#!/usr/bin/env node
// Пересборка «хром»-слайдов уже созданного доклада: «Программа вечера»
// и «Что далее». Нужна, когда программа изменилась — спикера подтвердили,
// заменили или появились ссылки на соседние доклады.
//
// Контентные слайды спикера не трогаются: правим только секции, помеченные
// в шаблоне data-chrome (их ставит генератор new-talk.mjs).
//
// Использование:
//   node scripts/rebuild-talk.mjs --talk BC-115-REACT-9-POMAZKOV \
//        --program '<json>' | --program-file program.json [--data ../book-club-data]
//
// Формат программы — как у new-talk.mjs:
//   [{ title, topic_id?, speaker?: {name, avatar}, slides_url?, current?: true }]
// Текущий доклад определяется полем current или совпадением с папкой доклада
// (её имя содержит фамилию спикера), поэтому в снимке лучше ставить current.

import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, basename } from 'node:path';
import { env } from 'node:process';

import { buildAgenda, buildWhatNext, dropChromeSlide, replaceTimeline } from './new-talk.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (!t.startsWith('--')) continue;
    const key = t.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) a[key] = true;
    else {
      a[key] = next;
      i++;
    }
  }
  return a;
}

const args = parseArgs(process.argv.slice(2));

const talk = String(args.talk || '').trim();
if (!talk) fail('Не указан --talk (имя папки доклада, например BC-115-REACT-9-POMAZKOV).');

const target = join(ROOT, 'talks', talk);
const indexPath = join(target, 'index.html');
if (!existsSync(indexPath)) fail(`Доклад ${talk} не найден: нет ${indexPath}`);

const raw = args['program-file']
  ? readFileSync(resolve(String(args['program-file'])), 'utf8')
  : args.program && args.program !== true
    ? String(args.program)
    : null;
if (!raw) fail('Не передана программа: --program <json> или --program-file <файл>.');

let parsed;
try {
  parsed = JSON.parse(raw);
} catch (e) {
  fail(`Не разобрать программу: ${e.message}`);
}
if (!Array.isArray(parsed) || parsed.length === 0) fail('Программа пуста.');

const items = parsed.map((p) => ({
  title: p.title,
  topicId: p.topic_id ?? p.topicId,
  speaker: p.speaker,
  slidesUrl: p.slides_url ?? p.slidesUrl,
  current: Boolean(p.current),
}));

// Текущий доклад: явный признак current или совпадение ссылки на слайды
// с адресом самой папки (bc-115-…​.pages.dev).
const selfUrl = `https://${talk.toLowerCase()}.pages.dev`;
let currentIdx = items.findIndex((p) => p.slidesUrl === selfUrl);
if (currentIdx < 0) currentIdx = items.findIndex((p) => p.current);
if (currentIdx < 0)
  fail(
    `Не понять, какая тема принадлежит докладу ${talk}: пометьте её "current": true или задайте ей slides_url ${selfUrl}.`,
  );

// Аватарки спикеров программы — доклад автономен, файлы лежат внутри папки.
const DATA = resolve(args.data || env.BOOK_CLUB_DATA || join(ROOT, '..', 'book-club-data'));
mkdirSync(join(target, 'assets', 'speakers'), { recursive: true });
for (const item of items) {
  const avatar = item.speaker?.avatar;
  if (!avatar) continue;
  const src = join(DATA, String(avatar).replace(/^\//, ''));
  const dest = join(target, 'assets', 'speakers', basename(avatar));
  if (existsSync(dest)) continue;
  if (!existsSync(src)) {
    console.warn(`  ! нет аватарки ${avatar} в book-club-data — спикер будет без картинки`);
    continue;
  }
  copyFileSync(src, dest);
}

let html = readFileSync(indexPath, 'utf8');
if (!html.includes('data-chrome=')) {
  fail(
    `Доклад ${talk} создан старым генератором: у слайдов нет меток data-chrome, пересобрать их нельзя. Создайте доклад заново (new-talk.mjs --force).`,
  );
}

html = replaceTimeline(html, 'agenda', buildAgenda(items, currentIdx));
html = replaceTimeline(html, 'whatnext', buildWhatNext(items, currentIdx));
// «Программа вечера» живёт только в первом докладе вечера.
if (currentIdx > 0) html = dropChromeSlide(html, 'agenda');

writeFileSync(indexPath, html);

console.log(`\n✓ Пересобраны слайды доклада ${talk}`);
console.log(`  Тема доклада: ${items[currentIdx].title}`);
console.log(`  Программа вечера: ${currentIdx === 0 ? 'есть (первый доклад)' : 'убрана (не первый доклад)'}`);
console.log(`  Тем в программе: ${items.length}`);
