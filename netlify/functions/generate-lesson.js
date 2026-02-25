/**
 * Netlify Function: generate-lesson
 * Прокси к Claude API для генерации уроков ЖУ360
 *
 * Требует env variable: ANTHROPIC_API_KEY
 * Netlify > Site settings > Environment variables
 */

exports.handler = async (event) => {
  // CORS headers — разрешаем только с нашего домена
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY не задан");
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Сервер не настроен: отсутствует API ключ" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Неверный JSON в запросе" }) };
  }

  const { system, userMessage, model = "claude-haiku-4-5", max_tokens = 4000 } = body;

  if (!system || !userMessage) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Обязательные поля: system, userMessage" }),
    };
  }

  // ── Логируем событие генерации в Supabase ─────────────
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  async function logEvent(eventData) {
    if (!supabaseUrl || !supabaseKey) return;
    try {
      await fetch(`${supabaseUrl}/rest/v1/lesson_events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Prefer": "return=minimal",
        },
        body: JSON.stringify(eventData),
      });
    } catch (e) {
      console.warn("[generate-lesson] Supabase log error:", e.message);
    }
  }

  // Извлекаем данные пользователя из заголовка Authorization
  let userId = null;
  let userEmail = null;
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (authHeader && supabaseKey) {
    try {
      const token = authHeader.replace("Bearer ", "");
      const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { "Authorization": `Bearer ${token}`, "apikey": supabaseKey },
      });
      if (userResp.ok) {
        const userData = await userResp.json();
        userId = userData.id;
        userEmail = userData.email;
      }
    } catch (e) {
      console.warn("[generate-lesson] Auth check error:", e.message);
    }
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens,
        system,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Claude API error:", data);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: data.error?.message || "Claude API вернул ошибку" }),
      };
    }

    // Логируем успешную генерацию
    if (userEmail) {
      const subject = body.subject || body.userMessage?.match(/предмет[:\s]+([^\n,]+)/i)?.[1] || null;
      const grade = body.grade || body.userMessage?.match(/класс[:\s]+([^\n,]+)/i)?.[1] || null;
      await logEvent({
        user_id: userId,
        user_email: userEmail,
        event_type: "generated",
        subject: subject?.trim() || null,
        grade: grade?.trim() || null,
      });
    }

    return { statusCode: 200, headers, body: JSON.stringify(data) };
  } catch (err) {
    console.error("Fetch error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Не удалось подключиться к Claude API: " + err.message }),
    };
  }
};
