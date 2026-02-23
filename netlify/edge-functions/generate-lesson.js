/**
 * Netlify Edge Function: generate-lesson
 * Стриминг-прокси к Claude API — не ждёт полного ответа,
 * а пересылает SSE-поток напрямую в браузер.
 * Это исключает 504/Inactivity Timeout.
 *
 * Требует env variable: ANTHROPIC_API_KEY
 */

export default async (request, context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Сервер не настроен: отсутствует API ключ" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Неверный JSON в запросе" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const {
    system,
    userMessage,
    model = "claude-haiku-4-5-20251001",
    max_tokens = 3000,
  } = body;

  if (!system || !userMessage) {
    return new Response(
      JSON.stringify({ error: "Обязательные поля: system, userMessage" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens,
      stream: true,
      system,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!anthropicRes.ok) {
    const error = await anthropicRes.json();
    return new Response(
      JSON.stringify({ error: error.error?.message || "Claude API вернул ошибку" }),
      { status: anthropicRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Пересылаем SSE-поток напрямую в браузер — соединение активно всё время генерации
  return new Response(anthropicRes.body, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
};

export const config = {
  path: "/api/generate-lesson",
};
