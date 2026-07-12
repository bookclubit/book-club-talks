---
name: deploy-talk
description: Помочь с публикацией доклада в репозитории book-club-talks — объяснить PR-флоу автопубликации и, при необходимости, задеплоить папку вручную через wrangler. Использовать, когда пользователь хочет опубликовать доклад или разобраться, как это происходит.
---

# deploy-talk

Помогает опубликовать доклад на Cloudflare Pages. Штатный путь —
автоматический через pull request; ручной деплой нужен лишь как запасной вариант.

## Как это работает

Публикация полностью автоматизирована в CI (`.github/workflows/deploy.yml`):

- при вливании PR в `main` workflow через `git diff` находит изменённые папки `BC-*`;
- для каждой **создаёт проект Cloudflare Pages, если его ещё нет** (идемпотентно),
  затем деплоит.

Поэтому вручную запускать `wrangler pages project create` не нужно — ни спикеру,
ни мейнтейнеру.

## Имя проекта

Имя проекта = имя папки доклада в **lowercase (kebab-case)**.
Пример: `BC-112-DOCKER-8-POMAZKOV` → `bc-112-docker-8-pomazkov`.

```bash
PROJECT=$(echo "BC-112-DOCKER-8-POMAZKOV" | tr '[:upper:]' '[:lower:]')
```

## Штатный путь — PR (рекомендуется)

1. Ветка с именем, совпадающим с именем папки доклада:
   ```bash
   git checkout -b BC-112-DOCKER-8-POMAZKOV
   git add BC-112-DOCKER-8-POMAZKOV
   git commit -m "BC-112 Docker гл.8 — доклад Помазкова"
   git push -u origin BC-112-DOCKER-8-POMAZKOV
   ```
2. Открыть PR в `main`:
   ```bash
   gh pr create --fill --base main
   ```
3. После одобрения и вливания PR публикация происходит сама. Через 1–2 минуты
   доклад доступен на `https://<lowercase-имя>.pages.dev`.

## Запасной путь — ручной деплой

Нужен установленный и авторизованный `wrangler` (`wrangler login` или переменная
`CLOUDFLARE_API_TOKEN`).

```bash
# проект создастся сам при деплое, но при желании можно заранее:
wrangler pages project create bc-112-docker-8-pomazkov --production-branch main

wrangler pages deploy BC-112-DOCKER-8-POMAZKOV \
  --project-name=bc-112-docker-8-pomazkov \
  --branch=main
```

`--branch=main` помечает деплой как production (production branch проекта — `main`).

## Аутентификация

- Локально: `wrangler login` или переменная окружения `CLOUDFLARE_API_TOKEN`.
- В CI: секрет репозитория `CLOUDFLARE_API_TOKEN`
  (опционально `CLOUDFLARE_ACCOUNT_ID`, если токен видит несколько аккаунтов).
