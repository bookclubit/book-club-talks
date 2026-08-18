#!/usr/bin/env node
// Генератор доклада книжного клуба.
// Детерминированно разворачивает единый шаблон _template/ в папку BC-* и
// подставляет данные книги/главы/темы/спикера из репозитория book-club-data
// (единый источник контента клуба).
//
// Источник данных — book-club-data. Путь берётся из (в порядке приоритета):
//   --data <путь> | env BOOK_CLUB_DATA | ../book-club-data (сосед по каталогу)
//
// Использование (не-интерактивно, для CI/AI):
//   node scripts/new-talk.mjs --book docker-up-and-running --chapter 9 \
//        --topic 1 --speaker pomazkov-anton --stream 112 [--force] [--data ../book-club-data]
//
// Имя папки: BC-<стрим>-<КНИГА>-<глава>-<номер темы>-<ФАМИЛИЯ>. Номер темы
// в имени обязателен — иначе доклады одного спикера по одной главе совпали бы.
// --seq добавляет ещё один суффикс; нужен в редких ручных случаях.
//
// Интерактивно (для человека):
//   npm run new-talk
//
// --book    — имя папки книги или её id (meta.id) в book-club-data
// --chapter — slug главы (папка) или её номер (chapter.order)
// --topic   — индекс темы (с 1), её id или точное название
// --speaker — id спикера в index.json (например pomazkov-anton)

import { readFileSync, existsSync, mkdirSync, cpSync, writeFileSync, copyFileSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, basename } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout, env } from 'node:process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = join(ROOT, '_template');

// ---------- утилиты ----------
const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'));
const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// путь в book-club-data вида «/media/...» → абсолютный файл
const dataFile = (DATA, p) => join(DATA, String(p).replace(/^\//, ''));

// Ограничения Cloudflare Pages на имя проекта: lowercase, буквы/цифры/дефисы,
// начинается с буквы или цифры, длина ≤ 58 символов (project + ".pages.dev" ≤ 68).
const CF_PROJECT_RE = /^[a-z0-9][a-z0-9-]*$/;
const CF_PROJECT_MAX = 58;

// Проверка имени проекта Cloudflare Pages; возвращает текст ошибки или null.
function cfProjectNameError(project) {
  if (!CF_PROJECT_RE.test(project))
    return `имя проекта "${project}" не подходит для Cloudflare Pages: допустимы только строчные латинские буквы, цифры и дефисы (без пробелов, точек и кириллицы), первый символ — буква или цифра`;
  if (project.length > CF_PROJECT_MAX)
    return `имя проекта "${project}" длиннее ${CF_PROJECT_MAX} символов (${project.length}) — Cloudflare Pages его не примет`;
  return null;
}

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t.startsWith('--')) {
      const key = t.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) { a[key] = true; }
      else { a[key] = next; i++; }
    }
  }
  return a;
}

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

// человекочитаемая подпись ссылки: «github.com/x ↗»
function urlLabel(url) {
  if (!url) return '';
  return `${url.replace(/^https?:\/\//, '').replace(/\/$/, '')} ↗`;
}

// ---------- «хром»-слайды ----------
// Слайды, которые собирает генератор, помечены в шаблоне data-chrome
// («agenda», «whatnext»): по этой метке их находит и пересборка
// (scripts/rebuild-talk.mjs), не трогая контентные слайды спикера.
export function chromeSlideRe(kind) {
  return new RegExp(
    `[ \\t]*<section class="slide"[^>]*data-chrome="${kind}"[\\s\\S]*?</section>\\s*`,
    '',
  );
}

/** Убирает «хром»-слайд целиком (например, программу вечера у второго доклада). */
export function dropChromeSlide(html, kind) {
  return html.replace(chromeSlideRe(kind), '\n');
}

// Стили «хром»-слайдов выделены в deck.css маркерами: пересборка старого
// доклада обновляет этот блок (иначе новая раскладка таймлайна осталась бы
// без стилей), не трогая всё, что спикер дописал вне маркеров.
const CHROME_CSS_RE = /\/\* @chrome-timeline-start[\s\S]*?\/\* @chrome-timeline-end \*\//;
const LEGACY_TIMELINE_CSS_RE = /\/\* ===== Слайды-таймлайны[\s\S]*?(?=\/\* ===== )/;

/** Подтягивает блок «хром»-стилей доклада к шаблонному. */
export function syncChromeStyles(deckCss, templateCss) {
  const fresh = templateCss.match(CHROME_CSS_RE);
  if (!fresh) return deckCss;
  if (CHROME_CSS_RE.test(deckCss)) return deckCss.replace(CHROME_CSS_RE, fresh[0]);
  // Доклад со старым CSS: блок ещё без маркеров — меняем прежнюю секцию.
  if (LEGACY_TIMELINE_CSS_RE.test(deckCss)) {
    return deckCss.replace(LEGACY_TIMELINE_CSS_RE, `${fresh[0]}\n\n`);
  }
  return `${deckCss.replace(/\s*$/, '')}\n\n${fresh[0]}\n`;
}

/**
 * Тело «хром»-слайда: всё под заголовком внутри `.timeline-next-container`.
 * Меняем целиком (а не пункты внутри `.timeline-next`), потому что от числа
 * тем зависит и сама раскладка — одна колонка или несколько.
 */
export function replaceTimeline(html, kind, block) {
  const slide = html.match(chromeSlideRe(kind));
  if (!slide) return html;
  const updated = slide[0].replace(
    /(<\/h2>)[\s\S]*(<\/div>\s*<\/section>)/,
    (_, head, tail) => `${head}\n                    ${block}\n                ${tail}`,
  );
  return html.replace(slide[0], updated);
}

// ---------- построение таймлайнов ----------
// Пункт программы: `item` = { title, speaker: {name, avatar}, slidesUrl }.
// Название ведёт на доклад этой темы, под ним — спикер с аватаркой: на слайде
// видно не только что будет, но и кто выступает.
function timelineItem(item, state) {
  const title = esc(item.title);
  const link = item.slidesUrl
    ? `<a href="${esc(item.slidesUrl)}" target="_blank" rel="noreferrer">${title}</a>`
    : title;

  const speaker = item.speaker?.name
    ? `
                                <div class="timeline-next-speaker">
                                    ${
                                      item.speaker.avatar
                                        ? `<img class="timeline-next-speaker-avatar" src="assets/speakers/${esc(basename(item.speaker.avatar))}" alt="">`
                                        : ''
                                    }
                                    <span class="timeline-next-speaker-name">${esc(item.speaker.name)}</span>
                                </div>`
    : '';

  // Размеры и отступы задаёт CSS (переменные под число колонок) — инлайновых
  // стилей у пунктов нет, иначе колонки не смогли бы их уменьшить.
  if (state === 'completed') {
    return `<div class="timeline-next-item completed">
                            <div class="timeline-next-marker completed">
                                <svg class="flat-icon" viewBox="0 0 24 24" style="width: 14px; height: 14px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </div>
                            <div class="timeline-next-content">
                                <div class="timeline-next-title">
                                    <span style="text-decoration: line-through;">${link}</span>
                                    <span class="timeline-badge-completed">Пройдено</span>
                                </div>${speaker}
                            </div>
                        </div>`;
  }
  if (state === 'active') {
    return `<div class="timeline-next-item next-large">
                            <div class="timeline-next-marker active"></div>
                            <div class="timeline-next-content">
                                <div class="timeline-next-title">${link}</div>${speaker}
                            </div>
                        </div>`;
  }
  // upcoming
  return `<div class="timeline-next-item">
                            <div class="timeline-next-marker upcoming"></div>
                            <div class="timeline-next-content">
                                <div class="timeline-next-title">${link}</div>${speaker}
                            </div>
                        </div>`;
}

// Сколько тем помещается в колонку, пока таймлайн не начал вылезать за слайд.
const PER_COLUMN = 6;
const MAX_COLUMNS = 3;

/** Подряд идущие темы одной главы — секция будущей колонки. */
function sections(items) {
  const out = [];
  items.forEach((item, index) => {
    const label = item.group || '';
    const last = out[out.length - 1];
    if (last && last.label === label) last.items.push({ item, index });
    else out.push({ label, items: [{ item, index }] });
  });
  return out;
}

/**
 * Пока есть место, делит самую длинную колонку пополам: главы бывают очень
 * разными (пять тем и восемь), и без этого длинная колонка упирается в низ
 * слайда, а рядом пустует место. Порядок вечера сохраняется — колонки читают
 * слева направо, поэтому продолжение главы встаёт следующей колонкой.
 */
function splitLongColumns(columns) {
  const out = columns.map((c) => ({ label: c.label, items: [...c.items] }));
  while (out.length < MAX_COLUMNS) {
    let longest = 0;
    out.forEach((c, i) => {
      if (c.items.length > out[longest].items.length) longest = i;
    });
    if (out[longest].items.length <= PER_COLUMN) break;
    const half = Math.ceil(out[longest].items.length / 2);
    const tail = out[longest].items.splice(half);
    // «Глава 10. Альтернативы React» → «Глава 10 · продолжение»: полное название
    // уже стоит в соседней колонке, а длинный заголовок ломается на две строки.
    const short = out[longest].label.split('. ')[0];
    out.splice(longest + 1, 0, { label: `${short} · продолжение`, items: tail });
  }
  return out;
}

/** Делит список на `cols` колонок примерно поровну, сохраняя порядок. */
function evenColumns(entries, cols) {
  const size = Math.ceil(entries.length / cols);
  const out = [];
  for (let i = 0; i < entries.length; i += size) out.push({ label: '', items: entries.slice(i, i + size) });
  return out;
}

/**
 * Раскладка таймлайна: список тем → колонки. Темы разных глав (в снимке
 * программы у них есть `group`) идут отдельными колонками — слева одна глава,
 * справа другая. Если глава одна, длинный список просто делится поровну:
 * десяток тем в столбик не помещается на слайде.
 */
export function timelineColumns(items) {
  const parts = sections(items);
  const labelled = parts.length > 1 && parts.every((p) => p.label);

  if (!labelled) {
    const entries = items.map((item, index) => ({ item, index }));
    const cols = Math.min(MAX_COLUMNS, Math.max(1, Math.ceil(entries.length / PER_COLUMN)));
    return cols === 1 ? [{ label: '', items: entries }] : evenColumns(entries, cols);
  }
  if (parts.length <= MAX_COLUMNS) return splitLongColumns(parts);

  // Глав больше, чем колонок: складываем соседние главы в общую колонку,
  // пока она не наберёт свою долю тем. Порядок вечера при этом сохраняется.
  const target = Math.ceil(items.length / MAX_COLUMNS);
  const packed = [];
  for (const part of parts) {
    const last = packed[packed.length - 1];
    const full = packed.length >= MAX_COLUMNS;
    if (last && (full || last.items.length + part.items.length <= target)) {
      last.items.push(...part.items);
      last.label = `${last.label} · ${part.label}`;
    } else {
      packed.push({ label: part.label, items: [...part.items] });
    }
  }
  return packed;
}

/** Таймлайн целиком: колонки с заголовками глав и пунктами в состоянии. */
export function buildTimeline(items, stateOf) {
  const columns = timelineColumns(items);
  const longest = Math.max(...columns.map((c) => c.items.length));
  const density = longest > PER_COLUMN ? 'tight' : 'normal';

  const body = columns
    .map((column) => {
      const label = column.label
        ? `<div class="timeline-column-label">${esc(column.label)}</div>\n                            `
        : '';
      const rows = column.items
        .map(({ item, index }) => timelineItem(item, stateOf(index)))
        .join('\n\n                            ');
      return `<div class="timeline-column">
                            ${label}<div class="timeline-next">
                            ${rows}
                            </div>
                        </div>`;
    })
    .join('\n                        ');

  return `<div class="timeline-next-columns" data-cols="${columns.length}" data-density="${density}">
                        ${body}
                    </div>`;
}

export function buildAgenda(items, currentIdx) {
  return buildTimeline(items, (i) =>
    i < currentIdx ? 'completed' : i === currentIdx ? 'active' : 'upcoming',
  );
}

export function buildWhatNext(items, currentIdx) {
  const nextIdx = currentIdx + 1;
  return buildTimeline(items, (i) =>
    i <= currentIdx ? 'completed' : i === nextIdx ? 'active' : 'upcoming',
  );
}

/**
 * Программа вечера: снимок из CMS (`--program`) или, если его нет, темы главы
 * из book-club-data. Снимок нужен потому, что спикеров знает только D1 бота,
 * а ссылки на соседние доклады — CMS.
 *
 * Формат снимка: [{ title, topic_id?, speaker?: {name, avatar}, slides_url?,
 * current?: true }].
 */
export function readProgram(args, chapterTopics, topicIdx) {
  const raw = args['program-file']
    ? readFileSync(resolve(String(args['program-file'])), 'utf8')
    : args.program && args.program !== true
      ? String(args.program)
      : null;

  if (!raw) {
    const items = chapterTopics.map((t) => ({ title: t.title, topicId: t.id }));
    return { items, currentIdx: topicIdx };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    fail(`Не разобрать --program: ${e.message}`);
  }
  if (!Array.isArray(parsed) || parsed.length === 0) fail('--program: ожидался непустой массив тем');

  const items = parsed.map((p) => ({
    title: p.title,
    topicId: p.topic_id ?? p.topicId,
    speaker: p.speaker,
    slidesUrl: p.slides_url ?? p.slidesUrl,
    // Глава темы: по ней таймлайн раскладывается по колонкам (глава — колонка).
    group: p.group ?? p.chapter_title ?? p.chapterTitle,
    current: Boolean(p.current),
  }));

  // Какая тема в программе — эта: сначала по выбранной теме доклада (--topic),
  // и только если её в снимке нет — по метке current. Иначе снимок с чужой
  // меткой (в нём current стоит у первого доклада) сбил бы нумерацию.
  const wanted = chapterTopics[topicIdx];
  let currentIdx = wanted
    ? items.findIndex((p) => p.topicId === wanted.id || p.title === wanted.title)
    : -1;
  if (currentIdx < 0) currentIdx = items.findIndex((p) => p.current);
  if (currentIdx < 0) {
    fail(
      `Тема доклада не найдена в --program (${items.map((p) => p.title).join('; ')}) — программа и тема должны быть из одной встречи.`,
    );
  }
  return { items, currentIdx };
}

/**
 * Темы, объединённые в один доклад. Спикер иногда берёт две-три соседние темы
 * главы и рассказывает их вместе: в chapter.json у них общий `talk_group`
 * (id ведущей темы). Для доклада это одна тема — с названием через запятую
 * и на титульном слайде, и в программе вечера.
 */
export function mergeTalkTopics(topics) {
  const out = [];
  const byKey = new Map();
  for (const topic of topics) {
    const key = String(topic.talk_group ?? '').trim() || topic.id;
    const merged = byKey.get(key);
    if (merged) merged.title = `${merged.title}, ${topic.title}`;
    else {
      const created = { ...topic };
      byKey.set(key, created);
      out.push(created);
    }
  }
  return out;
}

// главы книги в book-club-data: books/<folder>/chapters/<slug>/chapter.json
// В index.json главы лежат объектами {slug, order, title, topics} (реестр v2).
function loadChapters(DATA, folder, entries) {
  return entries
    .map((entry) => {
      const slug = entry.slug;
      const p = join(DATA, 'books', folder, 'chapters', slug, 'chapter.json');
      if (!existsSync(p)) return null;
      const c = readJSON(p);
      return { slug, order: c.order, title: c.title, topics: c.topics ?? [] };
    })
    .filter(Boolean)
    .sort((a, b) => a.order - b.order);
}

// Карточка автора: если у автора есть ссылка (meta.authors[].url) — кликабельна.
function authorCard(a) {
  const label = urlLabel(a.url);
  const img = a.avatar
    ? `<img class="author-avatar" src="assets/authors/${esc(basename(a.avatar))}" alt="${esc(a.name)}">`
    : '';
  const inner = `${img}
                                    <div class="author-info">
                                        <div class="author-name">${esc(a.name)}</div>
                                        <div class="author-link-text">${esc(label)}</div>
                                    </div>`;
  return a.url
    ? `<a class="author-card" href="${esc(a.url)}" target="_blank">
                                    ${inner}
                                </a>`
    : `<div class="author-card">
                                    ${inner}
                                </div>`;
}

function speakerCard(s) {
  const label = urlLabel(s.url);
  const img = s.avatar
    ? `<img class="author-avatar" src="assets/speakers/${esc(basename(s.avatar))}" alt="${esc(s.name)}">`
    : '';
  const inner = `${img}
                                <div class="author-info">
                                    <div class="author-name">${esc(s.name)}</div>
                                    <div class="author-link-text">${esc(label)}</div>
                                </div>`;
  return s.url
    ? `<a class="author-card" href="${esc(s.url)}" target="_blank">
                                ${inner}
                            </a>`
    : `<div class="author-card">
                                ${inner}
                            </div>`;
}

// url спикера — из его соцсетей (github → website → telegram).
function speakerUrl(s) {
  const soc = s.socials ?? {};
  return soc.github || soc.website || soc.telegram || '';
}

// ---------- интерактивный выбор ----------
async function pick(rl, label, items, render) {
  console.log(`\n${label}:`);
  items.forEach((it, i) => console.log(`  ${i + 1}) ${render(it)}`));
  while (true) {
    const ans = (await rl.question('  Выбор (номер): ')).trim();
    const n = Number(ans);
    if (Number.isInteger(n) && n >= 1 && n <= items.length) return items[n - 1];
    console.log('  Некорректный номер, повторите.');
  }
}

// ---------- основной поток ----------
async function main() {
  const args = parseArgs(process.argv.slice(2));

  const DATA = resolve(
    args.data || env.BOOK_CLUB_DATA || join(ROOT, '..', 'book-club-data'),
  );
  if (!existsSync(join(DATA, 'index.json')))
    fail(`Не найден book-club-data: ${DATA}. Укажите --data <путь> или env BOOK_CLUB_DATA.`);

  const index = readJSON(join(DATA, 'index.json'));
  const speakers = index.speakers ?? [];

  let bookEntry, meta, chapter, topicIdx, speaker, stream, seq;

  const interactive = !args.book && stdin.isTTY;
  let rl;
  if (interactive) {
    rl = createInterface({ input: stdin, output: stdout });
    bookEntry = await pick(rl, 'Книга', index.books, (b) => b.title);
    meta = readJSON(join(DATA, 'books', bookEntry.folder, 'meta.json'));
    const chapters = loadChapters(DATA, bookEntry.folder, bookEntry.chapters ?? []);
    if (chapters.length === 0) fail(`У книги ${bookEntry.folder} нет глав в book-club-data.`);
    chapter = await pick(rl, 'Глава', chapters, (c) => `Глава ${c.order} — ${c.title}`);
    const topic = await pick(rl, 'Тема доклада', mergeTalkTopics(chapter.topics), (t) => t.title);
    topicIdx = mergeTalkTopics(chapter.topics).indexOf(topic);
    speaker = await pick(rl, 'Спикер', speakers, (s) => s.name);
    stream = (await rl.question('\nНомер стрима (например 112): ')).trim();
    seq = (await rl.question('Суффикс имени папки (Enter — пропустить, нужен редко): ')).trim();
    rl.close();
  } else {
    bookEntry = index.books.find((b) => b.folder === args.book || b.id === args.book);
    if (!bookEntry) fail(`Книга "${args.book}" не найдена. Доступны: ${index.books.map((b) => b.folder).join(', ')}`);
    meta = readJSON(join(DATA, 'books', bookEntry.folder, 'meta.json'));
    const chapters = loadChapters(DATA, bookEntry.folder, bookEntry.chapters ?? []);
    if (chapters.length === 0) fail(`У книги ${bookEntry.folder} нет глав в book-club-data.`);
    chapter = chapters.find((c) => c.slug === args.chapter || String(c.order) === String(args.chapter));
    if (!chapter) fail(`Глава "${args.chapter}" не найдена. Есть: ${chapters.map((c) => `${c.order} (${c.slug})`).join(', ')}`);
    // topic по индексу (1-based), id или точному названию — среди докладов
    // главы: объединённые темы это один доклад с названием через запятую.
    const talks = mergeTalkTopics(chapter.topics);
    if (/^\d+$/.test(String(args.topic))) topicIdx = Number(args.topic) - 1;
    else topicIdx = talks.findIndex((t) => t.id === args.topic || t.title === args.topic);
    if (topicIdx < 0 || topicIdx >= talks.length)
      fail(`Тема "${args.topic}" не найдена. Темы главы: ${talks.map((t, i) => `${i + 1}) ${t.title}`).join('; ')}`);
    speaker = speakers.find((s) => s.id === args.speaker);
    if (!speaker) fail(`Спикер "${args.speaker}" не найден. Доступны: ${speakers.map((s) => s.id).join(', ')}`);
    stream = String(args.stream || '').trim();
    if (!stream) fail('Не указан --stream (номер стрима).');
    seq = args.seq ? String(args.seq).trim() : '';
  }

  const code = meta.code;
  if (!code) fail(`У книги ${bookEntry.folder} нет поля "code" в meta.json (нужно для имени папки, например DOCKER). Задайте его в CMS.`);

  // Валидация обязательных полей данных — падаем сразу с адресной подсказкой,
  // а не поздно с непонятной ошибкой в разметке или в CI.
  if (!String(meta.title ?? '').trim())
    fail(`У книги ${bookEntry.folder} пустое поле "title" в books/${bookEntry.folder}/meta.json — заполните название книги (в CMS или в book-club-data).`);
  if (chapter.order === undefined || chapter.order === null || String(chapter.order).trim() === '')
    fail(`У главы "${chapter.slug}" книги ${bookEntry.folder} пустое поле "order" в chapter.json — укажите номер главы (нужен для бейджа «Глава N» и имени папки).`);

  const talks = mergeTalkTopics(chapter.topics);
  const topic = talks[topicIdx];
  const topicTitle = topic.title;
  if (!String(topicTitle ?? '').trim())
    fail(`У темы №${topicIdx + 1} главы "${chapter.slug}" книги ${bookEntry.folder} пустое поле "title" в chapter.json — заполните название темы доклада.`);
  // Программа вечера: снимок из CMS (со спикерами и ссылками на доклады)
  // или, если его нет, просто темы главы.
  const program = readProgram(args, talks, topicIdx);
  const surname = String(speaker.id).split('-')[0].toUpperCase();

  // Имя папки: BC-<стрим>-<CODE>-<глава>-<номер темы>-<ФАМИЛИЯ>. Номер темы —
  // её порядок в главе: без него два доклада одного спикера по одной главе
  // получали одну папку и один адрес (и второй доклад затирал первый).
  // У объединённых тем номер берётся по ведущей теме группы — так же его
  // считает CMS, когда заранее сообщает спикеру адрес слайдов.
  const topicNo = chapter.topics.findIndex((t) => t.id === topic.id) + 1 || topicIdx + 1;
  const parts = ['BC', stream, code, chapter.order, topicNo, surname];
  if (seq) parts.push(seq);
  const folder = parts.join('-');
  const project = folder.toLowerCase();

  // Имя папки считает генератор, а ссылку на слайды для заявки и сообщения
  // спикеру — CMS. Если формулы разошлись (например, у админа открыта вкладка
  // со старой сборкой), спикер получит письмо про ветку, которой нет. Поэтому
  // CMS присылает ожидаемое имя, и расхождение роняет генерацию сразу.
  const expected = args.expect && args.expect !== true ? String(args.expect).trim().toUpperCase() : '';
  if (expected && expected !== folder) {
    fail(
      `CMS ждёт доклад "${expected}", а по данным book-club-data имя папки — "${folder}".\n` +
        '  Обычно это старая вкладка CMS: обновите её (Ctrl+F5) и создайте презентацию заново.',
    );
  }

  // Fail-fast: проверяем имя проекта Cloudflare Pages сразу после сборки,
  // а не поздно в CI на шаге wrangler.
  const nameError = cfProjectNameError(project);
  if (nameError)
    fail(`${nameError}.\n  Проверьте составные части имени: стрим "${stream}", код книги "${code}", номер главы "${chapter.order}", номер темы "${topicNo}", фамилию "${surname}"${seq ? `, суффикс "${seq}"` : ''}.`);
  const domain = `https://${project}.pages.dev`;
  const relPath = `talks/${folder}`;
  const target = join(ROOT, 'talks', folder);

  if (existsSync(target) && !args.force) fail(`Папка ${relPath} уже существует. Используйте --force для перезаписи.`);

  // 1. копируем шаблон
  mkdirSync(join(ROOT, 'talks'), { recursive: true });
  cpSync(TEMPLATE, target, { recursive: true, force: true });

  // 2. копируем ассеты из book-club-data/media
  // Обёртка над copyFileSync: адресная ошибка вместо голого стектрейса ENOENT.
  const copyAsset = (srcRel, destDir, what) => {
    const src = dataFile(DATA, srcRel);
    if (!existsSync(src))
      fail(`Нет файла ${srcRel} в book-club-data (искали: ${src}) — ${what}.\n  Проверьте путь в данных книги/спикера или обновите book-club-data (git pull).`);
    try {
      copyFileSync(src, join(target, 'assets', destDir, basename(srcRel)));
    } catch (e) {
      fail(`Не удалось скопировать ${srcRel} из book-club-data (${what}): ${e.message}`);
    }
  };

  mkdirSync(join(target, 'assets', 'cover'), { recursive: true });
  mkdirSync(join(target, 'assets', 'authors'), { recursive: true });
  mkdirSync(join(target, 'assets', 'speakers'), { recursive: true });
  if (meta.cover) copyAsset(meta.cover, 'cover', `обложка книги ${bookEntry.folder} (meta.json → "cover")`);
  for (const a of meta.authors ?? []) {
    if (a.avatar) copyAsset(a.avatar, 'authors', `аватар автора «${a.name}» (meta.json → authors[].avatar)`);
  }
  if (speaker.avatar) copyAsset(speaker.avatar, 'speakers', `аватар спикера «${speaker.name}» (index.json → speakers[].avatar)`);
  // Аватарки спикеров всей программы: они видны на слайдах «Программа вечера»
  // и «Что далее». Доклад автономен, поэтому файлы кладём внутрь папки.
  for (const item of program.items) {
    const avatar = item.speaker?.avatar;
    if (!avatar || avatar === speaker.avatar) continue;
    copyAsset(avatar, 'speakers', `аватар спикера «${item.speaker.name}» из программы вечера`);
  }

  // 3. подстановки
  const subtitle = meta.title_original ?? '';
  const bookUrl = meta.url ?? '';
  const coverFile = meta.cover ? basename(meta.cover) : '';
  const ogTitle = `${topicTitle} — ${meta.title}`;
  const ogImage = coverFile ? `${domain}/assets/cover/${coverFile}` : '';

  const scalars = {
    TALK_TITLE: esc(topicTitle),
    BOOK_TITLE: esc(meta.title),
    BOOK_SUBTITLE: esc(subtitle),
    BOOK_DESC: esc(meta.description ?? ''),
    BOOK_URL: esc(bookUrl),
    BOOK_COVER_FILE: esc(coverFile),
    CHAPTER_LABEL: `Глава ${esc(chapter.order)}`,
    CHAPTER_TITLE: esc(chapter.title ?? ''),
    AUTHORS_BADGE: (meta.authors ?? []).length > 1 ? 'Авторы' : 'Автор',
    OG_TITLE: esc(ogTitle),
    OG_DESCRIPTION: esc(subtitle || meta.description || ''),
    OG_IMAGE: esc(ogImage),
  };

  const speakerView = { name: speaker.name, avatar: speaker.avatar, url: speakerUrl(speaker) };

  let html = readFileSync(join(target, 'index.html'), 'utf8');
  for (const [k, v] of Object.entries(scalars)) html = html.split(`{{${k}}}`).join(v);
  html = html.replace('<!--AUTHOR_CARDS-->', (meta.authors ?? []).map(authorCard).join('\n                                '));
  html = html.replace('<!--SPEAKER_CARD-->', speakerCard(speakerView));
  html = html.replace('<!--AGENDA_ITEMS-->', buildAgenda(program.items, program.currentIdx));
  html = html.replace('<!--WHATNEXT_ITEMS-->', buildWhatNext(program.items, program.currentIdx));

  // «Программа вечера» — только в первом докладе вечера: дальше её повторять
  // незачем, ход вечера показывает слайд «Что далее».
  if (program.currentIdx > 0) html = dropChromeSlide(html, 'agenda');

  const leftover = html.match(/\{\{[A-Z_]+\}\}|<!--(?:AUTHOR_CARDS|SPEAKER_CARD|AGENDA_ITEMS|WHATNEXT_ITEMS)-->/g);
  if (leftover) fail(`Остались незаполненные маркеры: ${[...new Set(leftover)].join(', ')}`);

  writeFileSync(join(target, 'index.html'), html);

  // Для CI: отдаём имя папки/проекта/URL в $GITHUB_OUTPUT (ветка и PR).
  if (env.GITHUB_OUTPUT) {
    appendFileSync(env.GITHUB_OUTPUT, `folder=${folder}\nproject=${project}\nurl=${domain}\ntopic=${topicTitle}\n`);
  }

  // 4. отчёт
  console.log(`\n✓ Доклад создан: ${relPath}`);
  console.log(`  Книга:   ${meta.title}`);
  console.log(`  Глава:   ${chapter.order} — ${chapter.title}`);
  console.log(`  Тема:    ${topicTitle}`);
  console.log(`  Спикер:  ${speaker.name}`);
  console.log(`  Проект Cloudflare Pages: ${project}`);
  console.log(`  URL после публикации:    ${domain}`);
}

// Файл ещё и модуль: пересборка (rebuild-talk.mjs) переиспользует построение
// таймлайнов, поэтому main запускаем только при прямом вызове.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => fail(e.stack || String(e)));
}
