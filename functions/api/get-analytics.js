/**
 * Cloudflare Pages Function: /api/get-analytics
 * Аналитика активности пользователей. Только admin.
 */

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: cors });
}

export async function onRequestGet(context) {
  const { request, env } = context;

  const supabaseUrl = env.SUPABASE_URL;
  const serviceKey  = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return json({ error: "Supabase не настроен" }, 500);

  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Требуется авторизация" }, 401);

  try {
    const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { "Authorization": `Bearer ${token}`, "apikey": serviceKey },
    });
    if (!userResp.ok) return json({ error: "Недействительный токен" }, 401);
    const userData = await userResp.json();
    if (userData.user_metadata?.role !== "admin") return json({ error: "Только для admin" }, 403);
  } catch {
    return json({ error: "Ошибка проверки токена" }, 401);
  }

  try {
    const [authUsersResp, eventsResp] = await Promise.all([
      fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=100`, {
        headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` },
      }),
      fetch(`${supabaseUrl}/rest/v1/lesson_events?select=*&order=created_at.desc&limit=500`, {
        headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` },
      }),
    ]);

    let users = [];
    if (authUsersResp.ok) {
      const authData = await authUsersResp.json();
      users = (authData.users || []).map(u => ({
        id: u.id, email: u.email,
        role: u.user_metadata?.role || "teacher",
        status: u.user_metadata?.status || null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      }));
    }

    let events = [];
    if (eventsResp.ok) events = await eventsResp.json();

    const statsByUser = {};
    for (const e of events) {
      if (!statsByUser[e.user_email]) {
        statsByUser[e.user_email] = { generated: 0, saved: 0, subjects: new Set() };
      }
      if (e.event_type === "generated") statsByUser[e.user_email].generated++;
      if (e.event_type === "saved")     statsByUser[e.user_email].saved++;
      if (e.subject) statsByUser[e.user_email].subjects.add(e.subject);
    }
    for (const k of Object.keys(statsByUser)) {
      statsByUser[k].subjects = Array.from(statsByUser[k].subjects);
    }

    const activeEmails = new Set(events.map(e => e.user_email));
    const byDay = {};
    for (const e of events) {
      const day = e.created_at?.slice(0, 10);
      if (day) {
        if (!byDay[day]) byDay[day] = { generated: 0, saved: 0 };
        if (e.event_type === "generated") byDay[day].generated++;
        if (e.event_type === "saved")     byDay[day].saved++;
      }
    }

    return json({
      summary: {
        total_users:     users.length,
        active_users:    activeEmails.size,
        total_generated: events.filter(e => e.event_type === "generated").length,
        total_saved:     events.filter(e => e.event_type === "saved").length,
      },
      users: users.map(u => ({ ...u, stats: statsByUser[u.email] || { generated: 0, saved: 0, subjects: [] } })),
      by_day: byDay,
      recent_events: events.slice(0, 20),
    });
  } catch (err) {
    return json({ error: "Ошибка аналитики: " + err.message }, 500);
  }
}
