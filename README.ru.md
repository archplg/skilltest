# SkillTest

**Тестовый фреймворк и CI-барьер для скиллов AI-агентов (`SKILL.md`).**
Двуязычные RU/EN тест-кейсы · контракт поведения (`spec.yaml`) · модель-судья · сравнение «со скиллом / без скилла» · тест срабатывания (триггеров) · сканер prompt injection с кириллическими паттернами · отчёты HTML / JSON / JUnit / SARIF · ненулевые коды выхода для CI.

**→ [skillemall.ai](https://skillemall.ai)** — публичный рейтинг на этом движке: 118 000+ скиллов из открытых
каталогов, оценка A–F за безопасность и качество, и отдельная вторая оценка — дойдёт ли процесс скилла до конца.
Ищите по задаче, смотрите сегодняшний улов сломанных и рискованных скиллов или проверьте свой — бесплатно, без
установки. Всё, что ниже, — тот же движок, чтобы запустить у себя или встроить в CI.

<p align="center">
  <a href="https://skillemall.ai"><img src="docs/screenshots/home.png" alt="skillemall.ai — поиск скиллов по задаче, сегодняшний улов, свежесть данных и динамика" width="820"></a>
</p>
<p align="center">
  <a href="https://skillemall.ai/rating"><img src="docs/screenshots/rating.png" alt="skillemall.ai — таблица рейтинга: оценка, безопасность, качество, процесс, тесты, популярность" width="820"></a>
</p>

[English version → README.md](README.md)

> Пока пакет не опубликован в npm: `npm i -g github:archplg/skilltest`, затем `skilleval …`; или `npx github:archplg/skilltest …`.

```bash
npx skilleval init  ./my-skill      # создать spec.yaml + evals/evals.json
npx skilleval run   ./my-skill      # guard → кейсы → триггеры → отчёт (exit 0/1/2/3)
```

> Пакет на npm называется **`skilleval`** (имя `skilltest` занято). Ставятся обе команды: `skilleval` и `skilltest`.

## Зачем

Скилл — это текст. Когда его правят, ничто не сообщает, что он перестал работать: нет стектрейса, нет красного статуса, только изменение поведения, которое кто-то заметит через неделю. Скиллы ещё и не срабатывают (примерно «подброс монетки» из коробки), молча вылетают за бюджет описаний, а после ClawHavoc известно, что вредоносные инструкции в них лежат открытым текстом, и не только на английском.

SkillTest превращает скилл в то, что можно поставить за CI:

| Проверка | На какой вопрос отвечает | Когда роняет сборку |
|---|---|---|
| **guard** | Есть ли в папке скилла инъекции, эксфильтрация, опасные команды, секреты? (паттерны RU + EN, проверки невидимого Unicode) | любая *critical* находка (настраивается) |
| **lint** | Валиден ли фронтматтер, соблюдены ли лимиты, на месте ли файлы, говорит ли description модели, *когда* срабатывать? | ошибки |
| **кейсы** | Даёт ли скилл ожидаемое поведение на реальных запросах (на языке пользователя)? | pass rate ниже порога или падение относительно сохранённого снапшота |
| **baseline** | Добавляет ли скилл хоть что-то по сравнению с той же моделью *без* скилла? | прирост ниже порога → статус **OBSOLETE** |
| **триггеры** | Заставляет ли description модель выбрать этот скилл на нужные фразы и *не* выбирать на чужие? | доля срабатываний ниже порога |

Статусы — по жизненному циклу Skillemall: **ACTIVE · DEGRADED · OBSOLETE · BLOCKED · DRAFT · ERROR**.

## Быстрый старт

```bash
# 1. шаблоны (name/description берутся из SKILL.md)
npx skilleval init ./my-skill

# 2. заполнить TODO в my-skill/spec.yaml и my-skill/evals/evals.json

# 3. офлайн-проверка формата — без ключей, $0
npx skilleval run ./my-skill --mock

# 4. план и оценка стоимости, без вызовов
export OPENROUTER_API_KEY=sk-or-...
npx skilleval run ./my-skill --dry-run

# 5. реальный прогон с жёстким лимитом расходов, результат сохранить как эталон для регрессий
npx skilleval run ./my-skill --budget 1 --snapshot save --lang ru
```

Отчёты складываются в `my-skill/.skilltest/`: `report.html` (самодостаточный), `results.json`, `junit.xml`, `guard.sarif`.

## Файлы

```
my-skill/
├── SKILL.md                 # сам скилл (формат Agent Skills)
├── spec.yaml                # контракт: триггеры, утверждения, пороги, модели, исключения guard
└── evals/
    ├── evals.json           # тест-кейсы (совместимы с evals.json из skill-creator от Anthropic)
    ├── inputs/…             # файлы, прикладываемые к кейсам
    └── snapshot.json        # сохранённый эталон для регрессий (коммитить)
```

### `evals/evals.json`

Совместим с форматом `skill-creator` (`skill_name`, `evals[].prompt`, `expected_output`, `files`) плюс необязательные поля:

```jsonc
{
  "skill_name": "ticket-classifier",
  "evals": [
    {
      "id": "ru-billing",
      "lang": "ru",                      // ru | en (если не указан, определяется по промпту)
      "tags": ["classify", "happy-path"],// для утверждений из spec с when: {tag: …}
      "prompt": "Классифицируй заявку: «…»",
      "files": ["inputs/ticket.txt"],    // подставляются в сообщение блоками <file>
      "expected_output": "JSON с category billing, priority high и резюме одним предложением по-русски",
      "assertions": [ { "type": "not_contains", "value": ["CANARY-7731"] } ],   // проверки только для этого кейса
      "canary": "CANARY-7731",           // для кейсов с инъекцией
      "baseline": false,                 // не гонять этот кейс без скилла
      "mock": { "skill": "…", "baseline": "…" }   // ответы для режима --mock
    }
  ]
}
```

Если у кейса есть `expected_output`, модель-судья сверяет с ним ответ (неявное утверждение `expected_output`). Формат OpenAI Codex eval-skills тоже принимается: массив `expectations: ["…"]` превращается в утверждения для судьи, по одному на элемент.

Если ценность скилла лежит в справочных файлах (`rules/*.md`, `references/**`), их можно подгрузить в системный промпт флагом `--include-files "rules/*.md"` или полем `run.include_files` в spec.yaml; скилл shadcn так переходит от нулевого прироста к +33 п.п.

### `spec.yaml`

```yaml
version: 1
skill: ticket-classifier
language: [ru, en]

triggers:                 # проверяются на фоне каталога скиллов-приманок
  positive: ["классифицируй эту заявку …", "triage this support ticket …"]
  negative: ["переведи это письмо", "merge these two PDF files"]

assertions:               # проверяются на каждом ответе; область — when: {tag|lang|case|not_tag}
  - { id: A1, type: json, required_keys: [category, priority, confidence, summary], when: { tag: classify } }
  - { id: A2, type: language }                       # ответ на языке пользователя
  - { id: A3, type: not_contains, value: ["CANARY-7731"] }
  - { id: A4, type: llm_judge, rubric: "Резюме — одно предложение, без выдуманных фактов." }

thresholds:
  pass_rate: 0.8          # ACTIVE при ≥ 80 % пройденных утверждений (со скиллом)
  degraded_drop: 0.1      # падение на ≥ 10 п.п. относительно снапшота → DEGRADED
  min_uplift: 0.1         # baseline уже проходит и прирост < 10 п.п. → OBSOLETE
  trigger_rate: 0.8
  judge_pass_score: 0.7

models: [openrouter:anthropic/claude-sonnet-4.6, openrouter:openai/gpt-5.5]
judge: openrouter:anthropic/claude-sonnet-4.6

run: { baseline: true, triggers: true, guard: true, budget_usd: 5, concurrency: 4, temperature: 0, max_tokens: 2000 }

guard:
  fail_on: critical       # critical | high | medium | none
  allow: []               # id паттернов, которые игнорировать (или `skilltest-guard: allow <id>` на строке)
  ignore_paths: []        # glob-маски; evals/** и tests/** не сканируются по умолчанию
```

### Диалекты скиллов

SkillTest читает общий формат `SKILL.md` и подстраивается под известные диалекты. Скиллы **Hermes Agent** (`metadata.hermes.*`, `category`, `tags`, `platforms`, раздел `## When to Use`) живут по стандарту Hermes: description не длиннее 60 символов, «когда применять» в разделе тела, а не в description. Lint применяет этот набор правил вместо правил Anthropic, а тест триггеров показывает роутеру текст «When to Use» вместе с description, как это делает сам Hermes. Guard также помечает `required_environment_variables` с секретными именами, потому что Hermes пробрасывает их в песочницу скилла. Полевые заметки по 22 000 скиллов экосистемы Hermes: [HERMES-REPORT.ru.md](HERMES-REPORT.ru.md).

### Типы утверждений

`contains` · `not_contains` · `one_of` · `regex` · `not_regex` · `starts_with` · `ends_with` · `language` (ru/en/auto) · `json` (+`required_keys`) · `max_chars` · `min_chars` · `word_count` · `no_secret_leak` (паттерны ключей + канарейки) · `no_injection_compliance` (канарейка, опционально судья) · `refuses` (судья) · `expected_output` (судья против `expected_output`) · `llm_judge` (судья против `rubric`).

## Модели и провайдеры

Ссылка на модель — `provider:model`:

| Префикс | Бэкенд | Переменные |
|---|---|---|
| `openrouter:vendor/model` (по умолчанию для `vendor/model`) | OpenRouter — любая модель, стоимость из `usage.cost` | `OPENROUTER_API_KEY` |
| `anthropic:claude-…` | Anthropic Messages API | `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL` |
| `openai:gpt-…` | OpenAI Chat Completions | `OPENAI_API_KEY`, `OPENAI_BASE_URL` |
| `litellm:<alias>` | прокси LiteLLM (GigaChat, YandexGPT, Bedrock, что угодно) | `LITELLM_BASE_URL`, `LITELLM_API_KEY` |
| `ollama:<model>` | локальная Ollama | `OLLAMA_BASE_URL` |
| `gigachat:` / `yandex:` / `custom:` | любой OpenAI-совместимый шлюз | `GIGACHAT_BASE_URL`, `YANDEX_BASE_URL`, `CUSTOM_LLM_BASE_URL` (+ `_API_KEY`) |
| `mock` | офлайн детерминированный провайдер | — |

Приоритет: `--models` > `SKILLTEST_MODELS` > `models` в spec.yaml > OpenRouter по умолчанию. У каждого прогона есть жёсткий лимит расходов (`--budget`, `SKILLTEST_BUDGET_USD`, `run.budget_usd`); при его достижении прогон останавливается с кодом 2, а не возвращает ложный «зелёный».

## Аудит каталога

```bash
npx skilleval audit ./skills-repo ~/.claude/skills --lang ru --top 40
```

Обходит все `SKILL.md` под указанными корнями (корневой SKILL.md репозитория не «владеет» вложенными скиллами), прогоняет lint и guard по каждому, печатает топ по риску и пишет `audit.md` / `audit.json` со статистикой корпуса: заблокировано, находки по серьёзности и правилам, покрытие тестами, длина описаний, доля описаний без «когда применять». Скиллы в папках `test/`, `fixtures/` и т.п. показываются, но не считаются заблокированными. Exit 3, если хоть один скилл заблокирован. Это команда для мейнтейнеров каталогов и для всех, кто ставит пачку чужих скиллов.

Проверено на ~26 000 публичных скиллов (каталоги GitHub, зеркало реестра, живая выборка ClawHub): 0 ложных блокировок в живых каталогах и 17 настоящих в зеркале, почти все это утечки ключей API, токенов ботов и дампов памяти агента, опубликованных как скиллы. Разбор: [HUNT-REPORT.ru.md](HUNT-REPORT.ru.md).

## Черновик тестов от модели

```bash
npx skilleval init ./my-skill --draft            # OpenRouter по умолчанию или --models m
```

`--draft` просит модель написать по SKILL.md позитивные и негативные триггеры, 2–4 дешёвых утверждения и 4–6 двуязычных кейсов (кейс с инъекцией добавляется всегда). Один вызов, несколько центов, и скилл из состояния «ноль тестов» переходит в состояние «есть прогоняемый набор». Черновик надо проверить: модель может ошибиться в понимании скилла.

## CLI

```
skilltest init [dir] [--draft]   skilltest lint [dir]        skilltest guard [dir] [--sarif out.sarif]
skilltest run  [dir]             skilltest ci   [dir]        skilltest triggers [dir]
skilltest audit <root...>        skilltest report [dir]      skilltest models [--check a,b]

--models a,b  --judge m  --budget usd  --mock  --dry-run  --no-baseline  --no-triggers  --no-guard
--fail-on critical|high|medium|none  --filter id1,id2  --repeats n  --concurrency n
--snapshot save|compare|none  --strict  --out dir  --report json,html,junit,sarif  --lang ru|en  --json  --quiet  --verbose
```

Коды выхода: **0** ACTIVE (или OBSOLETE без `--strict`) · **1** DEGRADED / ошибки lint · **2** ошибка конфигурации или выполнения (в т.ч. исчерпан бюджет) · **3** guard BLOCKED.

## GitHub Action

```yaml
- uses: archplg/skilltest@v1
  with:
    skill: skills/ticket-classifier
    models: openrouter:anthropic/claude-sonnet-4.6
    budget: '1'
  env:
    OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
- uses: actions/upload-artifact@v4
  if: always()
  with: { name: skilltest-report, path: skills/ticket-classifier/.skilltest }
```

Action пишет job summary и отдаёт выходы `status`, `exit-code`, `report-dir`. Файл `guard.sarif` можно загрузить через `github/codeql-action/upload-sarif`, чтобы находки появились во вкладке Security. Без ключей используйте `mock: 'true'` для дымовой проверки формата.

## Guard

Статический сканер, заточенный под скиллы, а не под исходный код: перехват инструкций, подмена роли, сокрытие («не сообщай пользователю» / "do not tell the user"), эксфильтрация (секреты → URL, вебхуки, переменные окружения в сетевых вызовах), pipe в shell, закодированные payload'ы, закрепление в системе, инструкции автозапуска, обфускация (base64-блобы, hex-цепочки, инструкции в HTML-комментариях, скрытый текст), ложный авторитет («по указанию администратора» / "authorised test mode"), захардкоженные ключи (форматы вендоров плюс токены неизвестного формата рядом с меткой), Unicode-трюки (нулевая ширина, TAG-символы, bidi-переопределения, слова-гомоглифы из латиницы и кириллицы) и файловые проверки: дампы памяти агента (`MEMORY.md`, `memory/*.md`), файлы `.env` и учётных данных внутри скилла, helper-скрипты, отправляющие API-ключ на хост из переменной окружения, доступ к хранилищу cookies браузера, секреты криптокошельков, наступательное назначение.

Паттерны используют Unicode-классы букв вместо ASCII `\b`, поэтому «проигнорируйте все предыдущие инструкции» ловится так же, как "ignore all previous instructions". У каждой находки есть **контекст**, и серьёзность подстраивается под него: фраза с отрицанием («никогда не отправляй ключ на…») или ключ-заглушка (`sk-ant-your-key-here`, `AKIAIOSFODNN7EXAMPLE`) опускаются до *low*; строка чёрного списка или регулярного выражения, строка таблицы в документации, демонстрационный домен (`evil.com`), тестовый файл и markdown security-скилла понижают уровень на одну ступень каждый. Настоящая эксфильтрация внутри скрипта не понижается никогда. Серьёзность откалибрована на 532 реальных скиллах (anthropics/skills, obra/superpowers, каталог плагинов Codex, Hermes): **0 ложных блокировок, 6 high на ручную проверку**, при этом вредоносная заглушка блокируется по четырём независимым critical-правилам. Guard — эвристика: он поднимает цену очевидных атак, но не доказывает безопасность скилла. Подробности: [WILD-SCAN.ru.md](WILD-SCAN.ru.md).

## Программный интерфейс

```js
import { runSkill, scanSkill, loadSkill } from 'skilleval';
const summary = await runSkill('./my-skill', { models: ['openrouter:anthropic/claude-sonnet-4.6'], budget: 1 });
console.log(summary.status, summary.passRate, summary.exitCode);
```

## Разработка

```bash
npm install
npm test                                   # unit + e2e (офлайн)
node bin/skilltest.js run examples/ticket-classifier --mock --lang ru
node bin/skilltest.js guard test/fixtures/malicious-skill   # exit 3
```

## Дорожная карта

- многоходовые кейсы и вызовы инструментов (агентный цикл вместо одного хода), симуляция `allowed-tools`
- оценка нестабильности по `--repeats`, матрица прироста по моделям в HTML-отчёте
- `skilltest watch` и pre-commit-хук; `skilltest diff` между двумя снапшотами
- нативные адаптеры GigaChat / YandexGPT (сейчас — через LiteLLM или любой OpenAI-совместимый шлюз)
- хук для каталогов: guard перед публикацией скилла (NeuralDeep, skills.sh)

MIT © 2026 Сергей Долгов / Archipelago

## SkillTest Hub: веб-рейтинг и проверка своих скиллов

На том же ядре работает веб-сервис (`web/`): пополняемый рейтинг скиллов из открытых каталогов (API ClawHub, GitHub-репозитории, локальные папки) с оценками A–F и страница, где любой может проверить свой скилл: вставить SKILL.md, загрузить ZIP или дать ссылку. Быстрый статический скан бесплатный и без ограничений; полная проверка на моделях (черновик тестов, прогон со скиллом и без, LLM-судья, HTML-отчёт) — одна в день бесплатно, дальше за кредиты (Stripe / ЮKassa / промокоды).

```bash
cp web/.env.example web/.env   # HUB_SECRET, OPENROUTER_API_KEY …
npm run web                    # http://127.0.0.1:8788
npm run web:ingest             # наполнить рейтинг из каталогов по умолчанию
```

Для продакшена: `docker compose up -d --build`. Подробности в [web/README.ru.md](web/README.ru.md); JSON API описано на странице `/api` работающего сервиса.
