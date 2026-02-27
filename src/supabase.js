import { createClient } from "@supabase/supabase-js";

// Браузер обращается через прокси /_supabase на нашем домене.
// Netlify: редирект прописан в netlify.toml [[redirects]].
// Cloudflare Pages: прокси через functions/_supabase/[[catchall]].js.
// Это исключает прямые запросы к supabase.co — сайт доступен в РФ без VPN.
// Сервер-сайд функции по-прежнему используют SUPABASE_URL напрямую (env var).
const supabaseUrl = process.env.REACT_APP_SUPABASE_PROXY_URL
  // Автодетект: если env var не задан — строим прокси-URL из текущего домена.
  // Работает на любом хостинге (Netlify, Cloudflare Pages, localhost).
  || (typeof window !== "undefined" ? `${window.location.origin}/_supabase` : null)
  || process.env.REACT_APP_SUPABASE_URL
  || "https://placeholder.supabase.co";

const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseAnonKey) {
  console.warn(
    "Supabase env vars not set. Auth will not work.\n" +
    "Добавьте REACT_APP_SUPABASE_ANON_KEY в Netlify."
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey || "placeholder"
);
