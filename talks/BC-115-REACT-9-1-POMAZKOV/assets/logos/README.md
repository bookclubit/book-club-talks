# Логотипы фреймворков (лента на слайде «Зачем нужен фреймворк?»)

Файлы лежат локально — доклад должен работать без внешних CDN
(`npm run lint:talks`).

| Файл | Откуда | Обработка |
| --- | --- | --- |
| `next-js.svg`, `remix.svg`, `react-router.svg`, `tanstack-start.svg`, `astro.svg`, `gatsby.svg`, `redwoodjs.svg`, `expo-router.svg` | [simple-icons](https://simpleicons.org/) 16.28 (набор путей — CC0) | один `path`, `fill="#ffffff"` |
| `waku.svg` | официальный логотип с [waku.gg](https://waku.gg/) (`cdn.candycode.com/waku/waku-logo-shadow.svg`) | заливки заменены на белую, тени и `defs` убраны |
| `vike.svg` | официальный знак из репозитория [vikejs/vike](https://github.com/vikejs/vike/blob/main/docs/assets/logo/vike.svg) | файл как есть; белым его делает CSS-фильтр `grayscale + brightness` (силуэт молотка не читается) |

Знаки принадлежат их владельцам и используются как названия фреймворков.
