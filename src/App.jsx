import { useState, useCallback, useMemo, useEffect, useRef } from "react";

// ========== DATA ==========
const CLUSTERS = {
  exact: { name: "Точные и естественные", emoji: "🔬", color: "#2563eb", subjects: ["Математика","Алгебра","Геометрия","Физика","Химия","Информатика","Биология"], profile: "Конвергентное мышление. Тренажёр 30%, Практикум 25%. Бинарная мгновенная ОС. Deliberate practice." },
  lang: { name: "Язык и коммуникация", emoji: "✍️", color: "#7c3aed", subjects: ["Русский язык","Английский язык","Немецкий язык","Французский язык"], profile: "Drilling правил + порождение речи 50/50. Мастерская 25%, Тренажёр 20%. Двойная ОС: бинарная для грамматики + критериальная для текстов." },
  human: { name: "Гуманитарные и социальные", emoji: "📜", color: "#dc2626", subjects: ["Литература","История","Обществознание","География","МХК"], profile: "Дивергентное мышление. Дискуссия 30%, Исследование 25%. Критериальная + диалогическая ОС." }
};

const MODELS = [
  { id: "research", name: "Исследование", emoji: "🔍", mode: "Открытие", desc: "Новая тема через открытие закономерности", w: { exact: 25, lang: 20, human: 25 } },
  { id: "discussion", name: "Дискуссия", emoji: "💬", mode: "Открытие", desc: "Столкновение позиций, анализ, дебаты", w: { exact: 0, lang: 10, human: 30 } },
  { id: "project", name: "Проект", emoji: "🏗️", mode: "Открытие", desc: "Создание продукта, комплексная работа", w: { exact: 5, lang: 5, human: 20 } },
  { id: "quest", name: "Квест", emoji: "🗺️", mode: "Открытие", desc: "Нарративное погружение, игровые форматы", w: { exact: 5, lang: 15, human: 10 } },
  { id: "practice", name: "Практикум", emoji: "⚙️", mode: "Закрепление", desc: "Отработка на сложных задачах", w: { exact: 25, lang: 10, human: 10 } },
  { id: "trainer", name: "Тренажёр", emoji: "🎯", mode: "Закрепление", desc: "Автоматизация навыков, подготовка к контролю", w: { exact: 30, lang: 20, human: 0 } },
  { id: "workshop", name: "Мастерская", emoji: "🎨", mode: "Смешанный", desc: "Создание текстов, индивидуальная работа", w: { exact: 0, lang: 25, human: 0 } },
  { id: "recovery", name: "Восстановление", emoji: "🌿", mode: "Смешанный", desc: "После контрольных, эмоциональная разгрузка", w: { exact: 10, lang: 10, human: 5 } }
];

function gc(s) { for (const [k, c] of Object.entries(CLUSTERS)) if (c.subjects.includes(s)) return k; return "exact"; }

// ========== CURRICULUM DATA ==========
// Maps subject+gradeRange to a static JSON file in /curriculum/
const CURRICULUM_FILES = {
  "Математика_1-4": "/curriculum/math-1-4.json",
  "Русский язык_1-4": "/curriculum/russian-1-4.json",
};

function getCurriculumKey(subject, grade) {
  if (subject === "Математика" && grade >= 1 && grade <= 4) return "Математика_1-4";
  if (subject === "Русский язык" && grade >= 1 && grade <= 4) return "Русский язык_1-4";
  return null;
}

// Hook: loads and caches curriculum JSON for subject+grade
function useCurriculum(subject, grade) {
  const [data, setData] = useState(null);
  const cache = useRef({});
  useEffect(() => {
    const key = getCurriculumKey(subject, grade);
    if (!key) { setData(null); return; }
    if (cache.current[key]) { setData(cache.current[key]); return; }
    fetch(CURRICULUM_FILES[key])
      .then(r => r.json())
      .then(json => { cache.current[key] = json; setData(json); })
      .catch(() => setData(null));
  }, [subject, grade]);
  return data;
}

// Build curriculum context string for the system prompt
function buildCurriculumContext(curriculum, lessonId) {
  if (!curriculum || !lessonId) return null;
  const lesson = curriculum.lessons.find(l => l.id === lessonId);
  if (!lesson) return null;
  const section = curriculum.sections.find(s => s.id === lesson.section_id);
  const grade = lesson.grade;
  const idx = curriculum.lessons.filter(l => l.grade === grade).findIndex(l => l.id === lessonId);
  const gradeLessons = curriculum.lessons.filter(l => l.grade === grade);
  const prev = gradeLessons.slice(Math.max(0, idx - 2), idx).map(l => `${l.lesson_num}. ${l.topic}`);
  const next = gradeLessons.slice(idx + 1, idx + 2).map(l => `${l.lesson_num}. ${l.topic}`);
  const techs = Array.isArray(lesson.techniques) ? lesson.techniques.join(", ") : lesson.techniques;
  return [
    `ПРОГРАММА: ${curriculum.meta.subject} ${curriculum.meta.grades} кл. (ЖУ360 v5.1), урок №${lesson.lesson_num}/${curriculum.lessons.filter(l => l.grade === grade).length}`,
    section ? `РАЗДЕЛ: ${section.title}` : "",
    prev.length ? `ПРЕДЫДУЩИЕ УРОКИ (контекст для связи): ${prev.join(" → ")}` : "",
    next.length ? `СЛЕДУЮЩИЙ УРОК (упомяни вскользь в ДЗ или сюжете): ${next.join(", ")}` : "",
    `РЕКОМЕНДОВАННАЯ МОДЕЛЬ ПО ПРОГРАММЕ: ${lesson.model} (${lesson.lesson_type})`,
    lesson.poiya_step ? `ШАГ ПОЙЯ: ${lesson.poiya_step}` : "",
    lesson.uud_fgos ? `УУД по ФГОС: ${lesson.uud_fgos}` : "",
    techs ? `РЕКОМЕНДОВАННЫЕ ТЕХНИКИ ЖУ360: ${techs}` : "",
    lesson.homework ? `ДОМАШНЕЕ ЗАДАНИЕ (из программы): ${lesson.homework}` : "",
  ].filter(Boolean).join("\n");
}

// ========== AI PROMPT ==========
function buildSystemPrompt(clusterName, clusterProfile, modelName, grade, format, curriculumCtx) {
  const isPrimary = grade <= 4;
  const isMiddle = grade >= 5 && grade <= 9;
  const isLang = clusterName === "Язык и коммуникация";
  const writingNorm = grade <= 2 ? "35-50 слов класс / 12-17 дом" : grade <= 3 ? "45-60 / 15-20" : "55-70 / 20-25";

  const core = `Ты — эксперт «Живой урок 360» (Корифей). Генерируй урок-конструктор на русском.
МЕТОДОЛОГИЯ: 8 компонентов, трёхакт Захват→Развитие→Кульминация, смена каждые ${isPrimary?'5-7':'7-10'} мин, «Победа до теории», мгновенная ОС, уровни 🟢🟡🔴.`;

  const primaryBlock = isPrimary ? `
НАЧАЛКА (${grade}кл): конкретно-образное мышление, концентрация 10-15мин, 70% Открытие. Норма письма: ${writingNorm}.
КОРИ — персонаж-помощник (голубая буква К, шарфик, рюкзачок). 4 роли: задаёт вопросы, ПУТАЕТСЯ (типичная ошибка→дети исправляют), удивляется, хвалит. Минимум 2 появления, одно — ошибка.
ОБЯЗАТЕЛЬНО: разминка (каллиграфия+словарь+мостик к теме), игра-передвижение/физминутка ПО ТЕМЕ, хоровое закрепление, «Что я теперь умею», светофор 🟢🟡🔴.` : '';

  const middleBlock = isMiddle ? `
СРЕДНЯЯ ШКОЛА (${grade}кл): абстрактно-логическое мышление, концентрация 12-15 мин, потребность в автономности и значимости.
НЕ используй: хоровое закрепление, физминутки, каллиграфию — они воспринимаются как «детское».
ИСПОЛЬЗУЙ: когнитивный конфликт, связь с реальной жизнью («зачем это мне»), выбор уровня сложности.
КОРИ для подростков — провокатор или исследователь: создаёт когнитивный конфликт или задаёт открытый вопрос без простого ответа. Появляется 1 раз, реплика острая и короткая (1-2 предложения).
ГИЛЬДИИ (вместо обычных групп): 🔬 Учёные (ищут закономерности), 💡 Изобретатели (придумывают применение), 🌍 Исследователи (проверяют гипотезы). Каждая гильдия смотрит на задачу со своей точки зрения.
ЛОВУШКИ: 2 правдоподобных, но ошибочных утверждения учителя — ученики должны поймать и опровергнуть.
ДВОЙНАЯ РЕФЛЕКСИЯ: контент («Что изменилось в понимании?») + процесс («Как работал? Что помогло думать?»).
3 ЗАХВАТА разных стилей — учитель выбирает один перед уроком.` : '';

  const langBlock = isLang ? `
РУССКИЙ ЯЗЫК: drilling правил + порождение речи. Каллиграфия→словарь→тема. Мостик: «На какой вопрос отвечают эти слова?». Стыдные вопросы, слова-ловушки обязательны.` : '';

  const middleJsonFormat = isMiddle ?
`ОТВЕТ — ТОЛЬКО JSON (без markdown, без \`\`\`):
{"passport":{"topic":"str","type":"str","emotional_goal":"str","educational_goal":"str","key_concept":"str"},"captures":[{"style":"🎭 Провокация","name":"str","technique":"str","text":"полный текст учителя 3-4 предложения","kori_role":"str"},{"style":"💭 Загадка","name":"str","technique":"другой приём","text":"другой текст","kori_role":"str"},{"style":"🌍 Связь с жизнью","name":"str","technique":"третий приём","text":"третий текст","kori_role":"str"}],"first_win":{"task":"конкретная задача — ученик пробует ДО объяснения теории","duration":5},"development":{"key_points":["п1","п2","п3"],"teacher_text":"что говорит учитель","kori":{"role":"провокатор/исследователь","text":"реплика Кори"},"traps":["Ловушка 1: утверждение — почему ошибка","Ловушка 2: утверждение — почему ошибка"]},"guild_task":{"guilds":[{"name":"🔬 Учёные","task":"конкретное задание"},{"name":"💡 Изобретатели","task":"конкретное задание"},{"name":"🌍 Исследователи","task":"конкретное задание"}],"discussion_question":"вопрос для общего обсуждения после"},"tasks":{"green":["з1 базовый","з2"],"yellow":["з1 продвинутый","з2"],"red":"босс-задача нестандартное применение"},"reflection":{"content":"Что изменилось в твоём понимании темы?","process":"Как ты работал сегодня? Что помогло думать лучше?"},"teacher_notes":"3-4 предложения"}` : '';

  const jsonFormat = isPrimary ?
`ОТВЕТ — ТОЛЬКО JSON (без markdown, без \`\`\`):
{"passport":{"topic":"str","type":"Урок-открытие/закрепление","emotional_goal":"str","educational_goal":"str","key_concept":"str","writing_volume":"~N слов"},"warmup":{"calligraphy":"буква+соединения+слова","vocabulary":"формат+объём","bridge":"вопрос-мостик"},"captures":[{"style":"🎭 Драматический","name":"str","technique":"str","text":"ПОЛНЫЙ текст учителя 3-5 предложений","kori_role":"str","first_win":"конкретная задача"},{"style":"💭 Рефлексивный","name":"str","technique":"другой приём","text":"другой текст","kori_role":"str","first_win":"str"},{"style":"🔍 Аналитический","name":"str","technique":"третий приём","text":"третий текст","kori_role":"str","first_win":"str"}],"development":{"new_material":{"duration":7,"key_content":["п1","п2","п3"],"teacher_text":"str","kori_mistake":{"mistake":"ошибка Кори","correction":"как дети исправляют"}},"active_game":{"name":"str","type":"передвижение/жесты/пары","rules":["п1","п2","п3"],"words_or_tasks":["8+ слов"],"traps":["ловушка ⚠️ — почему"],"duration":8,"online_adaptation":"str"},"written_practice":{"volume":"~25-30 слов","variants":["вар1","вар2"],"duration":8}},"climax":{"humanitarian_question":"💭 вопрос про чувства","practical_question":"🔍 что умею + как проверить","choral":["«начало...» — ОТВЕТ!","«начало...» — ОТВЕТ!"],"i_can_now":"Теперь я умею..."},"homework":{"basic":"str","creative":"str (по желанию)"},"storylines":[{"name":"🔬 Назв","style":"str","this_lesson":"str","next_lessons":"str"},{"name":"🏙️ Назв","style":"str","this_lesson":"str","next_lessons":"str"}],"checklist":["☐ п1","☐ п2","☐ п3","☐ п4","☐ п5","☐ п6","☐ п7","☐ п8"],"teacher_notes":"3-4 предложения"}` :
`ОТВЕТ — ТОЛЬКО JSON (без markdown):
{"capture":{"technique":"str","text":"подробный текст 3-5 предложений","duration":5},"first_win":{"task":"конкретная задача","duration":3},"timeline":[{"phase":"str","duration":5,"activity":"учитель","students":"ученики","materials":"str","tip":"совет"}],"tasks":{"green":["з1","з2"],"yellow":["з1","з2"],"red":["босс"]},"feedback":{"method":"метод","exit_ticket":"вопрос"},"teacher_notes":"3-4 предложения"}`;

  const curriculumBlock = curriculumCtx ? `\n\n--- ДАННЫЕ ИЗ ПРОГРАММЫ ---\n${curriculumCtx}\n--- (используй эти данные для связи с предыдущими уроками, точных техник и ДЗ) ---` : '';

  return `${core}
КЛАСТЕР: ${clusterName}. ${clusterProfile}
МОДЕЛЬ: ${modelName}, КЛАСС: ${grade}, ФОРМАТ: ${format === 'online' ? 'Онлайн' : 'Очный'}${grade >= 7 && format === 'online' ? '. Онлайн 7+: Концентрат 10-22мин.' : ''}${primaryBlock}${middleBlock}${langBlock}${curriculumBlock}
ПРАВИЛА: конкретность (не «задача», а точная формулировка), готовый текст учителя, каждый захват — ДРУГОЙ стиль, ловушки обязательны, ошибка Кори=типичная ошибка ученика, всё на русском.
${isMiddle ? middleJsonFormat : jsonFormat}`;
}

async function generateLesson(st) {
  const ck = gc(st.subject);
  const ci = CLUSTERS[ck];
  const mo = MODELS.find(m => m.id === st.model);
  const sysPrompt = buildSystemPrompt(ci.name, ci.profile, mo.name, st.grade, st.format, st.curriculumCtx || null);
  const userMsg = `Предмет: ${st.subject}, Класс: ${st.grade}, Тема: ${st.topic}, Модель: ${mo.name} (${mo.mode}), ${st.duration} мин, ${st.format === 'online' ? 'Онлайн' : 'Очный'}${st.notes ? ', Пожелания: ' + st.notes : ''}`;

  let response;
  try {
    response = await fetch("/api/generate-lesson", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: sysPrompt,
        userMessage: userMsg,
        model: "claude-haiku-4-5-20251001",
        max_tokens: 5000
      })
    });
  } catch (fetchErr) {
    throw new Error("Не удалось подключиться к серверу. Проверьте интернет-соединение. (" + fetchErr.message + ")");
  }

  if (!response.ok) {
    let errText = "";
    try { errText = await response.text(); } catch(e) {}
    throw new Error(`API вернул ошибку ${response.status}. ${errText.slice(0, 200)}`);
  }

  // Читаем SSE-поток (streaming) — данные приходят по мере генерации
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (raw === "[DONE]") continue;
      try {
        const ev = JSON.parse(raw);
        if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
          text += ev.delta.text;
        }
        if (ev.type === "error") {
          throw new Error(ev.error?.message || "Claude API streaming error");
        }
      } catch (parseErr) {
        if (parseErr.message.includes("Claude API")) throw parseErr;
      }
    }
  }
  if (!text) {
    throw new Error("API вернул пустой ответ");
  }

  let parsed;
  try {
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const i = cleaned.indexOf('{');
    const j = cleaned.lastIndexOf('}');
    if (i === -1 || j === -1) throw new Error("No JSON object found");
    parsed = JSON.parse(cleaned.slice(i, j + 1));
  } catch (e) {
    try {
      const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const i = cleaned.indexOf('{');
      if (i === -1) throw e;
      let fragment = cleaned.slice(i);
      let braces = 0, brackets = 0;
      for (const ch of fragment) {
        if (ch === '{') braces++;
        if (ch === '}') braces--;
        if (ch === '[') brackets++;
        if (ch === ']') brackets--;
      }
      while (brackets > 0) { fragment += ']'; brackets--; }
      while (braces > 0) { fragment += '}'; braces--; }
      fragment = fragment.replace(/,\s*([}\]])/g, '$1');
      parsed = JSON.parse(fragment);
    } catch (e2) {
      throw new Error("AI не завершил JSON. Попробуйте перегенерировать. Конец: ..." + text.slice(-100));
    }
  }

  return parsed;
}

// ========== UI COMPONENTS ==========
const STEPS_BASIC = ["Параметры", "Модель", "Генерация", "Результат"];

function StepIndicator({ current, steps }) {
  return (
    <div style={{ display: "flex", gap: 0, marginBottom: 32, position: "relative" }}>
      {steps.map((s, i) => (
        <div key={s} style={{ flex: 1, textAlign: "center", position: "relative" }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%", margin: "0 auto 6px",
            background: i <= current ? "#1e3a5f" : "#e2e8f0",
            color: i <= current ? "#fff" : "#94a3b8",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700, transition: "all 0.3s",
            boxShadow: i === current ? "0 0 0 4px rgba(30,58,95,0.2)" : "none"
          }}>{i + 1}</div>
          <div style={{ fontSize: 11, color: i <= current ? "#1e3a5f" : "#94a3b8", fontWeight: i === current ? 700 : 400 }}>{s}</div>
        </div>
      ))}
      <div style={{ position: "absolute", top: 18, left: "8%", right: "8%", height: 2, background: "#e2e8f0", zIndex: -1 }} />
      <div style={{ position: "absolute", top: 18, left: "8%", height: 2, background: "#1e3a5f", zIndex: -1, width: `${(current / (steps.length - 1)) * 84}%`, transition: "width 0.4s" }} />
    </div>
  );
}

function Card({ children, active, onClick, style }) {
  return (
    <div onClick={onClick} style={{
      border: active ? "2px solid #1e3a5f" : "1px solid #e2e8f0",
      borderRadius: 12, padding: 16, cursor: onClick ? "pointer" : "default",
      background: active ? "#f0f4ff" : "#fff", transition: "all 0.2s",
      boxShadow: active ? "0 2px 12px rgba(30,58,95,0.12)" : "0 1px 3px rgba(0,0,0,0.06)",
      ...style
    }}>{children}</div>
  );
}

function Btn({ children, onClick, variant = "primary", disabled, style }) {
  const styles = {
    primary: { background: "#1e3a5f", color: "#fff", border: "none" },
    secondary: { background: "#fff", color: "#1e3a5f", border: "1px solid #1e3a5f" },
    accent: { background: "#f59e0b", color: "#1e3a5f", border: "none" },
    ghost: { background: "transparent", color: "#64748b", border: "1px solid #e2e8f0" }
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...styles[variant], padding: "10px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600,
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
      transition: "all 0.2s", fontFamily: "inherit", ...style
    }}>{children}</button>
  );
}

// ========== CURRICULUM SELECTOR ==========
function CurriculumSelector({ curriculum, grade, onSelect }) {
  const [selectedId, setSelectedId] = useState("");
  if (!curriculum) return null;

  const gradeSections = curriculum.sections.filter(s => s.grade === grade);
  const gradeLessons = curriculum.lessons.filter(l => l.grade === grade);

  const handleChange = (e) => {
    const id = e.target.value;
    setSelectedId(id);
    if (!id) { onSelect(null); return; }
    const lesson = gradeLessons.find(l => l.id === id);
    if (lesson) onSelect(lesson);
  };

  const modelEmoji = { "Тренажёр": "🎯", "Исследование": "🔍", "Практикум": "⚙️", "Восстановление": "🌿", "Квест": "🗺️", "Дискуссия": "💬", "Мастерская": "🎨" };
  const selected = selectedId ? gradeLessons.find(l => l.id === selectedId) : null;
  const selSection = selected ? curriculum.sections.find(s => s.id === selected.section_id) : null;

  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
        📚 Выбрать урок из программы
        <span style={{ fontWeight: 400, color: "#94a3b8", fontSize: 12 }}>(необязательно — автозаполнит тему)</span>
      </label>
      <select value={selectedId} onChange={handleChange}
        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #a5b4fc", fontSize: 14, fontFamily: "inherit", background: "#fff", color: "#1e293b" }}>
        <option value="">— Ввести тему вручную —</option>
        {gradeSections.map(sec => {
          const secLessons = gradeLessons.filter(l => l.section_id === sec.id);
          return (
            <optgroup key={sec.id} label={`📂 ${sec.title} (ур. ${sec.lessons_range})`}>
              {secLessons.map(l => (
                <option key={l.id} value={l.id}>
                  {l.lesson_num}. {l.topic} — {modelEmoji[l.model] || ""} {l.model}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>

      {selected && (
        <div style={{ marginTop: 8, padding: 12, borderRadius: 10, background: "#eff6ff", border: "1px solid #bfdbfe", fontSize: 13 }}>
          <div style={{ fontWeight: 700, color: "#1e3a5f", marginBottom: 4 }}>📖 Урок №{selected.lesson_num} из программы</div>
          {selSection && <div style={{ color: "#475569", marginBottom: 3 }}>Раздел: {selSection.title}</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
            <span style={{ padding: "2px 8px", background: "#e0e7ff", borderRadius: 12, color: "#3730a3" }}>{selected.lesson_type}</span>
            <span style={{ padding: "2px 8px", background: "#fef3c7", borderRadius: 12, color: "#92400e" }}>{modelEmoji[selected.model]} {selected.model}</span>
            {selected.poiya_step && <span style={{ padding: "2px 8px", background: "#dcfce7", borderRadius: 12, color: "#166534" }}>Пойя: {selected.poiya_step}</span>}
          </div>
          {selected.techniques && selected.techniques.length > 0 && (
            <div style={{ marginTop: 6, color: "#64748b" }}>Техники: {selected.techniques.join(", ")}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ========== STEP 1: Parameters ==========
function Step1({ state, setState }) {
  const grades = Array.from({ length: 11 }, (_, i) => i + 1);
  const cluster = state.subject ? gc(state.subject) : null;
  const clInfo = cluster ? CLUSTERS[cluster] : null;
  const isPrimary = state.grade && state.grade <= 4;
  const curriculum = useCurriculum(state.subject, state.grade);
  const hasCurriculum = !!getCurriculumKey(state.subject, state.grade);

  const handleCurriculumSelect = useCallback((lesson) => {
    if (!lesson) {
      setState(s => ({ ...s, curriculumLesson: null, curriculumCtx: null }));
    } else {
      const ctx = buildCurriculumContext(curriculum, lesson.id);
      setState(s => ({
        ...s,
        topic: lesson.topic,
        model: MODELS.find(m => m.name === lesson.model)?.id || s.model,
        curriculumLesson: lesson.id,
        curriculumCtx: ctx,
      }));
    }
  }, [curriculum, setState]);

  return (
    <div>
      <h2 style={{ fontSize: 22, marginBottom: 8, color: "#1e3a5f" }}>Параметры урока</h2>
      <p style={{ color: "#64748b", marginBottom: 24, fontSize: 14 }}>Укажите базовые параметры — AI подберёт оптимальный сценарий</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6, display: "block" }}>Класс</label>
          <select value={state.grade || ""} onChange={e => setState(s => ({ ...s, grade: +e.target.value }))}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 15, fontFamily: "inherit", background: "#fff" }}>
            <option value="">Выберите</option>
            {grades.map(g => <option key={g} value={g}>{g} класс</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6, display: "block" }}>Предмет</label>
          <select value={state.subject || ""} onChange={e => setState(s => ({ ...s, subject: e.target.value }))}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 15, fontFamily: "inherit", background: "#fff" }}>
            <option value="">Выберите</option>
            {Object.entries(CLUSTERS).map(([k, cl]) => (
              <optgroup key={k} label={`${cl.emoji} ${cl.name}`}>
                {cl.subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
      </div>
      {hasCurriculum && curriculum && (
        <CurriculumSelector
          curriculum={curriculum}
          grade={state.grade}
          onSelect={handleCurriculumSelect}
        />
      )}
      {hasCurriculum && !curriculum && (
        <div style={{ padding: 10, background: "#f1f5f9", borderRadius: 8, fontSize: 13, color: "#94a3b8", marginBottom: 16 }}>
          ⏳ Загружаем программу...
        </div>
      )}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6, display: "block" }}>Тема урока</label>
        <input value={state.topic || ""} onChange={e => setState(s => ({ ...s, topic: e.target.value }))}
          placeholder="Например: Что такое части речи?"
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 15, fontFamily: "inherit", boxSizing: "border-box" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6, display: "block" }}>Длительность</label>
          <select value={state.duration || 45} onChange={e => setState(s => ({ ...s, duration: +e.target.value }))}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 15, fontFamily: "inherit", background: "#fff" }}>
            {[30, 35, 40, 45, 50, 60, 80].map(d => <option key={d} value={d}>{d} мин</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6, display: "block" }}>Формат</label>
          <select value={state.format || "offline"} onChange={e => setState(s => ({ ...s, format: e.target.value }))}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 15, fontFamily: "inherit", background: "#fff" }}>
            <option value="offline">Очный</option>
            <option value="online">Онлайн</option>
          </select>
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6, display: "block" }}>Пожелания (необязательно)</label>
        <input value={state.notes || ""} onChange={e => setState(s => ({ ...s, notes: e.target.value }))}
          placeholder="Учебник Канакина, упр. 68-70; тема предыдущего урока..."
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 15, fontFamily: "inherit", boxSizing: "border-box" }} />
      </div>
      {clInfo && (
        <div style={{ padding: 16, borderRadius: 12, background: `${clInfo.color}10`, border: `1px solid ${clInfo.color}30` }}>
          <div style={{ fontWeight: 700, color: clInfo.color, marginBottom: 4 }}>{clInfo.emoji} Кластер: {clInfo.name}</div>
          <div style={{ fontSize: 13, color: "#475569" }}>{clInfo.profile}</div>
        </div>
      )}
      {isPrimary && (
        <div style={{ padding: 16, borderRadius: 12, background: "#fef3c7", border: "1px solid #fbbf2430", marginTop: 12 }}>
          <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 4 }}>🎒 Начальная школа — режим Кори</div>
          <div style={{ fontSize: 13, color: "#78350f" }}>AI сгенерирует урок-конструктор с персонажем Кори, 3 вариантами захвата, игрой-передвижением, хоровым закреплением и двойной рефлексией</div>
        </div>
      )}
    </div>
  );
}

// ========== STEP 2: Model ==========
function Step2({ state, setState }) {
  const cluster = state.subject ? gc(state.subject) : "exact";
  const sorted = [...MODELS].sort((a, b) => (b.w[cluster] || 0) - (a.w[cluster] || 0));
  return (
    <div>
      <h2 style={{ fontSize: 22, marginBottom: 8, color: "#1e3a5f" }}>Модель урока</h2>
      <p style={{ color: "#64748b", marginBottom: 24, fontSize: 14 }}>Отсортированы по частоте для вашего кластера. Процент — рекомендуемая доля в модуле.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {sorted.map(m => {
          const w = m.w[cluster] || 0;
          return (
            <Card key={m.id} active={state.model === m.id} onClick={() => setState(s => ({ ...s, model: m.id }))} style={{ opacity: w === 0 ? 0.4 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 17 }}>{m.emoji} <strong>{m.name}</strong></span>
                <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 20,
                  background: w >= 20 ? "#dcfce7" : w > 0 ? "#fef3c7" : "#fee2e2",
                  color: w >= 20 ? "#166534" : w > 0 ? "#92400e" : "#991b1b" }}>{w}%</span>
              </div>
              <div style={{ fontSize: 12, color: "#64748b" }}>{m.desc}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Режим: {m.mode}</div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ========== STEP 3: Generation ==========
function Step3({ state, onGenerate, loading, error }) {
  const model = MODELS.find(m => m.id === state.model);
  const cluster = gc(state.subject);
  const clInfo = CLUSTERS[cluster];
  const isPrimary = state.grade <= 4;

  return (
    <div style={{ textAlign: "center" }}>
      <h2 style={{ fontSize: 22, marginBottom: 8, color: "#1e3a5f" }}>Генерация сценария</h2>
      <div style={{ background: "#f0f4ff", borderRadius: 12, padding: 20, marginBottom: 24, border: "1px solid #c7d2fe", textAlign: "left" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#1e3a5f", marginBottom: 8 }}>{state.topic}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 13 }}>
          <span style={{ padding: "3px 10px", background: "#e0e7ff", borderRadius: 20, color: "#3730a3" }}>{state.grade} класс</span>
          <span style={{ padding: "3px 10px", background: "#e0e7ff", borderRadius: 20, color: "#3730a3" }}>{state.subject}</span>
          <span style={{ padding: "3px 10px", background: `${clInfo.color}15`, borderRadius: 20, color: clInfo.color }}>{clInfo.emoji} {clInfo.name}</span>
          <span style={{ padding: "3px 10px", background: "#fef3c7", borderRadius: 20, color: "#92400e" }}>{model?.emoji} {model?.name}</span>
          <span style={{ padding: "3px 10px", background: "#f1f5f9", borderRadius: 20, color: "#475569" }}>{state.duration} мин</span>
          {isPrimary && <span style={{ padding: "3px 10px", background: "#fef3c7", borderRadius: 20, color: "#92400e" }}>🎒 Кори</span>}
        </div>
        {state.notes && <div style={{ fontSize: 13, color: "#64748b", marginTop: 8 }}>📝 {state.notes}</div>}
      </div>

      {loading ? (
        <div style={{ padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16, animation: "pulse 1.5s infinite" }}>✨</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#1e3a5f", marginBottom: 8 }}>AI генерирует сценарий...</div>
          <div style={{ fontSize: 13, color: "#64748b" }}>
            {isPrimary ? "Создаём 3 варианта захвата, игру-передвижение, ошибки Кори и хоровое закрепление" : "Создаём захват, таймлайн и задачи трёх уровней"}
          </div>
          <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
        </div>
      ) : error ? (
        <div style={{ padding: 20, background: "#fef2f2", borderRadius: 12, marginBottom: 16, textAlign: "left" }}>
          <div style={{ color: "#dc2626", fontWeight: 600, marginBottom: 8 }}>❌ Ошибка генерации</div>
          <div style={{ color: "#991b1b", fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{error}</div>
          <div style={{ marginTop: 12, fontSize: 12, color: "#6b7280" }}>Нажмите кнопку ниже, чтобы попробовать ещё раз</div>
        </div>
      ) : (
        <div style={{ padding: 20 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚀</div>
          <div style={{ fontSize: 14, color: "#64748b", marginBottom: 24 }}>
            {isPrimary ? "AI создаст урок-конструктор: 3 захвата, Кори, игра, хоровое закрепление, 2 сюжетные линии" : "AI создаст детальный сценарий с захватом, таймлайном и задачами трёх уровней"}
          </div>
        </div>
      )}

      {!loading && (
        <Btn variant="accent" onClick={onGenerate} style={{ padding: "14px 40px", fontSize: 16, fontWeight: 700 }}>
          ✨ Сгенерировать сценарий
        </Btn>
      )}
    </div>
  );
}

// ========== DOCX EXPORT (HTML-based, works in iframe) ==========
function exportPrimaryDocx(data, state) {
  const p = data.passport || {};
  const w = data.warmup || {};
  const dev = data.development || {};
  const cl = data.climax || {};
  const hw = data.homework || {};

  const esc = (s) => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const css = `
    body { font-family: Arial, sans-serif; font-size: 11pt; color: #1e293b; max-width: 700px; margin: 0 auto; padding: 20px; }
    h1 { color: #1e3a5f; font-size: 18pt; text-align: center; margin-bottom: 4px; }
    h2 { color: #1e3a5f; font-size: 14pt; border-bottom: 2px solid #1e3a5f; padding-bottom: 4px; margin-top: 24px; }
    h3 { color: #475569; font-size: 12pt; margin-top: 16px; }
    .subtitle { text-align: center; color: #666; font-size: 10pt; margin-bottom: 20px; }
    table { border-collapse: collapse; width: 100%; margin: 8px 0; }
    td, th { border: 1px solid #ccc; padding: 6px 10px; font-size: 10pt; vertical-align: top; }
    th { background: #1e3a5f; color: #fff; font-weight: bold; }
    .label { background: #f0f4ff; font-weight: bold; width: 30%; }
    .capture-box { background: #fffbeb; border: 1px solid #fbbf24; border-radius: 8px; padding: 12px; margin: 8px 0; }
    .kori-box { background: #f5f3ff; border: 1px solid #c4b5fd; border-radius: 8px; padding: 10px; margin: 8px 0; }
    .game-box { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 12px; margin: 8px 0; }
    .climax-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 10px; margin: 6px 0; }
    .tag { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 9pt; margin: 2px; }
    ul { margin: 4px 0 4px 20px; }
    li { margin-bottom: 3px; }
    .checklist { list-style: none; padding-left: 0; }
    .checklist li::before { content: "☐ "; }
    .page-break { page-break-before: always; }
  `;

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(state.topic)}</title><style>${css}</style></head><body>`;

  // Title
  html += `<h1>${esc(state.topic)}</h1>`;
  html += `<div class="subtitle">РУССКИЙ ЯЗЫК • ${state.grade} КЛАСС • Урок-конструктор<br>Методология «Живой урок 360» v5.1 • Образовательная сеть «Корифей» • 2026</div>`;

  // Passport
  html += `<h2>📋 Паспорт урока</h2><table>`;
  const rows = [
    ['Тема', p.topic || state.topic], ['Тип урока', p.type], ['Класс', `${state.grade} класс`],
    ['🎯 Эмоциональная цель', p.emotional_goal], ['📚 Образовательная цель', p.educational_goal],
    ['🔑 Ключевое понятие', p.key_concept], ['✏️ Объём письма', p.writing_volume]
  ];
  rows.forEach(([l,v]) => { if(v) html += `<tr><td class="label">${esc(l)}</td><td>${esc(v)}</td></tr>`; });
  html += `</table>`;

  // Warmup
  if (w.calligraphy) {
    html += `<h2>✏️ Разминка</h2>`;
    html += `<p><b>Каллиграфическая минутка (~3 мин):</b> ${esc(w.calligraphy)}</p>`;
    html += `<p><b>Словарная работа (~4 мин):</b> ${esc(w.vocabulary)}</p>`;
    html += `<p><b>🌉 Мостик к теме:</b> <i>${esc(w.bridge)}</i></p>`;
  }

  // Captures
  if (data.captures && data.captures.length > 0) {
    html += `<h2>⚡ АКТ I: ЗАХВАТ — три варианта</h2>`;
    html += `<p><i style="color:#666">Выберите один вариант захвата или скомбинируйте элементы из разных.</i></p>`;
    data.captures.forEach((c, i) => {
      html += `<div class="capture-box"><h3>${esc(c.style)}: «${esc(c.name)}»</h3>`;
      html += `<p><i>Приём: ${esc(c.technique)}</i></p>`;
      html += `<p><b>📢 Учитель:</b> ${esc(c.text)}</p>`;
      if (c.kori_role) html += `<p><b>🎒 Кори:</b> ${esc(c.kori_role)}</p>`;
      html += `<p><b>🏆 Первая победа:</b> ${esc(c.first_win)}</p></div>`;
    });
  }

  // Development
  if (dev.new_material) {
    html += `<h2>📚 АКТ II: РАЗВИТИЕ</h2>`;
    html += `<h3>Изучение нового материала (${dev.new_material.duration || 7} мин)</h3>`;
    if (dev.new_material.key_content) {
      html += `<ul>${dev.new_material.key_content.map(c => `<li>${esc(c)}</li>`).join('')}</ul>`;
    }
    if (dev.new_material.teacher_text) html += `<p><b>📢</b> ${esc(dev.new_material.teacher_text)}</p>`;
    if (dev.new_material.kori_mistake) {
      html += `<div class="kori-box"><b>🎒 Кори путается:</b> <i>«${esc(dev.new_material.kori_mistake.mistake)}»</i>`;
      html += `<br><b>👧 Дети исправляют:</b> ${esc(dev.new_material.kori_mistake.correction)}</div>`;
    }
  }

  // Active game
  if (dev.active_game) {
    html += `<div class="game-box"><h3>🎮 ${esc(dev.active_game.name)} (${dev.active_game.duration || 8} мин)</h3>`;
    html += `<p><b>Тип:</b> ${esc(dev.active_game.type)}</p>`;
    if (dev.active_game.rules) {
      const rules = Array.isArray(dev.active_game.rules) ? dev.active_game.rules : [dev.active_game.rules];
      html += `<p><b>Правила:</b></p><ol>${rules.map(r => `<li>${esc(r)}</li>`).join('')}</ol>`;
    }
    if (dev.active_game.words_or_tasks) {
      html += `<p><b>Слова/задания:</b> ${dev.active_game.words_or_tasks.map(w => `<span class="tag" style="background:#d1fae5">${esc(w)}</span>`).join(' ')}</p>`;
    }
    if (dev.active_game.traps) html += `<p><b>⚠️ Ловушки:</b> ${dev.active_game.traps.map(t => esc(t)).join('; ')}</p>`;
    if (dev.active_game.online_adaptation) html += `<p><b>💻 Онлайн:</b> ${esc(dev.active_game.online_adaptation)}</p>`;
    html += `</div>`;
  }

  // Written practice
  if (dev.written_practice) {
    html += `<h3>✏️ Письменная работа (${esc(dev.written_practice.volume)}, ${dev.written_practice.duration || 8} мин)</h3>`;
    if (dev.written_practice.variants) {
      html += `<ul>${dev.written_practice.variants.map(v => `<li>${esc(v)}</li>`).join('')}</ul>`;
    }
  }

  // Climax
  html += `<h2>🎬 АКТ III: КУЛЬМИНАЦИЯ</h2>`;
  if (cl.humanitarian_question) html += `<div class="climax-box"><b>💭 Гуманитарный вопрос:</b> ${esc(cl.humanitarian_question)}</div>`;
  if (cl.practical_question) html += `<div class="climax-box"><b>🔍 Практический вопрос:</b> ${esc(cl.practical_question)}</div>`;
  if (cl.choral && cl.choral.length > 0) {
    html += `<p><b>📣 Хоровое закрепление:</b></p><ul>${cl.choral.map(c => `<li>${esc(c)}</li>`).join('')}</ul>`;
  }
  if (cl.i_can_now) html += `<p style="text-align:center;font-size:13pt;font-weight:bold;color:#92400e;background:#fef3c7;padding:10px;border-radius:8px">💪 ${esc(cl.i_can_now)}</p>`;

  // Homework
  if (hw.basic || hw.creative) {
    html += `<h2>🏠 Домашнее задание</h2>`;
    if (hw.basic) html += `<p><b>Базовое:</b> ${esc(hw.basic)}</p>`;
    if (hw.creative) html += `<p><b>Творческое (по желанию):</b> ${esc(hw.creative)}</p>`;
  }

  // Storylines
  if (data.storylines && data.storylines.length > 0) {
    html += `<h2>📖 Сюжетные линии</h2>`;
    data.storylines.forEach(s => {
      html += `<h3>${esc(s.name)} <span style="color:#94a3b8;font-weight:normal">(${esc(s.style)})</span></h3>`;
      html += `<p><b>Этот урок:</b> ${esc(s.this_lesson)}<br><b>Далее:</b> ${esc(s.next_lessons)}</p>`;
    });
  }

  // Checklist
  if (data.checklist) {
    html += `<h2>✅ Чек-лист урока</h2><ul class="checklist">${data.checklist.map(c => `<li>${esc(c.replace('☐ ',''))}</li>`).join('')}</ul>`;
  }

  // Teacher notes
  if (data.teacher_notes) {
    html += `<h2>📝 Заметки для учителя</h2><p style="background:#fffbeb;padding:12px;border-radius:8px;border:1px solid #fbbf24">${esc(data.teacher_notes)}</p>`;
  }

  html += `</body></html>`;

  // Download as .doc (Word opens HTML files natively)
  const blob = new Blob([html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const cleanTopic = (state.topic || 'урок').replace(/[^\wа-яА-ЯёЁ\s]/g, '').trim().replace(/\s+/g, '_').slice(0, 40);
  a.download = `Урок_${state.grade}кл_${cleanTopic}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ========== STEP 4: Result (Primary) ==========
function PrimaryResult({ data, state }) {
  const [openCapture, setOpenCapture] = useState(0);
  const [openStory, setOpenStory] = useState(null);
  const [checks, setChecks] = useState({});
  const [exporting, setExporting] = useState(false);
  const p = data.passport || {};
  const w = data.warmup || {};
  const dev = data.development || {};
  const cl = data.climax || {};
  const hw = data.homework || {};
  const done = Object.values(checks).filter(Boolean).length;
  const total = (data.checklist || []).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const handleExport = () => {
    setExporting(true);
    try { exportPrimaryDocx(data, state); } catch(e) { alert("Ошибка экспорта: " + e.message); }
    setExporting(false);
  };

  const Section = ({ title, icon, children, color = "#1e3a5f" }) => (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 16, color, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>{icon} {title}</h3>
      {children}
    </div>
  );

  const InfoBox = ({ bg, border, children }) => (
    <div style={{ padding: 14, borderRadius: 10, background: bg, border: `1px solid ${border}`, marginBottom: 8, fontSize: 13, lineHeight: 1.6 }}>{children}</div>
  );

  return (
    <div>
      {/* Passport */}
      <div style={{ background: "#f0f4ff", borderRadius: 12, padding: 20, marginBottom: 24, border: "1px solid #c7d2fe" }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#1e3a5f", marginBottom: 4 }}>{state.topic}</div>
        <div style={{ fontSize: 14, color: "#475569", marginBottom: 12 }}>{p.type} • {state.grade} класс • {state.subject}</div>
        <button onClick={handleExport} disabled={exporting} style={{
          background: "#10b981", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px",
          fontSize: 14, fontWeight: 700, cursor: exporting ? "wait" : "pointer", opacity: exporting ? 0.6 : 1,
          width: "100%", marginBottom: 12
        }}>{exporting ? "⏳ Создаём документ..." : "📥 Скачать план урока (.doc)"}</button>
        <div style={{ fontSize: 14, color: "#475569", marginBottom: 12 }}>{p.type} • {state.grade} класс • {state.subject}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
          <div><strong>🎯 Эмоциональная цель:</strong> {p.emotional_goal}</div>
          <div><strong>📚 Образовательная цель:</strong> {p.educational_goal}</div>
          <div><strong>🔑 Ключевое понятие:</strong> {p.key_concept}</div>
          <div><strong>✏️ Объём письма:</strong> {p.writing_volume}</div>
        </div>
      </div>

      {/* Warmup */}
      {w.calligraphy && (
        <Section title="Разминка" icon="✏️">
          <InfoBox bg="#f8fafc" border="#e2e8f0">
            <div><strong>Каллиграфия:</strong> {w.calligraphy}</div>
            <div style={{ marginTop: 6 }}><strong>Словарная работа:</strong> {w.vocabulary}</div>
            <div style={{ marginTop: 6 }}><strong>🌉 Мостик к теме:</strong> <em>{w.bridge}</em></div>
          </InfoBox>
        </Section>
      )}

      {/* Captures - 3 variants */}
      {data.captures && data.captures.length > 0 && (
        <Section title="Захват — 3 варианта (выберите один)" icon="⚡">
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {data.captures.map((c, i) => (
              <button key={i} onClick={() => setOpenCapture(i)} style={{
                flex: 1, padding: "10px 8px", borderRadius: 8, fontSize: 13, fontWeight: openCapture === i ? 700 : 400,
                background: openCapture === i ? "#1e3a5f" : "#f8fafc", color: openCapture === i ? "#fff" : "#475569",
                border: openCapture === i ? "none" : "1px solid #e2e8f0", cursor: "pointer", transition: "all 0.2s"
              }}>{c.style?.split(' ')[0]} {c.name?.slice(0, 20)}</button>
            ))}
          </div>
          {data.captures[openCapture] && (() => {
            const c = data.captures[openCapture];
            return (
              <div style={{ background: "#fffbeb", border: "1px solid #fbbf2440", borderRadius: 12, padding: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#92400e", marginBottom: 4 }}>{c.style}: «{c.name}»</div>
                <div style={{ fontSize: 12, color: "#78350f", marginBottom: 8 }}>Приём: {c.technique}</div>
                <div style={{ fontSize: 14, color: "#1e293b", lineHeight: 1.6, marginBottom: 10, padding: 12, background: "#fff", borderRadius: 8, border: "1px solid #fbbf2420" }}>
                  📢 <strong>Текст учителя:</strong> {c.text}
                </div>
                {c.kori_role && (
                  <div style={{ fontSize: 13, color: "#7c3aed", marginBottom: 6 }}>🎒 <strong>Кори:</strong> {c.kori_role}</div>
                )}
                <div style={{ fontSize: 13, color: "#166534" }}>🏆 <strong>Первая победа:</strong> {c.first_win}</div>
              </div>
            );
          })()}
        </Section>
      )}

      {/* Development */}
      {dev.new_material && (
        <Section title="Развитие" icon="📚">
          <InfoBox bg="#eff6ff" border="#bfdbfe">
            <strong>Новый материал ({dev.new_material.duration} мин):</strong>
            <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
              {(dev.new_material.key_content || []).map((c, i) => <li key={i} style={{ marginBottom: 4 }}>{c}</li>)}
            </ul>
            {dev.new_material.teacher_text && <div style={{ marginTop: 8 }}>📢 {dev.new_material.teacher_text}</div>}
          </InfoBox>

          {dev.new_material.kori_mistake && (
            <InfoBox bg="#f5f3ff" border="#c4b5fd">
              <strong>🎒 Кори путается:</strong> <em>«{dev.new_material.kori_mistake.mistake}»</em>
              <div style={{ marginTop: 4 }}>👧 Дети: {dev.new_material.kori_mistake.correction}</div>
            </InfoBox>
          )}

          {dev.active_game && (
            <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 12, padding: 16, marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#065f46", marginBottom: 6 }}>🎮 {dev.active_game.name} ({dev.active_game.duration} мин)</div>
              <div style={{ fontSize: 12, color: "#047857", marginBottom: 8 }}>Тип: {dev.active_game.type}</div>
              {dev.active_game.rules && (
                <div style={{ marginBottom: 8 }}>
                  <strong style={{ fontSize: 13 }}>Правила:</strong>
                  <ol style={{ margin: "4px 0 0 16px", padding: 0, fontSize: 13 }}>
                    {(Array.isArray(dev.active_game.rules) ? dev.active_game.rules : [dev.active_game.rules]).map((r, i) => <li key={i} style={{ marginBottom: 2 }}>{r}</li>)}
                  </ol>
                </div>
              )}
              {dev.active_game.words_or_tasks && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {dev.active_game.words_or_tasks.map((w, i) => (
                    <span key={i} style={{ padding: "4px 10px", background: "#d1fae5", borderRadius: 8, fontSize: 13 }}>{w}</span>
                  ))}
                </div>
              )}
              {dev.active_game.traps && (
                <div style={{ fontSize: 13, color: "#dc2626", marginBottom: 6 }}>
                  ⚠️ <strong>Ловушки:</strong> {dev.active_game.traps.join('; ')}
                </div>
              )}
              {dev.active_game.online_adaptation && (
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>💻 <strong>Онлайн:</strong> {dev.active_game.online_adaptation}</div>
              )}
            </div>
          )}

          {dev.written_practice && (
            <InfoBox bg="#f8fafc" border="#e2e8f0">
              <strong>✏️ Письменная работа ({dev.written_practice.volume}, {dev.written_practice.duration} мин):</strong>
              <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                {(dev.written_practice.variants || []).map((v, i) => <li key={i} style={{ marginBottom: 2 }}>{v}</li>)}
              </ul>
            </InfoBox>
          )}
        </Section>
      )}

      {/* Climax */}
      <Section title="Кульминация" icon="🎬">
        {cl.humanitarian_question && <InfoBox bg="#fdf4ff" border="#e9d5ff">💭 <strong>Гуманитарный вопрос:</strong> {cl.humanitarian_question}</InfoBox>}
        {cl.practical_question && <InfoBox bg="#eff6ff" border="#bfdbfe">🔍 <strong>Практический вопрос:</strong> {cl.practical_question}</InfoBox>}
        {cl.choral && cl.choral.length > 0 && (
          <InfoBox bg="#ecfdf5" border="#a7f3d0">
            <strong>📣 Хоровое закрепление:</strong>
            {cl.choral.map((c, i) => <div key={i} style={{ marginTop: 4 }}>{c}</div>)}
          </InfoBox>
        )}
        {cl.i_can_now && (
          <div style={{ padding: 12, background: "#fef3c7", borderRadius: 8, border: "1px solid #fbbf2440", fontSize: 14, fontWeight: 600, color: "#92400e", textAlign: "center" }}>
            💪 {cl.i_can_now}
          </div>
        )}
      </Section>

      {/* Homework */}
      {(hw.basic || hw.creative) && (
        <Section title="Домашнее задание" icon="🏠">
          <InfoBox bg="#f8fafc" border="#e2e8f0">
            {hw.basic && <div><strong>Базовое:</strong> {hw.basic}</div>}
            {hw.creative && <div style={{ marginTop: 4 }}><strong>Творческое (по желанию):</strong> {hw.creative}</div>}
          </InfoBox>
        </Section>
      )}

      {/* Storylines */}
      {data.storylines && data.storylines.length > 0 && (
        <Section title="Сюжетные линии (на серию уроков)" icon="📖">
          <div style={{ display: "grid", gap: 8 }}>
            {data.storylines.map((s, i) => (
              <div key={i} onClick={() => setOpenStory(openStory === i ? null : i)}
                style={{ padding: 12, background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0", cursor: "pointer" }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name} <span style={{ fontSize: 12, color: "#94a3b8" }}>({s.style})</span></div>
                {openStory === i && (
                  <div style={{ marginTop: 8, fontSize: 13, color: "#475569" }}>
                    <div><strong>Этот урок:</strong> {s.this_lesson}</div>
                    <div style={{ marginTop: 4 }}><strong>Далее:</strong> {s.next_lessons}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Checklist */}
      {data.checklist && (
        <Section title={`Чек-лист учителя: ${done}/${total}`} icon="✅">
          <div style={{ width: "100%", height: 6, background: "#e2e8f0", borderRadius: 3, marginBottom: 12 }}>
            <div style={{ height: 6, borderRadius: 3, width: `${pct}%`, background: pct === 100 ? "#10b981" : pct >= 60 ? "#f59e0b" : "#ef4444", transition: "width 0.4s" }} />
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {data.checklist.map((item, i) => (
              <div key={i} onClick={() => setChecks(s => ({ ...s, [i]: !s[i] }))}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8,
                  background: checks[i] ? "#f0fdf4" : "#fff", border: checks[i] ? "1px solid #bbf7d0" : "1px solid #e2e8f0", cursor: "pointer" }}>
                <div style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0, border: checks[i] ? "none" : "2px solid #d1d5db",
                  background: checks[i] ? "#10b981" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12 }}>
                  {checks[i] ? "✓" : ""}
                </div>
                <span style={{ fontSize: 13, color: checks[i] ? "#166534" : "#475569" }}>{item.replace('☐ ', '')}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Teacher notes */}
      {data.teacher_notes && (
        <Section title="Заметки для учителя" icon="📝">
          <InfoBox bg="#fffbeb" border="#fbbf2440">{data.teacher_notes}</InfoBox>
        </Section>
      )}

      {/* Bottom export button */}
      <div style={{ marginTop: 24, padding: 20, background: "linear-gradient(135deg, #10b981, #059669)", borderRadius: 12, textAlign: "center" }}>
        <button onClick={handleExport} disabled={exporting} style={{
          background: "#fff", color: "#059669", border: "none", borderRadius: 10, padding: "14px 32px",
          fontSize: 16, fontWeight: 800, cursor: exporting ? "wait" : "pointer", opacity: exporting ? 0.7 : 1,
          width: "100%", boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
        }}>{exporting ? "⏳ Создаём документ..." : "📥 Скачать план урока в Word (.doc)"}</button>
        <div style={{ color: "#fff", fontSize: 12, marginTop: 8, opacity: 0.9 }}>Готовый документ для печати в формате эталонных уроков Корифей</div>
      </div>
    </div>
  );
}

// ========== STEP 4: Result (Standard for 5-11) ==========
function StandardResult({ data, state }) {
  const clInfo = CLUSTERS[gc(state.subject)];
  const model = MODELS.find(m => m.id === state.model);

  return (
    <div>
      <div style={{ background: "#f0f4ff", borderRadius: 12, padding: 20, marginBottom: 24, border: "1px solid #c7d2fe" }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#1e3a5f", marginBottom: 8 }}>{state.topic}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 13 }}>
          <span style={{ padding: "3px 10px", background: "#e0e7ff", borderRadius: 20, color: "#3730a3" }}>{state.grade} класс • {state.subject}</span>
          <span style={{ padding: "3px 10px", background: "#fef3c7", borderRadius: 20, color: "#92400e" }}>{model?.emoji} {model?.name}</span>
          <span style={{ padding: "3px 10px", background: "#f1f5f9", borderRadius: 20, color: "#475569" }}>{state.duration} мин</span>
        </div>
      </div>

      {data.capture && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, color: "#1e3a5f", marginBottom: 8 }}>⚡ Захват</h3>
          <div style={{ padding: 14, background: "#fffbeb", borderRadius: 10, border: "1px solid #fbbf2440", fontSize: 14, lineHeight: 1.6 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{data.capture.technique}</div>
            <div>{data.capture.text}</div>
          </div>
        </div>
      )}

      {data.first_win && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, color: "#1e3a5f", marginBottom: 8 }}>🏆 Первая победа</h3>
          <div style={{ padding: 14, background: "#ecfdf5", borderRadius: 10, border: "1px solid #a7f3d0", fontSize: 14 }}>{data.first_win.task}</div>
        </div>
      )}

      {data.timeline && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, color: "#1e3a5f", marginBottom: 8 }}>⏱️ Таймлайн</h3>
          {data.timeline.map((p, i) => (
            <div key={i} style={{ padding: 12, marginBottom: 6, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }}>
              <div style={{ fontWeight: 600 }}>{p.phase} ({p.duration} мин)</div>
              {p.activity && <div style={{ marginTop: 4 }}>👨‍🏫 {p.activity}</div>}
              {p.students && <div>👧 {p.students}</div>}
              {p.tip && <div style={{ color: "#64748b", fontStyle: "italic" }}>💡 {p.tip}</div>}
            </div>
          ))}
        </div>
      )}

      {data.tasks && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, color: "#1e3a5f", marginBottom: 8 }}>📝 Задачи</h3>
          {['green', 'yellow', 'red'].map(level => data.tasks[level] && (
            <div key={level} style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{level === 'green' ? '🟢' : level === 'yellow' ? '🟡' : '🔴'} {level === 'green' ? 'Базовый' : level === 'yellow' ? 'Продвинутый' : 'Босс'}</span>
              {data.tasks[level].map((t, i) => <div key={i} style={{ fontSize: 13, color: "#475569", marginLeft: 24, marginTop: 2 }}>• {t}</div>)}
            </div>
          ))}
        </div>
      )}

      {data.feedback && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, color: "#1e3a5f", marginBottom: 8 }}>📊 Обратная связь</h3>
          <div style={{ padding: 12, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }}>
            <div><strong>Метод:</strong> {data.feedback.method}</div>
            <div style={{ marginTop: 4 }}><strong>🎫 Билет на выход:</strong> {data.feedback.exit_ticket}</div>
          </div>
        </div>
      )}

      {data.teacher_notes && (
        <div style={{ padding: 14, background: "#fffbeb", borderRadius: 10, border: "1px solid #fbbf2440", fontSize: 13 }}>
          📝 <strong>Заметки:</strong> {data.teacher_notes}
        </div>
      )}
    </div>
  );
}

// ========== STEP 4: Result (Middle School 5-9) ==========
function MiddleResult({ data, state }) {
  const [openCapture, setOpenCapture] = useState(0);
  const clInfo = CLUSTERS[gc(state.subject)];
  const model = MODELS.find(m => m.id === state.model);
  const p = data.passport || {};
  const dev = data.development || {};
  const guild = data.guild_task || {};

  const InfoBox = ({ bg, border, children }) => (
    <div style={{ padding: 14, borderRadius: 10, background: bg, border: `1px solid ${border}`, marginBottom: 8, fontSize: 13, lineHeight: 1.6 }}>{children}</div>
  );
  const Section = ({ title, icon, children }) => (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 16, color: "#1e3a5f", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>{icon} {title}</h3>
      {children}
    </div>
  );

  return (
    <div>
      {/* Passport */}
      <div style={{ background: "#f0f4ff", borderRadius: 12, padding: 20, marginBottom: 24, border: "1px solid #c7d2fe" }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#1e3a5f", marginBottom: 4 }}>{state.topic}</div>
        <div style={{ fontSize: 13, color: "#475569", marginBottom: 8 }}>{p.type} • {state.grade} класс • {state.subject}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
          {p.emotional_goal && <div><strong>🎯 Эмоц. цель:</strong> {p.emotional_goal}</div>}
          {p.educational_goal && <div><strong>📚 Образ. цель:</strong> {p.educational_goal}</div>}
          {p.key_concept && <div style={{ gridColumn: "span 2" }}><strong>🔑 Ключевое понятие:</strong> {p.key_concept}</div>}
        </div>
      </div>

      {/* Captures */}
      {data.captures && data.captures.length > 0 && (
        <Section title="Захват — 3 варианта (выберите один)" icon="⚡">
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {data.captures.map((c, i) => (
              <button key={i} onClick={() => setOpenCapture(i)} style={{
                flex: 1, padding: "10px 8px", borderRadius: 8, fontSize: 12, fontWeight: openCapture === i ? 700 : 400,
                background: openCapture === i ? "#1e3a5f" : "#f8fafc", color: openCapture === i ? "#fff" : "#475569",
                border: openCapture === i ? "none" : "1px solid #e2e8f0", cursor: "pointer"
              }}>{c.style?.split(' ')[0]} {c.name?.slice(0, 18)}</button>
            ))}
          </div>
          {data.captures[openCapture] && (() => {
            const c = data.captures[openCapture];
            return (
              <div style={{ background: "#fffbeb", border: "1px solid #fbbf2440", borderRadius: 12, padding: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#92400e", marginBottom: 4 }}>{c.style}: «{c.name}»</div>
                <div style={{ fontSize: 12, color: "#78350f", marginBottom: 8 }}>Приём: {c.technique}</div>
                <div style={{ fontSize: 14, lineHeight: 1.6, padding: 12, background: "#fff", borderRadius: 8, marginBottom: 8 }}>
                  📢 <strong>Учитель:</strong> {c.text}
                </div>
                {c.kori_role && <div style={{ fontSize: 13, color: "#7c3aed" }}>🎭 <strong>Кори:</strong> {c.kori_role}</div>}
              </div>
            );
          })()}
        </Section>
      )}

      {/* First win */}
      {data.first_win && (
        <Section title="Победа до теории" icon="🏆">
          <InfoBox bg="#ecfdf5" border="#a7f3d0">
            <strong>Задача ({data.first_win.duration} мин):</strong> {data.first_win.task}
          </InfoBox>
        </Section>
      )}

      {/* Development */}
      {dev.key_points && (
        <Section title="Развитие" icon="📚">
          <InfoBox bg="#eff6ff" border="#bfdbfe">
            <strong>Ключевые точки:</strong>
            <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
              {dev.key_points.map((p, i) => <li key={i} style={{ marginBottom: 3 }}>{p}</li>)}
            </ul>
            {dev.teacher_text && <div style={{ marginTop: 8 }}>📢 {dev.teacher_text}</div>}
          </InfoBox>
          {dev.kori && (
            <InfoBox bg="#f5f3ff" border="#c4b5fd">
              <strong>🎭 Кори ({dev.kori.role}):</strong> <em>«{dev.kori.text}»</em>
            </InfoBox>
          )}
          {dev.traps && dev.traps.length > 0 && (
            <InfoBox bg="#fef2f2" border="#fecaca">
              <strong>⚠️ Ловушки:</strong>
              <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
                {dev.traps.map((t, i) => <li key={i} style={{ marginBottom: 3 }}>{t}</li>)}
              </ul>
            </InfoBox>
          )}
        </Section>
      )}

      {/* Guild task */}
      {guild.guilds && (
        <Section title="Задание гильдий" icon="⚔️">
          <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
            {guild.guilds.map((g, i) => (
              <div key={i} style={{ padding: 12, background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13 }}>
                <strong>{g.name}:</strong> {g.task}
              </div>
            ))}
          </div>
          {guild.discussion_question && (
            <InfoBox bg="#fdf4ff" border="#e9d5ff">
              💬 <strong>Общее обсуждение:</strong> {guild.discussion_question}
            </InfoBox>
          )}
        </Section>
      )}

      {/* Tasks */}
      {data.tasks && (
        <Section title="Задачи по уровням" icon="📝">
          {['green', 'yellow', 'red'].map(level => data.tasks[level] && (
            <div key={level} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                {level === 'green' ? '🟢 Базовый' : level === 'yellow' ? '🟡 Продвинутый' : '🔴 Босс'}
              </div>
              {Array.isArray(data.tasks[level])
                ? data.tasks[level].map((t, i) => <div key={i} style={{ fontSize: 13, color: "#475569", marginLeft: 20, marginBottom: 2 }}>• {t}</div>)
                : <div style={{ fontSize: 13, color: "#475569", marginLeft: 20 }}>• {data.tasks[level]}</div>
              }
            </div>
          ))}
        </Section>
      )}

      {/* Reflection */}
      {data.reflection && (
        <Section title="Двойная рефлексия" icon="🪞">
          <InfoBox bg="#f0fdf4" border="#bbf7d0">
            <div><strong>📖 Контент:</strong> {data.reflection.content}</div>
            <div style={{ marginTop: 6 }}><strong>⚙️ Процесс:</strong> {data.reflection.process}</div>
          </InfoBox>
        </Section>
      )}

      {/* Teacher notes */}
      {data.teacher_notes && (
        <Section title="Заметки для учителя" icon="📝">
          <InfoBox bg="#fffbeb" border="#fbbf2440">{data.teacher_notes}</InfoBox>
        </Section>
      )}
    </div>
  );
}

// ========== MAIN APP ==========
export default function App() {
  const [step, setStep] = useState(0);
  const [state, setState] = useState({ duration: 45, format: "offline" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const isPrimary = state.grade && state.grade <= 4;
  const isMiddle = state.grade && state.grade >= 5 && state.grade <= 9;
  const steps = STEPS_BASIC;

  const canNext = useMemo(() => {
    if (step === 0) return state.grade && state.subject && state.topic;
    if (step === 1) return !!state.model;
    return true;
  }, [step, state]);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    let lastErr = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const data = await generateLesson(state);
        setResult(data);
        setStep(3);
        setLoading(false);
        return;
      } catch (e) {
        lastErr = e;
        if (attempt === 0) await new Promise(r => setTimeout(r, 1500));
      }
    }
    setError(lastErr?.message || "Не удалось сгенерировать. Попробуйте ещё раз.");
    setLoading(false);
  }, [state]);

  const reset = () => {
    setStep(0);
    setState({ duration: 45, format: "offline" });
    setResult(null);
    setError(null);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Segoe UI', -apple-system, sans-serif" }}>
      <div style={{ background: "#1e3a5f", color: "#fff", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 24 }}>🎯</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: -0.5 }}>Живой урок 360</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>Конструктор урока • v2.0 {isPrimary ? '• 🎒 Режим Кори' : ''}</div>
          </div>
        </div>
        {step > 0 && (
          <Btn variant="ghost" onClick={reset} style={{ color: "#fff", borderColor: "rgba(255,255,255,0.2)", fontSize: 12 }}>↺ Новый урок</Btn>
        )}
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px" }}>
        <StepIndicator current={step} steps={steps} />
        <div style={{ background: "#fff", borderRadius: 16, padding: 28, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0", marginBottom: 24 }}>
          {step === 0 && <Step1 state={state} setState={setState} />}
          {step === 1 && <Step2 state={state} setState={setState} />}
          {step === 2 && <Step3 state={state} onGenerate={handleGenerate} loading={loading} error={error} />}
          {step === 3 && result && (isPrimary ? <PrimaryResult data={result} state={state} /> : isMiddle ? <MiddleResult data={result} state={state} /> : <StandardResult data={result} state={state} />)}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {step > 0 && step < 3 ? <Btn variant="secondary" onClick={() => setStep(s => s - 1)}>← Назад</Btn> : <div />}
          {step < 2 ? (
            <Btn onClick={() => setStep(s => s + 1)} disabled={!canNext}>Далее →</Btn>
          ) : step === 3 ? (
            <div style={{ display: "flex", gap: 12 }}>
              <Btn variant="secondary" onClick={() => { setResult(null); setStep(2); }}>🔄 Перегенерировать</Btn>
              <Btn onClick={reset}>🎯 Новый урок</Btn>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
