/**
 * CF Pages Function: прокси Supabase через /_supabase/*
 *
 * Cloudflare Pages не поддерживает proxy-rewrite (status 200) к внешним доменам
 * через _redirects. Нужна полноценная Function.
 *
 * Браузер → /_supabase/auth/v1/token → этот файл → supabase.co/auth/v1/token
 */

const SUPABASE_URL = "https://wogcofceyeeouxokzpqy.supabase.co";

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // Убираем /_supabase из пути и проксируем на supabase.co
  const supabasePath = url.pathname.replace(/^\/_supabase/, "");
  const targetUrl = `${SUPABASE_URL}${supabasePath}${url.search}`;

  // Копируем исходный запрос, меняя только URL и origin
  const proxyRequest = new Request(targetUrl, {
    method: request.method,
    headers: (() => {
      const headers = new Headers(request.headers);
      headers.set("origin", SUPABASE_URL);
      // Убираем host — браузер подставит неправильный
      headers.delete("host");
      return headers;
    })(),
    body: ["GET", "HEAD"].includes(request.method) ? null : request.body,
    redirect: "follow",
  });

  try {
    const response = await fetch(proxyRequest);

    // Пробрасываем ответ с CORS-заголовками
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    responseHeaders.set(
      "Access-Control-Allow-Headers",
      "authorization, x-client-info, apikey, content-type"
    );

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Supabase proxy error", detail: err.message }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
