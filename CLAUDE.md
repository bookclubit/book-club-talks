# book-club-talks

Репозиторий презентаций докладов книжного клуба для фронтендеров.
Каждый доклад — самостоятельный статический сайт, который автоматически
деплоится на Cloudflare Pages при пуше в `main`.

## Структура репозитория

```
book-club-talks/
├── talks/                        # ВСЕ доклады здесь (плоско; можно группировать глубже)
│   ├── BC-112-DOCKER-8-POMAZKOV/ # одна папка = один доклад = один проект Cloudflare Pages
│   │   ├── index.html            # точка входа презентации (генерируется из _template)
│   │   └── assets/               # локальные ассеты доклада (fonts, css, cover, authors, speakers)
│   └── BC-113-DOCKER-9-POMAZKOV-1/
├── _template/                    # ЕДИНЫЙ шаблон дека (index.html с маркерами + assets/fonts,css)
├── data/                         # источник правды для генератора
│   ├── books.json                # книги: метаданные и авторы
│   ├── books/<id>/chapters.json  # главы и темы книги (chapter_number, chapter_title, topics[])
│   ├── speakers.json             # реестр спикеров (id, name, surname, avatar, url)
│   └── assets/                   # ВСЕ картинки: books/<id>/{cover,authors}/ и speakers/
├── scripts/
│   ├── new-talk.mjs              # генератор доклада (единый шаблон + data → папка BC-*)
│   └── lint-talks.mjs            # проверка автономности докладов
├── .github/workflows/
│   ├── deploy.yml                # прод-деплой при push в main (авто-создание проекта)
│   ├── preview.yml               # preview-деплой на pull request + комментарий со ссылкой
│   └── ci.yml                    # lint автономности на push/PR
├── AGENTS.md                     # универсальные инструкции для AI (Codex/Cursor/Antigravity/…)
└── .claude/skills/               # навыки Claude Code (add-talk, open-pr)
```

## Соглашение об именовании папок

Формат: `BC-<номер стрима>-<КНИГА>-<глава>-<ФАМИЛИЯ>[-<порядковый номер>]`

Всё капсом, разделитель — дефис. Порядковый номер добавляется, только если у
одного спикера в одном стриме несколько докладов.

Примеры:
- `BC-112-DOCKER-8-POMAZKOV`
- `BC-113-DOCKER-9-POMAZKOV-1`
- `BC-113-DOCKER-9-POMAZKOV-2`

## Имя проекта Cloudflare Pages

Имя проекта = имя папки в **lowercase (kebab-case)**. Преобразование однозначное:
просто перевести имя папки в нижний регистр.

| Папка                        | Проект Cloudflare Pages      |
| ---------------------------- | ---------------------------- |
| `BC-112-DOCKER-8-POMAZKOV`   | `bc-112-docker-8-pomazkov`   |
| `BC-113-DOCKER-9-POMAZKOV-1` | `bc-113-docker-9-pomazkov-1` |
| `BC-113-DOCKER-9-POMAZKOV-2` | `bc-113-docker-9-pomazkov-2` |

## Генерация доклада

Доклады создаются **только генератором**, не копированием папок вручную. Вся
книжно-специфичная информация (обложка, описание, авторы, главы, темы) лежит в
`data/`, а вёрстка — в единственном `_template/index.html` с маркерами.

```bash
# интерактивно (человек)
npm run new-talk

# не-интерактивно (AI-инструменты, CI)
node scripts/new-talk.mjs --book docker-up-and-running --chapter 9 \
  --topic 2 --speaker pomazkov-anton --stream 112 [--seq 2] [--force]
```

Генератор подставляет данные в слайды: титул (глава + тема), «о книге»
(обложка/описание/авторы + спикер), «Программа вечера» и «Что далее» (темы главы
со статусами пройдено/активна/далее), OG-метатеги; копирует все ассеты локально.

Универсальные инструкции для любого AI-инструмента — в
[AGENTS.md](./AGENTS.md) (единый файл читают Codex, Cursor, Antigravity и др.;
Claude Code использует `.claude/skills/add-talk`).

## Рабочий процесс добавления доклада

Публикация идёт через pull request — от спикера не требуется ни `wrangler`,
ни доступ к Cloudflare.

1. Спикер создаёт ветку с именем, совпадающим с именем папки доклада
   (`BC-<...>`), кладёт туда папку презентации и открывает PR в `main`.
   PR оформляется по единому шаблону `.github/pull_request_template.md`
   (навык `open-pr`); превью-ссылку постит `preview.yml` автоматически.
2. Мейнтейнер ревьюит и вливает PR.
3. Пуш в `main` запускает workflow `.github/workflows/deploy.yml`.

## Как работает деплой

1. Workflow `.github/workflows/deploy.yml` через `git diff` находит изменённые
   папки докладов `BC-*` внутри `talks/` (на любой глубине).
2. Для каждой изменённой папки CI **создаёт проект Cloudflare Pages, если его
   ещё нет** (`wrangler pages project create <lowercase-имя> --production-branch main`,
   идемпотентно), затем деплоит
   `wrangler pages deploy <папка> --project-name=<lowercase-имя> --branch=main`.
3. Аутентификация — через секрет репозитория `CLOUDFLARE_API_TOKEN`
   (опционально `CLOUDFLARE_ACCOUNT_ID`, если у токена доступ к нескольким аккаунтам).

## Важные правила

- Создание проекта Cloudflare Pages автоматизировано в CI — вручную запускать
  `wrangler pages project create` не нужно.
- Все имена проектов — только lowercase/kebab-case.
- Не переименовывай существующие папки докладов — это создаст новый проект и осиротит старый.
- Каждая презентация автономна: относительные пути к ассетам, никаких внешних CDN.
  Это проверяет `npm run lint:talks` (и CI на каждом PR/push).
- «Хром»-слайды (титул, о книге, программа, что далее) не правь руками — меняй
  данные в `data/` и перегенерируй. Спикер редактирует только контентные слайды.

## Коммиты

- Сообщения коммитов — **на русском языке**.
- Формат — Conventional Commits: `<тип>(<область>): <краткое описание>`
  в повелительном наклонении. Типы: `feat`, `fix`, `docs`, `style`, `refactor`,
  `perf`, `test`, `build`, `ci`, `chore`.
- Новый доклад: `feat(talk): <ИМЯ-ПАПКИ> — <тема>`.
- Примеры: `fix(generator): чинит резолвинг путей ассетов`,
  `docs(readme): описывает жизненный цикл доклада`.
- Подробнее — в [AGENTS.md](./AGENTS.md).

## Ручной деплой (запасной путь)

В обычном потоке деплой полностью автоматический — эти команды нужны только в
аварийной ситуации (например, CI недоступен). Требуется авторизованный
`wrangler` (`wrangler login` или переменная `CLOUDFLARE_API_TOKEN`).

```bash
# проект создаётся сам при деплое, но при желании можно заранее:
wrangler pages project create <lowercase-имя> --production-branch main
wrangler pages deploy <ПАПКА> --project-name=<lowercase-имя> --branch=main
```

## Навыки Claude Code

- `add-talk` — создать доклад генератором (`scripts/new-talk.mjs`).
- `open-pr` — открыть pull request в едином формате (шаблон + превью-ссылка).
