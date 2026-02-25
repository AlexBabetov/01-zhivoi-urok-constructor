/**
 * Netlify Function: list-pending-users
 * Возвращает список пользователей со статусом "pending"
 *
 * Доступно только администраторам (role === "admin" в user_metadata JWT).
 *
 * Требует env variables:
 *   SUPABASE_URL              — URL проекта Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — Service role key (не anon!)
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
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: "Supabase env vars не заданы" }),
    };
  }

  // Проверяем JWT токен вызывающего
  const authHeader = event.headers["authorization"] || event.headers["Authorization"] || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  if (!token) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Требуется авторизация" }) };
  }

  // Получаем данные пользователя по его JWT через Supabase Auth API
  const meRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "apikey": serviceRoleKey,
    },
  });

  if (!meRes.ok) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Неверный токен" }) };
  }

  const me = await meRes.json();
  const role = me?.user_metadata?.role;

  if (role !== "admin") {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: "Доступ запрещён" }) };
  }

  // Получаем список всех пользователей через Admin API
  // Supabase Admin API: GET /auth/v1/admin/users
  const usersRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=500`, {
    headers: {
      "Authorization": `Bearer ${serviceRoleKey}`,
      "apikey": serviceRoleKey,
    },
  });

  if (!usersRes.ok) {
    const err = await usersRes.json().catch(() => ({}));
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: `Supabase Admin API error: ${err.message || usersRes.status}` }),
    };
  }

  const { users: allUsers } = await usersRes.json();

  // Фильтруем pending
  const pending = (allUsers || [])
    .filter((u) => u.user_metadata?.status === "pending")
    .map((u) => ({
      id: u.id,
      email: u.email,
      name: u.user_metadata?.name || null,
      school: u.user_metadata?.school || null,
      city: u.user_metadata?.city || null,
      created_at: u.created_at,
    }))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); // старые сверху

  console.log(`[list-pending-users] Найдено pending: ${pending.length}`);

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ users: pending }),
  };
};
