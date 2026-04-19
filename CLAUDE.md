@AGENTS.md

# Thermo Glass CRM — контекст проекта

## О бизнесе
**Thermo Glass** — торгово-дистрибуторский бизнес подогреваемых стеклопакетов (электрообогреваемое стекло для окон, фасадов, витрин). Работа и B2B, и B2C: входящие заявки → замер → расчёт → производство/закупка → монтаж → гарантия.

## Что должен уметь CRM (минимум)

1. **Клиенты** — карточки физлиц и компаний, контакты, история взаимодействий, комментарии, упоминания сотрудников.
2. **Заказы / сделки / лиды** — воронки, статусы, канбан, расчёты, файлы, расходы, платежи.
3. **Склад** — остатки, приход/расход, привязка к заказам. *(в работе)*
4. **WhatsApp-интеграция** — приём и отправка сообщений. Три провайдера уже подключены и переключаются в UI на странице `/settings/whatsapp`: **Green API**, **Omnichat**, **Meta Cloud API**. Вебхуки: `src/app/api/webhooks/whatsapp/`, `.../omnichat/`, `.../whatsapp-meta/`. Автоматизация сценариев висит в **n8n** снаружи CRM — CRM просто шлёт и принимает.
5. **Финансы** — расходы и оплаты по заказам, общий P&L (`/finance`, `/finance/expenses`).
6. **Маркетинг / лиды** — отдельная воронка, wiki «болей» клиентов, AI-помощник для контента (использует Anthropic SDK).
7. **Задачи, уведомления, лидерборд, лояльность** — вспомогательные модули.

## Стек (критично)

- **Next.js 16.2.3** — App Router, Route Handlers (не `pages/api`).
- **React 19.2**
- **TypeScript 5** (строгий)
- **Tailwind 4** (`@tailwindcss/postcss`)
- **Neon Postgres** (`@neondatabase/serverless`) в проде, **better-sqlite3** локально (`db/crm.db`)
- **NextAuth 4** для авторизации (`src/app/api/auth/[...nextauth]/route.ts`)
- **@dnd-kit** для канбана, **recharts** для графиков
- **Anthropic SDK** (`@anthropic-ai/sdk`) для AI-фич
- Тест-фреймворк: **не установлен** — Tester предложит выбор при первой задаче на тесты.

## Структура

```
src/
  app/            — страницы App Router (page.tsx) + Route Handlers (api/*/route.ts)
    api/          — backend: REST-эндпоинты CRM
    api/webhooks/ — входящие вебхуки (WhatsApp Green/Omnichat/Meta)
  components/     — React-компоненты
  lib/            — серверные и общие утилиты
  types/          — типы
db/               — SQLite-файлы локалки + миграции
DESIGN.md         — полный дизайн-документ CRM (читать перед крупной фичей)
.claude/agents/   — роли агентов команды (pm, backend, frontend, tester)
TEAM.md           — протокол работы команды
start-team.sh     — запуск мульти-агентной tmux-команды
stop-team.sh      — остановка
logs/             — логи агентов (pm.log, backend.log, frontend.log, tester.log)
```

## Важное правило про Next.js 16

См. `AGENTS.md` (импортировано выше): это **не тот Next.js, что в тренировочных данных**. Перед написанием API-кода или Server Components — читай `node_modules/next/dist/docs/`. Обращай внимание на deprecation-warnings при сборке.

## Команда

Проект ведётся мульти-агентной командой (см. `TEAM.md`):
**PM + Backend + Frontend + Tester** — все в tmux-сессии `thermo-team`. Единственная точка общения с пользователем — PM (панель `0.0`).
