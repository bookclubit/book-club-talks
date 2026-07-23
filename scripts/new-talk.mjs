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
//        --topic 1 --speaker pomazkov-anton --stream 112 [--seq 2] [--force] [--data ../book-club-data]
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

// ---------- построение таймлайнов ----------
function timelineItem(title, state) {
  const t = esc(title);
  if (state === 'completed') {
    return `<div class="timeline-next-item completed">
                            <div class="timeline-next-marker completed">
                                <svg class="flat-icon" viewBox="0 0 24 24" style="width: 14px; height: 14px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </div>
                            <div class="timeline-next-content">
                                <div class="timeline-next-title">
                                    <span style="text-decoration: line-through;">${t}</span>
                                    <span class="timeline-badge-completed">Пройдено</span>
                                </div>
                            </div>
                        </div>`;
  }
  if (state === 'active') {
    return `<div class="timeline-next-item next-large">
                            <div class="timeline-next-marker" style="border-color: #fff; background: #fff; top: 21px;"></div>
                            <div class="timeline-next-content">
                                <div class="timeline-next-title">${t}</div>
                            </div>
                        </div>`;
  }
  // upcoming
  return `<div class="timeline-next-item">
                            <div class="timeline-next-marker" style="width: 10px; height: 10px; left: -44px; top: 14px; background: #333; border: none;"></div>
                            <div class="timeline-next-content">
                                <div class="timeline-next-title" style="font-size: 28px;">${t}</div>
                            </div>
                        </div>`;
}

function buildAgenda(topics, currentIdx) {
  return topics.map((tp, i) =>
    timelineItem(tp, i < currentIdx ? 'completed' : i === currentIdx ? 'active' : 'upcoming')
  ).join('\n\n                        ');
}

function buildWhatNext(topics, currentIdx) {
  const nextIdx = currentIdx + 1;
  return topics.map((tp, i) =>
    timelineItem(tp, i <= currentIdx ? 'completed' : i === nextIdx ? 'active' : 'upcoming')
  ).join('\n\n                        ');
}

// главы книги в book-club-data: books/<folder>/chapters/<slug>/chapter.json
function loadChapters(DATA, folder, slugs) {
  return slugs
    .map((slug) => {
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
    const topic = await pick(rl, 'Тема доклада', chapter.topics, (t) => t.title);
    topicIdx = chapter.topics.indexOf(topic);
    speaker = await pick(rl, 'Спикер', speakers, (s) => s.name);
    stream = (await rl.question('\nНомер стрима (например 112): ')).trim();
    seq = (await rl.question('Порядковый номер доклада (Enter — пропустить): ')).trim();
    rl.close();
  } else {
    bookEntry = index.books.find((b) => b.folder === args.book || b.id === args.book);
    if (!bookEntry) fail(`Книга "${args.book}" не найдена. Доступны: ${index.books.map((b) => b.folder).join(', ')}`);
    meta = readJSON(join(DATA, 'books', bookEntry.folder, 'meta.json'));
    const chapters = loadChapters(DATA, bookEntry.folder, bookEntry.chapters ?? []);
    if (chapters.length === 0) fail(`У книги ${bookEntry.folder} нет глав в book-club-data.`);
    chapter = chapters.find((c) => c.slug === args.chapter || String(c.order) === String(args.chapter));
    if (!chapter) fail(`Глава "${args.chapter}" не найдена. Есть: ${chapters.map((c) => `${c.order} (${c.slug})`).join(', ')}`);
    // topic по индексу (1-based), id или точному названию
    if (/^\d+$/.test(String(args.topic))) topicIdx = Number(args.topic) - 1;
    else topicIdx = chapter.topics.findIndex((t) => t.id === args.topic || t.title === args.topic);
    if (topicIdx < 0 || topicIdx >= chapter.topics.length)
      fail(`Тема "${args.topic}" не найдена. Темы главы: ${chapter.topics.map((t, i) => `${i + 1}) ${t.title}`).join('; ')}`);
    speaker = speakers.find((s) => s.id === args.speaker);
    if (!speaker) fail(`Спикер "${args.speaker}" не найден. Доступны: ${speakers.map((s) => s.id).join(', ')}`);
    stream = String(args.stream || '').trim();
    if (!stream) fail('Не указан --stream (номер стрима).');
    seq = args.seq ? String(args.seq).trim() : '';
  }

  const code = meta.code;
  if (!code) fail(`У книги ${bookEntry.folder} нет поля "code" в meta.json (нужно для имени папки, например DOCKER). Задайте его в CMS.`);

  const topic = chapter.topics[topicIdx];
  const topicTitle = topic.title;
  const topicTitles = chapter.topics.map((t) => t.title);
  const surname = String(speaker.id).split('-')[0].toUpperCase();

  // имя папки: BC-<стрим>-<CODE>-<номер главы>-<ФАМИЛИЯ>[-<seq>]
  const parts = ['BC', stream, code, chapter.order, surname];
  if (seq) parts.push(seq);
  const folder = parts.join('-');
  const project = folder.toLowerCase();
  const domain = `https://${project}.pages.dev`;
  const relPath = `talks/${folder}`;
  const target = join(ROOT, 'talks', folder);

  if (existsSync(target) && !args.force) fail(`Папка ${relPath} уже существует. Используйте --force для перезаписи.`);

  // 1. копируем шаблон
  mkdirSync(join(ROOT, 'talks'), { recursive: true });
  cpSync(TEMPLATE, target, { recursive: true, force: true });

  // 2. копируем ассеты из book-club-data/media
  mkdirSync(join(target, 'assets', 'cover'), { recursive: true });
  mkdirSync(join(target, 'assets', 'authors'), { recursive: true });
  mkdirSync(join(target, 'assets', 'speakers'), { recursive: true });
  if (meta.cover) copyFileSync(dataFile(DATA, meta.cover), join(target, 'assets', 'cover', basename(meta.cover)));
  for (const a of meta.authors ?? []) {
    if (a.avatar) copyFileSync(dataFile(DATA, a.avatar), join(target, 'assets', 'authors', basename(a.avatar)));
  }
  if (speaker.avatar) copyFileSync(dataFile(DATA, speaker.avatar), join(target, 'assets', 'speakers', basename(speaker.avatar)));

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
  html = html.replace('<!--AGENDA_ITEMS-->', buildAgenda(topicTitles, topicIdx));
  html = html.replace('<!--WHATNEXT_ITEMS-->', buildWhatNext(topicTitles, topicIdx));

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

main().catch((e) => fail(e.stack || String(e)));
