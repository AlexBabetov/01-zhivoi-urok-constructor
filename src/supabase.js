import { createClient } from "@supabase/supabase-js";

// Браузер обращается через прокси /_supabase на нашем домене (netlify.toml).
// Это исключает прямые запросы к supabase.co — сайт доступен в РФ без VPN.
// Сервер-сайд функции по-прежнему используют SUPABASE_URL напрямую (env var в Netlify).
const supabaseUrl = process.env.REACT_APP_SUPABASE_PROXY_URL
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
