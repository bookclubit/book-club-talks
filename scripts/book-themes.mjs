// Цвет книги в докладах. У каждой книги клуба — свой акцент: им выделены
// главные слова и цифры, текущая тема в программе вечера, полоса прогресса.
// Всё остальное в деке монохромное, поэтому акцент один.
//
// Генератор (new-talk.mjs) по папке книги в book-club-data находит тему
// и пишет её в assets/css/theme.css доклада. У тёмной и светлой темы дека
// свои значения: светлый неон на белом выцветает.
//
// --hot — «плохо, дорого, хуже»: у книг с тёплым акцентом он розово-красный,
// чтобы не сливаться с акцентом, у остальных — красно-оранжевый.
//
// Неоновый циан, маджента и фиолет не используем: в таких цветах сделан
// другой проект, и деки выглядели бы его копией.

const HOT = { dark: '#ff6b4a', light: '#c2410c' };
const HOT_ROSE = { dark: '#ff4d6d', light: '#be123c' };
const HOT_AMBER = { dark: '#ffb020', light: '#b45309' };

/** Именованные цвета: значение тёмной темы, значение светлой и «горячий» цвет. */
export const PALETTE = {
  lime: { name: 'лайм', dark: '#d4ff3f', light: '#4d7c0f', hot: HOT },
  orange: { name: 'оранжевый', dark: '#ff8a3d', light: '#c2410c', hot: HOT_ROSE },
  amber: { name: 'янтарь', dark: '#ffb83d', light: '#b45309', hot: HOT_ROSE },
  jsYellow: { name: 'JS-жёлтый', dark: '#f7df1e', light: '#a16207', hot: HOT_ROSE },
  coral: { name: 'коралл', dark: '#ff6f61', light: '#be3a2c', hot: HOT_AMBER },
  rose: { name: 'розовый', dark: '#ff8fb8', light: '#be185d', hot: HOT_AMBER },
  mint: { name: 'мята', dark: '#3fe0a3', light: '#047857', hot: HOT },
  green: { name: 'зелёный', dark: '#7fe36b', light: '#15803d', hot: HOT },
  blue: { name: 'синий', dark: '#4d9fff', light: '#1d4ed8', hot: HOT },
  cornflower: { name: 'васильковый', dark: '#8fa0ff', light: '#4338ca', hot: HOT },
};

/**
 * Книги, которые клуб читает сейчас (status: reading в book-club-data),
 * → цвет из палитры. Цвета разведены по кругу, чтобы вечера разных книг
 * не путались. Прочитанные книги в таблицу не входят: докладов по ним
 * больше не будет.
 */
export const BOOK_THEMES = {
  'ai-engineering': 'lime',
  'introduction-to-algorithms': 'orange',
  'mastering-blockchain': 'rose',
  'docker-up-and-running': 'blue',
  'designing-data-intensive-applications-the-big-ideas-behind-reliable-scalable-and-maintainable-systems':
    'mint',
};

// Запас для новой книги, которой ещё нет в таблице: цвета, не занятые выше.
const SPARE = Object.keys(PALETTE).filter((k) => !Object.values(BOOK_THEMES).includes(k));

const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
};

/**
 * Тема книги. Новой книги в таблице ещё нет — цвет выбирается из запасных
 * по её папке детерминированно (одна книга всегда получает один цвет);
 * чтобы закрепить выбор, книгу стоит дописать в BOOK_THEMES.
 */
export function themeFor(folder) {
  let key = BOOK_THEMES[folder];
  if (!key) {
    let h = 0;
    for (const ch of String(folder)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
    key = SPARE[h % SPARE.length];
  }
  return { key, ...PALETTE[key] };
}

/** Содержимое assets/css/theme.css доклада. */
export function themeCss(folder, bookTitle = '') {
  const t = themeFor(folder);
  return `/*
 * theme.css — цвет книги${bookTitle ? ` «${bookTitle}»` : ''}: ${t.name}.
 * Файл пишет генератор (scripts/new-talk.mjs, таблица scripts/book-themes.mjs);
 * правьте таблицу, а не этот файл.
 */
:root {
    --fx: ${t.dark};
    --fx-rgb: ${rgb(t.dark)};
    --hot: ${t.hot.dark};
    --hot-rgb: ${rgb(t.hot.dark)};
}

:root[data-theme='light'] {
    --fx: ${t.light};
    --fx-rgb: ${rgb(t.light)};
    --hot: ${t.hot.light};
    --hot-rgb: ${rgb(t.hot.light)};
}
`;
}
