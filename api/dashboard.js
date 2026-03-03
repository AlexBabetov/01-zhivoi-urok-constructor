/**
 * GET /api/dashboard?days=30
 *
 * Дашборд завуча — агрегация рефлексий учителей.
 * Требует JWT с ролью admin или superadmin.
 *
 * Response:
 * {
 *   period_days: 30,
 *   summary: { reflections_total, avg_rating, teachers_with_reflections },
 *   by_teacher: [ { user_id, total_lessons, avg_rating, timing_ok_count,
 *                   high_energy_count, low_energy_count, last_reflection_at } ],
 *   by_subject: [ { subject, grade, total, avg_rating, typical_mood, typical_wellbeing } ],
 *   recent:     [ { id, subject, grade, topic, rating, timing, mood, wellbeing, saved_at } ]
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
      headers: { "Authorization": authHeader, "apikey": serviceKey },
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

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return json({ error: "Сервер не настроен" }, 500);

  const authHeader = req.headers.get("Authorization");
  const adminUser  = await verifyAdmin(authHeader, supabaseUrl, serviceKey);
  if (!adminUser) return json({ error: "Нет доступа. Требуется роль admin." }, 403);

  const url  = new URL(req.url);
  const days = Math.min(parseInt(url.searchParams.get("days") || "30", 10), 365);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  try {
    // Запросы к Supabase — параллельно
    const headers = {
      "apikey":        serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
    };

    const [byTeacherResp, bySubjectResp, recentResp] = await Promise.all([
      // Вьюха: агрегат по учителю (все время, не фильтруется — вьюха статичная)
      fetch(`${supabaseUrl}/rest/v1/reflections_by_teacher?order=last_reflection_at.desc`, { headers }),
      // Вьюха: агрегат по предмету+классу
      fetch(`${supabaseUrl}/rest/v1/reflections_by_subject?order=avg_rating.asc`, { headers }),
      // Последние рефлексии за период
      fetch(
        `${supabaseUrl}/rest/v1/reflections?saved_at=gte.${encodeURIComponent(since)}&order=saved_at.desc&limit=30&select=id,subject,grade,topic,rating,timing,mood,wellbeing,saved_at`,
        { headers }
      ),
    ]);

    const byTeacher = byTeacherResp.ok ? await byTeacherResp.json() : [];
    const bySubject = bySubjectResp.ok ? await bySubjectResp.json() : [];
    const recent    = recentResp.ok    ? await recentResp.json()    : [];

    // Фильтруем byTeacher по дате (вьюха не фильтрует, фильтруем в JS)
    const byTeacherFiltered = days < 365
      ? byTeacher.filter(r => r.last_reflection_at && r.last_reflection_at >= since)
      : byTeacher;

    // Суммарная статистика
    const totalReflections = recent.length; // за период
    const avgRating = recent.length > 0
      ? +(recent.reduce((s, r) => s + (r.rating || 0), 0) / recent.length).toFixed(1)
      : null;
    const teachersWithReflections = new Set(byTeacherFiltered.map(r => r.user_id)).size;

    return json({
      period_days: days,
      summary: {
        reflections_total:        totalReflections,
        avg_rating:               avgRating,
        teachers_with_reflections: teachersWithReflections,
      },
      by_teacher: byTeacherFiltered,
      by_subject: bySubject,
      recent,
    });

  } catch (err) {
    return json({ error: "Ошибка загрузки дашборда: " + err.message }, 500);
  }
}
