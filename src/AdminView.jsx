import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

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
      const res = await fetch("/.netlify/functions/get-analytics", {
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
      const res = await fetch("/.netlify/functions/list-pending-users", {
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
      const res = await fetch("/.netlify/functions/update-user-status", {
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
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px" }}>
          {tab === "requests" && <PendingUsersTab />}
          {tab === "analytics" && <AnalyticsTab />}
        </div>
      </div>
    </div>
  );
}
