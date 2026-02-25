import { useState, useCallback, useMemo, useEffect, useRef } from "react";

// ========== DATA ==========
const CLUSTERS = {
  exact: { name: "Точные и естественные", emoji: "🔬", color: "#2563eb", subjects: ["Математика","Алгебра","Геометрия","Физика","Химия","Химия База","Химия Профиль","Информатика","Биология"], profile: "Конвергентное мышление. Тренажёр 30%, Практикум 25%. Бинарная мгновенная ОС. Deliberate practice." },
  lang: { name: "Язык и коммуникация", emoji: "✍️", color: "#7c3aed", subjects: ["Русский язык","Английский язык","Немецкий язык","Французский язык"], profile: "Drilling правил + порождение речи 50/50. Мастерская 25%, Тренажёр 20%. Двойная ОС: бинарная для грамматики + критериальная для текстов." },
  human: { name: "Гуманитарные и социальные", emoji: "📜", color: "#dc2626", subjects: ["Литературное чтение","Литература","Литература База","Литература Профиль","История","Обществознание","География","МХК","Окружающий мир","Изобразительное искусство","Музыка","Технология","Физическая культура"], profile: "Дивергентное мышление. Дискуссия 30%, Исследование 25%. Критериальная + диалогическая ОС." }
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

// Диапазоны классов для каждого предмета
const SUBJECT_GRADES = {
  "Математика":          [1,  6],
  "Алгебра":             [7, 11],
  "Геометрия":           [7, 11],
  "Физика":              [7, 11],
  "Химия":               [8,  9],
  "Химия База":          [10, 11],
  "Химия Профиль":       [10, 11],
  "Информатика":         [7, 11],
  "Биология":            [5, 11],
  "Русский язык":        [1, 11],
  "Английский язык":     [2, 11],
  "Немецкий язык":       [2, 11],
  "Французский язык":    [2, 11],
  "Литература":          [5,  9],
  "Литература База":     [10, 11],
  "Литература Профиль":  [10, 11],
  "История":             [5, 11],
  "Обществознание":      [6, 11],
  "География":           [5,  9],
  "МХК":                 [8, 11],
  "Окружающий мир":            [1,  4],
  "Литературное чтение":       [1,  4],
  "Изобразительное искусство": [1,  4],
  "Музыка":                    [1,  4],
  "Технология":                [1,  4],
  "Физическая культура":       [1,  4],
};

function gc(s) { for (const [k, c] of Object.entries(CLUSTERS)) if (c.subjects.includes(s)) return k; return "exact"; }
function subjectAvailable(subject, grade) {
  if (!grade) return true;
  const r = SUBJECT_GRADES[subject];
  return !r || (grade >= r[0] && grade <= r[1]);
}

// ========== CURRICULUM DATA ==========
// Maps subject+gradeRange to a static JSON file in /curriculum/
const CURRICULUM_FILES = {
  "Математика_1-4": "/curriculum/math-1-4.json",
  "Русский язык_1-4": "/curriculum/russian-1-4.json",
  "Окружающий мир_1-4": "/curriculum/okr-1-4.json",
  "Математика_5-6": "/curriculum/math-5-6.json",
  "Алгебра_7-9": "/curriculum/algebra-7-9.json",
  "Геометрия_7-9": "/curriculum/geometry-7-9.json",
  "Русский язык_5-9": "/curriculum/russian-5-9.json",
  "Литература База_10-11": "/curriculum/literatura-baza-10-11.json",
  "Литература Профиль_10-11": "/curriculum/literatura-profil-10-11.json",
  "Химия_8-9": "/curriculum/himiya-8-9.json",
  "Химия База_10-11": "/curriculum/himiya-10-11-baza.json",
  "Химия Профиль_10-11": "/curriculum/himiya-10-11-profil.json",
  "Литературное чтение_1-4":       "/curriculum/litchtenie-1-4.json",
  "Изобразительное искусство_1-4": "/curriculum/izo-1-4.json",
  "Музыка_1-4":                    "/curriculum/muzyka-1-4.json",
  "Технология_1-4":                "/curriculum/tekhnologiya-1-4.json",
  "Физическая культура_1-4":       "/curriculum/fizkultura-1-4.json",
  // Средняя школа — добавлено Sprint 2
  "Биология_5-9":        "/curriculum/biology-5-9.json",
  "Физика_7-9":          "/curriculum/fizika-7-9.json",
  "Информатика_7-9":     "/curriculum/informatika-7-9.json",
  "История_5-9":         "/curriculum/istoriya-5-9.json",
  "Обществознание_6-9":  "/curriculum/obshestvo-6-9.json",
  "Литература_5-9":      "/curriculum/literatura-5-9.json",
  "География_5-9":       "/curriculum/geografiya-5-9.json",
  // Старшая школа (СОО) — добавлено Sprint 2
  "Математика_10-11_база":          "/curriculum/matematika-10-11-baza.json",
  "Математика_10-11_углублённый":   "/curriculum/matematika-10-11-ugl.json",
  "Физика_10-11_база":              "/curriculum/fizika-10-11-baza.json",
  "Физика_10-11_углублённый":       "/curriculum/fizika-10-11-ugl.json",
  "Русский язык_10-11":             "/curriculum/russian-10-11.json",
  "История_10-11_база":             "/curriculum/istoriya-10-11-baza.json",
  "История_10-11_углублённый":      "/curriculum/istoriya-10-11-ugl.json",
  "Обществознание_10-11_база":      "/curriculum/obshestvo-10-11-baza.json",
  "Обществознание_10-11_углублённый": "/curriculum/obshestvo-10-11-ugl.json",
};

function getCurriculumKey(subject, grade) {
  if (subject === "Математика" && grade >= 1 && grade <= 4) return "Математика_1-4";
  if (subject === "Русский язык" && grade >= 1 && grade <= 4) return "Русский язык_1-4";
  if (subject === "Окружающий мир" && grade >= 1 && grade <= 4) return "Окружающий мир_1-4";
  if (subject === "Математика" && grade >= 5 && grade <= 6) return "Математика_5-6";
  if (subject === "Алгебра" && grade >= 7 && grade <= 9) return "Алгебра_7-9";
  if (subject === "Геометрия" && grade >= 7 && grade <= 9) return "Геометрия_7-9";
  if (subject === "Русский язык" && grade >= 5 && grade <= 9) return "Русский язык_5-9";
  if (subject === "Литература База" && grade >= 10 && grade <= 11) return "Литература База_10-11";
  if (subject === "Литература Профиль" && grade >= 10 && grade <= 11) return "Литература Профиль_10-11";
  if (subject === "Химия" && grade >= 8 && grade <= 9) return "Химия_8-9";
  if (subject === "Химия База" && grade >= 10 && grade <= 11) return "Химия База_10-11";
  if (subject === "Химия Профиль" && grade >= 10 && grade <= 11) return "Химия Профиль_10-11";
  if (subject === "Литературное чтение" && grade >= 1 && grade <= 4) return "Литературное чтение_1-4";
  if (subject === "Изобразительное искусство" && grade >= 1 && grade <= 4) return "Изобразительное искусство_1-4";
  if (subject === "Музыка" && grade >= 1 && grade <= 4) return "Музыка_1-4";
  if (subject === "Технология" && grade >= 1 && grade <= 4) return "Технология_1-4";
  if (subject === "Физическая культура" && grade >= 1 && grade <= 4) return "Физическая культура_1-4";
  // Средняя школа — добавлено Sprint 2
  if (subject === "Биология" && grade >= 5 && grade <= 9) return "Биология_5-9";
  if (subject === "Физика" && grade >= 7 && grade <= 9) return "Физика_7-9";
  if (subject === "Информатика" && grade >= 7 && grade <= 9) return "Информатика_7-9";
  if (subject === "История" && grade >= 5 && grade <= 9) return "История_5-9";
  if (subject === "Обществознание" && grade >= 6 && grade <= 9) return "Обществознание_6-9";
  if (subject === "Литература" && grade >= 5 && grade <= 9) return "Литература_5-9";
  if (subject === "География" && grade >= 5 && grade <= 9) return "География_5-9";
  // Старшая школа (СОО) — добавлено Sprint 2
  // Алгебра и Геометрия в 10-11 классе объединены в ФРП по Математике (СОО)
  if (subject === "Алгебра" && grade >= 10 && grade <= 11) return "Математика_10-11_база";
  if (subject === "Геометрия" && grade >= 10 && grade <= 11) return "Математика_10-11_база";
  if (subject === "Математика" && grade >= 10 && grade <= 11) return "Математика_10-11_база";
  if (subject === "Математика (углублённый)" && grade >= 10 && grade <= 11) return "Математика_10-11_углублённый";
  if (subject === "Физика" && grade >= 10 && grade <= 11) return "Физика_10-11_база";
  if (subject === "Физика (углублённый)" && grade >= 10 && grade <= 11) return "Физика_10-11_углублённый";
  if (subject === "Русский язык" && grade >= 10 && grade <= 11) return "Русский язык_10-11";
  if (subject === "История" && grade >= 10 && grade <= 11) return "История_10-11_база";
  if (subject === "История (углублённый)" && grade >= 10 && grade <= 11) return "История_10-11_углублённый";
  if (subject === "Обществознание" && grade >= 10 && grade <= 11) return "Обществознание_10-11_база";
  if (subject === "Обществознание (углублённый)" && grade >= 10 && grade <= 11) return "Обществознание_10-11_углублённый";
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

// Build curriculum context from sections only (for ФРП-style JSONs without lesson-level detail)
function buildSectionsContext(curriculum, grade, focusSection) {
  if (!curriculum || !grade) return null;
  const gradeSections = (curriculum.sections || []).filter(s => s.grade === grade);
  if (!gradeSections.length) return null;
  const meta = curriculum.meta || {};
  const level = meta.level ? ` (${meta.level})` : '';
  const sectionList = gradeSections.map(s => `${s.title} (${s.hours}ч)`).join('; ');
  const totalH = gradeSections.reduce((acc, s) => acc + (s.hours || 0), 0);
  if (focusSection) {
    return [
      `ПРОГРАММА: ${meta.subject || ''} ${meta.grades || ''} кл.${level} — ${meta.source || 'ФРП'}, ${grade} класс`,
      `ВЫБРАННЫЙ РАЗДЕЛ: ${focusSection.title} (${focusSection.hours}ч)`,
      `Все разделы ${grade} класса (${totalH}ч): ${sectionList}`,
      `Учитывай: тема урока принадлежит разделу "${focusSection.title}". Упоминай предыдущие разделы как контекст, делай связи вперёд на следующие разделы курса.`,
    ].join("\n");
  }
  return [
    `ПРОГРАММА: ${meta.subject || ''} ${meta.grades || ''} кл.${level} — ${meta.source || 'ФРП'}, ${grade} класс`,
    `РАЗДЕЛЫ ${grade} КЛАССА (${totalH}ч всего): ${sectionList}`,
    `Учитывай эти разделы: тема урока должна соответствовать одному из разделов, упоминай связи с соседними темами курса.`,
  ].join("\n");
}

// Build curriculum context string for the system prompt (detailed lesson-level)
function buildCurriculumContext(curriculum, lessonId) {
  if (!curriculum || !lessonId || !curriculum.lessons) return null;
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
function buildSystemPrompt(clusterName, clusterProfile, modelName, grade, format, curriculumCtx, subject = "") {
  const isPrimary = grade <= 4;
  const isMiddle = grade >= 5 && grade <= 9;
  const isLang = clusterName === "Язык и коммуникация";
  const isMath = ["Математика","Алгебра","Геометрия","Физика","Химия","Химия База","Химия Профиль"].includes(subject);
  const isRussian = subject === "Русский язык";
  const isLitReading = subject === "Литературное чтение";
  const isPE = subject === "Физическая культура";
  const writingNorm = grade <= 2 ? "35-50 слов класс / 12-17 дом" : grade <= 3 ? "45-60 / 15-20" : "55-70 / 20-25";

  // Предметная разминка для начальной школы
  let warmupDesc;
  if (isRussian && isPrimary) warmupDesc = "каллиграфическая минутка (буква+соединения+слова) + словарная работа (5-7 слов) + мостик к теме";
  else if (isMath)     warmupDesc = "устный счёт (5-6 примеров вслух хором) + таблица умножения (2-3 мин) + логическая задача-ловушка";
  else if (isLitReading) warmupDesc = "речевая разминка (скороговорка или артикуляция, 2 мин) + вопрос-крючок по прошлому тексту + мостик к теме";
  else if (isPE)       warmupDesc = "лёгкая подвижная разминка (бег на месте, прыжки, потряхивания) + активирующий вопрос по теме";
  else                 warmupDesc = "тематическая разминка-загадка или вопрос по теме урока + мостик к новому знанию";

  // Схема поля warmup в JSON — зависит от предмета
  let warmupSchema;
  if (isRussian && isPrimary)
    warmupSchema = `"warmup":{"calligraphy":"буква+соединения+слова","vocabulary":"формат+объём","bridge":"вопрос-мостик"}`;
  else if (isMath && isPrimary)
    warmupSchema = `"warmup":{"oral_count":"5-6 конкретных примеров для хорового счёта","multiplication":"тема таблицы умножения + 3-4 факта","logic":"задача-ловушка одной строкой","bridge":"мостик к теме урока"}`;
  else if (isPrimary)
    warmupSchema = `"warmup":{"activity":"конкретное упражнение или игровое задание разминки (2-3 мин)","bridge":"мостик к теме урока"}`;
  else
    warmupSchema = null; // средняя и старшая школа — разминка свободная

  const core = `Ты — эксперт «Живой урок 360» (Корифей). Генерируй урок-конструктор на русском.
МЕТОДОЛОГИЯ: 8 компонентов, трёхакт Захват→Развитие→Кульминация, смена каждые ${isPrimary?'5-7':'7-10'} мин, «Победа до теории», мгновенная ОС, уровни 🟢🟡🔴.`;

  const primaryBlock = isPrimary ? `
НАЧАЛКА (${grade}кл): конкретно-образное мышление, концентрация 10-15мин, 70% Открытие. Норма письма: ${writingNorm}.
КОРИ — персонаж-помощник (голубая буква К, шарфик, рюкзачок). 4 роли: задаёт вопросы, ПУТАЕТСЯ (типичная ошибка→дети исправляют), удивляется, хвалит. Минимум 2 появления, одно — ошибка.
РАЗМИНКА (обязательно, 5-7 мин): ${warmupDesc}.
ОБЯЗАТЕЛЬНО ТАКЖЕ: игра-передвижение/физминутка ПО ТЕМЕ, хоровое закрепление, «Что я теперь умею», светофор 🟢🟡🔴.
ШАГ ПОЙЯ (только Математика, Алгебра, Геометрия): используй в задачах на открытие; для других предметов НЕ применяй.` : '';

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
РУССКИЙ ЯЗЫК: drilling правил + порождение речи.${isPrimary ? ' Каллиграфия→словарь→тема.' : ''} Мостик: «На какой вопрос отвечают эти слова?». Стыдные вопросы, слова-ловушки обязательны.` : '';

  const middleJsonFormat = isMiddle ?
`ОТВЕТ — ТОЛЬКО JSON (без markdown, без \`\`\`):
{"passport":{"topic":"str","type":"str","emotional_goal":"str","educational_goal":"str","key_concept":"str"},"captures":[{"style":"🎭 Провокация","name":"str","technique":"str","text":"полный текст учителя 3-4 предложения","kori_role":"str"},{"style":"💭 Загадка","name":"str","technique":"другой приём","text":"другой текст","kori_role":"str"},{"style":"🌍 Связь с жизнью","name":"str","technique":"третий приём","text":"третий текст","kori_role":"str"}],"first_win":{"task":"конкретная задача — ученик пробует ДО объяснения теории","duration":5},"development":{"key_points":["п1","п2","п3"],"teacher_text":"что говорит учитель","kori":{"role":"провокатор/исследователь","text":"реплика Кори"},"traps":["Ловушка 1: утверждение — почему ошибка","Ловушка 2: утверждение — почему ошибка"]},"guild_task":{"guilds":[{"name":"🔬 Учёные","task":"конкретное задание"},{"name":"💡 Изобретатели","task":"конкретное задание"},{"name":"🌍 Исследователи","task":"конкретное задание"}],"discussion_question":"вопрос для общего обсуждения после"},"tasks":{"green":["з1 базовый","з2"],"yellow":["з1 продвинутый","з2"],"red":"босс-задача нестандартное применение"},"reflection":{"content":"Что изменилось в твоём понимании темы?","process":"Как ты работал сегодня? Что помогло думать лучше?"},"teacher_notes":"3-4 предложения"}` : '';

  const jsonFormat = isPrimary ?
`ОТВЕТ — ТОЛЬКО JSON (без markdown, без \`\`\`):
{"passport":{"topic":"str","type":"Урок-открытие/закрепление","emotional_goal":"str","educational_goal":"str","key_concept":"str","writing_volume":"~N слов"},${warmupSchema ? warmupSchema + ',' : ''}"captures":[{"style":"🎭 Драматический","name":"str","technique":"str","text":"ПОЛНЫЙ текст учителя 3-5 предложений","kori_role":"str","first_win":"конкретная задача"},{"style":"💭 Рефлексивный","name":"str","technique":"другой приём","text":"другой текст","kori_role":"str","first_win":"str"},{"style":"🔍 Аналитический","name":"str","technique":"третий приём","text":"третий текст","kori_role":"str","first_win":"str"}],"development":{"new_material":{"duration":7,"key_content":["п1","п2","п3"],"teacher_text":"str","kori_mistake":{"mistake":"ошибка Кори","correction":"как дети исправляют"}},"active_game":{"name":"str","type":"передвижение/жесты/пары","rules":["п1","п2","п3"],"words_or_tasks":["8+ слов"],"traps":["ловушка ⚠️ — почему"],"duration":8,"online_adaptation":"str"},"written_practice":{"volume":"~25-30 слов","variants":["вар1","вар2"],"duration":8}},"climax":{"humanitarian_question":"💭 вопрос про чувства","practical_question":"🔍 что умею + как проверить","choral":["«начало...» — ОТВЕТ!","«начало...» — ОТВЕТ!"],"i_can_now":"Теперь я умею..."},"homework":{"basic":"str","creative":"str (по желанию)"},"storylines":[{"name":"🔬 Назв","style":"str","this_lesson":"str","next_lessons":"str"},{"name":"🏙️ Назв","style":"str","this_lesson":"str","next_lessons":"str"}],"checklist":["☐ п1","☐ п2","☐ п3","☐ п4","☐ п5","☐ п6","☐ п7","☐ п8"],"teacher_notes":"3-4 предложения"}` :
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
  // curriculumCtx = lesson-level (from detailed JSONs); sectionsCtx = auto-built from ФРП sections
  const effectiveCtx = st.curriculumCtx || st.sectionsCtx || null;
  const sysPrompt = buildSystemPrompt(ci.name, ci.profile, mo.name, st.grade, st.format, effectiveCtx, st.subject);
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
        max_tokens: 8000
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
  let hitMaxTokens = false;

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
        // Detect truncation by token limit
        if (ev.type === "message_delta" && ev.delta?.stop_reason === "max_tokens") {
          hitMaxTokens = true;
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
  if (hitMaxTokens) {
    throw new Error("Урок слишком большой — AI достиг лимита токенов. Попробуйте более короткую тему или перегенерируйте.");
  }

  // Repair helper: fix literal newlines/tabs inside JSON string values
  function repairJsonStrings(str) {
    // Replace literal newlines/tabs inside quoted strings only
    return str.replace(/"(?:[^"\\]|\\.)*"/g, (match) =>
      match.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")
    );
  }

  function extractAndParse(raw) {
    // Strip markdown fences
    let s = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    // Find outermost JSON object
    const i = s.indexOf('{');
    const j = s.lastIndexOf('}');
    if (i === -1 || j === -1) throw new Error("No JSON object found");
    s = s.slice(i, j + 1);
    // Fix literal newlines inside strings
    s = repairJsonStrings(s);
    // Fix trailing commas
    s = s.replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(s);
  }

  function extractAndRepair(raw) {
    let s = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const i = s.indexOf('{');
    if (i === -1) throw new Error("No JSON object found");
    let fragment = s.slice(i);
    // Count braces to close incomplete JSON
    let braces = 0, brackets = 0;
    for (const ch of fragment) {
      if (ch === '{') braces++;
      if (ch === '}') braces--;
      if (ch === '[') brackets++;
      if (ch === ']') brackets--;
    }
    while (brackets > 0) { fragment += ']'; brackets--; }
    while (braces > 0) { fragment += '}'; braces--; }
    fragment = repairJsonStrings(fragment);
    fragment = fragment.replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(fragment);
  }

  let parsed;
  try {
    parsed = extractAndParse(text);
  } catch (e) {
    try {
      parsed = extractAndRepair(text);
    } catch (e2) {
      throw new Error("AI не завершил JSON. Попробуйте перегенерировать. Конец: ..." + text.slice(-120));
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

// ========== REFLECTION: localStorage helpers ==========
const REFL_KEY = "zh360_reflections";

function makeReflId(subject, grade, topic) {
  const slug = (s) => (s || "").toLowerCase().replace(/ё/g, "е").replace(/\s+/g, "-").replace(/[^a-zа-я0-9-]/g, "");
  return `${slug(subject)}-${grade}-${slug(topic).slice(0, 30)}`;
}

function saveReflection(subject, grade, topic, data) {
  try {
    const all = JSON.parse(localStorage.getItem(REFL_KEY) || "{}");
    const id = makeReflId(subject, grade, topic);
    all[id] = { ...data, saved_at: new Date().toISOString() };
    localStorage.setItem(REFL_KEY, JSON.stringify(all));
    return id;
  } catch { return null; }
}

function getReflection(subject, grade, topic) {
  try {
    const all = JSON.parse(localStorage.getItem(REFL_KEY) || "{}");
    return all[makeReflId(subject, grade, topic)] || null;
  } catch { return null; }
}

// ========== REFLECTION MODAL ==========
const TIMING_OPTS = [
  { v: "ok",    label: "✅ Уложился в время" },
  { v: "5min",  label: "⏱ Вышел на 5–10 мин" },
  { v: "long",  label: "⌛ Значительно вышел / не завершил" },
];
const MOOD_OPTS = [
  { v: "low",    emoji: "😐", label: "Вялая" },
  { v: "work",   emoji: "🙂", label: "Рабочая" },
  { v: "active", emoji: "😊", label: "Активная" },
  { v: "fire",   emoji: "🔥", label: "Высокий драйв" },
];
const CAPTURE_OPTS = [
  { v: "1", label: "Захват 1" },
  { v: "2", label: "Захват 2" },
  { v: "3", label: "Захват 3" },
  { v: "0", label: "Не использовал" },
];

function ReflectionModal({ state, onClose, onSaved }) {
  const existing = getReflection(state.subject, state.grade, state.topic);
  const [rating,  setRating]  = useState(existing?.rating  || 0);
  const [timing,  setTiming]  = useState(existing?.timing  || "");
  const [mood,    setMood]    = useState(existing?.mood    || "");
  const [capture, setCapture] = useState(existing?.capture || "");
  const [notes,   setNotes]   = useState(existing?.notes   || "");
  const [saved,   setSaved]   = useState(!!existing);

  const canSave = rating > 0 && timing && mood;

  const handleSave = () => {
    saveReflection(state.subject, state.grade, state.topic, { rating, timing, mood, capture, notes });
    setSaved(true);
    onSaved && onSaved();
    setTimeout(onClose, 1200);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 28, maxWidth: 480, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#1e3a5f" }}>📋 Рефлексия после урока</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
              {state.subject} · {state.grade} кл. · {state.topic}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#94a3b8", padding: 0 }}>✕</button>
        </div>

        {saved ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "#16a34a", fontSize: 16, fontWeight: 600 }}>
            ✅ Рефлексия сохранена!
          </div>
        ) : (
          <>
            {/* Rating */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Общая оценка урока</div>
              <div style={{ display: "flex", gap: 8 }}>
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setRating(n)}
                    style={{ fontSize: 26, background: "none", border: "none", cursor: "pointer", opacity: n <= rating ? 1 : 0.3, transition: "opacity 0.15s" }}>⭐</button>
                ))}
              </div>
            </div>

            {/* Timing */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Тайминг</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {TIMING_OPTS.map(o => (
                  <label key={o.v} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "8px 12px", borderRadius: 8,
                    background: timing === o.v ? "#eff6ff" : "#f8fafc", border: timing === o.v ? "1px solid #bfdbfe" : "1px solid #e2e8f0" }}>
                    <input type="radio" name="timing" value={o.v} checked={timing === o.v} onChange={() => setTiming(o.v)} style={{ accentColor: "#1e3a5f" }} />
                    <span style={{ fontSize: 14 }}>{o.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Mood */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Атмосфера класса</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {MOOD_OPTS.map(o => (
                  <button key={o.v} onClick={() => setMood(o.v)}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 16px", borderRadius: 10, cursor: "pointer",
                      border: mood === o.v ? "2px solid #1e3a5f" : "1px solid #e2e8f0",
                      background: mood === o.v ? "#eff6ff" : "#f8fafc", minWidth: 72 }}>
                    <span style={{ fontSize: 24 }}>{o.emoji}</span>
                    <span style={{ fontSize: 11, color: "#475569" }}>{o.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Capture */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Какой захват использовал?</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {CAPTURE_OPTS.map(o => (
                  <button key={o.v} onClick={() => setCapture(o.v)}
                    style={{ padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13,
                      border: capture === o.v ? "2px solid #7c3aed" : "1px solid #e2e8f0",
                      background: capture === o.v ? "#f5f3ff" : "#f8fafc",
                      color: capture === o.v ? "#6d28d9" : "#475569" }}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Что изменить в следующий раз? <span style={{ fontWeight: 400, color: "#94a3b8" }}>(необязательно)</span></div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Например: дать больше времени на игру, усилить хоровое закрепление..."
                rows={3} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", resize: "vertical" }} />
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Btn variant="secondary" onClick={onClose}>Отмена</Btn>
              <Btn onClick={handleSave} disabled={!canSave}
                style={!canSave ? { opacity: 0.5 } : {}}>
                💾 Сохранить рефлексию
              </Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ========== CURRICULUM SELECTOR ==========
function CurriculumSelector({ curriculum, grade, onSelect }) {
  const [selectedId, setSelectedId] = useState("");
  if (!curriculum) return null;

  const gradeSections = (curriculum.sections || []).filter(s => s.grade === grade);
  const gradeLessons = (curriculum.lessons || []).filter(l => l.grade === grade);
  const sectionsOnly = gradeLessons.length === 0 && gradeSections.length > 0;

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
  const meta = curriculum.meta || {};
  const totalH = gradeSections.reduce((acc, s) => acc + (s.hours || 0), 0);

  // ФРП-style JSON: только разделы, без поурочного планирования
  if (sectionsOnly) {
    const [selSectionKey, setSelSectionKey] = useState("");
    const selectedSection = selSectionKey ? gradeSections.find(s => (s.id || s.title) === selSectionKey) : null;
    const handleSectionChange = (e) => {
      const key = e.target.value;
      setSelSectionKey(key);
      const sec = key ? gradeSections.find(s => (s.id || s.title) === key) : null;
      onSelect(sec ? { sectionMode: true, section: sec } : null);
    };
    return (
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
          📚 Раздел программы
          <span style={{ fontWeight: 400, color: "#94a3b8", fontSize: 12 }}>(необязательно — уточняет контекст урока)</span>
        </label>
        <select value={selSectionKey} onChange={handleSectionChange}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #a5b4fc", fontSize: 14, fontFamily: "inherit", background: "#fff", color: "#1e293b" }}>
          <option value="">— Все разделы (тему введите вручную) —</option>
          {gradeSections.map(sec => (
            <option key={sec.id || sec.title} value={sec.id || sec.title}>
              {sec.title} ({sec.hours}ч)
            </option>
          ))}
        </select>
        {selectedSection && (
          <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: "#f0fdf4", border: "1px solid #86efac", fontSize: 12, color: "#166534" }}>
            ✅ Раздел выбран — AI учтёт его при генерации. Введите конкретную тему урока ниже.
          </div>
        )}
        {!selectedSection && (
          <div style={{ marginTop: 6, fontSize: 11, color: "#94a3b8" }}>
            {meta.subject} {meta.grades} кл.{meta.level ? ` · ${meta.level}` : ""} · {grade} класс · {totalH}ч · {gradeSections.length} разделов
          </div>
        )}
      </div>
    );
  }

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
            <optgroup key={sec.id} label={`📂 ${sec.title} (${sec.lessons_range ? `ур. ${sec.lessons_range}` : `${sec.hours ?? sec.total_lessons ?? secLessons.length} ч`})`}>
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
  // Фильтруем предметы по выбранному классу
  const availableSubjects = Object.entries(CLUSTERS).reduce((acc, [k, cl]) => {
    const filtered = cl.subjects.filter(s => subjectAvailable(s, state.grade));
    if (filtered.length) acc.push([k, { ...cl, subjects: filtered }]);
    return acc;
  }, []);
  const cluster = state.subject ? gc(state.subject) : null;
  const clInfo = cluster ? CLUSTERS[cluster] : null;
  const isPrimary = state.grade && state.grade <= 4;
  const curriculum = useCurriculum(state.subject, state.grade);
  const hasCurriculum = !!getCurriculumKey(state.subject, state.grade);

  // Auto-inject sections context when curriculum loads (ФРП-style JSONs without lesson detail)
  // Also clears sectionsCtx when curriculum is null (subject/grade without program)
  useEffect(() => {
    if (!state.grade) return;
    if (!curriculum) {
      // Нет программы для этого предмета/класса — сбрасываем
      setState(s => (s.sectionsCtx ? { ...s, sectionsCtx: null } : s));
      return;
    }
    const hasCurriculumLessons = !!(curriculum.lessons && curriculum.lessons.length);
    if (!hasCurriculumLessons) {
      const ctx = buildSectionsContext(curriculum, state.grade);
      setState(s => ({ ...s, sectionsCtx: ctx }));
    } else {
      // У этого JSON есть поурочное планирование — sectionsCtx не нужен
      setState(s => (s.sectionsCtx ? { ...s, sectionsCtx: null } : s));
    }
  }, [curriculum, state.grade, setState]);

  const handleCurriculumSelect = useCallback((item) => {
    if (!item) {
      // Сброс — восстанавливаем полный sectionsCtx если есть sections
      setState(s => ({ ...s, curriculumLesson: null, curriculumCtx: null }));
      if (curriculum && !(curriculum.lessons && curriculum.lessons.length)) {
        const ctx = buildSectionsContext(curriculum, state.grade);
        setState(s => ({ ...s, sectionsCtx: ctx }));
      }
    } else if (item.sectionMode) {
      // Выбран раздел из ФРП — обновляем sectionsCtx с фокусом на разделе
      const ctx = buildSectionsContext(curriculum, state.grade, item.section);
      setState(s => ({ ...s, sectionsCtx: ctx, curriculumLesson: null, curriculumCtx: null }));
    } else {
      // Выбран конкретный урок из поурочного планирования
      const ctx = buildCurriculumContext(curriculum, item.id);
      setState(s => ({
        ...s,
        topic: item.topic,
        model: MODELS.find(m => m.name === item.model)?.id || s.model,
        curriculumLesson: item.id,
        curriculumCtx: ctx,
      }));
    }
  }, [curriculum, state.grade, setState]);

  return (
    <div>
      <h2 style={{ fontSize: 22, marginBottom: 8, color: "#1e3a5f" }}>Параметры урока</h2>
      <p style={{ color: "#64748b", marginBottom: 24, fontSize: 14 }}>Укажите базовые параметры — AI подберёт оптимальный сценарий</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6, display: "block" }}>Класс</label>
          <select value={state.grade || ""} onChange={e => {
            const g = +e.target.value;
            setState(s => ({
              ...s,
              grade: g,
              // сбрасываем предмет если он недоступен для нового класса
              subject: subjectAvailable(s.subject, g) ? s.subject : "",
            }));
          }}
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
            {availableSubjects.map(([k, cl]) => (
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
        {state.curriculumLesson ? (
          <>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#6d28d9", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
              Уточнить тему
              <span style={{ fontWeight: 400, color: "#94a3b8", fontSize: 12 }}>(необязательно — тема взята из программы)</span>
            </label>
            <input value={state.topic || ""} onChange={e => setState(s => ({ ...s, topic: e.target.value }))}
              placeholder="Например: акцент на самостоятельной работе, после каникул, перед контрольной..."
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #a5b4fc", fontSize: 15, fontFamily: "inherit", boxSizing: "border-box", background: "#f5f3ff" }} />
            <div style={{ fontSize: 12, color: "#7c3aed", marginTop: 5, display: "flex", alignItems: "center", gap: 4 }}>
              📚 Тема из программы: <em>{state.topic}</em>
            </div>
          </>
        ) : (
          <>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6, display: "block" }}>Тема урока</label>
            <input value={state.topic || ""} onChange={e => setState(s => ({ ...s, topic: e.target.value }))}
              placeholder="Например: Что такое части речи?"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 15, fontFamily: "inherit", boxSizing: "border-box" }} />
          </>
        )}
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
  html += `<div class="subtitle">${esc((state.subject || "").toUpperCase())} • ${state.grade} КЛАСС • Урок-конструктор<br>Методология «Живой урок 360» v5.1 • Образовательная сеть «Корифей» • 2026</div>`;

  // Passport
  html += `<h2>📋 Паспорт урока</h2><table>`;
  const rows = [
    ['Тема', p.topic || state.topic], ['Тип урока', p.type], ['Класс', `${state.grade} класс`],
    ['🎯 Эмоциональная цель', p.emotional_goal], ['📚 Образовательная цель', p.educational_goal],
    ['🔑 Ключевое понятие', p.key_concept], ['✏️ Объём письма', p.writing_volume]
  ];
  rows.forEach(([l,v]) => { if(v) html += `<tr><td class="label">${esc(l)}</td><td>${esc(v)}</td></tr>`; });
  html += `</table>`;

  // Warmup — универсальный (Russian: calligraphy/vocabulary; Math: oral_count/multiplication/logic; other: activity)
  if (w.calligraphy || w.oral_count || w.activity) {
    html += `<h2>✏️ Разминка</h2>`;
    if (w.calligraphy)    html += `<p><b>Каллиграфическая минутка (~3 мин):</b> ${esc(w.calligraphy)}</p>`;
    if (w.vocabulary)     html += `<p><b>Словарная работа (~4 мин):</b> ${esc(w.vocabulary)}</p>`;
    if (w.oral_count)     html += `<p><b>Устный счёт (~3 мин):</b> ${esc(w.oral_count)}</p>`;
    if (w.multiplication) html += `<p><b>Таблица умножения (~2 мин):</b> ${esc(w.multiplication)}</p>`;
    if (w.logic)          html += `<p><b>Логическая задача (~2 мин):</b> ${esc(w.logic)}</p>`;
    if (w.activity)       html += `<p><b>Разминка (~3 мин):</b> ${esc(w.activity)}</p>`;
    if (w.bridge)         html += `<p><b>🌉 Мостик к теме:</b> <i>${esc(w.bridge)}</i></p>`;
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

      {/* Warmup — универсальный: Russian / Math / другие */}
      {(w.calligraphy || w.oral_count || w.activity) && (
        <Section title="Разминка" icon="✏️">
          <InfoBox bg="#f8fafc" border="#e2e8f0">
            {w.calligraphy    && <div><strong>Каллиграфическая минутка:</strong> {w.calligraphy}</div>}
            {w.vocabulary     && <div style={{ marginTop: 6 }}><strong>Словарная работа:</strong> {w.vocabulary}</div>}
            {w.oral_count     && <div><strong>Устный счёт:</strong> {w.oral_count}</div>}
            {w.multiplication && <div style={{ marginTop: 6 }}><strong>Таблица умножения:</strong> {w.multiplication}</div>}
            {w.logic          && <div style={{ marginTop: 6 }}><strong>Логическая задача:</strong> {w.logic}</div>}
            {w.activity       && <div><strong>Разминка:</strong> {w.activity}</div>}
            {w.bridge         && <div style={{ marginTop: 6 }}><strong>🌉 Мостик к теме:</strong> <em>{w.bridge}</em></div>}
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
// ─────────────────────────────────────────────────────────
// БИБЛИОТЕКА УРОКОВ
// ─────────────────────────────────────────────────────────

function useLessons() {
  const [lessons, setLessons] = useState(null);
  const [libLoading, setLibLoading] = useState(false);
  const refresh = useCallback(() => {
    setLibLoading(true);
    fetch(`/lessons/index.json?t=${Date.now()}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setLessons(Array.isArray(data) ? data : []); setLibLoading(false); })
      .catch(() => { setLessons([]); setLibLoading(false); });
  }, []);
  return { lessons, libLoading, refresh };
}

const MOOD_EMOJI = { low: "😐", work: "🙂", active: "😊", fire: "🔥" };
const TIMING_SHORT = { ok: "✅ В времени", "5min": "⏱ +5–10 мин", long: "⌛ Вышел" };
const STAR_LABEL = ["", "★", "★★", "★★★", "★★★★", "★★★★★"];

function LessonCard({ entry, onOpen }) {
  const [hovered, setHovered] = useState(false);
  const refl = getReflection(entry.subject, entry.grade, entry.topic);
  const dateStr = entry.saved_at
    ? new Date(entry.saved_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "";
  const modelColors = { "Исследование": "#eff6ff:#1d4ed8", "Тренажёр": "#fef3c7:#92400e", "Практикум": "#f0fdf4:#166534", "Мастерская": "#fdf4ff:#7e22ce", "Дискуссия": "#fff1f2:#9f1239", "Квест": "#fff7ed:#c2410c", "Восстановление": "#f8fafc:#475569" };
  const [bg, fg] = (modelColors[entry.model] || "#f8fafc:#475569").split(":");
  return (
    <div
      onClick={() => onOpen(entry)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 16px", cursor: "pointer", background: "#fff", transition: "box-shadow 0.15s", boxShadow: hovered ? "0 4px 14px rgba(0,0,0,0.1)" : "none" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: "#1e293b", lineHeight: 1.4, flex: 1 }}>{entry.topic}</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          {refl && <span title="Урок проведён" style={{ fontSize: 11, padding: "2px 7px", background: "#f0fdf4", color: "#16a34a", borderRadius: 20, border: "1px solid #bbf7d0" }}>
            {MOOD_EMOJI[refl.mood] || "✅"} {refl.rating ? STAR_LABEL[refl.rating] : "Проведён"}
          </span>}
          {entry.model && <div style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", background: bg, color: fg, borderRadius: 20, whiteSpace: "nowrap" }}>{entry.model}</div>}
        </div>
      </div>
      <div style={{ marginTop: 7, fontSize: 12, color: "#64748b", display: "flex", flexWrap: "wrap", gap: "4px 12px", alignItems: "center" }}>
        <span>📚 {entry.subject}</span>
        <span>🎓 {entry.grade} кл.</span>
        {entry.lesson_num > 0 && <span>№{entry.lesson_num}</span>}
        {dateStr && <span style={{ marginLeft: "auto", opacity: 0.7 }}>⏰ {dateStr}</span>}
      </div>
    </div>
  );
}

// ── Lesson detail view (shared between library modes) ──
function LessonDetailView({ openData, onBack, onClose }) {
  const st = openData.meta || {};
  const isPrimary = st.grade && st.grade <= 4;
  const isMiddle = st.grade && st.grade >= 5 && st.grade <= 9;
  const [libReflOpen, setLibReflOpen] = useState(false);
  const [libReflDone, setLibReflDone] = useState(!!getReflection(st.subject, st.grade, st.topic));
  const currentRefl = libReflDone ? getReflection(st.subject, st.grade, st.topic) : null;
  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <Btn variant="secondary" onClick={onBack}>← Назад</Btn>
        <Btn variant={libReflDone ? "ghost" : "accent"} onClick={() => setLibReflOpen(true)}
          style={libReflDone ? { borderColor: "#16a34a", color: "#16a34a" } : {}}>
          {libReflDone ? "✅ Рефлексия" : "📋 Провёл урок"}
        </Btn>
        <Btn variant="ghost" onClick={onClose} style={{ marginLeft: "auto" }}>✕ Закрыть</Btn>
      </div>
      <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 16px", marginBottom: 18, fontSize: 13, color: "#166534" }}>
        📚 {st.subject} · {st.grade} кл. · {openData.saved_at ? new Date(openData.saved_at).toLocaleDateString("ru-RU") : ""}
      </div>
      {currentRefl && (
        <div style={{ background: "#fafafa", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 16px", marginBottom: 18, fontSize: 13 }}>
          <div style={{ fontWeight: 600, color: "#374151", marginBottom: 8 }}>📋 Рефлексия после урока</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {currentRefl.rating && <span style={{ padding: "2px 10px", background: "#fef3c7", borderRadius: 12, color: "#92400e" }}>{STAR_LABEL[currentRefl.rating]}</span>}
            {currentRefl.timing && <span style={{ padding: "2px 10px", background: "#eff6ff", borderRadius: 12, color: "#1d4ed8" }}>{TIMING_SHORT[currentRefl.timing]}</span>}
            {currentRefl.mood && <span style={{ padding: "2px 10px", background: "#f0fdf4", borderRadius: 12, color: "#166534" }}>{MOOD_EMOJI[currentRefl.mood]} {MOOD_OPTS.find(o => o.v === currentRefl.mood)?.label}</span>}
            {currentRefl.capture && currentRefl.capture !== "0" && <span style={{ padding: "2px 10px", background: "#f5f3ff", borderRadius: 12, color: "#6d28d9" }}>Захват {currentRefl.capture}</span>}
          </div>
          {currentRefl.notes && <div style={{ marginTop: 8, color: "#64748b", fontStyle: "italic" }}>💬 {currentRefl.notes}</div>}
        </div>
      )}
      {isPrimary ? <PrimaryResult data={openData.lesson} state={st} />
        : isMiddle ? <MiddleResult data={openData.lesson} state={st} />
        : <StandardResult data={openData.lesson} state={st} />}
      {libReflOpen && <ReflectionModal state={st} onClose={() => setLibReflOpen(false)} onSaved={() => setLibReflDone(true)} />}
    </div>
  );
}

function LibraryView({ onClose }) {
  const { lessons, libLoading, refresh } = useLessons();
  const [search, setSearch] = useState("");
  const [selectedSubject, setSelectedSubject] = useState(null); // null = subject grid
  const [openData, setOpenData] = useState(null);
  const [loadingLesson, setLoadingLesson] = useState(false);

  useEffect(() => { refresh(); }, [refresh]);

  const handleOpen = async (entry) => {
    setLoadingLesson(true);
    try {
      const resp = await fetch(`/lessons/${entry.filename}?t=${Date.now()}`);
      if (!resp.ok) throw new Error("Файл не найден. Возможно, урок ещё не задеплоен (~2-3 мин после сохранения).");
      setOpenData(await resp.json());
    } catch (e) { alert("Ошибка: " + e.message); }
    finally { setLoadingLesson(false); }
  };

  // Открыт конкретный урок
  if (openData) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 900, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "24px 16px" }}>
        <div style={{ background: "#f8fafc", borderRadius: 20, width: "100%", maxWidth: 720, padding: 28, boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}>
          <LessonDetailView openData={openData} onBack={() => setOpenData(null)} onClose={onClose} />
        </div>
      </div>
    );
  }

  // Поиск — глобальный по всем урокам
  const searchResults = search.trim()
    ? (lessons || []).filter(l => l.topic.toLowerCase().includes(search.toLowerCase()) || l.subject.toLowerCase().includes(search.toLowerCase()))
    : null;

  // Группировка по предметам
  const subjectMap = {};
  (lessons || []).forEach(l => {
    if (!subjectMap[l.subject]) subjectMap[l.subject] = [];
    subjectMap[l.subject].push(l);
  });
  const subjectList = Object.entries(subjectMap).sort((a, b) => b[1].length - a[1].length);

  // Уроки выбранного предмета, сгруппированные по классам
  const subjectLessons = selectedSubject ? (subjectMap[selectedSubject] || []) : [];
  const gradeMap = {};
  subjectLessons.forEach(l => {
    if (!gradeMap[l.grade]) gradeMap[l.grade] = [];
    gradeMap[l.grade].push(l);
  });
  const gradeList = Object.entries(gradeMap)
    .sort((a, b) => a[0] - b[0])
    .map(([g, ls]) => [Number(g), ls.sort((a, b) => (a.lesson_num || 0) - (b.lesson_num || 0))]);

  // Subject emoji map
  const subjectEmoji = (s) => {
    const lower = s.toLowerCase();
    if (lower.includes("математик") || lower.includes("алгебр") || lower.includes("геометр")) return "🔢";
    if (lower.includes("физик")) return "⚡";
    if (lower.includes("хими")) return "🧪";
    if (lower.includes("биолог")) return "🌿";
    if (lower.includes("история")) return "📜";
    if (lower.includes("общество")) return "🏛️";
    if (lower.includes("литератур")) return "📖";
    if (lower.includes("русский")) return "✍️";
    if (lower.includes("английск") || lower.includes("иностранн")) return "🌍";
    if (lower.includes("информатик")) return "💻";
    if (lower.includes("географ")) return "🗺️";
    if (lower.includes("окружающ")) return "🌱";
    return "📚";
  };

  const totalLessons = (lessons || []).length;
  const conductedCount = (lessons || []).filter(l => getReflection(l.subject, l.grade, l.topic)).length;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 900, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "24px 16px" }}>
    <div style={{ background: "#f8fafc", borderRadius: 20, width: "100%", maxWidth: 720, minHeight: 300, padding: 28, boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          {selectedSubject
            ? <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={() => setSelectedSubject(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#64748b", padding: 0 }}>←</button>
                <div>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#1e293b" }}>{subjectEmoji(selectedSubject)} {selectedSubject}</h2>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{subjectLessons.length} урок{subjectLessons.length === 1 ? "" : subjectLessons.length < 5 ? "а" : "ов"}</div>
                </div>
              </div>
            : <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#1e293b" }}>📚 Библиотека уроков</h2>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  {libLoading ? "Загрузка..." : `${totalLessons} урок${totalLessons === 1 ? "" : totalLessons < 5 ? "а" : "ов"} · ${conductedCount} проведено`}
                </div>
              </div>
          }
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="secondary" onClick={refresh} style={{ fontSize: 12 }}>↻</Btn>
          <Btn variant="ghost" onClick={onClose}>✕ Закрыть</Btn>
        </div>
      </div>

      {/* Search (always visible) */}
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="🔍 Поиск по теме или предмету..."
        style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 14, outline: "none", marginBottom: 20, boxSizing: "border-box" }} />

      {/* Loading */}
      {(libLoading || loadingLesson) && (
        <div style={{ textAlign: "center", padding: 48, color: "#64748b" }}>⏳ {loadingLesson ? "Открываю урок..." : "Загрузка..."}</div>
      )}

      {!libLoading && !loadingLesson && (
        <>
          {/* Search results */}
          {searchResults !== null && (
            <>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
                {searchResults.length === 0 ? "Ничего не найдено" : `Найдено: ${searchResults.length}`}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {searchResults.map(entry => <LessonCard key={entry.id} entry={entry} onOpen={handleOpen} />)}
              </div>
            </>
          )}

          {/* Subject grid */}
          {searchResults === null && !selectedSubject && (
            <>
              {subjectList.length === 0 ? (
                <div style={{ textAlign: "center", padding: 56, color: "#94a3b8" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Библиотека пустая</div>
                  <div style={{ fontSize: 13 }}>Сгенерируйте урок и нажмите «💾 Сохранить»</div>
                  <div style={{ fontSize: 12, marginTop: 8, color: "#cbd5e1" }}>Уроки появятся после деплоя Netlify (~2-3 мин)</div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                  {subjectList.map(([subj, ls]) => {
                    const grades = [...new Set(ls.map(l => l.grade))].sort((a, b) => a - b);
                    const conducted = ls.filter(l => getReflection(l.subject, l.grade, l.topic)).length;
                    return (
                      <button key={subj} onClick={() => setSelectedSubject(subj)}
                        style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "18px 16px", cursor: "pointer", textAlign: "left", transition: "all 0.15s", fontFamily: "inherit" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "#1e3a5f"; e.currentTarget.style.boxShadow = "0 4px 14px rgba(30,58,95,0.1)"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "none"; }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>{subjectEmoji(subj)}</div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b", marginBottom: 6, lineHeight: 1.3 }}>{subj}</div>
                        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
                          {ls.length} урок{ls.length === 1 ? "" : ls.length < 5 ? "а" : "ов"}
                          {conducted > 0 && <span style={{ color: "#16a34a", marginLeft: 6 }}>· {conducted} ✅</span>}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {grades.map(g => (
                            <span key={g} style={{ fontSize: 11, padding: "1px 6px", background: "#eff6ff", color: "#1d4ed8", borderRadius: 8 }}>{g} кл.</span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Subject detail — lessons by grade */}
          {searchResults === null && selectedSubject && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {gradeList.map(([grade, ls]) => (
                <div key={grade}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ background: "#1e3a5f", color: "#fff", borderRadius: 20, padding: "2px 10px", fontSize: 12 }}>{grade} класс</span>
                    <span style={{ color: "#94a3b8", fontWeight: 400 }}>{ls.length} урок{ls.length === 1 ? "" : ls.length < 5 ? "а" : "ов"}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {ls.map(entry => <LessonCard key={entry.id} entry={entry} onOpen={handleOpen} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: 20, padding: "10px 14px", background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12, color: "#94a3b8" }}>
        💡 Уроки сохраняются в GitHub и появляются здесь после деплоя Netlify (~2-3 мин)
      </div>
    </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────

export default function App() {
  const [step, setStep] = useState(0);
  const [state, setState] = useState({ duration: 45, format: "offline" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // null | "saving" | "saved" | "error"
  const [saveError, setSaveError] = useState(null);
  const [reflOpen, setReflOpen] = useState(false);
  const [reflDone, setReflDone] = useState(false);

  // Check if reflection already exists when result is shown
  useEffect(() => {
    if (step === 3 && state.subject && state.grade && state.topic) {
      setReflDone(!!getReflection(state.subject, state.grade, state.topic));
    }
  }, [step, state.subject, state.grade, state.topic]);

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

  const handleSave = useCallback(async () => {
    if (!result || !state.subject || saveStatus === "saving") return;
    setSaveStatus("saving");
    setSaveError(null);
    const lessonNum = state.curriculumLesson
      ? parseInt(state.curriculumLesson.replace(/^g\d+_l/, ""), 10) || 0
      : 0;
    const meta = {
      subject: state.subject,
      grade: state.grade,
      topic: state.topic || "",
      model: MODELS.find(m => m.id === state.model)?.name || state.model || "",
      lesson_num: lessonNum,
      curriculum_id: state.curriculumLesson || null,
    };
    try {
      const resp = await fetch("/.netlify/functions/save-lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lesson: result, meta }),
      });
      let data;
      try {
        data = await resp.json();
      } catch {
        throw new Error(`HTTP ${resp.status} — ответ не JSON (функция не развёрнута?)`);
      }
      if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 4000);
    } catch (e) {
      console.error("Save error:", e);
      setSaveError(e.message);
      setSaveStatus("error");
      setTimeout(() => { setSaveStatus(null); setSaveError(null); }, 8000);
    }
  }, [result, state, saveStatus]);

  const reset = () => {
    setStep(0);
    setState({ duration: 45, format: "offline" });
    setResult(null);
    setError(null);
    setSaveStatus(null);
    setSaveError(null);
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
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Btn variant="ghost" onClick={() => setLibraryOpen(true)} style={{ color: "#fff", borderColor: "rgba(255,255,255,0.2)", fontSize: 12 }}>📚 Библиотека</Btn>
          <a href="/feedback.html" target="_blank" rel="noopener noreferrer" style={{ color: "#fff", borderColor: "rgba(255,255,255,0.2)", fontSize: 12, padding: "10px 24px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", textDecoration: "none", fontWeight: 600, fontFamily: "inherit", display: "inline-block" }}>📋 Фидбек</a>
          {step > 0 && (
            <Btn variant="ghost" onClick={reset} style={{ color: "#fff", borderColor: "rgba(255,255,255,0.2)", fontSize: 12 }}>↺ Новый урок</Btn>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px" }}>
        <StepIndicator current={step} steps={steps} />
        <div style={{ background: "#fff", borderRadius: 16, padding: 28, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0", marginBottom: 24 }}>
          {step === 0 && <Step1 state={state} setState={setState} />}
          {step === 1 && <Step2 state={state} setState={setState} />}
          {step === 2 && <Step3 state={state} onGenerate={handleGenerate} loading={loading} error={error} />}
          {step === 3 && result && (isPrimary ? <PrimaryResult data={result} state={state} /> : isMiddle ? <MiddleResult data={result} state={state} /> : <StandardResult data={result} state={state} />)}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {saveError && (
            <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#b91c1c" }}>
              ⚠️ {saveError}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {step > 0 && step < 3 ? <Btn variant="secondary" onClick={() => setStep(s => s - 1)}>← Назад</Btn> : <div />}
            {step < 2 ? (
              <Btn onClick={() => setStep(s => s + 1)} disabled={!canNext}>Далее →</Btn>
            ) : step === 3 ? (
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <Btn variant="secondary" onClick={() => { setResult(null); setStep(2); }}>🔄 Перегенерировать</Btn>
                <Btn
                  variant="secondary"
                  onClick={handleSave}
                  disabled={saveStatus === "saving" || saveStatus === "saved"}
                  style={saveStatus === "saved" ? { borderColor: "#16a34a", color: "#16a34a" } : saveStatus === "error" ? { borderColor: "#dc2626", color: "#dc2626" } : {}}
                >
                  {saveStatus === "saving" ? "⏳ Сохраняю…" : saveStatus === "saved" ? "✅ Сохранено" : saveStatus === "error" ? "❌ Ошибка" : "💾 Сохранить урок"}
                </Btn>
                <Btn
                  variant={reflDone ? "ghost" : "accent"}
                  onClick={() => setReflOpen(true)}
                  style={reflDone ? { borderColor: "#16a34a", color: "#16a34a" } : {}}
                >
                  {reflDone ? "✅ Рефлексия заполнена" : "📋 Провёл урок"}
                </Btn>
                <Btn onClick={reset}>🎯 Новый урок</Btn>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {reflOpen && <ReflectionModal state={state} onClose={() => setReflOpen(false)} onSaved={() => setReflDone(true)} />}
      {libraryOpen && <LibraryView onClose={() => setLibraryOpen(false)} />}
    </div>
  );
}
