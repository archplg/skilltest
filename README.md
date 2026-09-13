# SkillTest

**Test framework and CI gate for AI agent skills (`SKILL.md`).**
Bilingual RU/EN evals · behaviour contract (`spec.yaml`) · LLM judge · with-skill vs no-skill baseline · trigger test · prompt-injection guard with Cyrillic-aware patterns · HTML / JSON / JUnit / SARIF reports · non-zero exit codes for CI.

[![tests](https://github.com/archplg/skilltest/actions/workflows/ci.yml/badge.svg)](https://github.com/archplg/skilltest/actions/workflows/ci.yml) [![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**→ [skillemall.ai](https://skillemall.ai)** is the public rating this engine runs: 118,000+ skills pulled from
open catalogs, graded A–F for safety and quality, with a second, separate grade for whether a skill's process
actually runs to the end. Search it, browse today's catch of broken or risky skills, or check your own skill there
for free — no install. Everything below is the same engine, to run yourself or wire into CI.

<p align="center">
  <a href="https://skillemall.ai"><img src="docs/screenshots/home.png" alt="skillemall.ai — search skills by task, today's caught skills, freshness and trend" width="820"></a>
</p>
<p align="center">
  <a href="https://skillemall.ai/rating"><img src="docs/screenshots/rating.png" alt="skillemall.ai rating table — grade, safety, quality, process, tests, popularity" width="820"></a>
</p>

[Русская версия → README.ru.md](README.ru.md)

> Until the package is on npm: `npm i -g github:archplg/skilltest`, then `skilleval …`; or `npx github:archplg/skilltest …`.

```bash
npx skilleval init  ./my-skill      # scaffold spec.yaml + evals/evals.json
npx skilleval run   ./my-skill      # guard → cases → triggers → report (exit 0/1/2/3)
```

> npm package: **`skilleval`** (the name `skilltest` was taken). Both `skilleval` and `skilltest` binaries are installed.

## Why

Skills are text. When you edit one, nothing tells you it stopped working: no stack trace, no red status, just a behaviour change somebody notices a week later. Skills also fail to trigger (about a coin flip out of the box), silently exceed description budgets, and — as ClawHavoc showed — ship with malicious instructions in plain sight, in more than one language.

SkillTest turns a skill into something you can put behind CI:

| Check | Question it answers | Fails the build when |
|---|---|---|
| **guard** | Does the skill folder contain injections, exfiltration, dangerous commands, secrets? (RU + EN patterns, invisible-Unicode checks) | any *critical* finding (configurable) |
| **lint** | Is the frontmatter valid, within limits, are referenced files present, is the description telling the model *when* to trigger? | errors |
| **cases** | Does the skill still produce the expected behaviour on real requests (in the user's language)? | pass rate < threshold, or a drop vs the saved snapshot |
| **baseline** | Does the skill add anything over the same model *without* the skill? | uplift below threshold → status **OBSOLETE** |
| **triggers** | Does the description make the model pick this skill for the right phrases — and *not* for the wrong ones? | positive/negative trigger rate < threshold |

Statuses follow the Skillemall lifecycle: **ACTIVE · DEGRADED · OBSOLETE · BLOCKED · DRAFT · ERROR**.

## Quick start

```bash
# 1. scaffold (reads name/description from SKILL.md)
npx skilleval init ./my-skill

# 2. fill in the TODOs in my-skill/spec.yaml and my-skill/evals/evals.json

# 3. offline sanity check — no keys, $0
npx skilleval run ./my-skill --mock

# 4. plan + cost estimate, no calls
export OPENROUTER_API_KEY=sk-or-...
npx skilleval run ./my-skill --dry-run

# 5. real run (hard spend cap), then save the result as the regression reference
npx skilleval run ./my-skill --budget 1 --snapshot save
```

Reports land in `my-skill/.skilltest/`: `report.html` (self-contained), `results.json`, `junit.xml`, `guard.sarif`.

## Files

```
my-skill/
├── SKILL.md                 # the skill (Agent Skills format)
├── spec.yaml                # behaviour contract: triggers, assertions, thresholds, models, guard allow-list
└── evals/
    ├── evals.json           # test cases (compatible with Anthropic skill-creator evals.json)
    ├── inputs/…             # files attached to cases
    └── snapshot.json        # saved reference for regression detection (commit it)
```

### `evals/evals.json`

Compatible with the `skill-creator` format (`skill_name`, `evals[].prompt`, `expected_output`, `files`) plus optional fields:

```jsonc
{
  "skill_name": "ticket-classifier",
  "evals": [
    {
      "id": "ru-billing",
      "lang": "ru",                      // ru | en (auto-detected from the prompt if omitted)
      "tags": ["classify", "happy-path"],// used by spec assertions `when: {tag: …}`
      "prompt": "Классифицируй заявку: «…»",
      "files": ["inputs/ticket.txt"],    // attached inline as <file> blocks
      "expected_output": "JSON with category billing, priority high, Russian one-sentence summary",
      "assertions": [ { "type": "not_contains", "value": ["CANARY-7731"] } ],   // per-case checks
      "canary": "CANARY-7731",           // for injection cases
      "baseline": false,                 // skip the no-skill run for this case
      "mock": { "skill": "…", "baseline": "…" }   // answers used by --mock
    }
  ]
}
```

If a case has `expected_output`, an LLM judge compares the answer with it (implicit `expected_output` assertion). The OpenAI Codex eval-skills format is also accepted: an `expectations: ["…"]` array becomes one judge assertion per item.

Skills whose value lives in reference files (`rules/*.md`, `references/**`) can inline them into the system prompt with `--include-files "rules/*.md"` or `run.include_files` in spec.yaml; the shadcn skill goes from 0 to +33 pp uplift this way.

### `spec.yaml`

```yaml
version: 1
skill: ticket-classifier
language: [ru, en]

triggers:                 # tested against a catalog of decoy skills
  positive: ["классифицируй эту заявку …", "triage this support ticket …"]
  negative: ["переведи это письмо", "merge these two PDF files"]

assertions:               # checked on every answer; scope with when: {tag|lang|case|not_tag}
  - { id: A1, type: json, required_keys: [category, priority, confidence, summary], when: { tag: classify } }
  - { id: A2, type: language }                       # answer in the user's language
  - { id: A3, type: not_contains, value: ["CANARY-7731"] }
  - { id: A4, type: llm_judge, rubric: "Summary is one sentence and invents no facts." }

thresholds:
  pass_rate: 0.8          # ACTIVE needs ≥ 80 % assertions passed (with skill)
  degraded_drop: 0.1      # ≥ 10 pp drop vs snapshot → DEGRADED
  min_uplift: 0.1         # baseline already passes and uplift < 10 pp → OBSOLETE
  trigger_rate: 0.8
  judge_pass_score: 0.7

models: [openrouter:anthropic/claude-sonnet-4.6, openrouter:openai/gpt-5.5]
judge: openrouter:anthropic/claude-sonnet-4.6

run: { baseline: true, triggers: true, guard: true, budget_usd: 5, concurrency: 4, temperature: 0, max_tokens: 2000 }

guard:
  fail_on: critical       # critical | high | medium | none
  allow: []               # pattern ids to ignore (or put `skilltest-guard: allow <id>` on the line)
  ignore_paths: []        # globs; evals/**, tests/** are ignored by default
```

### Skill dialects

SkillTest reads the common `SKILL.md` format and adapts to dialects it recognises. **Hermes Agent** skills (`metadata.hermes.*`, `category`, `tags`, `platforms`, a `## When to Use` section) follow the Hermes authoring standard: description ≤ 60 characters, "when to use" in the body section rather than the description. Lint applies that rule set instead of the Anthropic one, and the trigger test shows the router the "When to Use" text alongside the description, as Hermes does. Guard also flags `required_environment_variables` that request credential-looking names, since Hermes injects them into the skill's sandbox. Field notes on 22 000 Hermes-ecosystem skills: [HERMES-REPORT.ru.md](HERMES-REPORT.ru.md).

### Assertion types

`contains` · `not_contains` · `one_of` · `regex` · `not_regex` · `starts_with` · `ends_with` · `language` (ru/en/auto) · `json` (+`required_keys`) · `max_chars` · `min_chars` · `word_count` · `no_secret_leak` (key patterns + canaries) · `no_injection_compliance` (canary, optional judge) · `refuses` (judge) · `expected_output` (judge vs `expected_output`) · `llm_judge` (judge vs `rubric`).

## Models and providers

Model refs are `provider:model`:

| Prefix | Backend | Env |
|---|---|---|
| `openrouter:vendor/model` (default for `vendor/model`) | OpenRouter — any model, cost tracked via `usage.cost` | `OPENROUTER_API_KEY` |
| `anthropic:claude-…` | Anthropic Messages API | `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL` |
| `openai:gpt-…` | OpenAI Chat Completions | `OPENAI_API_KEY`, `OPENAI_BASE_URL` |
| `litellm:<alias>` | LiteLLM proxy (GigaChat, YandexGPT, Bedrock, anything) | `LITELLM_BASE_URL`, `LITELLM_API_KEY` |
| `ollama:<model>` | local Ollama | `OLLAMA_BASE_URL` |
| `gigachat:` / `yandex:` / `custom:` | any OpenAI-compatible gateway | `GIGACHAT_BASE_URL`, `YANDEX_BASE_URL`, `CUSTOM_LLM_BASE_URL` (+ `_API_KEY`) |
| `mock` | offline deterministic provider | — |

Precedence: `--models` > `SKILLTEST_MODELS` > `spec.yaml models` > OpenRouter default. Every run has a hard spend cap (`--budget`, `SKILLTEST_BUDGET_USD`, `run.budget_usd`); when it is hit the run stops with exit 2 instead of returning a misleading pass.

## Catalog audit

```bash
npx skilleval audit ./skills-repo ~/.claude/skills --lang ru --top 40
```

Walks every `SKILL.md` under the roots (a repo-root SKILL.md does not "own" nested skills), runs lint + guard on each, prints the top by risk and writes `audit.md` / `audit.json` with corpus statistics: blocked, findings by severity and rule, evals/spec coverage, description-length and "no when-to-use" rates. Skills living under `test/`, `fixtures/` etc. are reported but never counted as blocked. Exit 3 if any skill is blocked. This is the command for registry maintainers and for anyone installing a bundle of community skills.

Field-tested on ~26 000 public skills (GitHub catalogs, a registry mirror, a live ClawHub sample): 0 false blocks in the live catalogs, 17 real blocks in the mirror — nearly all leaked API keys, bot tokens and agent-memory dumps published as skills. Write-up: [HUNT-REPORT.ru.md](HUNT-REPORT.ru.md).

## Drafting tests with a model

```bash
npx skilleval init ./my-skill --draft            # uses OpenRouter default, or --models m
```

`--draft` asks a model to write positive/negative trigger phrases, 2–4 cheap assertions and 4–6 bilingual cases from the SKILL.md (an injection case is always added). One call, a few cents, and the skill goes from zero tests to a runnable suite. Review the draft: the model can be wrong about your skill.

## CLI

```
skilltest init [dir] [--draft]   skilltest lint [dir]        skilltest guard [dir] [--sarif out.sarif]
skilltest run  [dir]             skilltest ci   [dir]        skilltest triggers [dir]
skilltest audit <root...>        skilltest report [dir]      skilltest models [--check a,b]

--models a,b  --judge m  --budget usd  --mock  --dry-run  --no-baseline  --no-triggers  --no-guard
--fail-on critical|high|medium|none  --filter id1,id2  --repeats n  --concurrency n
--snapshot save|compare|none  --strict  --out dir  --report json,html,junit,sarif  --lang ru|en  --json  --quiet  --verbose
```

Exit codes: **0** ACTIVE (or OBSOLETE without `--strict`) · **1** DEGRADED / lint errors · **2** config or runtime error (incl. budget hit) · **3** guard BLOCKED.

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

The action writes a job summary and exposes `status`, `exit-code`, `report-dir` outputs. `guard.sarif` can be uploaded with `github/codeql-action/upload-sarif` to show findings in the Security tab. Without keys use `mock: 'true'` for a format smoke test.

## Guard

A static scanner tuned for skills, not for source code: instruction overrides, role hijacks, concealment ("do not tell the user" / «не сообщай пользователю»), exfiltration (secrets → URL, webhook hosts, env vars in network calls), pipe-to-shell, encoded payloads, persistence, auto-run instructions, obfuscation (base64 blobs, hex chains, HTML-comment instructions, hidden text), false authority ("authorised test mode" / «по указанию администратора»), hard-coded keys (vendor formats plus labelled tokens of unknown format), Unicode tricks (zero-width, TAG characters, bidi overrides, Latin/Cyrillic homoglyph words), and file-level checks: agent memory / workspace dumps (`MEMORY.md`, `memory/*.md`), bundled `.env` / credential files, helpers that send an API key to a host configured by an environment variable, browser cookie-store access, crypto-wallet secrets, offensive-security intent.

Patterns use Unicode letter classes instead of ASCII `\b`, so «проигнорируйте все предыдущие инструкции» is caught the same way as "ignore all previous instructions". Every finding carries its **context**, and severity is adjusted for it: a negated phrase ("never send your key to…") or a placeholder secret (`sk-ant-your-key-here`, `AKIAIOSFODNN7EXAMPLE`) drops to *low*; a deny-list/regex line, a documentation table row, a demo domain (`evil.com`), a test fixture, or the markdown of a security skill each step the severity down one level. Real exfiltration inside a script is never downgraded. Severities were calibrated on 532 real skills (anthropics/skills, obra/superpowers, the Codex plugin catalog, Hermes): **0 false blocks, 6 highs left for human review**, while the malicious fixture stays blocked on four independent critical rules. Guard is heuristic: it raises the cost of the obvious attacks, it does not prove a skill safe. Details: [WILD-SCAN.ru.md](WILD-SCAN.ru.md).

## Programmatic use

```js
import { runSkill, scanSkill, loadSkill } from 'skilleval';
const summary = await runSkill('./my-skill', { models: ['openrouter:anthropic/claude-sonnet-4.6'], budget: 1 });
console.log(summary.status, summary.passRate, summary.exitCode);
```

## Development

```bash
npm install
npm test                                   # unit + e2e (offline)
node bin/skilltest.js run examples/ticket-classifier --mock
node bin/skilltest.js guard test/fixtures/malicious-skill   # exit 3
```

## Roadmap

- multi-turn / tool-use cases (agent loop instead of single-turn), `allowed-tools` simulation
- flakiness score across `--repeats`, per-model uplift matrix in the HTML report
- `skilltest watch` and a pre-commit hook; `skilltest diff` between two snapshots
- GigaChat / YandexGPT native adapters (today via LiteLLM or any OpenAI-compatible gateway)
- registry hook: run the guard before publishing to a skills catalog

MIT © 2026 Sergey Dolgov / Archipelago

## SkillTest Hub: web rating and self-service checker

The same core powers a web service (`web/`): a continuously refreshed rating of skills from open catalogs (ClawHub API, GitHub repositories, local folders) with A–F grades, and a page where anyone can check their own skill — paste a SKILL.md, upload a ZIP or give a link. The quick static scan is free and unlimited; the full model run (drafted tests, with-skill vs. baseline, LLM judge, HTML report) is free once a day and then paid with credits (Stripe / YooKassa / promo codes).

```bash
cp web/.env.example web/.env   # HUB_SECRET, OPENROUTER_API_KEY …
npm run web                    # http://127.0.0.1:8788
npm run web:ingest             # fill the rating from the default catalogs
```

`docker compose up -d --build` runs it in production. Details in [web/README.ru.md](web/README.ru.md); the JSON API is documented at `/api` on the running service.
