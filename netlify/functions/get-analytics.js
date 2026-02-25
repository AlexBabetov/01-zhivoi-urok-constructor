/**
 * Netlify Function: get-analytics
 * Возвращает статистику активности пользователей
 * Доступно только для admin
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "" };
  }
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: "Supabase не настроен" }),
    };
  }

  // Проверяем что запрос от admin
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Требуется авторизация" }) };
  }

  try {
    const token = authHeader.replace("Bearer ", "");
    const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { "Authorization": `Bearer ${token}`, "apikey": serviceKey },
    });

    if (!userResp.ok) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Недействительный токен" }) };
    }

    const userData = await userResp.json();
    const role = userData.user_metadata?.role;
    if (role !== "admin") {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: "Только для admin" }) };
    }
  } catch (e) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Ошибка проверки токена" }) };
  }

  try {
    // 1. Список всех пользователей
    const usersResp = await fetch(
      `${supabaseUrl}/rest/v1/rpc/get_users_analytics`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({}),
      }
    );

    // Fallback: прямой запрос к auth.users через service role
    const authUsersResp = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?per_page=100`,
      {
        headers: {
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
        },
      }
    );

    let users = [];
    if (authUsersResp.ok) {
      const authData = await authUsersResp.json();
      users = (authData.users || []).map((u) => ({
        id: u.id,
        email: u.email,
        role: u.user_metadata?.role || "teacher",
        status: u.user_metadata?.status || null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        confirmed_at: u.confirmed_at,
      }));
    }

    // 2. События из lesson_events
    const eventsResp = await fetch(
      `${supabaseUrl}/rest/v1/lesson_events?select=*&order=created_at.desc&limit=500`,
      {
        headers: {
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
        },
      }
    );

    let events = [];
    if (eventsResp.ok) {
      events = await eventsResp.json();
    }

    // 3. Агрегация по пользователю
    const statsByUser = {};
    for (const e of events) {
      if (!statsByUser[e.user_email]) {
        statsByUser[e.user_email] = { generated: 0, saved: 0, subjects: new Set() };
      }
      if (e.event_type === "generated") statsByUser[e.user_email].generated++;
      if (e.event_type === "saved") statsByUser[e.user_email].saved++;
      if (e.subject) statsByUser[e.user_email].subjects.add(e.subject);
    }

    // Сериализуем Set
    for (const key of Object.keys(statsByUser)) {
      statsByUser[key].subjects = Array.from(statsByUser[key].subjects);
    }

    // 4. Общая статистика
    const totalGenerated = events.filter((e) => e.event_type === "generated").length;
    const totalSaved = events.filter((e) => e.event_type === "saved").length;
    const activeUsers = Object.keys(statsByUser).length;

    // 5. По дням (последние 14 дней)
    const byDay = {};
    for (const e of events) {
      const day = e.created_at?.substring(0, 10);
      if (!day) continue;
      if (!byDay[day]) byDay[day] = { generated: 0, saved: 0 };
      if (e.event_type === "generated") byDay[day].generated++;
      if (e.event_type === "saved") byDay[day].saved++;
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        summary: {
          total_users: users.filter((u) => u.role !== "admin").length,
          active_users: activeUsers,
          total_generated: totalGenerated,
          total_saved: totalSaved,
        },
        users: users.map((u) => ({
          ...u,
          stats: statsByUser[u.email] || { generated: 0, saved: 0, subjects: [] },
        })),
        by_day: byDay,
        recent_events: events.slice(0, 20),
      }),
    };
  } catch (err) {
    console.error("[get-analytics] ERROR:", err.message);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: "Ошибка получения аналитики: " + err.message }),
    };
  }
};
