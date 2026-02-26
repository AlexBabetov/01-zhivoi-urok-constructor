/**
 * Cloudflare Pages Function: /api/list-pending-users
 * Возвращает список пользователей со статусом "pending". Только admin.
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
  if (!supabaseUrl || !serviceKey) return json({ error: "Supabase env vars не заданы" }, 500);

  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Требуется авторизация" }, 401);

  const meRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { "Authorization": `Bearer ${token}`, "apikey": serviceKey },
  });
  if (!meRes.ok) return json({ error: "Неверный токен" }, 401);

  const me = await meRes.json();
  if (me?.user_metadata?.role !== "admin") return json({ error: "Доступ запрещён" }, 403);

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
      id: u.id, email: u.email,
      name: u.user_metadata?.name || null,
      school: u.user_metadata?.school || null,
      city: u.user_metadata?.city || null,
      created_at: u.created_at,
    }))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  return json({ users: pending });
}
