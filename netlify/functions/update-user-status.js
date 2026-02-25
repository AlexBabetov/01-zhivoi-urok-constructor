/**
 * Netlify Function: update-user-status
 * Обновляет статус пользователя (approved / rejected) и отправляет email.
 *
 * Доступно только администраторам.
 *
 * Требует env variables:
 *   SUPABASE_URL              — URL проекта Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — Service role key (не anon!)
 *   RESEND_API_KEY            — API ключ Resend.com
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

async function sendEmail(resendKey, { to, subject, html }) {
  if (!resendKey) return;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Живой урок 360 <info@koriphey.ru>",
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Resend ${res.status}: ${err.message}`);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: "Supabase env vars не заданы" }),
    };
  }

  // Проверяем JWT вызывающего — только admin
  const authHeader = event.headers["authorization"] || event.headers["Authorization"] || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  if (!token) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Требуется авторизация" }) };
  }

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
  if (me?.user_metadata?.role !== "admin") {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: "Доступ запрещён" }) };
  }

  // Парсим тело запроса
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Неверный JSON" }) };
  }

  const { userId, status, userEmail, userName } = body;

  if (!userId || !["approved", "rejected"].includes(status)) {
    return {
      statusCode: 400,
      headers: CORS,
      body: JSON.stringify({ error: "Нужны: userId, status (approved|rejected)" }),
    };
  }

  // Обновляем user_metadata через Admin API
  const updateRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${serviceRoleKey}`,
      "apikey": serviceRoleKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_metadata: { status },
    }),
  });

  if (!updateRes.ok) {
    const err = await updateRes.json().catch(() => ({}));
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: `Supabase update error: ${err.message || updateRes.status}` }),
    };
  }

  console.log(`[update-user-status] ${userId} → ${status}`);

  // Отправляем email учителю
  if (userEmail && resendKey) {
    const displayName = userName || userEmail;
    try {
      if (status === "approved") {
        await sendEmail(resendKey, {
          to: userEmail,
          subject: "✅ Доступ к Конструктору уроков одобрен",
          html: `
<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #1e3a5f, #1a3a4a); padding: 24px 28px; border-radius: 12px 12px 0 0;">
    <div style="font-size: 22px; font-weight: 800; color: #fff;">🎓 Живой урок 360</div>
  </div>
  <div style="background: #f0fdf4; padding: 24px 28px; border: 1px solid #bbf7d0; border-top: none; border-radius: 0 0 12px 12px;">
    <div style="font-size: 32px; margin-bottom: 12px;">✅</div>
    <p style="font-size: 16px; font-weight: 700; color: #15803d; margin: 0 0 12px;">Добро пожаловать, ${displayName}!</p>
    <p style="font-size: 14px; color: #1e293b; margin: 0 0 16px;">Ваша заявка на доступ к Конструктору уроков <strong>одобрена</strong>. Теперь вы можете войти и создавать уроки.</p>
    <a href="https://constructor-zhivoi-urok.netlify.app" style="display: inline-block; background: #1e3a5f; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 14px;">Открыть Конструктор →</a>
  </div>
</div>
          `.trim(),
        });
      } else {
        await sendEmail(resendKey, {
          to: userEmail,
          subject: "Заявка на доступ к Конструктору уроков",
          html: `
<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #1e3a5f, #1a3a4a); padding: 24px 28px; border-radius: 12px 12px 0 0;">
    <div style="font-size: 22px; font-weight: 800; color: #fff;">🎓 Живой урок 360</div>
  </div>
  <div style="background: #fef2f2; padding: 24px 28px; border: 1px solid #fecaca; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 15px; color: #1e293b; margin: 0 0 12px;">Здравствуйте, ${displayName}.</p>
    <p style="font-size: 14px; color: #475569; margin: 0 0 16px;">К сожалению, ваша заявка на доступ к Конструктору уроков не была одобрена на данный момент.</p>
    <p style="font-size: 13px; color: #64748b; margin: 0;">Если у вас есть вопросы, напишите нам: <a href="mailto:info@koriphey.ru" style="color: #1e3a5f;">info@koriphey.ru</a></p>
  </div>
</div>
          `.trim(),
        });
      }
      console.log(`[update-user-status] Email отправлен → ${userEmail}`);
    } catch (emailErr) {
      console.warn("[update-user-status] Email error (не критично):", emailErr.message);
    }
  }

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ ok: true, userId, status }),
  };
};
