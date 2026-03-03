/**
 * GET /api/get-analytics?days=30
 *
 * Возвращает агрегированную аналитику для AdminView → вкладка «Аналитика».
 * Требует JWT авторизации с ролью admin или superadmin.
 *
 * Response:
 * {
 *   summary: { total_users, active_users, total_generated, total_saved },
 *   users:   [ { id, email, role, status, created_at, generated, saved, last_active } ],
 *   recent_events: [ { id, user_email, event_type, subject, grade, lesson_title, created_at } ]
 * }
 */

export const config = { runtime: 'edge' };

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

async function verifyAdmin(authHeader, supabaseUrl, serviceKey) {
  if (!authHeader) return null;
  try {
    const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        "Authorization": authHeader,
        "apikey": serviceKey,
      },
    });
    if (!resp.ok) return null;
    const user = await resp.json();
    const role = user?.user_metadata?.role;
    if (!["admin", "superadmin"].includes(role)) return null;
    return user;
  } catch {
    return null;
  }
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl  = process.env.SUPABASE_URL;
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) return json({ error: "Сервер не настроен" }, 500);

  // Авторизация — только admin/superadmin
  const authHeader = req.headers.get("Authorization");
  const adminUser = await verifyAdmin(authHeader, supabaseUrl, serviceKey);
  if (!adminUser) return json({ error: "Нет доступа. Требуется роль admin." }, 403);

  // Период фильтрации
  const url  = new URL(req.url);
  const days = Math.min(parseInt(url.searchParams.get("days") || "30", 10), 365);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  try {
    // 1. Список всех пользователей (Supabase Auth Admin API)
    const usersResp = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=200`, {
      headers: {
        "apikey":        serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
      },
    });
    const usersData = usersResp.ok ? await usersResp.json() : { users: [] };
    const allUsers  = usersData.users || [];

    // 2. События из lesson_events за период
    const eventsResp = await fetch(
      `${supabaseUrl}/rest/v1/lesson_events?created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=500`,
      {
        headers: {
          "apikey":        serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
        },
      }
    );
    const events = eventsResp.ok ? await eventsResp.json() : [];

    // 3. Агрегируем события по пользователю
    const statsByUser = {};
    for (const ev of events) {
      const uid = ev.user_id || ev.user_email || "guest";
      if (!statsByUser[uid]) statsByUser[uid] = { generated: 0, saved: 0, last_active: null };
      if (ev.event_type === "generated") statsByUser[uid].generated++;
      if (ev.event_type === "saved")     statsByUser[uid].saved++;
      if (!statsByUser[uid].last_active || ev.created_at > statsByUser[uid].last_active) {
        statsByUser[uid].last_active = ev.created_at;
      }
    }

    // 4. Обогащаем список пользователей статистикой событий
    const usersEnriched = allUsers.map(u => {
      const stats = statsByUser[u.id] || { generated: 0, saved: 0, last_active: null };
      return {
        id:          u.id,
        email:       adminUser.user_metadata?.role === "superadmin" ? u.email : undefined,
        name:        u.user_metadata?.full_name || u.user_metadata?.name || null,
        role:        u.user_metadata?.role || "teacher",
        status:      u.user_metadata?.status || "approved",
        city:        u.user_metadata?.city || null,
        school:      u.user_metadata?.school || null,
        created_at:  u.created_at,
        generated:   stats.generated,
        saved:       stats.saved,
        last_active: stats.last_active,
      };
    });

    // 5. Считаем итоги
    const activeUserIds = new Set(
      events.filter(ev => ev.user_id).map(ev => ev.user_id)
    );
    const totalGenerated = events.filter(ev => ev.event_type === "generated").length;
    const totalSaved     = events.filter(ev => ev.event_type === "saved").length;

    // 6. Последние 20 событий для ленты
    const recentEvents = events.slice(0, 20).map(ev => ({
      id:           ev.id,
      user_email:   adminUser.user_metadata?.role === "superadmin" ? ev.user_email : null,
      event_type:   ev.event_type,
      subject:      ev.subject,
      grade:        ev.grade,
      lesson_title: ev.lesson_title,
      created_at:   ev.created_at,
    }));

    return json({
      period_days: days,
      summary: {
        total_users:    allUsers.length,
        active_users:   activeUserIds.size,
        total_generated: totalGenerated,
        total_saved:     totalSaved,
      },
      users:          usersEnriched,
      recent_events:  recentEvents,
    });

  } catch (err) {
    return json({ error: "Ошибка агрегации данных: " + err.message }, 500);
  }
}
