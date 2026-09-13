# Тексты страницы API (снято с сайта перед закрытием публичного API)

Страница `/api` и публичные ручки каталога убраны с сайта 11 сентября 2026 по решению владельца: открытый доступ без ключей позволял выкачать весь рейтинг за пару часов. Тексты сохранены здесь, чтобы вернуть их, когда появится выдача по ключу.

Что осталось работать после закрытия: `GET /api/checks/:id` (страница проверки опрашивает её сама) и адреса вебхуков оплаты. Всё остальное из списка ниже отключено.

---

## API

Публичное JSON API без ключей. Лимит: 120 запросов в минуту с одного адреса. Ответы кэшируются на минуту.

*Public JSON API, no keys. Limit: 120 requests per minute per address. Responses are cached for a minute.*

### GET /api/skills

Рейтинг с фильтрами: `q`, `source`, `grade`, `category`, `dialect`, `sort` (overall | popularity | safety | quality | risk | updated | new), `tests=1`, `verified=1`, `noblocked=1`, `page`, `limit` (≤ 200).

*The rating with filters.*

```
curl "https://skillemall.ai/api/skills?grade=A&sort=popularity&limit=5"
```

### GET /api/skills/:source/:slug

Полная карточка скилла: оценки, находки guard (улики замаскированы), lint, тесты, история.

*The full skill record: scores, guard findings (masked evidence), lint, tests, history.*

```
curl "https://skillemall.ai/api/skills/clawhub/steipete/gog"
```

### POST /api/checks

Создать проверку. Тело JSON: `{"mode":"quick"|"full","kind":"paste","text":"…"}` или `{"kind":"url","url":"https://github.com/…"}` или `{"kind":"zip","zip_base64":"…"}`. Квота полной проверки такая же, как на сайте (по сессии и адресу).

*Create a check. Same full-check quota as on the site (per session and address).*

```
curl -X POST "https://skillemall.ai/api/checks" -H "Content-Type: application/json" \
  -d '{"mode":"quick","kind":"paste","text":"---\nname: demo\ndescription: Use when …\n---\n# Demo"}'
```

### GET /api/checks/:id

Статус и результат проверки (опрашивайте раз в 2–5 с, пока status не станет done или failed).

*Check status and result (poll every 2–5 s until status is done or failed).*

### GET /api/stats

Сводка рейтинга: количество скиллов, источники, распределение оценок, версия правил.

*Rating summary: skill counts, sources, grade distribution, rules version.*

### CI

Для CI используйте CLI из того же ядра: `npx skilleval ci ./my-skill` (коды выхода 0/1/2/3, отчёты JSON/HTML/JUnit/SARIF, GitHub Action `archplg/skilltest@v0`).

*For CI use the CLI built on the same core.*

---

## Если возвращать API

Разумная форма: без ключа отдавать не больше 50 записей за запрос и только видимые на сайте поля; полную выгрузку, находки guard и процессные параметры — по ключу из кабинета, с учётом в квоте. Тогда API остаётся поводом встроить сервис в чужой CI, но перестаёт быть бесплатным каналом для копирования базы.
