#!/usr/bin/env node
// Проверка автономности докладов: каждая папка BC-* должна быть самодостаточной.
// Правила (ошибки, валят CI):
//   1. Имя папки BC-* в lowercase должно быть валидным именем проекта
//      Cloudflare Pages (^[a-z0-9][a-z0-9-]*$, длина ≤ 58).
//   2. Никаких внешних загрузок ресурсов (img/script/link/@font-face/url()) —
//      только относительные пути. Ссылки <a href> на внешние сайты разрешены.
//   3. Все относительные ссылки на ресурсы должны существовать на диске.
//   4. В index.html не должно остаться незаполненных маркеров шаблона.
// Предупреждения (CI не валят):
//   5. Соответствие каркасу шаблона (assets/css/fonts.css) — рукописные
//      доклады помечаются как кандидаты на перегенерацию.
//
// Запуск: node scripts/lint-talks.mjs  (или npm run lint:talks)

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Ограничения Cloudflare Pages на имя проекта (см. также scripts/new-talk.mjs):
// lowercase, буквы/цифры/дефисы, первый символ — буква или цифра, длина ≤ 58.
const CF_PROJECT_RE = /^[a-z0-9][a-z0-9-]*$/;
const CF_PROJECT_MAX = 58;

// Рекурсивно ищем папки докладов (BC-*) внутри talks/ на любой глубине —
// структура может быть плоской или сгруппированной (по книге/стриму).
function findTalks(relBase) {
  const out = [];
  const walk = (relDir) => {
    for (const name of readdirSync(join(ROOT, relDir))) {
      const rel = join(relDir, name);
      if (!statSync(join(ROOT, rel)).isDirectory()) continue;
      if (/^BC-/.test(name)) out.push(rel);
      else walk(rel);
    }
  };
  walk(relBase);
  return out;
}

// Внешний ли URL (http(s):// или протокол-относительный //...)
const isExternal = (u) => /^(https?:)?\/\//i.test(u);

// Значения атрибута attr в html: в кавычках и без (src=foo.png тоже валидно в HTML).
// Атрибуты регистронезависимы (SRC=, Src=), значение может быть без кавычек.
function attrValues(html, attr) {
  const out = [];
  const re = new RegExp(`[\\s"']${attr}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'<>\`]+))`, 'gi');
  for (const m of html.matchAll(re)) out.push(m[2] ?? m[3] ?? m[4]);
  return out;
}

// Значения href только у <link> (загрузка ресурса; <a href> наружу — разрешён).
function linkHrefs(html) {
  const out = [];
  for (const tag of html.matchAll(/<link\b[^>]*>/gi)) out.push(...attrValues(tag[0], 'href'));
  return out;
}

// url(...) в CSS/инлайн-стилях
function cssUrls(text) {
  const out = [];
  for (const m of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) out.push(m[1]);
  return out;
}

// Все .css-файлы доклада (рекурсивно) — проверяем на внешние url() и битые пути.
function findCssFiles(absDir, rel = '') {
  const out = [];
  for (const name of readdirSync(join(absDir, rel))) {
    const r = rel ? join(rel, name) : name;
    if (statSync(join(absDir, r)).isDirectory()) out.push(...findCssFiles(absDir, r));
    else if (/\.css$/i.test(name)) out.push(r);
  }
  return out;
}

const talkDirs = existsSync(join(ROOT, 'talks')) ? findTalks('talks') : [];

const problems = [];
const warnings = [];

for (const dir of talkDirs) {
  const folderName = dir.split(/[\\/]/).pop();

  // 1. имя папки → имя проекта Cloudflare Pages (то же правило, что в new-talk.mjs)
  const project = folderName.toLowerCase();
  if (!CF_PROJECT_RE.test(project))
    problems.push(`${dir}: имя папки в lowercase ("${project}") — невалидное имя проекта Cloudflare Pages: допустимы только латинские буквы, цифры и дефисы, первый символ — буква или цифра`);
  else if (project.length > CF_PROJECT_MAX)
    problems.push(`${dir}: имя папки длиннее ${CF_PROJECT_MAX} символов (${project.length}) — Cloudflare Pages не примет такое имя проекта`);

  const indexPath = join(ROOT, dir, 'index.html');
  if (!existsSync(indexPath)) { problems.push(`${dir}: нет index.html`); continue; }
  const html = readFileSync(indexPath, 'utf8');

  // 4. незаполненные маркеры
  const markers = html.match(/\{\{[A-Z_]+\}\}|<!--(?:AUTHOR_CARDS|SPEAKER_CARD|AGENDA_ITEMS|WHATNEXT_ITEMS)-->/g);
  if (markers) problems.push(`${dir}: незаполненные маркеры шаблона: ${[...new Set(markers)].join(', ')}`);

  // 2. внешние загрузки ресурсов: src (script/img/iframe/…), <link href>, srcset, url()
  const external = new Set();
  for (const u of attrValues(html, 'src')) if (isExternal(u)) external.add(u);
  for (const u of linkHrefs(html)) if (isExternal(u)) external.add(u);
  for (const m of html.matchAll(/[\s"']srcset\s*=\s*["']([^"']+)["']/gi))
    for (const part of m[1].split(',')) { const u = part.trim().split(/\s+/)[0]; if (isExternal(u)) external.add(u); }
  for (const u of cssUrls(html)) if (isExternal(u)) external.add(u);
  for (const u of external) problems.push(`${dir}: внешняя загрузка ресурса (нарушает автономность): ${u}`);

  // 3. битые относительные ссылки на ресурсы
  const localRefs = new Set();
  const collect = (u) => {
    if (!u) return;
    if (isExternal(u) || u.startsWith('data:') || u.startsWith('#') || u.startsWith('mailto:')) return;
    localRefs.add(u.split(/[?#]/)[0]);
  };
  for (const u of attrValues(html, 'src')) collect(u);
  for (const u of linkHrefs(html)) collect(u);
  for (const u of cssUrls(html)) collect(u);
  for (const ref of localRefs) {
    if (!existsSync(join(ROOT, dir, ref))) problems.push(`${dir}: битая относительная ссылка: ${ref}`);
  }

  // 2а. все .css доклада (fonts.css, deck.css, …): внешние url() и битые пути
  for (const cssRel of findCssFiles(join(ROOT, dir))) {
    const cssDir = dirname(join(ROOT, dir, cssRel));
    for (const u of cssUrls(readFileSync(join(ROOT, dir, cssRel), 'utf8'))) {
      if (isExternal(u)) problems.push(`${dir}: ${cssRel} ссылается на внешний ресурс: ${u}`);
      else if (!u.startsWith('data:') && !existsSync(join(cssDir, u.split(/[?#]/)[0])))
        problems.push(`${dir}: ${cssRel} — битый путь: ${u}`);
    }
  }

  // 5. каркас шаблона — ПРЕДУПРЕЖДЕНИЕ, не ошибка: рукописные доклады
  // (например заглушки) не должны валить CI, но их стоит перегенерировать.
  if (!existsSync(join(ROOT, dir, 'assets', 'css', 'fonts.css')))
    warnings.push(`${dir}: нет assets/css/fonts.css — доклад не соответствует каркасу шаблона; кандидат на перегенерацию через scripts/new-talk.mjs`);
}

if (warnings.length) {
  console.warn(`\n⚠ Предупреждения (${warnings.length}, CI не валят):\n`);
  for (const w of warnings) console.warn(`  - ${w}`);
  console.warn('');
}

if (problems.length) {
  console.error(`\n✖ Найдены проблемы автономности (${problems.length}):\n`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error('');
  process.exit(1);
}

console.log(`✓ Проверено докладов: ${talkDirs.length}. Все автономны, битых ссылок нет.${warnings.length ? ` Предупреждений: ${warnings.length}.` : ''}`);
