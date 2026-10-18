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

import { themeCss } from './book-themes.mjs';

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
// («title», «author», «book», «agenda», «whatnext»): по этой метке их находит
// и пересборка (scripts/rebuild-talk.mjs), не трогая контентные слайды спикера.
// Класс у секции бывает и просто «slide» (старые доклады), и «slide fx …».
export function chromeSlideRe(kind) {
  return new RegExp(
    `[ \\t]*<section class="slide[^"]*"[^>]*data-chrome="${kind}"[\\s\\S]*?</section>[ \\t]*\\n?`,
    '',
  );
}

/** Сквозная нумерация data-slide: после выброшенных слайдов номера не прыгают. */
export function renumberSlides(html) {
  let n = 0;
  return html.replace(/(<section class="slide[^"]*"[^>]*?)data-slide="\d+"/g, (_, head) => `${head}data-slide="${++n}"`);
}

/** Убирает «хром»-слайд целиком (например, программу вечера у второго доклада). */
export function dropChromeSlide(html, kind) {
  // Регулярка забирает строки слайда целиком, но не отступ следующей строки.
  return html.replace(chromeSlideRe(kind), '');
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

// ---------- спикер, автор, книга ----------
// Контакт спикера для титула: в клубе все на связи в Telegram, поэтому он
// первый (и подписью «@ник»), дальше GitHub и сайт. В данных Telegram бывает
// и ссылкой, и «@ником» — приводим к одному виду.
export function speakerContact(s) {
  const soc = s.socials ?? {};
  const tg = String(soc.telegram ?? '').trim();
  if (tg) {
    const handle = tg.replace(/^https?:\/\/(t\.me|telegram\.me)\//i, '').replace(/^@/, '').replace(/\/+$/, '');
    if (handle) return { url: `https://t.me/${handle}`, label: `@${handle}` };
  }
  const url = soc.github || soc.website || '';
  return { url, label: url ? url.replace(/^https?:\/\//, '').replace(/\/$/, '') : '' };
}

/** Блок спикера на титуле: аватар, имя и контакт — кто читает этот доклад. */
export function titleSpeaker(view) {
  const img = view.avatar ? `<img src="assets/speakers/${esc(basename(view.avatar))}" alt="">` : '';
  const inner = `${img}
                            <span><em>Доклад читает</em><b>${esc(view.name)}</b>${view.label ? `<i>${esc(view.label)}</i>` : ''}</span>`;
  return view.url
    ? `<a class="title-speaker" data-rv="left" href="${esc(view.url)}" target="_blank" rel="noopener">
                            ${inner}
                        </a>`
    : `<div class="title-speaker" data-rv="left">
                            ${inner}
                        </div>`;
}

/** Заменить блок спикера на титуле (пересборка, когда спикера сменили). */
export function replaceTitleSpeaker(html, view) {
  return html.replace(/<(a|div) class="title-speaker"[\s\S]*?<\/\1>/, () => titleSpeaker(view));
}

/** Книга на титуле: обложка, название и авторы — по какой книге доклад. */
function titleBook(meta, coverFile) {
  const authors = (meta.authors ?? []).map((a) => a.name).join(', ');
  const img = coverFile ? `<img src="assets/cover/${esc(coverFile)}" alt="">` : '';
  const inner = `<span><em>Книга</em><b>${esc(meta.title)}</b>${authors ? `<span>${esc(authors)}</span>` : ''}</span>
                            ${img}`;
  return meta.url
    ? `<a class="title-book" data-rv="right" href="${esc(meta.url)}" target="_blank" rel="noopener">
                            ${inner}
                        </a>`
    : `<div class="title-book" data-rv="right">
                            ${inner}
                        </div>`;
}

// ---------- открытие стрима ----------
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const TZ_SHORT = { 'Europe/Moscow': 'МСК' };

/** «23 октября 2026 · 18:00 МСК» из полей встречи; без даты — пусто. */
export function eventWhen(event) {
  const m = String(event?.date ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const day = `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
  const time = event.time ? ` · ${event.time}${TZ_SHORT[event.timezone] ? ` ${TZ_SHORT[event.timezone]}` : ''}` : '';
  return day + time;
}

/** «1 доклад», «4 доклада», «5 докладов». */
export function talksWord(n) {
  const d10 = n % 10;
  const d100 = n % 100;
  if (d10 === 1 && d100 !== 11) return `${n} доклад`;
  if (d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14)) return `${n} доклада`;
  return `${n} докладов`;
}

/**
 * Встреча этого стрима в book-club-data (events/<путь> из реестра): из неё
 * слайд открытия берёт дату, время и название вечера. Не нашлась — слайд
 * соберётся без даты, генерация не падает.
 */
export function findEvent(DATA, index, stream) {
  for (const rel of index.events ?? []) {
    const p = join(DATA, 'events', String(rel));
    if (!existsSync(p)) continue;
    try {
      const e = readJSON(p);
      if (String(e.stream ?? '') === String(stream)) return e;
    } catch {
      // битый файл встречи не должен ронять генерацию доклада
    }
  }
  return null;
}

// Ссылки клуба на слайде открытия: плоские одноцветные иконки (линия цвета
// текста, без фирменных цветов) — в одном стиле с остальным деком.
const icon = (paths) =>
  `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${paths.map((d) => `<path d="${d}"/>`).join('')}</svg>`;
const CLUB_LINKS = [
  ['telegram', 'Telegram', icon(['m22 2-7 20-4-9-9-4Z', 'M22 2 11 13'])],
  ['youtube', 'YouTube', icon([
    'M2.5 17a24.1 24.1 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.6 49.6 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.1 24.1 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.6 49.6 0 0 1-16.2 0A2 2 0 0 1 2.5 17',
    'm10 15 5-3-5-3z',
  ])],
  ['vk', 'VK Видео', icon(['M3 7.5 6.5 17 10 7.5', 'M13.5 7.5v9.5', 'M13.5 12.5 19 7.5', 'M15.3 11 19.5 17'])],
  ['boosty', 'Boosty', icon([
    'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4.1 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z',
  ])],
];

/**
 * Слайд «Открытие стрима» — первый в первом докладе вечера: клуб, номер
 * стрима, дата, о чём вечер (книга, глава, сколько докладов) и ссылки клуба
 * из settings.json — их видят и те, кто смотрит запись.
 */
/** Спикеры вечера из программы — каждый по разу, в порядке выступлений. */
export function eveningSpeakers(items) {
  const seen = new Set();
  return items
    .map((i) => i.speaker)
    .filter((sp) => sp?.name && !seen.has(sp.name) && seen.add(sp.name));
}

export function buildOpeningSlide({ meta, chapter, event, stream, coverFile, talks, socials, speakers = [] }) {
  const when = eventWhen(event);
  const title = String(event?.title ?? '').trim() || chapter.title || meta.title;
  const links = CLUB_LINKS.filter(([k]) => socials?.[k])
    .map(([k, label, svg]) => `<a class="chip" href="${esc(socials[k])}" target="_blank" rel="noopener">${svg}${label}</a>`)
    .join('');
  const linksBlock = links
    ? `<div class="open-links" data-rv="fade"><em>Клуб</em><div class="chips">${links}</div></div>`
    : '';
  // Кто выступает сегодня — аватар и имя каждого спикера программы.
  const people = speakers
    .map((sp) => {
      const img = sp.avatar ? `<img src="assets/speakers/${esc(basename(sp.avatar))}" alt="">` : '';
      return `<span class="os">${img}<b>${esc(sp.name)}</b></span>`;
    })
    .join('');
  const speakersBlock = people
    ? `<div class="open-speakers" data-rv="left"><em>Спикеры вечера</em><div class="os-row">${people}</div></div>`
    : '';
  return `<section class="slide fx is-title is-opening" id="slide-opening" data-slide="1" data-chrome="opening" data-toc="Открытие стрима">
                <div class="fx-wrap">
                    <div class="title-meta" data-rv="fade"><span>Книжный клуб</span><span>${esc(when)}</span></div>
                    <div class="open-num" aria-hidden="true">${esc(stream)}</div>
                    <div class="fx-kicker" data-rv="fade"><span class="n">Стрим ${esc(stream)}</span>Добро пожаловать</div>
                    <h1 class="title-h" data-rv>${esc(title)}</h1>
                    <p class="open-sub" data-rv><b>${esc(meta.title)}</b> · Глава ${esc(chapter.order)} · ${talksWord(talks)}</p>
                    <div class="title-bar"></div>
                    <div class="title-foot">
                        ${speakersBlock || linksBlock}
                        ${speakersBlock ? linksBlock : ''}
                        ${titleBook(meta, coverFile)}
                    </div>
                </div>
                <aside class="notes">
                    <p><em>Текст</em> Открытие стрима: поздоровайтесь, назовите книгу и главу вечера, скажите, сколько будет докладов, и напомните про Telegram-канал клуба. Дальше — пара слов об авторе и книге, потом программа.</p>
                </aside>
            </section>`;
}

// Ключ автора — одно правило на три репозитория: id, иначе имя файла
// аватарки, иначе имя.
const authorKey = (a) => a.id || (a.avatar ? basename(a.avatar) : '') || a.name;

const authorNotes = (many) => `
                <aside class="notes">
                    <p><em>Текст</em> Слайд собран генератором из book-club-data. Допишите два-три факта ${many ? 'об авторах: чем они известны и почему им' : 'об авторе: чем он известен и почему ему'} стоит доверять.</p>
                </aside>`;

/**
 * Слайд «Кто написал книгу». Один автор — крупное фото, сайт и все его книги,
 * которые читал клуб (из реестра index.json); несколько — карточки в ряд.
 * Биографии в данных нет: что рассказать об авторе, спикер дописывает сам,
 * подсказка лежит в заметках.
 */
export function buildAuthorSlide(meta, index, folder) {
  const authors = meta.authors ?? [];
  if (authors.length === 0) return '';

  if (authors.length === 1) {
    const a = authors[0];
    const rec = (index.authors ?? []).find((x) => authorKey(x) === authorKey(a));
    const books = (rec?.books ?? [folder])
      .map((f) => (index.books ?? []).find((b) => b.folder === f))
      .filter(Boolean);
    const photo = a.avatar
      ? `<div class="au-photo" data-rv="pop"><img src="assets/authors/${esc(basename(a.avatar))}" alt="${esc(a.name)}"></div>`
      : '';
    const site = a.url
      ? `
                                <div class="au-row" data-rv><span class="k">Сайт</span><div><p><a class="lnk" href="${esc(a.url)}" target="_blank" rel="noopener">${esc(urlLabel(a.url))}</a></p></div></div>`
      : '';
    const list = books
      .map((b) => `<li${b.folder === folder ? ' class="is-now"' : ''}>${esc(b.title)}</li>`)
      .join('');
    return `<section class="slide fx" id="slide-author" data-slide="2" data-chrome="author" data-toc="Кто написал книгу">
                <div class="fx-wrap">
                    <div class="fx-kicker" data-rv="fade">Кто написал книгу</div>
                    <div class="fx-body">
                        <div class="au">
                            <div class="au-id">
                                ${photo}
                                <h2 class="au-name" data-rv="left">${esc(a.name)}</h2>
                            </div>
                            <div class="au-rows">${site}
                                <div class="au-row" data-rv><span class="k">${books.length > 1 ? 'Книги в клубе' : 'В клубе'}</span><div><ul class="au-books">${list}</ul></div></div>
                            </div>
                        </div>
                    </div>
                </div>${authorNotes(false)}
            </section>`;
  }

  const cards = authors
    .map((a) => {
      const img = a.avatar ? `<img src="assets/authors/${esc(basename(a.avatar))}" alt="">` : '';
      return a.url
        ? `<a class="au-card" data-rv="pop" href="${esc(a.url)}" target="_blank" rel="noopener">${img}<b>${esc(a.name)}</b><span>${esc(urlLabel(a.url))}</span></a>`
        : `<div class="au-card" data-rv="pop">${img}<b>${esc(a.name)}</b></div>`;
    })
    .join('\n                            ');
  const many = authors.length;
  const heading = many === 2 ? 'Два автора' : many === 3 ? 'Три автора' : many === 4 ? 'Четыре автора' : `Авторов: ${many}`;
  return `<section class="slide fx" id="slide-author" data-slide="2" data-chrome="author" data-toc="Кто написал книгу">
                <div class="fx-wrap">
                    <div class="fx-kicker" data-rv="fade">Кто написал книгу</div>
                    <h2 class="fx-h" data-rv>${heading}</h2>
                    <div class="fx-body">
                        <div class="au-grid" style="--n:${Math.min(many, 4)}">
                            ${cards}
                        </div>
                    </div>
                </div>${authorNotes(true)}
            </section>`;
}

/**
 * Слайд «Что это за книга»: обложка, название, оригинал и издание, описание,
 * сколько глав и тем, полоса глав с сегодняшней главой.
 */
export function buildBookSlide(meta, bookEntry, chapter, coverFile) {
  const total = Number(meta.total_chapters) || (bookEntry.chapters ?? []).length || Number(chapter.order);
  const titles = new Map((bookEntry.chapters ?? []).map((c) => [Number(c.order), c.title]));
  const cells = Array.from({ length: total }, (_, i) => {
    const n = i + 1;
    const t = titles.get(n);
    return `<span class="chap${n === Number(chapter.order) ? ' is-now' : ''}"${t ? ` title="${esc(t)}"` : ''}>${n}</span>`;
  }).join('');
  const sub = [meta.title_original, Number(meta.edition) > 1 ? `${meta.edition}-е издание` : '']
    .filter(Boolean)
    .map(esc)
    .join(' · ');
  const img = `<img src="assets/cover/${esc(coverFile)}" alt="Обложка книги ${esc(meta.title)}">`;
  const cover = coverFile
    ? `<div class="bk2-cover" data-rv="left">${meta.url ? `<a href="${esc(meta.url)}" target="_blank" rel="noopener">${img}</a>` : img}</div>`
    : '<div></div>';
  const topics = (chapter.topics ?? []).length;
  const stats = [
    `<div class="stat"><b data-count="${total}">${total}</b><span>глав в книге</span></div>`,
    topics ? `<div class="stat"><b data-count="${topics}">${topics}</b><span>тем в главе ${esc(chapter.order)}</span></div>` : '',
  ]
    .filter(Boolean)
    .join('\n                                    ');
  return `<section class="slide fx" id="slide-book" data-slide="3" data-chrome="book" data-toc="Что это за книга">
                <div class="fx-wrap">
                    <div class="fx-kicker" data-rv="fade">Что это за книга</div>
                    <div class="fx-body">
                        <div class="bk2">
                            ${cover}
                            <div>
                                <div data-rv>
                                    <div class="bk2-title">${esc(meta.title)}</div>
                                    ${sub ? `<p class="bk2-meta">${sub}</p>` : ''}
                                    ${meta.description ? `<p class="bk2-desc">${esc(meta.description)}</p>` : ''}
                                </div>
                                <div class="stats" data-rv>
                                    ${stats}
                                </div>
                                <div data-rv>
                                    <div class="chaps" style="--chaps:${Math.min(total, 12)}">${cells}</div>
                                    <p class="chaps-cap"><b>Глава ${esc(chapter.order)}</b> · ${esc(chapter.title ?? '')} — сегодня</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <aside class="notes">
                    <p><em>Текст</em> Слайд собран генератором из book-club-data. Расскажите, почему клуб читает эту книгу и о чём глава, которую разбираем сегодня.</p>
                </aside>
            </section>`;
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
  // Фото авторов нужны только слайду «Кто написал книгу» — он есть лишь
  // в первом докладе вечера.
  for (const a of program.currentIdx === 0 ? meta.authors ?? [] : []) {
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
  const coverFile = meta.cover ? basename(meta.cover) : '';
  const ogTitle = `${topicTitle} — ${meta.title}`;
  const ogImage = coverFile ? `${domain}/assets/cover/${coverFile}` : '';
  const first = program.currentIdx === 0;

  const scalars = {
    TALK_TITLE: esc(topicTitle),
    BOOK_TITLE: esc(meta.title),
    CHAPTER_LABEL: `Глава ${esc(chapter.order)}`,
    CHAPTER_TITLE: esc(chapter.title ?? ''),
    STREAM: esc(stream),
    // Подпись внизу каждого слайда (её выводит deck.js).
    HUD_LABEL: esc(`${meta.title} · Глава ${chapter.order} · ${topicTitle}`),
    OG_TITLE: esc(ogTitle),
    OG_DESCRIPTION: esc(subtitle || meta.description || ''),
    OG_IMAGE: esc(ogImage),
  };

  const contact = speakerContact(speaker);
  const speakerView = { name: speaker.name, avatar: speaker.avatar, url: contact.url, label: contact.label };

  let html = readFileSync(join(target, 'index.html'), 'utf8');
  for (const [k, v] of Object.entries(scalars)) html = html.split(`{{${k}}}`).join(v);
  html = html.replace('<!--SPEAKER_CARD-->', titleSpeaker(speakerView));
  html = html.replace('<!--TITLE_BOOK-->', titleBook(meta, coverFile));
  // Открытие стрима, автор, книга и программа вечера — только в первом
  // докладе вечера: в остальных о книге уже рассказали, а ход вечера
  // показывает «Что далее». У первого доклада номер стрима и клуб уже на
  // слайде открытия, поэтому с титула доклада эта строка уходит.
  const settingsPath = join(DATA, 'settings.json');
  const socials = existsSync(settingsPath) ? readJSON(settingsPath).socials ?? {} : {};
  // Строку убираем до вставки открытия: у него своя такая же.
  if (first) html = html.replace(/[ \t]*<div class="title-meta"[^\n]*\n/, '');
  html = html.replace(
    '<!--OPENING_SLIDE-->',
    first
      ? buildOpeningSlide({
          meta,
          chapter,
          event: findEvent(DATA, index, stream),
          stream,
          coverFile,
          talks: program.items.length,
          socials,
          speakers: eveningSpeakers(program.items),
        })
      : '',
  );
  html = html.replace('<!--AUTHOR_SLIDE-->', first ? buildAuthorSlide(meta, index, bookEntry.folder) : '');
  html = html.replace('<!--BOOK_SLIDE-->', first ? buildBookSlide(meta, bookEntry, chapter, coverFile) : '');
  html = html.replace('<!--AGENDA_ITEMS-->', buildAgenda(program.items, program.currentIdx));
  html = html.replace('<!--WHATNEXT_ITEMS-->', buildWhatNext(program.items, program.currentIdx));
  if (!first) html = dropChromeSlide(html, 'agenda');
  html = renumberSlides(html);

  const leftover = html.match(/\{\{[A-Z_]+\}\}|<!--(?:SPEAKER_CARD|TITLE_BOOK|OPENING_SLIDE|AUTHOR_SLIDE|BOOK_SLIDE|AGENDA_ITEMS|WHATNEXT_ITEMS)-->/g);
  if (leftover) fail(`Остались незаполненные маркеры: ${[...new Set(leftover)].join(', ')}`);

  // Цвет книги — свой у каждой книги клуба (scripts/book-themes.mjs).
  writeFileSync(join(target, 'assets', 'css', 'theme.css'), themeCss(bookEntry.folder, meta.title));

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
