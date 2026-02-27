import { createClient } from "@supabase/supabase-js";

// Браузер обращается через прокси /_supabase на нашем домене.
// Netlify: редирект прописан в netlify.toml [[redirects]].
// Cloudflare Pages: прокси через functions/_supabase/[[catchall]].js.
// Это исключает прямые запросы к supabase.co — сайт доступен в РФ без VPN.
// Сервер-сайд функции по-прежнему используют SUPABASE_URL напрямую (env var).

// Anon key — публичный ключ (не секретный), безопасно хранить в коде.
// Он же прописан в netlify.toml [build.environment] для Netlify-сборок.
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvZ2NvZmNleWVlb3V4b2t6cHF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjUwNDEsImV4cCI6MjA4NzYwMTA0MX0.fWXd3TnEIyXEOE8USvTVbITHr6TqYe-2dtA51511Wc8";

const supabaseUrl = process.env.REACT_APP_SUPABASE_PROXY_URL
  // Автодетект: если env var не задан — строим прокси-URL из текущего домена.
  // Работает на любом хостинге (Netlify, Cloudflare Pages, localhost).
  || (typeof window !== "undefined" ? `${window.location.origin}/_supabase` : null)
  || process.env.REACT_APP_SUPABASE_URL
  || "https://wogcofceyeeouxokzpqy.supabase.co";

const supabaseAnonKey =
  process.env.REACT_APP_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
