#!/usr/bin/env node
// Генератор доклада книжного клуба.
// Детерминированно разворачивает единый шаблон _template/ в папку BC-* и
// подставляет данные книги/главы/темы/спикера из data/*.json.
//
// Использование (не-интерактивно, для AI-инструментов и CI):
//   node scripts/new-talk.mjs --book docker-up-and-running --chapter 9 \
//        --topic 1 --speaker pomazkov-anton --stream 112 [--seq 2] [--force]
//
// Интерактивно (для человека):
//   npm run new-talk
//
// --topic принимает индекс (с 1) или точное название темы внутри главы.

import { readFileSync, existsSync, mkdirSync, cpSync, writeFileSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, basename } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = join(ROOT, '_template');
const DATA = join(ROOT, 'data');

// ---------- утилиты ----------
const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'));
const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

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

// ---------- построение таймлайнов ----------
function timelineItem(title, state) {
  const t = esc(title);
  if (state === 'completed') {
    return `<div class="timeline-next-item completed">
                            <div class="timeline-next-marker completed">
                                <svg class="flat-icon" viewBox="0 0 24 24" style="width: 14px; height: 14px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </div>
                            <div class="timeline-next-content">
                                <div class="timeline-next-title" style="text-decoration: line-through;">
                                    ${t}
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

// главы книги лежат в отдельном файле data/books/<id>/chapters.json
function loadChapters(book) {
  const p = join(DATA, 'books', book.id, 'chapters.json');
  if (!existsSync(p)) fail(`Нет файла глав: ${p}`);
  return readJSON(p).chapters;
}

function authorCard(a) {
  const label = a.urlLabel ? `${esc(a.urlLabel)} ↗` : '';
  return `<a class="author-card" href="${esc(a.url)}" target="_blank">
                                    <img class="author-avatar" src="assets/authors/${esc(basename(a.avatar))}" alt="${esc(a.name)}">
                                    <div class="author-info">
                                        <div class="author-name">${esc(a.name)}</div>
                                        <div class="author-link-text">${label}</div>
                                    </div>
                                </a>`;
}

function speakerCard(s) {
  const label = s.urlLabel ? `${esc(s.urlLabel)} ↗` : '';
  const inner = `<img class="author-avatar" src="assets/speakers/${esc(basename(s.avatar))}" alt="${esc(s.name)}">
                                <div class="author-info">
                                    <div class="author-name">${esc(s.name)}</div>
                                    <div class="author-link-text">${label}</div>
                                </div>`;
  return s.url
    ? `<a class="author-card" href="${esc(s.url)}" target="_blank">
                                ${inner}
                            </a>`
    : `<div class="author-card">
                                ${inner}
                            </div>`;
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
  const books = readJSON(join(DATA, 'books.json')).books;
  const speakers = readJSON(join(DATA, 'speakers.json')).speakers;

  let book, chapter, topicIdx, speaker, stream, seq;

  const interactive = !args.book && stdin.isTTY;
  let rl;
  if (interactive) {
    rl = createInterface({ input: stdin, output: stdout });
    book = await pick(rl, 'Книга', books, (b) => b.title);
    const chapters = loadChapters(book);
    chapter = await pick(rl, 'Глава', chapters, (c) => `Глава ${c.chapter_number} — ${c.chapter_title}`);
    const topic = await pick(rl, 'Тема доклада', chapter.topics, (t) => t);
    topicIdx = chapter.topics.indexOf(topic);
    speaker = await pick(rl, 'Спикер', speakers, (s) => s.name);
    stream = (await rl.question('\nНомер стрима (например 112): ')).trim();
    seq = (await rl.question('Порядковый номер доклада (Enter — пропустить): ')).trim();
    rl.close();
  } else {
    // не-интерактивный режим (флаги)
    book = books.find((b) => b.id === args.book);
    if (!book) fail(`Книга "${args.book}" не найдена. Доступны: ${books.map((b) => b.id).join(', ')}`);
    const chapters = loadChapters(book);
    chapter = chapters.find((c) => String(c.chapter_number) === String(args.chapter));
    if (!chapter) fail(`Глава ${args.chapter} не найдена в книге ${book.id}. Есть: ${chapters.map((c) => c.chapter_number).join(', ')}`);
    // topic по индексу (1-based) или по точному названию
    if (/^\d+$/.test(String(args.topic))) topicIdx = Number(args.topic) - 1;
    else topicIdx = chapter.topics.indexOf(args.topic);
    if (topicIdx < 0 || topicIdx >= chapter.topics.length)
      fail(`Тема "${args.topic}" не найдена. Темы главы: ${chapter.topics.map((t, i) => `${i + 1}) ${t}`).join('; ')}`);
    speaker = speakers.find((s) => s.id === args.speaker);
    if (!speaker) fail(`Спикер "${args.speaker}" не найден. Доступны: ${speakers.map((s) => s.id).join(', ')}`);
    stream = String(args.stream || '').trim();
    if (!stream) fail('Не указан --stream (номер стрима).');
    seq = args.seq ? String(args.seq).trim() : '';
  }

  const topic = chapter.topics[topicIdx];

  // имя папки: BC-<стрим>-<CODE>-<глава>-<ФАМИЛИЯ>[-<seq>]
  const parts = ['BC', stream, book.code, chapter.chapter_number, speaker.surname];
  if (seq) parts.push(seq);
  const folder = parts.join('-');
  const project = folder.toLowerCase();
  const domain = `https://${project}.pages.dev`;
  const target = join(ROOT, folder);

  if (existsSync(target) && !args.force) fail(`Папка ${folder} уже существует. Используйте --force для перезаписи.`);

  // 1. копируем шаблон
  cpSync(TEMPLATE, target, { recursive: true, force: true });

  // 2. копируем ассеты (все картинки лежат в data/assets/)
  const bookAssets = join(DATA, 'assets', 'books', book.id);
  mkdirSync(join(target, 'assets', 'cover'), { recursive: true });
  mkdirSync(join(target, 'assets', 'authors'), { recursive: true });
  mkdirSync(join(target, 'assets', 'speakers'), { recursive: true });
  copyFileSync(join(bookAssets, book.cover), join(target, 'assets', 'cover', basename(book.cover)));
  for (const a of book.authors) copyFileSync(join(bookAssets, a.avatar), join(target, 'assets', 'authors', basename(a.avatar)));
  copyFileSync(join(DATA, 'assets', 'speakers', speaker.avatar), join(target, 'assets', 'speakers', basename(speaker.avatar)));

  // 3. подстановки
  const ogTitle = `${topic} — ${book.title}`;
  const ogDesc = book.subtitle;
  const ogImage = `${domain}/assets/cover/${basename(book.cover)}`;

  const scalars = {
    TALK_TITLE: esc(topic),
    BOOK_TITLE: esc(book.title),
    BOOK_SUBTITLE: esc(book.subtitle),
    BOOK_DESC: esc(book.descRu),
    BOOK_URL: esc(book.url),
    BOOK_COVER_FILE: esc(basename(book.cover)),
    CHAPTER_LABEL: `Глава ${esc(chapter.chapter_number)}`,
    AUTHORS_BADGE: book.authors.length > 1 ? 'Авторы' : 'Автор',
    OG_TITLE: esc(ogTitle),
    OG_DESCRIPTION: esc(ogDesc),
    OG_IMAGE: esc(ogImage),
  };

  let html = readFileSync(join(target, 'index.html'), 'utf8');
  for (const [k, v] of Object.entries(scalars)) html = html.split(`{{${k}}}`).join(v);
  html = html.replace('<!--AUTHOR_CARDS-->', book.authors.map(authorCard).join('\n                                '));
  html = html.replace('<!--SPEAKER_CARD-->', speakerCard(speaker));
  html = html.replace('<!--AGENDA_ITEMS-->', buildAgenda(chapter.topics, topicIdx));
  html = html.replace('<!--WHATNEXT_ITEMS-->', buildWhatNext(chapter.topics, topicIdx));

  const leftover = html.match(/\{\{[A-Z_]+\}\}|<!--(?:AUTHOR_CARDS|SPEAKER_CARD|AGENDA_ITEMS|WHATNEXT_ITEMS)-->/g);
  if (leftover) fail(`Остались незаполненные маркеры: ${[...new Set(leftover)].join(', ')}`);

  writeFileSync(join(target, 'index.html'), html);

  // 4. отчёт
  console.log(`\n✓ Доклад создан: ${folder}`);
  console.log(`  Книга:   ${book.title}`);
  console.log(`  Глава:   ${chapter.chapter_number} — ${chapter.chapter_title}`);
  console.log(`  Тема:    ${topic}`);
  console.log(`  Спикер:  ${speaker.name}`);
  console.log(`  Проект Cloudflare Pages: ${project}`);
  console.log(`  URL после публикации:    ${domain}`);
  console.log(`\nДалее — опубликовать через pull request:`);
  console.log(`  git checkout -b ${folder}`);
  console.log(`  git add ${folder}`);
  console.log(`  git commit -m "${folder} — ${topic}"`);
  console.log(`  git push -u origin ${folder}`);
  console.log(`  gh pr create --fill --base main\n`);
}

main().catch((e) => fail(e.stack || String(e)));
