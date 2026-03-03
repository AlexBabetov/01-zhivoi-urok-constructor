/**
 * Vercel Edge Function: GET /api/courses
 * Зеркало netlify/functions/courses.js для деплоя на Vercel.
 *
 * GET /api/courses               → public/courses/index.json (каталог курсов)
 * GET /api/courses?file=path.md  → public/courses/{file}    (Markdown сценария модуля)
 *
 * Env vars: GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH
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

function base64ToUtf8(b64) {
  const clean  = b64.replace(/\n/g, "");
  const binary = atob(clean);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function fetchGithubFile(repo, branch, filePath, ghHeaders) {
  const encoded = filePath.split("/").map(s => encodeURIComponent(s)).join("/");
  const url = `https://api.github.com/repos/${repo}/contents/${encoded}?ref=${branch}`;
  const resp = await fetch(url, { headers: ghHeaders });
  if (resp.status === 404) return null;
  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    throw new Error(`GitHub ${resp.status}: ${err.slice(0, 200)}`);
  }
  const data = await resp.json();
  return base64ToUtf8(data.content);
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  if (req.method !== "GET") return jsonResp({ error: "Method not allowed" }, 405);

  const githubToken = process.env.GITHUB_TOKEN;
  const repo        = process.env.GITHUB_REPO   || "AlexBabetov/01-zhivoi-urok-constructor";
  const branch      = process.env.GITHUB_BRANCH || "main";

  if (!githubToken) return jsonResp({ error: "GITHUB_TOKEN не задан" }, 500);

  const ghHeaders = {
    "Authorization":        `Bearer ${githubToken}`,
    "Accept":               "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent":           "ZhivoyUrok360-Constructor/1.0",
  };

  const fileParam = new URL(req.url).searchParams.get("file");

  try {
    // ── Режим 2: конкретный файл модуля (Markdown) ──────────────────────────
    if (fileParam) {
      if (fileParam.includes("..") || fileParam.startsWith("/")) {
        return jsonResp({ error: "Недопустимый путь" }, 400);
      }
      const content = await fetchGithubFile(repo, branch, `public/courses/${fileParam}`, ghHeaders);
      if (content === null) return jsonResp({ error: "Модуль не найден" }, 404);
      // Markdown возвращаем обёрнутым в JSON (клиент рендерит поле content)
      return jsonResp({ content });
    }

    // ── Режим 1: каталог курсов ─────────────────────────────────────────────
    const content = await fetchGithubFile(repo, branch, "public/courses/index.json", ghHeaders);
    if (content === null) return jsonResp([]);
    const courses = JSON.parse(content);
    return jsonResp(Array.isArray(courses) ? courses : []);

  } catch (e) {
    return jsonResp({ error: e.message }, 500);
  }
}
