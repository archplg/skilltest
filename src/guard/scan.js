import { PATTERNS, UNICODE_CHECKS, INVISIBLE_RE, SEVERITY_SCORE, SEVERITY_ORDER } from './patterns.js';
import { isTextFile, looksLikeScript } from '../skill.js';
import { readText, truncate } from '../util.js';

const MAX_FINDINGS_PER_PATTERN_PER_FILE = 5;

/** Test inputs legitimately contain injections (that is what they test), so they are not scanned by default. */
export const DEFAULT_IGNORE_PATHS = ['evals/**', 'tests/**', 'test/**', '.skilltest/**', '.skilltest-audit/**'];

const DOWN = { critical: 'high', high: 'medium', medium: 'low', low: 'low' };
const OPEN_Q = /["«`“„']\s*$/u;
const CLOSE_Q = /^\s*["»`”“']/u;
/** The line is a detector / deny-list / regex definition. */
const DETECTOR_CONTEXT = /(?:grep|egrep|rg|ripgrep|regex|regexp|pattern|patterns|match(?:es)?|detect(?:s|ed|ion)?|block(?:ed|s|list)?|deny|denylist|forbid(?:den)?|reject|blacklist|guard|scan(?:ner)?|signature|rule|marker|source|injection|severity|expected|malicious|suspicious|dangerous|unsafe|forbidden|indicator|ioc)[^\n]{0,80}$/iu;
/** Comparison against a literal is detection, not execution: `if cmd == "rm -rf /"`, `.includes(":(){…")`. */
const COMPARISON_CONTEXT = /(?:==|!=|=~|===|!==|includes\(|indexOf\(|contains\(|startsWith\(|endsWith\(|test\(|search\(|\bin\b)\s*\*?\s*["'`]?\s*$/iu;
/** Regex literal / raw string being defined: r"…", re.compile("…"), new RegExp("…"), /…/. */
const RAW_REGEX_CONTEXT = /(?:\br|re\.compile\(|RegExp\(|regex\s*[:=]\s*|pattern\s*[:=]\s*)["'`][^"'`]{0,16}$/u;
/** The line itself is regex syntax: (?: … ), .{0,40}, \d, [^…]. */
const REGEX_SYNTAX_RE = /\(\?[:!=<]|\.\{\d+,|\\[dwsDWS]\b|\[\^|\)\?|\{0,\d+\}/;
/** Detector output / report line with an upper-case severity label. */
const SEVERITY_LABEL_RE = /\b(?:CRITICAL|HIGH|MEDIUM|LOW|WARNING|BLOCKED)\b/;
/** Destination host is a variable / placeholder of the skill's own service: https://$HOST, https://{{host}}. */
const VARIABLE_HOST_RE = /https?:\/\/(?:\$\{?[A-Za-z_][\w]*\}?|\{\{[^}]+\}\}|<[^>]+>|\$\()/;
/** The phrase is negated: "never send…", "do NOT tell…", "не отправляй…". */
const NEGATION_CONTEXT = /(?:never|not|don'?t|do\s+not|no|nor|without|prohibited|forbidden|нельзя|не|никогда|запрещено|запрещается)\s*(?:\*\*|__|`)?\s*$/iu;
/** "Only send your API key to https://our-api…": scoping, not exfiltration. */
const SCOPED_CONTEXT = /(?:only|только)\s*(?:\*\*|__|`)?\s*$/iu;
/** Security-education demo markers. */
const DEMO_CONTEXT = /evil\.(?:com|example|net)|attacker(?:\.com|@)|malicious\.(?:com|example)|example\.(?:com|org|net)|badguy|hacker\.com|target\.(?:com|local|htb)|victim\.(?:com|local)|\btarget\b|\bvictim\b|\bpayload example|\bfor example\b|\be\.g\.|например|пример|злоумышленник|атакующ|to demonstrate|demonstrat|攻击者|恶意|例如|示例|注入|危険|禁止|確認|例え|など|\s等\)|WRONG|mistake|don'?t do this|never do this/iu;
/** Previous line is a "Never:" / "Do not:" style heading, so this list item is a prohibition. */
/** A heading/lead-in line that makes the list below it a prohibition: "Never:", "STRICTLY FORBIDDEN …, including:", "## Do Not Use When". */
const NEG_WORDS_RE = /never|do\s+not|don'?t|must\s+not|prohibited|forbidden|not\s+allowed|refuse|reject|decline|avoid|dangerous|destructive|blocked|denylist|blacklist|никогда|нельзя|запрещ|не\s+делай|отказ|опасн|禁止|危険|破壊的|不要/iu;
function isNegatedHeading(h) {
  if (!h || !NEG_WORDS_RE.test(h)) return false;
  return /[:：]\s*(?:\*\*)?\s*$/.test(h) || /^\s*#{1,6}\s/.test(h) || /^\s*\*\*[^*]{2,80}\*\*\s*$/.test(h);
}
/** Well-known publishing / hosting services: uploading with a token there is normal, not exfiltration. */
const KNOWN_SERVICE_RE = /https?:\/\/(?:[\w-]+\.)*(?:huggingface\.co|github\.com|gitlab\.com|pypi\.org|npmjs\.com|docker\.io|hub\.docker\.com|vercel\.com|netlify\.com|cloudflare\.com|amazonaws\.com|googleapis\.com|azure\.com|openai\.com|anthropic\.com|slack\.com\/api|notion\.so|atlassian\.net|figma\.com|supabase\.co|render\.com|fly\.io|heroku\.com|railway\.app)\b/i;
/** "Do not tell the user <a claim>" is guidance about honesty, not concealment. */
const CLAIM_AFTER_USER_RE = /^\s+(?:an?|any|that\s+(?:an?\s+)?\w+|which|what|how|whether)\s+\w+[^.]{0,40}\b(?:will|would|can|could|is|are|makes?|guarantee)/i;
/** Dockerfile instruction lines. */
const DOCKERFILE_LINE_RE = /^\s*(?:COPY|ADD|RUN|FROM|WORKDIR|ENV|ARG)\s+/;
/** The URL is a reference link (docs, "from https://…", markdown link), not a destination. */
const REFERENCE_LINK_RE = /(?:from|at|see|docs?|documentation|settings|console|dashboard|\(|\[)\s*[`"'<]?https?:\/\//iu;
/** Placeholder / example secret values. */
const PLACEHOLDER_RE = /x{4,}|X{4,}|your[-_ ]|YOUR[-_ ]|example|EXAMPLE|placeholder|\.\.\.|<[^>]{2,40}>|actual[-_]key|1234567890|abcdefgh|REPLACE|CHANGE[-_ ]?ME|dummy|sample|fake|redacted|\bTODO\b|\{\{|\$\{|YOUR_TOKEN|_TOKEN\b|\bsk-(?:tmp|temp|test|demo|dev|local|fake)-/;
const FIXTURE_FILE_RE = /(?:^|\/)(?:fixtures?|examples?|samples?|__tests__|spec|specs|mocks?)\/|(?:^|\/)[^/]*(?:test|spec|fixture|vulnerable|sample|example|mock)[^/]*\.[a-z0-9]+$/i;
const SECURITY_DOC_FILE_RE = /secur|advisory|threat|vulnerab|cve-|attack|injection|defen[cs]e|blacklist|denylist|hardening|pentest|exploit|payload|malware|forensic|escape|privesc|redteam|red-team|dorks?|hunt|recon|osint|fuzz|audit|guard|sentinel|shield|vett|scan/i;
const SECURITY_SKILL_RE = /secur|guard|sentinel|shield|defen[cs]e|scanner|audit|vett|firewall|threat|injection|sandbox|safe[-_ ]?exec|blacklist|denylist|hardening|pentest|red[-_ ]?team|ctf|forensic|malware|exploit|osint|recon|fuzz|hunt|dork|privesc|escape/i;
const EXEC_CALL_RE = /(?:exec(?:Sync)?|spawn(?:Sync)?|system|subprocess|popen|run\(|shell|eval|invoke|Start-Process|os\.system|child_process)\s*[\(\s]/i;
const MD_RE = /\.(?:md|markdown|txt|mdx)$/i;
const CODE_RE = /\.(?:js|mjs|cjs|ts|tsx|jsx|py|json|yaml|yml|rb|go|rs|java|sh|bat|ps1)$/i;
const DOC_CATEGORIES = new Set(['instruction_override', 'concealment', 'exfiltration', 'dangerous_command', 'obfuscation', 'social_engineering']);

function globToRe(glob) {
  const s = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '§§').replace(/\*/g, '[^/]*').replace(/§§/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${s}$`, 'i');
}

/** Parse inline allow markers: `skilltest-guard: allow id1,id2` on the line or the previous line. */
function inlineAllows(line, prevLine) {
  const out = new Set();
  for (const l of [line, prevLine]) {
    const m = l && l.match(/skilltest-guard\s*:\s*allow\s+([a-z0-9_,\- ]+)/i);
    if (m) for (const id of m[1].split(/[,\s]+/)) if (id) out.add(id.trim());
  }
  return out;
}

/**
 * Static scan of a skill folder.
 * opts: { allow: [ids], ignorePaths: [globs], scanEvals: bool, failOn: 'critical'|'high'|'medium'|'low'|'none', maxHigh }
 */
export function scanSkill(skill, opts = {}) {
  const allow = new Set(opts.allow || []);
  const ignore = [...(opts.scanEvals ? [] : DEFAULT_IGNORE_PATHS), ...(opts.ignorePaths || [])].map(globToRe);
  const failOn = opts.failOn || 'critical';
  const securitySkill = SECURITY_SKILL_RE.test(`${skill.name} ${skill.description}`);
  const vendorWords = vendorWordsOf(`${skill.name} ${skill.description}`);
  const findings = [];
  const scanned = [];
  for (const f of skill.files) {
    // Text by name, or a bare script by its first line — a payload in scripts/run must not escape by having no extension.
    if (f.tooBig || !(isTextFile(f.path) || looksLikeScript(f.full))) continue;
    if (ignore.some((re) => re.test(f.path))) continue;
    let text;
    try { text = readText(f.full); } catch { continue; }
    scanned.push(f.path);
    scanText(text, f.path, findings, allow, { securitySkill, vendorWords });
  }
  const at = skill.frontmatter?.['allowed-tools'];
  if (at) {
    const tools = Array.isArray(at) ? at.map(String) : String(at).split(/[\s,]+/);
    const broad = tools.filter((tl) => /^(?:Bash|Shell|Terminal)(?:\(\*?\))?$|^\*$|Bash\(\*\)|Bash\(sudo|Bash\(rm|Bash\(curl|Bash\(wget|Write\(\*?\)|Edit\(\*?\)/i.test(tl));
    if (broad.length && !allow.has('meta-broad-allowed-tools')) {
      findings.push({ id: 'meta-broad-allowed-tools', category: 'scope', severity: 'medium', file: 'SKILL.md', line: 1, snippet: `allowed-tools: ${tools.join(' ')}`, contexts: [], message: { en: `Broad tool permissions pre-approved: ${broad.join(', ')}`, ru: `Заранее разрешены широкие инструменты: ${broad.join(', ')}` } });
    }
  }
  // Hermes: a skill may declare env vars that the runtime injects into its sandboxes. Requesting credential-looking
  // names is a capability grab worth a human look; well-known high-value keys are high.
  const reqEnv = skill.frontmatter?.required_environment_variables || skill.frontmatter?.metadata?.hermes?.required_environment_variables;
  if (Array.isArray(reqEnv) && !allow.has('meta-requests-env-secret')) {
    const names = reqEnv.map((e) => (typeof e === 'string' ? e : e?.name)).filter(Boolean).map(String);
    const credLike = names.filter((n) => /KEY|TOKEN|SECRET|PASS(?:WORD)?|CRED|PRIVATE|SEED|MNEMONIC|COOKIE|SESSION/i.test(n));
    const highValue = credLike.filter((n) => /^(?:ANTHROPIC|OPENAI|OPENROUTER|GEMINI|GOOGLE|AWS|AZURE|GITHUB|GH|GITLAB|SLACK|DISCORD|TELEGRAM|STRIPE|TWILIO|SENDGRID|NPM|PYPI|DOCKER|CLOUDFLARE|VERCEL|SUPABASE|HF|HUGGINGFACE|SSH|GPG|DATABASE|DB|POSTGRES|MYSQL|REDIS|MONGO)_/i.test(n) || /PRIVATE_KEY|SEED_PHRASE|MNEMONIC|ROOT_PASSWORD|SUDO_PASSWORD/i.test(n));
    if (credLike.length) {
      findings.push({ id: 'meta-requests-env-secret', category: 'scope', severity: highValue.length ? 'high' : 'medium', file: 'SKILL.md', line: 1, snippet: `required_environment_variables: ${credLike.join(', ')}`, contexts: [], message: { en: `Skill asks the runtime to inject credential env vars into its sandbox: ${credLike.join(', ')}${highValue.length ? ` (high-value: ${highValue.join(', ')})` : ''} — verify each one is needed for the stated purpose`, ru: `Скилл просит рантайм передать в его песочницу секретные переменные: ${credLike.join(', ')}${highValue.length ? ` (особо ценные: ${highValue.join(', ')})` : ''} — проверьте, что каждая нужна для заявленной задачи` } });
    }
  }
  // Workspace dumps published as skills: agent memory files and dotenv/credential files almost always leak something.
  const memoryFiles = skill.files.filter((f) => /(?:^|\/)(?:MEMORY\.md|memory\/[^/]+\.md|SOUL\.md|USER\.md|IDENTITY\.md|HEARTBEAT\.md)$/i.test(f.path));
  if (memoryFiles.length && !allow.has('meta-agent-memory-dump')) {
    findings.push({ id: 'meta-agent-memory-dump', category: 'scope', severity: 'medium', file: memoryFiles[0].path, line: 0, snippet: memoryFiles.slice(0, 5).map((f) => f.path).join(', '), contexts: [], message: { en: `Agent memory / workspace files bundled with the skill (${memoryFiles.length}) — likely a workspace dump with personal data or tokens`, ru: `В скилле есть файлы памяти агента / рабочего пространства (${memoryFiles.length}) — похоже на дамп с личными данными или токенами` } });
  }
  const envFiles = skill.files.filter((f) => /(?:^|\/)\.env(?:\.(?!example|sample|template|dist|schema)[\w.-]+)?$/i.test(f.path) || /(?:^|\/)(?:credentials\.json|token\.json|secrets?\.(?:json|yaml|yml)|\.netrc|id_rsa|id_ed25519)$/i.test(f.path));
  if (envFiles.length && !allow.has('meta-credential-files')) {
    findings.push({ id: 'meta-credential-files', category: 'secret', severity: 'high', file: envFiles[0].path, line: 0, snippet: envFiles.slice(0, 5).map((f) => f.path).join(', '), contexts: [], message: { en: `Credential / dotenv files bundled with the skill (${envFiles.length})`, ru: `В скилле лежат файлы с учётными данными / .env (${envFiles.length})` } });
  }
  // A helper that reads BOTH an API key and a configurable base URL from the environment can be pointed at any host.
  for (const f of skill.files) {
    if (allow.has('net-redirectable-api-key') || f.tooBig || !/\.(?:py|js|mjs|cjs|ts|sh|rb|go)$/i.test(f.path)) continue;
    let text; try { text = readText(f.full); } catch { continue; }
    const urlEnv = /(?:BASE_URL|API_BASE|API_URL|API_HOST|API_ENDPOINT|ENDPOINT_URL)[A-Z_]*\b[^\n]{0,40}(?:os\.environ|process\.env|getenv|\$\{?[A-Z_]{3,}\}?|ENV\[)|(?:os\.environ|process\.env|getenv)[^\n]{0,40}(?:BASE_URL|API_BASE|API_URL|API_HOST|API_ENDPOINT|ENDPOINT_URL)/;
    const keyEnv = /(?:API_KEY|APIKEY|TOKEN|SECRET)[A-Z_]*\b[^\n]{0,40}(?:os\.environ|process\.env|getenv|ENV\[)|(?:os\.environ|process\.env|getenv)[^\n]{0,40}(?:API_KEY|APIKEY|TOKEN|SECRET)/;
    if (urlEnv.test(text) && keyEnv.test(text)) {
      const ln = text.split(/\r?\n/).findIndex((l) => urlEnv.test(l)) + 1;
      findings.push({ id: 'net-redirectable-api-key', category: 'exfiltration', severity: 'medium', file: f.path, line: Math.max(1, ln), snippet: 'API key + configurable base URL from environment', contexts: [], message: { en: 'Helper sends the API key to a host configured by an environment variable — the key can be redirected to another server', ru: 'Скрипт отправляет API-ключ на хост из переменной окружения — ключ можно перенаправить на другой сервер' } });
    }
  }
  const execs = skill.files.filter((f) => /\.(?:sh|bat|ps1|cmd|command|exe|dll|so|dylib|bin|scr|vbs|jar)$/i.test(f.path));
  const binaries = execs.filter((f) => /\.(?:exe|dll|so|dylib|bin|scr|jar)$/i.test(f.path));
  if (binaries.length && !allow.has('meta-binary-files')) {
    findings.push({ id: 'meta-binary-files', category: 'scope', severity: 'high', file: binaries[0].path, line: 0, snippet: binaries.map((b) => b.path).join(', '), contexts: [], message: { en: `Binary executables bundled with the skill (${binaries.length})`, ru: `В скилле есть бинарные исполняемые файлы (${binaries.length})` } });
  }
  findings.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) || a.file.localeCompare(b.file) || a.line - b.line);
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  let score = 0;
  for (const x of findings) { counts[x.severity]++; score += SEVERITY_SCORE[x.severity] || 0; }
  const blocked = isBlocked(counts, failOn, opts.maxHigh ?? Infinity);
  return { findings, counts, score, blocked, failOn, scannedFiles: scanned, scriptFiles: execs.map((f) => f.path), securitySkill };
}

/** Block when any finding at or above `failOn` severity exists. `maxHigh` (optional) additionally blocks on that many highs. */
export function isBlocked(counts, failOn, maxHigh = Infinity) {
  if (failOn === 'none') return false;
  const idx = SEVERITY_ORDER.indexOf(failOn);
  if (idx < 0) return counts.critical > 0;
  for (let i = 0; i <= idx; i++) if (counts[SEVERITY_ORDER[i]] > 0) return true;
  if (failOn === 'critical' && Number.isFinite(maxHigh) && counts.high >= maxHigh) return true;
  return false;
}

/** True when the text before the match has an unmatched opening quote (', " or `), i.e. the match sits inside a string literal. */
function insideOpenQuote(before) {
  const s = before.replace(/\\["'`]/g, '');
  for (const q of ['"', "'", '`']) {
    const n = (s.match(new RegExp(q, 'g')) || []).length;
    if (n % 2 === 1) return true;
  }
  return false;
}

function stepDown(sev, steps) {
  let s = sev;
  for (let i = 0; i < steps; i++) s = DOWN[s];
  return s;
}

const CTX_LABEL = {
  negated: { en: 'negated — the text forbids it', ru: 'с отрицанием — текст это запрещает' },
  placeholder: { en: 'placeholder value', ru: 'значение-заглушка' },
  detector: { en: 'detector / deny-list definition', ru: 'определение детектора / чёрного списка' },
  quoted: { en: 'quoted — discussed, not commanded', ru: 'в кавычках — упоминание, а не команда' },
  demo: { en: 'security demo / example', ru: 'демонстрация атаки / пример' },
  table: { en: 'documentation table row', ru: 'строка таблицы в документации' },
  fixture: { en: 'test fixture / example file', ru: 'тестовый файл / пример' },
  'security-skill': { en: 'documentation of a security skill', ru: 'документация security-скилла' },
  scoped: { en: '"only send to …" — scoping, not exfiltration', ru: '«отправляй только на …» — ограничение, а не эксфильтрация' },
  'reference-link': { en: 'URL is a reference link, not a destination', ru: 'URL — ссылка на документацию, а не адрес отправки' },
  'header-only': { en: 'key header without key body', ru: 'заголовок ключа без тела' },
  'code-literal': { en: 'string literal in code, not executed', ru: 'строковый литерал в коде, не выполняется' },
  comment: { en: 'code comment', ru: 'комментарий в коде' },
  'api-auth': { en: 'describes API authentication (bearer / header / HTTPS)', ru: 'описание авторизации в API (bearer / заголовок / HTTPS)' },
  'variable-host': { en: 'destination host is a configured variable', ru: 'адрес назначения — переменная конфигурации' },
  claim: { en: '"do not tell the user <a claim>" — honesty guidance, not concealment', ru: '«не говори пользователю, что …» — про честность, а не сокрытие' },
  dockerfile: { en: 'Dockerfile instruction (build context, not runtime exfiltration)', ru: 'инструкция Dockerfile (сборка образа, а не эксфильтрация)' },
  'known-service': { en: 'destination is a well-known publishing service', ru: 'адрес назначения — известный публичный сервис' },
  'notification-token': { en: 'push-notification device token, not a credential', ru: 'токен push-уведомлений устройства, а не секрет' },
  'vendor-host': { en: "the skill's own vendor host", ru: 'хост вендора самого скилла' },
};

/**
 * Scan one text; findings get `contexts` and a severity adjusted for them.
 * Downgrade rules (never upgrade):
 *  - negated phrase or placeholder secret → low
 *  - detector / deny-list line, documentation table row, demo domains, fixture file, security-skill markdown → one level each (max two)
 *  - quoted alone → one level for non-critical; for critical only together with another context
 */
export function scanText(text, file, findings, allow = new Set(), ctxOpts = {}) {
  const lines = text.split(/\r?\n/);
  const perPatternCount = new Map();
  const isMd = MD_RE.test(file);
  const fixture = FIXTURE_FILE_RE.test(file);
  for (const u of UNICODE_CHECKS) {
    if (allow.has(u.id)) continue;
    const g = new RegExp(u.re.source, u.re.flags.includes('g') ? u.re.flags : `${u.re.flags}g`);
    let hits = 0; let firstLine = 0; let sample = '';
    lines.forEach((ln, i) => {
      if (u.skipLine && u.skipLine.test(ln)) return;
      const n = (ln.match(g) || []).length;
      if (n) { hits += n; if (!firstLine) { firstLine = i + 1; sample = ln; } }
    });
    if (hits >= u.min) {
      let severity = u.mdSeverity && isMd ? u.mdSeverity : u.severity;
      const contexts = [];
      if (CODE_RE.test(file) && /pattern|source|regex|marker|\\u|U\+[0-9A-F]{4}|invisible|zero[- ]width/i.test(sample)) { contexts.push('detector'); severity = stepDown(severity, 1); }
      if (fixture) { contexts.push('fixture'); severity = stepDown(severity, 1); }
      findings.push({ id: u.id, category: u.category, severity, file, line: firstLine, snippet: visible(truncate(sample.trim(), 160)), contexts, message: withCtx({ en: `${u.message.en} (${hits} occurrence${hits > 1 ? 's' : ''})`, ru: `${u.message.ru} (${hits} шт.)` }, contexts) });
    }
  }
  // Multi-line template literals / triple-quoted strings in code: lines that start inside such a string are "quoted".
  const isCode = CODE_RE.test(file);
  let tplOpen = false; let tripleOpen = false;
  lines.forEach((rawLine, i) => {
    const line = rawLine.normalize('NFC');
    const startsInsideString = isCode && (tplOpen || tripleOpen);
    if (isCode) {
      const ticks = (line.replace(/\\`/g, '').match(/`/g) || []).length;
      if (ticks % 2 === 1) tplOpen = !tplOpen;
      const triples = (line.match(/"""|'''/g) || []).length;
      if (triples % 2 === 1) tripleOpen = !tripleOpen;
    }
    const lineAllow = inlineAllows(rawLine, i > 0 ? lines[i - 1] : '');
    for (const pat of PATTERNS) {
      if (allow.has(pat.id) || lineAllow.has(pat.id) || lineAllow.has('all')) continue;
      if (pat.files && !pat.files.test(file)) continue;
      if ((perPatternCount.get(pat.id) || 0) >= MAX_FINDINGS_PER_PATTERN_PER_FILE) continue;
      pat.re.lastIndex = 0;
      const m = pat.re.exec(line);
      if (!m) continue;
      perPatternCount.set(pat.id, (perPatternCount.get(pat.id) || 0) + 1);
      const before = line.slice(0, m.index); const after = line.slice(m.index + m[0].length);
      const prevLine = i > 0 ? lines[i - 1] : '';
      const contexts = [];
      const quoted = startsInsideString || (OPEN_Q.test(before) && CLOSE_Q.test(after)) || insideOpenQuote(before);
      const detector = DETECTOR_CONTEXT.test(before) || COMPARISON_CONTEXT.test(before.slice(-30)) || RAW_REGEX_CONTEXT.test(before.slice(-40)) || SEVERITY_LABEL_RE.test(before) || (quoted && (REGEX_SYNTAX_RE.test(line) || DETECTOR_CONTEXT.test(line.slice(0, m.index + 20)) || DETECTOR_CONTEXT.test(prevLine.slice(-120)) || RAW_REGEX_CONTEXT.test(prevLine.slice(-40))));
      const variableHost = pat.category === 'exfiltration' && VARIABLE_HOST_RE.test(line.slice(m.index, m.index + m[0].length + 60));
      // For a list item, find the heading above the list (skipping sibling items and blank lines, up to 8 lines back).
      let heading = '';
      if (/^\s*(?:[-*+]|\d+[.)])\s/.test(line)) {
        const indent = line.match(/^\s*/)[0].length;
        for (let k = i - 1; k >= 0 && k >= i - 10; k--) {
          const l = lines[k];
          if (!l.trim()) continue;
          const lIndent = l.match(/^\s*/)[0].length;
          // siblings / children at the same or deeper indentation are skipped, unless a sibling is a lead-in ending with ":"
          if (/^\s*(?:[-*+]|\d+[.)])\s/.test(l) && lIndent >= indent) {
            if (lIndent === indent && /[:：]\s*(?:\*\*)?\s*$/.test(l)) { heading = l; break; }
            continue;
          }
          heading = l; break;
        }
      }
      const negated = ['exfiltration', 'concealment', 'instruction_override', 'dangerous_command'].includes(pat.category) && (NEGATION_CONTEXT.test(before.slice(-40)) || isNegatedHeading(heading));
      const knownService = pat.category === 'exfiltration' && KNOWN_SERVICE_RE.test(line.slice(m.index, m.index + m[0].length + 80));
      // "wget https://lambdalabs.com/install.sh | sh" inside the lambda-labs skill: the vendor's own host, still remote code but expected.
      const vendorHost = (pat.id === 'cmd-pipe-to-shell' || pat.category === 'exfiltration') && Boolean(ctxOpts.vendorWords?.size) && vendorMatches(line.slice(m.index, m.index + m[0].length + 120), ctxOpts.vendorWords);
      const scoped = pat.id === 'exfil-send-secrets-to-url' && SCOPED_CONTEXT.test(before.slice(-30));
      const placeholder = (pat.category === 'secret' || pat.id.startsWith('exfil-webhook') || pat.id.startsWith('exfil-secret-in-url')) && (PLACEHOLDER_RE.test(m[0]) || PLACEHOLDER_RE.test(line.slice(m.index, m.index + m[0].length + 24)));
      const referenceLink = pat.id === 'exfil-send-secrets-to-url' && REFERENCE_LINK_RE.test(m[0]);
      const apiAuth = pat.id === 'exfil-send-secrets-to-url' && /bearer|authorization\s*(?:header|:)|as\s+an?\s+header|x-api-key|-H\s*["']?[\w-]*(?:key|token|auth|secret)[\w-]*\s*:|over\s+https|https\s+only|in\s+the\s+header|в\s+заголовке/i.test(line);
      const headerOnly = pat.id === 'secret-private-key' && !/^[A-Za-z0-9+/=]{40,}\s*$/.test(lines[i + 1] || '');
      const codeLiteral = pat.category === 'dangerous_command' && CODE_RE.test(file) && quoted && !EXEC_CALL_RE.test(line);
      const comment = (CODE_RE.test(file) && /^\s*(?:\/\/|\/\*\*?|\*|#)/.test(line)) || (/(?:^|\s)(?:#|\/\/)\s/.test(before) && !/^\s*#{1,6}\s/.test(line));
      const notificationToken = pat.id === 'exfil-send-secrets-to-url' && /notification|apns|fcm|device\s+tokens?|push\s+tokens?|registration\s+tokens?/i.test(`${file} ${line}`);
      const claim = pat.id === 'en-hide-from-user' && CLAIM_AFTER_USER_RE.test(after);
      const dockerfile = pat.category === 'exfiltration' && DOCKERFILE_LINE_RE.test(line);
      const demo = DOC_CATEGORIES.has(pat.category) && DEMO_CONTEXT.test(line);
      const table = /^\s*\|/.test(line) && quoted;
      const securityDoc = DOC_CATEGORIES.has(pat.category) && ((Boolean(ctxOpts.securitySkill) && isMd) || SECURITY_DOC_FILE_RE.test(file));
      let severity = pat.severity;
      if (negated) { contexts.push('negated'); severity = 'low'; }
      else if (placeholder) { contexts.push('placeholder'); severity = 'low'; }
      else {
        let steps = 0;
        if (detector) { contexts.push('detector'); steps++; }
        if (scoped) { contexts.push('scoped'); steps++; }
        if (referenceLink) { contexts.push('reference-link'); steps++; }
        if (apiAuth) { contexts.push('api-auth'); steps++; }
        if (variableHost) { contexts.push('variable-host'); steps++; }
        if (knownService) { contexts.push('known-service'); steps++; }
        if (headerOnly) { contexts.push('header-only'); steps++; }
        if (codeLiteral) { contexts.push('code-literal'); steps++; }
        if (comment && DOC_CATEGORIES.has(pat.category)) { contexts.push('comment'); steps++; }
        if (notificationToken) { contexts.push('notification-token'); steps++; }
        if (claim) { contexts.push('claim'); steps++; }
        if (dockerfile) { contexts.push('dockerfile'); steps++; }
        if (table) { contexts.push('table'); steps++; }
        if (demo) { contexts.push('demo'); steps++; }
        if (fixture) { contexts.push('fixture'); steps++; }
        if (securityDoc) { contexts.push('security-skill'); steps++; }
        if (vendorHost) { contexts.push('vendor-host'); steps++; }
        if (quoted && !detector && !table && !codeLiteral) { contexts.push('quoted'); if (pat.severity !== 'critical' || steps > 0) steps++; }
        severity = stepDown(pat.severity, Math.min(steps, 2));
      }
      findings.push({
        id: pat.id, category: pat.category, severity, contexts, quoted, file, line: i + 1, col: (m.index ?? 0) + 1,
        match: truncate(m[0], 120), snippet: visible(truncate(line.trim(), 200)),
        message: withCtx(pat.message, contexts),
      });
    }
  });
  return findings;
}

/** Words that identify the skill's vendor: "lambda-labs" → {lambda, labs, lambdalabs}; used to recognise the vendor's own hosts. */
export function vendorWordsOf(text) {
  const out = new Set();
  for (const w of String(text || '').toLowerCase().match(/[a-z0-9][a-z0-9-]{3,}/g) || []) {
    const parts = w.split('-').filter(Boolean);
    for (const p of parts) if (p.length >= 4 && !GENERIC_VENDOR_WORDS.has(p)) out.add(p);
    if (parts.length > 1) out.add(parts.join(''));
  }
  return out;
}
const GENERIC_VENDOR_WORDS = new Set(['skill', 'skills', 'agent', 'agents', 'tool', 'tools', 'when', 'with', 'from', 'this', 'that', 'user', 'users', 'your', 'file', 'files', 'data', 'help', 'helper', 'install', 'setup', 'code', 'search', 'cloud', 'server', 'client', 'api', 'apis', 'github', 'google', 'docs', 'http', 'https', 'localhost']);
/** Does a URL in the text point at the vendor's own domain? */
export function vendorMatches(text, vendorWords) {
  for (const m of String(text).matchAll(/https?:\/\/([\w.-]+)/g)) {
    const labels = m[1].toLowerCase().split('.').filter(Boolean);
    if (labels.length < 2) continue;
    const sld = labels.length >= 3 && labels[labels.length - 2].length <= 3 ? labels[labels.length - 3] : labels[labels.length - 2];
    const key = sld.replace(/[^a-z0-9]/g, '');
    if (key.length >= 4 && vendorWords.has(key)) return true;
  }
  return false;
}

function withCtx(message, contexts) {
  if (!contexts.length) return message;
  return { en: `${message.en} (${contexts.map((c) => CTX_LABEL[c].en).join('; ')})`, ru: `${message.ru} (${contexts.map((c) => CTX_LABEL[c].ru).join('; ')})` };
}

function visible(s) {
  return String(s).replace(INVISIBLE_RE, '␀');
}
