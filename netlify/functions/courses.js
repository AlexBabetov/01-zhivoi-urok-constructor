/**
 * Netlify Function: courses
 * Публичное чтение каталога авторских курсов из GitHub (без авторизации).
 *
 * GET /api/courses               → public/courses/index.json (каталог курсов)
 * GET /api/courses?file=path.md  → public/courses/{file} (Markdown сценария модуля)
 *
 * Env variables:
 *   GITHUB_TOKEN  — PAT с правами contents:read
 *   GITHUB_REPO   — AlexBabetov/01-zhivoi-urok-constructor
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: { ...CORS }, body: "" };
  }
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const token = process.env.GITHUB_TOKEN;
  const repo  = process.env.GITHUB_REPO || "AlexBabetov/01-zhivoi-urok-constructor";
  const apiBase = `https://api.github.com/repos/${repo}/contents`;

  const ghHeaders = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  async function getFile(path) {
    const resp = await fetch(`${apiBase}/${path}`, { headers: ghHeaders });
    if (resp.status === 404) return null;
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(`GitHub GET ${path}: ${resp.status} — ${err.message || resp.statusText}`);
    }
    const json = await resp.json();
    return Buffer.from(json.content, "base64").toString("utf-8");
  }

  const file = event.queryStringParameters?.file;

  try {
    // ── Режим 2: конкретный файл модуля (Markdown) ────────────────────────
    if (file) {
      if (!/^[a-zа-я0-9_\-/.]+$/i.test(file) || file.includes("..")) {
        return {
          statusCode: 400,
          headers: { ...CORS, "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Недопустимый путь" }),
        };
      }

      const content = await getFile(`public/courses/${file}`);
      if (!content) {
        return {
          statusCode: 404,
          headers: { ...CORS, "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Модуль не найден" }),
        };
      }

      // Markdown возвращаем как JSON-обёртку (клиент рендерит поле content)
      return {
        statusCode: 200,
        headers: { ...CORS, "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      };
    }

    // ── Режим 1: каталог курсов ───────────────────────────────────────────
    const content = await getFile("public/courses/index.json");
    if (!content) {
      return {
        statusCode: 200,
        headers: { ...CORS, "Content-Type": "application/json" },
        body: JSON.stringify([]),
      };
    }

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: content,
    };

  } catch (err) {
    console.error("[courses] ERROR:", err.message);
    return {
      statusCode: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Ошибка чтения каталога: " + err.message }),
    };
  }
};
