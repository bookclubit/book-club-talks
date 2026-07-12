---
name: deploy-talk
description: Создать проект Cloudflare Pages для доклада и/или задеплоить папку доклада вручную через wrangler в репозитории book-club-talks. Использовать, когда пользователь хочет подготовить доклад к автодеплою или задеплоить его прямо сейчас.
---

# deploy-talk

Готовит доклад к деплою на Cloudflare Pages: создаёт проект (один раз) и,
при необходимости, деплоит папку вручную.

## Ключевое правило

Проект Cloudflare Pages **должен существовать до первого деплоя**. Автодеплой
через GitHub Actions не создаёт проекты — он только деплоит в уже существующие.

## Имя проекта

Имя проекта = имя папки доклада в **lowercase (kebab-case)**.
Пример: `BC-112-DOCKER-8-ANTON` → `bc-112-docker-8-anton`.

Получить имя из папки:

```bash
PROJECT=$(echo "BC-112-DOCKER-8-ANTON" | tr '[:upper:]' '[:lower:]')
```

## Шаг 1. Создать проект (один раз на доклад)

```bash
wrangler pages project create bc-112-docker-8-anton --production-branch main
```

Проверить, что проект ещё не создан:

```bash
wrangler pages project list
```

## Шаг 2. Деплой

### Вариант А — автоматический (рекомендуется)

Закоммить папку в `main` и запушь. Workflow `.github/workflows/deploy.yml`
сам найдёт изменённую папку `BC-*` и задеплоит её.

### Вариант Б — вручную

```bash
wrangler pages deploy BC-112-DOCKER-8-ANTON \
  --project-name=bc-112-docker-8-anton \
  --branch=main
```

`--branch=main` помечает деплой как production (production branch проекта — `main`).

## Аутентификация

- Локально: `wrangler` использует авторизованную сессию (`wrangler login`) или
  переменную окружения `CLOUDFLARE_API_TOKEN`.
- В CI: секрет репозитория `CLOUDFLARE_API_TOKEN`
  (опционально `CLOUDFLARE_ACCOUNT_ID`, если токен видит несколько аккаунтов).

## Чеклист нового доклада

1. Папка названа по соглашению (см. навык `add-talk`).
2. Проект Cloudflare Pages создан (`wrangler pages project create <lowercase>`).
3. Секрет `CLOUDFLARE_API_TOKEN` добавлен в репозиторий.
4. `git push` в `main` → автодеплой.
