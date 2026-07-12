# book-club-talks

Презентации докладов книжного клуба для фронтендеров. Каждая папка `BC-*` —
отдельный статический доклад, который автоматически деплоится на
[Cloudflare Pages](https://pages.cloudflare.com/) при пуше в `main`.

## Быстрый старт: добавить свой доклад

1. Создай папку по соглашению `BC-<стрим>-<КНИГА>-<глава>-<СПИКЕР>[-<номер>]`,
   например `BC-114-DOCKER-10-ANTON`.
2. Положи внутрь `index.html` и, при необходимости, папку `assets/`.
3. Создай проект Cloudflare Pages (один раз на доклад):
   ```bash
   wrangler pages project create bc-114-docker-10-anton --production-branch main
   ```
   Имя проекта = имя папки в нижнем регистре.
4. Закоммить и запушь в `main` — деплой произойдёт автоматически.

Подробнее об устройстве репозитория — в [CLAUDE.md](./CLAUDE.md).

## Секреты репозитория (GitHub Actions)

| Секрет                  | Обязательный | Назначение                                             |
| ----------------------- | ------------ | ------------------------------------------------------ |
| `CLOUDFLARE_API_TOKEN`  | да           | Токен с правами на Cloudflare Pages                    |
| `CLOUDFLARE_ACCOUNT_ID` | нет          | Нужен, только если у токена доступ к нескольким аккаунтам |

Добавить: **Settings → Secrets and variables → Actions → New repository secret**.
Токен создаётся на https://dash.cloudflare.com/profile/api-tokens
(шаблон **Edit Cloudflare Workers** или кастомный с правом *Account → Cloudflare Pages → Edit*).

## Как работает CI/CD

Workflow [.github/workflows/deploy.yml](./.github/workflows/deploy.yml):

- срабатывает на push в `main` при изменениях в папках `BC-*`;
- через `git diff` определяет, какие папки `BC-*` изменились;
- деплоит каждую изменённую папку в одноимённый (lowercase) проект Cloudflare Pages.
