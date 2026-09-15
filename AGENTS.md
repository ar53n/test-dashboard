# Описание

Дашборд оргструктуры «дивизион → отдел → команда»: дерево и сводная таблица с агрегатами по поддеревьям, live-обновления по WebSocket, AI-поиск на естественном языке. React 19 + Vite 8 + TypeScript + styled-components + TanStack Query + zod; mock-сервер на Node 24 (`server/`, npm workspace). Документация, комментарии и сообщения коммитов — на русском.

## Команды

Node.js 24+, все команды из корня.

- `npm run dev` — сервер (`:3001`) и Vite (`:5173`) вместе; `/api` и WebSocket `/api/live` проксируются на сервер. Сервер работает под `node --watch` и перезапускается при изменении `.env`.
- `npm test` — все тесты vitest (клиент и сервер одной командой; серверные тесты поднимают HTTP/WS на свободном порту).
- Один файл: `npx vitest run src/features/org-table/model/applyOrgFilter.test.ts`; один тест: добавить `-t "название"`.
- `npm run typecheck` (`tsc -b`: клиент, сервер, конфиги), `npm run lint` (oxlint), `npm run build`.
- `npm run size` — бюджет бандла (gzip JS+CSS ≤ 200 КБ) после `build`; при превышении падает и сборка Docker-образа.
- `docker compose up --build` — nginx + сервер на `http://localhost:8080`.
- `?scenario=slow|error|invalid|empty` в адресе страницы пробрасывается в API для проверки состояний (live-обновления при этом выключены).

## Архитектура

Подробно — `docs/architecture.md`, `docs/data-model.md`, ADR в `docs/adr/`. При изменении решений обновлять их.

**Контракт.** Корневой `shared/` (`contract.ts`, `orgFilter.ts`) — общие для клиента и сервера типы, константы и zod-схемы. Сервер импортирует его относительными путями, поэтому серверный Docker-образ копирует и `shared/`.

**Клиент** — feature-sliced, зависимости только вниз: `app → widgets → features → entities → shared`. Фичи (`org-tree`, `org-table`, `live-updates`) не импортируют друг друга; поэтому AI-поиск живёт внутри `org-table`. Алиасы `@/` → `src/`, `@shared/` → `shared/`.

**Поток данных.** `useOrgModel()` → `fetchOrgModel`: условный запрос с `If-None-Match: "<epoch>-<revision>"` и `cache: 'no-store'` → zod → `buildIndex` (проверка целостности) → `computeAggregates`. В кэше TanStack Query лежит готовая `OrgModel`, не сырой JSON; `structuralSharing` не даёт снимку старой версии заменить более новую модель.

**Live.** `LiveClient` (сокет, backoff, таймауты) → `SyncController` (ревизии, очередь, resync) → `applyPatch` → `queryClient.setQueryData`. Версия — пара `(epoch, revision)`: epoch меняется при рестарте сервера. Разрыв ревизий или новый epoch → один запрос снимка. Агрегаты пересчитываются только у изменённых узлов и их предков, неизменённые строки таблицы переиспользуются (ADR 005). Пока модель поддерживается патчами, `staleTime` = `Infinity`.

**Состояние UI** поднято в `Dashboard` (`useOrgTreeState`, `useOrgTableState`): на узком экране неактивная панель размонтируется, а раскрытие, выбор, поиск и сортировка должны сохраниться. Колбэки дерева стабильны (индекс читается через ref) — не ломать `memo` строк.

**AI-поиск** (ADR 006). Модель не видит метрик и не фильтрует данные: `server/src/ai/` переводит запрос в `OrgFilter` через `/chat/completions` со strict `json_schema`, нормализует и валидирует ответ (`filterFromModel.ts`), клиент применяет фильтр к актуальной модели (`applyOrgFilter`). Любая ошибка (503 без ключа, 429 лимиты, 502, 504) → подсказка и обычный поиск по названию. Настройка — `AI_*` в `.env` (см. `.env.example`); `AI_BASE_URL` должен включать версию API (`…/v1`), сервер дописывает только `/chat/completions`.

**Сервер** запускается без сборки (type stripping Node 24): только стираемый синтаксис TypeScript (`erasableSyntaxOnly` — никаких `enum`, `namespace`, parameter properties), импорты с явным расширением `.ts`.

## Соглашения

- Стили styled-components — в соседнем `X.styled.ts`, подключение `import * as S from './X.styled.ts'`.
- Компоненты `ui`-сегментов и виджетов — папкой `X/` с `X.tsx`, `X.styled.ts` и `index.ts`; снаружи импорт только через `index.ts`.
- Клиентские типы выводятся из контракта (`SortKey = FilterSortKey`, `Pick<Aggregate, …>`), а не дублируются.
- Тесты рядом с кодом; окружение по умолчанию `node`, компонентным тестам нужен `// @vitest-environment jsdom`. Для исправлений дефектов сначала пишется тест, падающий на прежнем коде.
- Форматирование: два пробела, одинарные кавычки, без точек с запятой.
- Коммиты: `feat:` / `fix:` / `refactor:` с русским описанием и списком изменений в теле.
