/**
 * Vercel Edge Function: GET /api/courses
 *
 * GET /api/courses               → /courses/index.json (каталог курсов из static build)
 * GET /api/courses?file=path.md  → /courses/{file}    (Markdown сценария модуля)
 *
 * Читает из статических файлов Vercel (public/courses/ → build/courses/).
 * Не требует GITHUB_TOKEN.
 */

export const config = { runtime: 'edge' };

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  if (req.method !== "GET") return jsonResp({ error: "Method not allowed" }, 405);

  const { origin } = new URL(req.url);
  const fileParam = new URL(req.url).searchParams.get("file");

  try {
    // ── Режим 2: конкретный файл модуля (Markdown) ──────────────────────────
    if (fileParam) {
      if (fileParam.includes("..") || fileParam.startsWith("/")) {
        return jsonResp({ error: "Недопустимый путь" }, 400);
      }
      const resp = await fetch(`${origin}/courses/${fileParam}`);
      if (!resp.ok) return jsonResp({ error: "Модуль не найден" }, 404);
      const content = await resp.text();
      return jsonResp({ content });
    }

    // ── Режим 1: каталог курсов ─────────────────────────────────────────────
    const resp = await fetch(`${origin}/courses/index.json`);
    if (!resp.ok) return jsonResp([]);
    const courses = await resp.json();
    return jsonResp(Array.isArray(courses) ? courses : []);

  } catch (e) {
    return jsonResp({ error: e.message }, 500);
  }
}
