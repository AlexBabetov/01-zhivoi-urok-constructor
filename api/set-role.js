/**
 * POST /api/set-role
 * Body: { userId: string, role: 'teacher' | 'admin' | 'superadmin' }
 *
 * Устанавливает роль пользователю. Требует JWT с ролью admin или superadmin.
 * superadmin может назначать superadmin; admin — только teacher/admin.
 */

export const config = { runtime: 'edge' };

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return json({ error: "Сервер не настроен" }, 500);

  const authHeader = req.headers.get("Authorization");
  const adminUser  = await verifyAdmin(authHeader, supabaseUrl, serviceKey);
  if (!adminUser) return json({ error: "Нет доступа. Требуется роль admin." }, 403);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Неверный JSON" }, 400); }

  const { userId, role } = body || {};
  if (!userId) return json({ error: "userId обязателен" }, 400);

  const ALLOWED_ROLES = ["teacher", "admin"];
  if (adminUser.user_metadata?.role === "superadmin") ALLOWED_ROLES.push("superadmin");
  if (!ALLOWED_ROLES.includes(role)) {
    return json({ error: `Недопустимая роль. Разрешено: ${ALLOWED_ROLES.join(", ")}` }, 400);
  }

  // Нельзя менять свою собственную роль
  if (userId === adminUser.id) {
    return json({ error: "Нельзя изменить собственную роль" }, 400);
  }

  // Обновляем user_metadata через Supabase Admin API
  const resp = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "apikey":        serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      user_metadata: { role },
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    return json({ error: "Ошибка Supabase: " + err }, 500);
  }

  const updated = await resp.json();
  return json({
    ok:    true,
    email: updated.email,
    role:  updated.user_metadata?.role,
  });
}
