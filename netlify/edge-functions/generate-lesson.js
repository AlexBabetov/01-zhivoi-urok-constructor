/**
 * Netlify Edge Function: generate-lesson
 * Streaming-прокси к Claude API с keepalive-пингами.
 * Пинги (": ping\n\n") каждые 3 сек не дают CDN убить соединение
 * до прихода первого токена от Claude.
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

  // TransformStream позволяет писать keepalive-пинги + данные от Claude
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();

  // Пинг каждые 3 секунды — CDN видит активность, браузер игнорирует
  const pingTimer = setInterval(() => {
    writer.write(enc.encode(": ping\n\n")).catch(() => clearInterval(pingTimer));
  }, 3000);

  // Запускаем fetch к Claude и стримим результат асинхронно
  (async () => {
    try {
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

      clearInterval(pingTimer);

      if (!anthropicRes.ok) {
        const err = await anthropicRes.json();
        const msg = err.error?.message || "Claude API error";
        writer.write(enc.encode(`data: ${JSON.stringify({ type: "error", error: { message: msg } })}\n\n`));
        writer.close();
        return;
      }

      // Форвардим SSE-поток от Claude напрямую
      const reader = anthropicRes.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writer.write(value);
      }
    } catch (err) {
      clearInterval(pingTimer);
      writer.write(enc.encode(`data: ${JSON.stringify({ type: "error", error: { message: err.message } })}\n\n`));
    } finally {
      clearInterval(pingTimer);
      writer.close();
    }
  })();

  return new Response(readable, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
};
