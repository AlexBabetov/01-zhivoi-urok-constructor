/**
 * Netlify Edge Function: generate-lesson
 * Проксирует запрос к Claude API со streaming.
 * Edge Functions не имеют таймаута CDN — поток течёт напрямую в браузер.
 */

export default async (request, context) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: cors });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Нет API ключа" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: "Неверный JSON" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } }); }

  const { system, userMessage, model = "claude-3-5-haiku-20241022", max_tokens = 2000 } = body;

  // Вызов Claude API со streaming=true
  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
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

  if (!upstream.ok) {
    const err = await upstream.json().catch(() => ({}));
    return new Response(JSON.stringify({ error: err.error?.message || `Claude API ${upstream.status}` }), {
      status: upstream.status, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Пересылаем SSE-поток напрямую — токены текут в браузер по мере генерации
  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...cors,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
};
