/**
 * Cloudflare Pages Function: GET /api/lessons
 *
 * Режимы:
 *   GET /api/lessons          → возвращает public/lessons/index.json (список всех уроков)
 *   GET /api/lessons?file=X  → возвращает public/lessons/X (конкретный урок)
 *
 * Читает файлы напрямую из GitHub API — без ожидания CF Pages деплоя.
 * Env vars: GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH
 */

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(data, status = 200) {
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
  // Кодируем каждый сегмент отдельно — кириллица в URL иначе даёт 403/404
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

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: cors });
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const githubToken = env.GITHUB_TOKEN;
  const repo        = env.GITHUB_REPO   || "AlexBabetov/01-zhivoi-urok-constructor";
  const branch      = env.GITHUB_BRANCH || "main";

  const ghHeaders = {
    "Authorization":       `Bearer ${githubToken}`,
    "Accept":              "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent":          "ZhivoyUrok360-Constructor/1.0",
  };

  // ?file=литература-профиль/10/41_...json  → читаем конкретный урок
  const fileParam = new URL(request.url).searchParams.get("file");

  try {
    if (fileParam) {
      // Защита от path traversal
      if (fileParam.includes("..") || fileParam.startsWith("/")) {
        return json({ error: "Недопустимый путь" }, 400);
      }
      const content = await fetchGithubFile(repo, branch, `public/lessons/${fileParam}`, ghHeaders);
      if (content === null) return json({ error: "Урок не найден" }, 404);
      return json(JSON.parse(content));
    }

    // По умолчанию — индекс
    const content = await fetchGithubFile(repo, branch, "public/lessons/index.json", ghHeaders);
    if (content === null) return json([]); // индекс ещё не создан
    const lessons = JSON.parse(content);
    return json(Array.isArray(lessons) ? lessons : []);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
