/**
 * Netlify Function: notify-admin
 * Отправляет email администратору о новой заявке на регистрацию
 *
 * Требует env variables:
 *   RESEND_API_KEY        — API ключ Resend.com
 *   ADMIN_EMAIL           — email администратора (по умолчанию babetov_aa@koriphey.ru)
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const resendKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.ADMIN_EMAIL || "babetov_aa@koriphey.ru";

  if (!resendKey) {
    console.warn("[notify-admin] RESEND_API_KEY не задан — уведомление не отправлено");
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, skipped: true }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Неверный JSON" }) };
  }

  const { name, email, school, city } = body;

  const html = `
<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #1e3a5f, #1a3a4a); padding: 24px 28px; border-radius: 12px 12px 0 0;">
    <div style="font-size: 22px; font-weight: 800; color: #fff;">🎓 Живой урок 360</div>
    <div style="font-size: 13px; color: rgba(255,255,255,0.7); margin-top: 4px;">Новая заявка на регистрацию</div>
  </div>
  <div style="background: #f8fafc; padding: 24px 28px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 15px; color: #1e293b; margin: 0 0 20px;">Поступила новая заявка от учителя:</p>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <tr><td style="padding: 8px 0; color: #64748b; width: 120px;">Имя:</td><td style="padding: 8px 0; color: #1e293b; font-weight: 600;">${name || "—"}</td></tr>
      <tr><td style="padding: 8px 0; color: #64748b;">Email:</td><td style="padding: 8px 0; color: #1e293b; font-weight: 600;">${email}</td></tr>
      <tr><td style="padding: 8px 0; color: #64748b;">Город:</td><td style="padding: 8px 0; color: #1e293b;">${city || "—"}</td></tr>
      <tr><td style="padding: 8px 0; color: #64748b;">Школа:</td><td style="padding: 8px 0; color: #1e293b;">${school || "—"}</td></tr>
    </table>
    <p style="font-size: 13px; color: #64748b; margin: 20px 0 0;">Войдите в Конструктор уроков и откройте панель <strong>«Заявки»</strong>, чтобы одобрить или отклонить.</p>
  </div>
</div>
  `.trim();

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Живой урок 360 <info@koriphey.ru>",
        to: [adminEmail],
        subject: `📩 Новая заявка: ${name || email}`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Resend error ${res.status}: ${err.message || res.statusText}`);
    }

    console.log(`[notify-admin] Уведомление отправлено на ${adminEmail}`);
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error("[notify-admin] ERROR:", err.message);
    // Не фатально — заявка уже в Supabase
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, warning: err.message }) };
  }
};
