/**
 * Vercel Edge Function: GET /api/list-pending-users
 * Возвращает список пользователей со статусом "pending". Только admin/superadmin.
 */

export const config = { runtime: "edge" };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: CORS });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return json({ error: "Supabase env vars не заданы" }, 500);

  // Проверяем токен
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Требуется авторизация" }, 401);

  const meRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { "Authorization": `Bearer ${token}`, "apikey": serviceKey },
  });
  if (!meRes.ok) return json({ error: "Неверный токен" }, 401);

  const me = await meRes.json();
  const role = me?.user_metadata?.role;
  if (!["admin", "superadmin"].includes(role)) return json({ error: "Доступ запрещён" }, 403);

  // Получаем всех пользователей
  const usersRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=500`, {
    headers: { "Authorization": `Bearer ${serviceKey}`, "apikey": serviceKey },
  });
  if (!usersRes.ok) {
    const err = await usersRes.json().catch(() => ({}));
    return json({ error: `Supabase Admin API error: ${err.message || usersRes.status}` }, 500);
  }

  const { users: allUsers } = await usersRes.json();
  const pending = (allUsers || [])
    .filter(u => u.user_metadata?.status === "pending")
    .map(u => ({
      id:         u.id,
      email:      u.email,
      name:       u.user_metadata?.name || u.user_metadata?.full_name || null,
      school:     u.user_metadata?.school || null,
      city:       u.user_metadata?.city || null,
      created_at: u.created_at,
    }))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  return json({ users: pending });
}
