#!/usr/bin/env node
// Проверка автономности докладов: каждая папка BC-* должна быть самодостаточной.
// Правила:
//   1. Никаких внешних загрузок ресурсов (img/script/link/@font-face/url()) —
//      только относительные пути. Ссылки <a href> на внешние сайты разрешены.
//   2. Все относительные ссылки на ресурсы должны существовать на диске.
//   3. В index.html не должно остаться незаполненных маркеров шаблона.
//
// Запуск: node scripts/lint-talks.mjs  (или npm run lint:talks)

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const talkDirs = readdirSync(ROOT)
  .filter((n) => /^BC-/.test(n) && statSync(join(ROOT, n)).isDirectory());

const problems = [];

for (const dir of talkDirs) {
  const indexPath = join(ROOT, dir, 'index.html');
  if (!existsSync(indexPath)) { problems.push(`${dir}: нет index.html`); continue; }
  const html = readFileSync(indexPath, 'utf8');

  // 1. незаполненные маркеры
  const markers = html.match(/\{\{[A-Z_]+\}\}|<!--(?:AUTHOR_CARDS|SPEAKER_CARD|AGENDA_ITEMS|WHATNEXT_ITEMS)-->/g);
  if (markers) problems.push(`${dir}: незаполненные маркеры шаблона: ${[...new Set(markers)].join(', ')}`);

  // 2. внешние загрузки ресурсов: src=, <link href>, srcset, url() в CSS
  const external = new Set();
  // src="..." (img/script)
  for (const m of html.matchAll(/\ssrc=["']([^"']+)["']/g)) if (/^(https?:)?\/\//i.test(m[1])) external.add(m[1]);
  // <link ... href="...">
  for (const m of html.matchAll(/<link\b[^>]*\shref=["']([^"']+)["']/gi)) if (/^(https?:)?\/\//i.test(m[1])) external.add(m[1]);
  // srcset
  for (const m of html.matchAll(/\ssrcset=["']([^"']+)["']/g))
    for (const part of m[1].split(',')) { const u = part.trim().split(/\s+/)[0]; if (/^(https?:)?\/\//i.test(u)) external.add(u); }
  // url(...) в inline-стилях и <style>
  for (const m of html.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) if (/^(https?:)?\/\//i.test(m[1])) external.add(m[1]);
  for (const u of external) problems.push(`${dir}: внешняя загрузка ресурса (нарушает автономность): ${u}`);

  // 3. битые относительные ссылки на ресурсы
  const localRefs = new Set();
  const collect = (u) => {
    if (!u) return;
    if (/^(https?:)?\/\//i.test(u) || u.startsWith('data:') || u.startsWith('#') || u.startsWith('mailto:')) return;
    localRefs.add(u.split(/[?#]/)[0]);
  };
  for (const m of html.matchAll(/\ssrc=["']([^"']+)["']/g)) collect(m[1]);
  for (const m of html.matchAll(/<link\b[^>]*\shref=["']([^"']+)["']/gi)) collect(m[1]);
  for (const m of html.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) collect(m[1]);
  for (const ref of localRefs) {
    if (!existsSync(join(ROOT, dir, ref))) problems.push(`${dir}: битая относительная ссылка: ${ref}`);
  }

  // проверяем и вложенные css (fonts.css) на внешние url()
  const fontsCss = join(ROOT, dir, 'assets', 'css', 'fonts.css');
  if (existsSync(fontsCss)) {
    const css = readFileSync(fontsCss, 'utf8');
    for (const m of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
      if (/^(https?:)?\/\//i.test(m[1])) problems.push(`${dir}: assets/css/fonts.css ссылается на внешний ресурс: ${m[1]}`);
      else if (!existsSync(join(ROOT, dir, 'assets', 'css', m[1]))) problems.push(`${dir}: assets/css/fonts.css — битый путь: ${m[1]}`);
    }
  }
}

if (problems.length) {
  console.error(`\n✖ Найдены проблемы автономности (${problems.length}):\n`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error('');
  process.exit(1);
}

console.log(`✓ Проверено докладов: ${talkDirs.length}. Все автономны, битых ссылок нет.`);
