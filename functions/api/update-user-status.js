/**
 * Cloudflare Pages Function: /api/update-user-status
 * Обновляет статус пользователя (approved/rejected) и отправляет email. Только admin.
 */

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

async function sendEmail(resendKey, { to, subject, html }) {
  if (!resendKey) return;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Живой урок 360 <info@koriphey.ru>", to: [to], subject, html }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Resend ${res.status}: ${err.message}`);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: cors });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const supabaseUrl = env.SUPABASE_URL;
  const serviceKey  = env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey   = env.RESEND_API_KEY;
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

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "Неверный JSON" }, 400); }

  const { userId, status, userEmail, userName } = body;
  if (!userId || !["approved", "rejected"].includes(status)) {
    return json({ error: "Нужны: userId, status (approved|rejected)" }, 400);
  }

  const updateRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${serviceKey}`, "apikey": serviceKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_metadata: { status } }),
  });
  if (!updateRes.ok) {
    const err = await updateRes.json().catch(() => ({}));
    return json({ error: `Supabase update error: ${err.message || updateRes.status}` }, 500);
  }

  if (userEmail && resendKey) {
    const displayName = userName || userEmail;
    try {
      if (status === "approved") {
        await sendEmail(resendKey, {
          to: userEmail,
          subject: "✅ Доступ к Конструктору уроков одобрен",
          html: `
<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;">
  <div style="background:linear-gradient(135deg,#1e3a5f,#1a3a4a);padding:24px 28px;border-radius:12px 12px 0 0;">
    <div style="font-size:22px;font-weight:800;color:#fff;">🎓 Живой урок 360</div>
  </div>
  <div style="background:#f0fdf4;padding:24px 28px;border:1px solid #bbf7d0;border-top:none;border-radius:0 0 12px 12px;">
    <div style="font-size:32px;margin-bottom:12px;">✅</div>
    <p style="font-size:16px;font-weight:700;color:#15803d;margin:0 0 12px;">Добро пожаловать, ${displayName}!</p>
    <p style="font-size:14px;color:#1e293b;margin:0 0 16px;">Ваша заявка <strong>одобрена</strong>. Теперь вы можете войти и создавать уроки.</p>
    <a href="https://urok360.koriphey.ru" style="display:inline-block;background:#1e3a5f;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;font-size:14px;">Открыть Конструктор →</a>
  </div>
</div>`.trim(),
        });
      } else {
        await sendEmail(resendKey, {
          to: userEmail,
          subject: "Заявка на доступ к Конструктору уроков",
          html: `
<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;">
  <div style="background:linear-gradient(135deg,#1e3a5f,#1a3a4a);padding:24px 28px;border-radius:12px 12px 0 0;">
    <div style="font-size:22px;font-weight:800;color:#fff;">🎓 Живой урок 360</div>
  </div>
  <div style="background:#fef2f2;padding:24px 28px;border:1px solid #fecaca;border-top:none;border-radius:0 0 12px 12px;">
    <p style="font-size:15px;color:#1e293b;margin:0 0 12px;">Здравствуйте, ${displayName}.</p>
    <p style="font-size:14px;color:#475569;margin:0 0 16px;">К сожалению, ваша заявка не была одобрена на данный момент.</p>
    <p style="font-size:13px;color:#64748b;margin:0;">Вопросы: <a href="mailto:info@koriphey.ru" style="color:#1e3a5f;">info@koriphey.ru</a></p>
  </div>
</div>`.trim(),
        });
      }
    } catch (emailErr) {
      console.warn("[update-user-status] Email error:", emailErr.message);
    }
  }

  return json({ ok: true, userId, status });
}
