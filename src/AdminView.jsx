import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

// ── Users Tab (Управление пользователями) ─────────────────────
const ROLE_LABELS = { teacher: "Учитель", admin: "Администратор", superadmin: "Суперадмин" };
const ROLE_COLORS = { teacher: "#64748b", admin: "#1e3a5f", superadmin: "#7c3aed" };

function UsersTab({ currentUser }) {
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [changing, setChanging]   = useState(null); // userId меняющийся прямо сейчас
  const [search, setSearch]       = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/api/get-analytics?days=365", {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Ошибка: ${res.status}`);
      const data = await res.json();
      setUsers(data.users || []);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const setRole = async (user, newRole) => {
    setChanging(user.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/api/set-role", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ userId: user.id, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
      // Обновляем локально
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u));
    } catch (e) { alert("Ошибка: " + e.message); }
    setChanging(null);
  };

  const filtered = users.filter(u =>
    !search ||
    (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.name  || "").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b", fontSize: 14 }}>
      ⏳ Загружаем пользователей...
    </div>
  );
  if (error) return (
    <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#dc2626" }}>
      ⚠️ {error}
      <button onClick={load} style={{ marginLeft: 12, background: "none", border: "none", cursor: "pointer", color: "#1e3a5f", fontWeight: 600 }}>Повторить</button>
    </div>
  );

  const isSuperadmin = currentUser?.user_metadata?.role === "superadmin";

  return (
    <div>
      {/* Поиск */}
      <input
        placeholder="🔍 Поиск по имени или email..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: "100%", padding: "9px 12px", fontSize: 13,
          border: "1.5px solid #e2e8f0", borderRadius: 10,
          marginBottom: 14, boxSizing: "border-box", outline: "none",
          fontFamily: "inherit",
        }}
      />

      {/* Список пользователей */}
      {filtered.map(u => {
        const isSelf = u.id === currentUser?.id;
        const isChanging = changing === u.id;
        const currentRole = u.role || "teacher";
        return (
          <div key={u.id} style={{
            border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "12px 16px",
            marginBottom: 8, background: "#f8fafc",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {u.name && (
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 2 }}>
                  {u.name}
                </div>
              )}
              {/* Email показываем только суперадмину */}
              {isSuperadmin && u.email && (
                <div style={{ fontSize: 12, color: "#64748b" }}>📧 {u.email}</div>
              )}
              {!isSuperadmin && (
                <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace" }}>
                  {u.id ? u.id.slice(0, 12) + "…" : "—"}
                </div>
              )}
            </div>

            {/* Текущая роль */}
            <div style={{
              fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
              background: (ROLE_COLORS[currentRole] || "#64748b") + "18",
              color: ROLE_COLORS[currentRole] || "#64748b",
              whiteSpace: "nowrap",
            }}>
              {ROLE_LABELS[currentRole] || currentRole}
            </div>

            {/* Кнопки смены роли */}
            {!isSelf && (
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {currentRole !== "teacher" && (
                  <button
                    onClick={() => setRole(u, "teacher")}
                    disabled={isChanging}
                    style={{
                      fontSize: 12, padding: "5px 12px", borderRadius: 8, cursor: "pointer",
                      border: "1.5px solid #e2e8f0", background: "#fff", color: "#64748b",
                      fontWeight: 600, opacity: isChanging ? 0.5 : 1,
                    }}
                  >
                    {isChanging ? "…" : "→ Учитель"}
                  </button>
                )}
                {currentRole !== "admin" && (
                  <button
                    onClick={() => setRole(u, "admin")}
                    disabled={isChanging}
                    style={{
                      fontSize: 12, padding: "5px 12px", borderRadius: 8, cursor: "pointer",
                      border: "1.5px solid #1e3a5f", background: "#1e3a5f", color: "#fff",
                      fontWeight: 600, opacity: isChanging ? 0.5 : 1,
                    }}
                  >
                    {isChanging ? "…" : "→ Админ"}
                  </button>
                )}
              </div>
            )}
            {isSelf && (
              <div style={{ fontSize: 11, color: "#94a3b8", fontStyle: "italic" }}>это вы</div>
            )}
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "30px 0", color: "#94a3b8", fontSize: 13 }}>
          Пользователи не найдены
        </div>
      )}
    </div>
  );
}

// ── Dashboard Tab (Дашборд завуча — рефлексии) ────────────────
const MOOD_LABELS  = { low: "😔 Низкий", work: "😐 Рабочий", active: "😊 Активный", fire: "🔥 Огонь" };
const MOOD_COLORS  = { low: "#dc2626", work: "#d97706", active: "#16a34a", fire: "#7c3aed" };
const TIMING_LABELS = { ok: "✅ В норме", "5min": "⏰ +5 мин", long: "⏱ Долго" };

function DashboardTab() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [days, setDays]       = useState(30);

  const load = useCallback(async (d) => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`/api/dashboard?days=${d}`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Ошибка сервера: ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(days); }, [load, days]);

  const periodBtn = (label, d) => (
    <button
      key={d}
      onClick={() => setDays(d)}
      style={{
        padding: "5px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
        border: "1.5px solid",
        borderColor: days === d ? "#1e3a5f" : "#e2e8f0",
        borderRadius: 20,
        background: days === d ? "#1e3a5f" : "#fff",
        color: days === d ? "#fff" : "#64748b",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );

  if (loading) return (
    <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b", fontSize: 14 }}>
      ⏳ Загружаем дашборд...
    </div>
  );
  if (error) return (
    <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#dc2626" }}>
      ⚠️ {error}
      <button onClick={() => load(days)} style={{ marginLeft: 12, background: "none", border: "none", cursor: "pointer", color: "#1e3a5f", fontWeight: 600, fontSize: 13 }}>Повторить</button>
    </div>
  );

  const { summary = {}, by_teacher = [], by_subject = [], recent = [] } = data || {};

  // ── Вспомогательные компоненты ──
  const statCard = (emoji, label, value, color) => (
    <div style={{ flex: 1, background: "#f8fafc", borderRadius: 12, padding: "14px 12px", border: `1.5px solid ${color}22`, textAlign: "center", minWidth: 90 }}>
      <div style={{ fontSize: 20 }}>{emoji}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, marginTop: 3 }}>{value ?? "—"}</div>
      <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{label}</div>
    </div>
  );

  const thStyle = { fontSize: 11, color: "#94a3b8", fontWeight: 600, padding: "6px 8px", textAlign: "left", borderBottom: "1.5px solid #e2e8f0", whiteSpace: "nowrap" };
  const tdStyle = { fontSize: 12, color: "#1e293b", padding: "8px 8px", borderBottom: "1px solid #f1f5f9" };

  return (
    <div>
      {/* Выбор периода */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {periodBtn("7 дней", 7)}
        {periodBtn("30 дней", 30)}
        {periodBtn("90 дней", 90)}
      </div>

      {/* Summary cards */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {statCard("📝", "Рефлексий", summary.reflections_total, "#1e3a5f")}
        {statCard("⭐", "Средний рейтинг", summary.avg_rating, "#d97706")}
        {statCard("👩‍🏫", "Учителей активных", summary.teachers_with_reflections, "#7c3aed")}
      </div>

      {/* По предметам */}
      {by_subject.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>📚 По предметам</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Предмет</th>
                  <th style={thStyle}>Класс</th>
                  <th style={thStyle}>Уроков</th>
                  <th style={thStyle}>Рейтинг</th>
                  <th style={thStyle}>Настроение</th>
                </tr>
              </thead>
              <tbody>
                {by_subject.map((r, i) => {
                  const isLow = parseFloat(r.avg_rating) < 3.0;
                  return (
                    <tr key={i} style={{ background: isLow ? "#fef2f2" : "transparent" }}>
                      <td style={tdStyle}>{r.subject}</td>
                      <td style={tdStyle}>{r.grade} кл.</td>
                      <td style={tdStyle}>{r.total}</td>
                      <td style={{ ...tdStyle, fontWeight: 700, color: isLow ? "#dc2626" : "#16a34a" }}>
                        {"⭐".repeat(Math.round(parseFloat(r.avg_rating) || 0))} {r.avg_rating}
                      </td>
                      <td style={{ ...tdStyle, color: MOOD_COLORS[r.typical_mood] || "#64748b" }}>
                        {MOOD_LABELS[r.typical_mood] || r.typical_mood || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* По учителям */}
      {by_teacher.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>👤 Активность учителей</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Учитель (ID)</th>
                  <th style={thStyle}>Рефлексий</th>
                  <th style={thStyle}>Рейтинг</th>
                  <th style={thStyle}>🔥 Огонь</th>
                  <th style={thStyle}>😔 Спад</th>
                  <th style={thStyle}>Последняя</th>
                </tr>
              </thead>
              <tbody>
                {by_teacher.map((r, i) => (
                  <tr key={i}>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 10, color: "#94a3b8" }}>
                      {r.user_id ? r.user_id.slice(0, 8) + "…" : "—"}
                    </td>
                    <td style={tdStyle}>{r.total_lessons}</td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: parseFloat(r.avg_rating) < 3 ? "#dc2626" : "#16a34a" }}>
                      {r.avg_rating || "—"}
                    </td>
                    <td style={tdStyle}>{r.high_energy_count || 0}</td>
                    <td style={{ ...tdStyle, color: r.low_energy_count > 0 ? "#dc2626" : "#94a3b8" }}>
                      {r.low_energy_count || 0}
                    </td>
                    <td style={{ ...tdStyle, fontSize: 10, color: "#94a3b8" }}>
                      {r.last_reflection_at
                        ? new Date(r.last_reflection_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Последние рефлексии */}
      {recent.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>🕐 Последние рефлексии</div>
          {recent.slice(0, 10).map((r, i) => (
            <div key={i} style={{
              border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "10px 14px",
              marginBottom: 6, background: "#f8fafc", fontSize: 12,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontWeight: 700, color: "#1e293b" }}>
                  {r.subject}, {r.grade} кл. — {r.topic}
                </span>
                <span style={{ fontSize: 10, color: "#94a3b8" }}>
                  {r.saved_at ? new Date(r.saved_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : ""}
                </span>
              </div>
              <div style={{ display: "flex", gap: 12, color: "#64748b" }}>
                <span>{"⭐".repeat(r.rating || 0)} {r.rating}/5</span>
                <span style={{ color: MOOD_COLORS[r.mood] }}>{MOOD_LABELS[r.mood] || r.mood || "—"}</span>
                <span>{TIMING_LABELS[r.timing] || r.timing || "—"}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {by_teacher.length === 0 && by_subject.length === 0 && recent.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8", fontSize: 13 }}>
          📭 Рефлексий за выбранный период пока нет
        </div>
      )}
    </div>
  );
}

// ── Analytics Tab ─────────────────────────────────────────────
function AnalyticsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/api/get-analytics", {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Ошибка сервера: ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

  if (loading) return (
    <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b", fontSize: 14 }}>
      ⏳ Загружаем аналитику...
    </div>
  );

  if (error) return (
    <div style={{
      background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10,
      padding: "12px 16px", fontSize: 13, color: "#dc2626",
    }}>
      ⚠️ {error}
      <button onClick={loadAnalytics} style={{
        marginLeft: 12, background: "none", border: "none",
        cursor: "pointer", color: "#1e3a5f", fontWeight: 600, fontSize: 13,
      }}>Повторить</button>
    </div>
  );

  const { summary, users = [], recent_events = [] } = data || {};

  const statCard = (emoji, label, value, color) => (
    <div style={{
      flex: 1, background: "#f8fafc", borderRadius: 12, padding: "16px",
      border: `1.5px solid ${color}22`, textAlign: "center", minWidth: 100,
    }}>
      <div style={{ fontSize: 22 }}>{emoji}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{label}</div>
    </div>
  );

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {statCard("👩‍🏫", "Учителей", summary?.total_users ?? 0, "#1e3a5f")}
        {statCard("⚡", "Активных", summary?.active_users ?? 0, "#7c3aed")}
        {statCard("🤖", "Генераций", summary?.total_generated ?? 0, "#0891b2")}
        {statCard("💾", "Сохранено", summary?.total_saved ?? 0, "#16a34a")}
      </div>

      {/* Users table */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 10 }}>
          👤 Пользователи
        </div>
        {users.filter(u => u.role !== "admin").map(u => (
          <div key={u.id} style={{
            border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "12px 16px",
            marginBottom: 8, background: "#f8fafc",
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
            flexWrap: "wrap",
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#1e293b" }}>
                {u.email}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                Регистрация: {u.created_at ? new Date(u.created_at).toLocaleDateString("ru-RU") : "—"}
                {" · "}Вход: {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("ru-RU") : "не входил"}
              </div>
              {u.stats?.subjects?.length > 0 && (
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                  Предметы: {u.stats.subjects.join(", ")}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{
                background: "#e0f2fe", color: "#0891b2", borderRadius: 6,
                padding: "4px 10px", fontSize: 12, fontWeight: 700,
              }}>
                🤖 {u.stats?.generated ?? 0}
              </span>
              <span style={{
                background: "#dcfce7", color: "#16a34a", borderRadius: 6,
                padding: "4px 10px", fontSize: 12, fontWeight: 700,
              }}>
                💾 {u.stats?.saved ?? 0}
              </span>
            </div>
          </div>
        ))}
        {users.filter(u => u.role !== "admin").length === 0 && (
          <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: "20px 0" }}>
            Нет зарегистрированных учителей
          </div>
        )}
      </div>

      {/* Recent events */}
      {recent_events.length > 0 && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 10 }}>
            🕐 Последние события
          </div>
          <div style={{
            border: "1.5px solid #e2e8f0", borderRadius: 12, overflow: "hidden",
          }}>
            {recent_events.slice(0, 10).map((e, i) => (
              <div key={e.id || i} style={{
                padding: "10px 14px", fontSize: 12,
                borderBottom: i < 9 ? "1px solid #f1f5f9" : "none",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: i % 2 === 0 ? "#fff" : "#f8fafc",
              }}>
                <div>
                  <span style={{
                    background: e.event_type === "generated" ? "#e0f2fe" : "#dcfce7",
                    color: e.event_type === "generated" ? "#0891b2" : "#16a34a",
                    borderRadius: 4, padding: "2px 6px", fontSize: 11, fontWeight: 700,
                    marginRight: 8,
                  }}>
                    {e.event_type === "generated" ? "🤖 генерация" : "💾 сохранение"}
                  </span>
                  <span style={{ color: "#64748b" }}>{e.user_email}</span>
                  {e.subject && <span style={{ color: "#94a3b8" }}> · {e.subject}{e.grade ? ` ${e.grade}` : ""}</span>}
                </div>
                <div style={{ color: "#94a3b8", flexShrink: 0, marginLeft: 8 }}>
                  {e.created_at ? new Date(e.created_at).toLocaleString("ru-RU", {
                    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                  }) : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {recent_events.length === 0 && (
        <div style={{
          textAlign: "center", color: "#94a3b8", fontSize: 13, padding: "20px 0",
          background: "#f8fafc", borderRadius: 10,
        }}>
          📊 Данных об активности пока нет — они появятся после первых генераций уроков
        </div>
      )}
    </div>
  );
}

// ── Pending Users Tab ──────────────────────────────────────────
function PendingUsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const loadPending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/api/list-pending-users", {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Ошибка сервера: ${res.status}`);
      const json = await res.json();
      setUsers(json.users || []);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadPending(); }, [loadPending]);

  const handleAction = async (u, newStatus) => {
    setActionLoading(u.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/api/update-user-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: u.id,
          status: newStatus,
          userEmail: u.email,
          userName: u.name || u.email,
        }),
      });
      if (!res.ok) throw new Error(`Ошибка: ${res.status}`);
      setUsers(prev => prev.filter(x => x.id !== u.id));
    } catch (e) {
      alert("Ошибка: " + e.message);
    }
    setActionLoading(null);
  };

  if (loading) return (
    <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b", fontSize: 14 }}>
      ⏳ Загружаем заявки...
    </div>
  );

  if (error) return (
    <div style={{
      background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10,
      padding: "12px 16px", fontSize: 13, color: "#dc2626",
    }}>
      ⚠️ {error}
      <button onClick={loadPending} style={{
        marginLeft: 12, background: "none", border: "none",
        cursor: "pointer", color: "#1e3a5f", fontWeight: 600, fontSize: 13,
      }}>Повторить</button>
    </div>
  );

  if (users.length === 0) return (
    <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b", fontSize: 14 }}>
      ✅ Новых заявок нет
    </div>
  );

  return (
    <div>
      {users.map(u => (
        <div key={u.id} style={{
          border: "1.5px solid #e2e8f0", borderRadius: 14, padding: "16px 20px",
          marginBottom: 12, background: "#f8fafc",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b", marginBottom: 4 }}>
                {u.name || "(имя не указано)"}
              </div>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 2 }}>
                📧 {u.email}
              </div>
              {u.city && (
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 2 }}>
                  📍 {u.city}
                </div>
              )}
              {u.school && (
                <div style={{ fontSize: 13, color: "#64748b" }}>
                  🏫 {u.school}
                </div>
              )}
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
                Подана: {new Date(u.created_at).toLocaleDateString("ru-RU", {
                  day: "numeric", month: "long", year: "numeric",
                })}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button
                onClick={() => handleAction(u, "approved")}
                disabled={actionLoading === u.id}
                style={{
                  background: "#16a34a", color: "#fff", border: "none",
                  borderRadius: 8, padding: "9px 16px", fontSize: 13,
                  fontWeight: 700, cursor: actionLoading === u.id ? "not-allowed" : "pointer",
                  opacity: actionLoading === u.id ? 0.6 : 1,
                }}
              >
                {actionLoading === u.id ? "..." : "✓ Одобрить"}
              </button>
              <button
                onClick={() => handleAction(u, "rejected")}
                disabled={actionLoading === u.id}
                style={{
                  background: "#fff", color: "#dc2626", border: "1.5px solid #fca5a5",
                  borderRadius: 8, padding: "9px 16px", fontSize: 13,
                  fontWeight: 700, cursor: actionLoading === u.id ? "not-allowed" : "pointer",
                  opacity: actionLoading === u.id ? 0.6 : 1,
                }}
              >
                ✕ Отклонить
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main AdminView ─────────────────────────────────────────────
export default function AdminView({ onClose, user }) {
  const [tab, setTab] = useState("requests");

  const tabStyle = (active) => ({
    padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer",
    border: "none", borderRadius: 8,
    background: active ? "#fff" : "transparent",
    color: active ? "#1e3a5f" : "rgba(255,255,255,0.7)",
    boxShadow: active ? "0 1px 4px rgba(0,0,0,0.15)" : "none",
    transition: "all 0.15s",
  });

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center",
      overflowY: "auto", padding: "32px 16px",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, width: "100%", maxWidth: 680,
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #1e3a5f, #1a3a4a)",
          padding: "20px 24px",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>
              🛡️ Панель администратора
            </div>
            <button onClick={onClose} style={{
              background: "rgba(255,255,255,0.15)", border: "none", color: "#fff",
              borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600,
            }}>
              Закрыть ✕
            </button>
          </div>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 6, background: "rgba(255,255,255,0.1)", borderRadius: 10, padding: 4, width: "fit-content" }}>
            <button style={tabStyle(tab === "requests")} onClick={() => setTab("requests")}>
              👥 Заявки
            </button>
            <button style={tabStyle(tab === "analytics")} onClick={() => setTab("analytics")}>
              📊 Аналитика
            </button>
            <button style={tabStyle(tab === "dashboard")} onClick={() => setTab("dashboard")}>
              🏫 Дашборд
            </button>
            <button style={tabStyle(tab === "users")} onClick={() => setTab("users")}>
              👤 Роли
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px" }}>
          {tab === "requests"  && <PendingUsersTab />}
          {tab === "analytics" && <AnalyticsTab />}
          {tab === "dashboard" && <DashboardTab />}
          {tab === "users"     && <UsersTab currentUser={user} />}
        </div>
      </div>
    </div>
  );
}
