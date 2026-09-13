/**
 * Prompt-injection / supply-chain patterns for Agent Skills, RU + EN.
 *
 * Design notes:
 *  - No ASCII \b word boundaries: they break on Cyrillic. We use Unicode lookarounds (L = letter, N = number)
 *    via the helper `tok()` and the `u` flag everywhere.
 *  - Russian stems are matched with suffix wildcards (\p{L}{0,5}) to cover inflection: игнорируй/игнорируйте/игнорировать.
 *  - Every pattern carries a bilingual message and a severity. The scanner adds file:line context.
 *  - Severities were calibrated on 531 real-world skills (anthropics/skills, obra/superpowers, Codex plugin catalog):
 *    critical = strong evidence of exfiltration / secrets / remote code execution; high = review needed;
 *    medium/low = informational, never blocks by default.
 *  - `files` restricts a pattern to instruction-bearing files (markdown/text) when the same construct is normal in code.
 *  - Legit security documentation may mention these phrases; allow-list ids in spec.yaml `guard.allow`
 *    or put `skilltest-guard: allow <id>` on the line (or the line above).
 */

const W0 = '(?<![\\p{L}\\p{N}_])';
const W1 = '(?![\\p{L}\\p{N}_])';
const tok = (src) => `${W0}(?:${src})${W1}`;
const S = '\\s*';
const SP = '\\s+';
const RU = '\\p{L}{0,5}';
const MD = /\.(?:md|markdown|txt|mdx)$/i;

function p(id, category, severity, lang, source, en, ru, opts = {}) {
  return { id, category, severity, lang, re: new RegExp(source, opts.flags ?? 'iu'), message: { en, ru }, files: opts.files || null };
}

const TRUSTED_INSTALL_HOSTS = 'raw\\.githubusercontent\\.com|github\\.com|get\\.docker\\.com|sh\\.rustup\\.rs|deb\\.nodesource\\.com|astral\\.sh|bun\\.sh|get\\.pnpm\\.io|ohmyz\\.sh|brew\\.sh|code-server\\.dev|cli\\.coderabbit\\.ai|hf\\.co|huggingface\\.co|deno\\.land|fly\\.io|get\\.helm\\.sh|dl\\.k8s\\.io|tailscale\\.com|cli\\.github\\.com|claude\\.ai|anthropic\\.com|openai\\.com|vercel\\.com|render\\.com|supabase\\.com|cloudflare\\.com|nvm\\.sh|pyenv\\.run|get\\.sdkman\\.io|install\\.python-poetry\\.org';
const SECRET_FILES = `(?:~|\\$HOME|%USERPROFILE%|/root|/home/[\\w.-]+|/Users/[\\w.-]+)?/?\\.ssh/(?:id_[a-z0-9]+(?![a-z0-9]|\\.pub))|\\.aws/credentials|(?:~|\\$HOME|/)\\.netrc|\\.git-credentials|/etc/shadow|wallet\\.dat|\\.gnupg/|\\.kube/config|\\.docker/config\\.json|\\.claude/\\.credentials|\\.config/openclaw/(?!skills/|workspace/)[\\w.-]*(?:json|cred|secret|token|env)|\\.config/gh/hosts\\.yml|/Login${SP}Data${W1}|/Default/Cookies${W1}|\\.pypirc|\\.npmrc`;
const CRED_VAR = '\\$\\{?[A-Za-z_]*(?:KEY|TOKEN|SECRET|PASS(?:WORD)?|CRED)[A-Za-z_]*\\}?|\\$env:[A-Za-z_]*(?:KEY|TOKEN|SECRET|PASS)[A-Za-z_]*|%[A-Za-z_]*(?:KEY|TOKEN|SECRET|PASS)[A-Za-z_]*%|process\\.env\\.[A-Za-z_]*(?:KEY|TOKEN|SECRET|PASS)[A-Za-z_]*|os\\.environ(?:\\.get)?\\(?\\[?["\']?[A-Za-z_]*(?:KEY|TOKEN|SECRET|PASS)[A-Za-z_]*';
const NET_CALL = 'curl|wget|Invoke-WebRequest|Invoke-RestMethod|iwr|irm|fetch\\(|requests\\.(?:post|put|get|patch)|httpx\\.|urllib\\.request|axios\\.|http\\.client|Net\\.WebClient|XMLHttpRequest';
const EXFIL_DOMAINS = 'hooks\\.slack\\.com|discord(?:app)?\\.com/api/webhooks|api\\.telegram\\.org/bot|webhook\\.site|requestbin|pipedream\\.net|ngrok(?:-free)?\\.(?:app|io|dev)|burpcollaborator|interact\\.sh|oast\\.(?:fun|live|pro|site|online|me)|beeceptor\\.com|hookbin|requestcatcher|localtunnel|trycloudflare\\.com';
/** Host part right after https?:// that counts as an exfiltration destination: known webhook hosts or a public IPv4 literal. */
const EXFIL_HOST = `(?:[^\\s"'<>/]*(?:${EXFIL_DOMAINS})|(?!127\\.|10\\.|192\\.168\\.|172\\.(?:1[6-9]|2\\d|3[01])\\.|0\\.0\\.0\\.0|169\\.254\\.)\\d{1,3}(?:\\.\\d{1,3}){3}(?![\\d.]))`;

export const PATTERNS = [
  // --- 1. Instruction override -------------------------------------------------------------
  p('en-ignore-previous', 'instruction_override', 'high', 'en',
    tok(`(?:ignore|disregard|forget|discard|override|bypass)${SP}(?:all${SP}|any${SP}|the${SP}|your${SP}|every${SP}|these${SP}|those${SP}|my${SP})?(?:previous|prior|above|earlier|preceding|original|system|initial|existing|safety|developer|operator)${SP}(?:instructions?|prompts?|rules|guidelines|directions|context|constraints|messages?|guardrails)|ignore${SP}(?:all${SP})?(?:the${SP})?instructions${SP}(?:above|before|given${SP}earlier)`),
    'Instruction-override phrase ("ignore previous instructions")', 'Фраза-перехват ("ignore previous instructions")'),
  p('en-role-hijack', 'instruction_override', 'high', 'en',
    tok(`from${SP}now${SP}on${SP}you${SP}(?:are|will|must)${SP}(?:ignore|not${SP}follow|disregard|no${SP}longer|an?${SP}(?:unrestricted|unfiltered|jailbroken))|act${SP}as${SP}(?:an?${SP})?(?:unrestricted|unfiltered|jailbroken|evil|dan)|(?:enter|enable|activate|switch${SP}to)${SP}(?:god|sudo|unrestricted|jailbreak|uncensored)${SP}mode|developer${SP}mode${SP}(?:enabled|activated)${S}[.:,]?${S}(?:you|ignore|from${SP}now|all${SP}(?:rules|restrictions))|your${SP}new${SP}(?:role|persona|identity|instructions?)${SP}(?:is|are)${S}:|you${SP}are${SP}now${SP}(?:free${SP}from|unrestricted|unfiltered|jailbroken|dan${W1}|in${SP}(?:developer|unrestricted|debug)${SP}mode)`),
    'Role hijack ("from now on you must ignore… / developer mode")', 'Подмена роли ("from now on you must ignore… / developer mode")'),
  p('en-fake-system-prompt', 'instruction_override', 'high', 'en',
    `${W0}(?:your|the)${SP}(?:real|actual|true|updated|hidden|secret|new)${SP}system${SP}(?:prompt|message|instructions?)${SP}(?:is|are)${S}:|${W0}system${SP}prompt${SP}(?:override|replacement)${W1}|^\\s*\\[?\\s*system\\s*\\]?\\s*:\\s*(?:ignore${SP}(?:all${SP})?(?:previous|prior|your)|from${SP}now${SP}on|you${SP}(?:must|will)${SP}(?:ignore|disregard|now))`,
    'Fake system prompt injected into content', 'Поддельный системный промпт внутри контента'),
  p('ru-ignore-previous', 'instruction_override', 'high', 'ru',
    tok(`(?:игнорируй${RU}|игнорировать|проигнорируй${RU}|проигнорировать)${SP}(?:все${SP}|всё${SP}|любые${SP}|свои${SP}|предыдущие${SP}|прежние${SP}|прошлые${SP}|исходные${SP}|системные${SP}|вышеуказанные${SP}|вышеизложенные${SP})*(?:инструкци${RU}|указани${RU}|правил${RU}|ограничени${RU}|промпт${RU}|системн${RU}${SP}промпт${RU})|(?:забудь${RU}|забыть|отбрось${RU}|не${SP}учитывай${RU}|отмени${RU}|отменить)${SP}(?:все${SP}|всё${SP}|любые${SP}|свои${SP})?(?:предыдущие|прежние|прошлые|исходные|системные|вышеуказанные|вышеизложенные|полученные${SP}ранее)${SP}(?:инструкци${RU}|указани${RU}|правил${RU}|ограничени${RU}|настройк${RU}|промпт${RU}|контекст${RU})`),
    'Instruction-override phrase in Russian ("игнорируй предыдущие инструкции")', 'Фраза-перехват на русском ("игнорируй предыдущие инструкции")'),
  p('ru-role-hijack', 'instruction_override', 'high', 'ru',
    tok(`теперь${SP}ты${S}[—–-]?${S}(?:\\p{L}+${S}){0,3}без${SP}(?:каких-либо${SP}|всяких${SP})?ограничений|без${SP}(?:каких-либо${SP})?ограничений${SP}и${SP}фильтров|отключи${RU}${SP}(?:все${SP})?(?:ограничени${RU}|фильтр${RU}|цензур${RU}|безопасност${RU})|войди${RU}${SP}в${SP}режим${SP}(?:разработчика|отладки|без${SP}ограничений)|режим${SP}разработчика${SP}(?:включ${RU}|активирован${RU})|твоя${SP}новая${SP}(?:роль|личность|инструкция)${S}[:—–-]|отныне${SP}ты${SP}(?:не${SP}(?:следуешь|подчиняешься|обязан)|свободен|можешь${SP}вс[её])`),
    'Role hijack in Russian ("теперь ты без ограничений / режим разработчика")', 'Подмена роли ("теперь ты без ограничений / режим разработчика")'),
  p('ru-fake-system-prompt', 'instruction_override', 'high', 'ru',
    tok(`(?:нов(?:ый|ая)|настоящ(?:ий|ая)|обновл(?:ённ|енн)(?:ый|ая)|реальн(?:ый|ая)|скрыт(?:ый|ая)|истинн(?:ый|ая))${SP}системн(?:ый|ая)${SP}(?:промпт|подсказка|инструкция|сообщение)${S}[:—–-]|системн(?:ый|ая)${SP}(?:промпт|инструкция)${S}:${S}(?:ты|игнорируй|отныне|теперь)`),
    'Fake system prompt in Russian', 'Поддельный системный промпт на русском'),

  // --- 2. Concealment from the user -----------------------------------------------------------
  p('en-hide-from-user', 'concealment', 'high', 'en',
    tok(`(?:do${SP}not|don'?t|never)${SP}(?:tell|inform|notify|mention${SP}(?:this|it)${SP}to|reveal${SP}(?:this|it)${SP}to|disclose${SP}(?:this|it)${SP}to)${SP}(?:the${SP})?(?:user|human|operator|owner)(?:${SP}(?:about|that|this|what|anything))?(?!${SP}to${SP})|(?:hide|conceal|keep)${SP}(?:this|it|these${SP}instructions?|the${SP}changes?|your${SP}actions?)${SP}(?:secret${SP})?from${SP}(?:the${SP})?(?:user|human)|(?:secretly|silently|covertly|quietly|discreetly)${SP}(?:send|run|execute|upload|copy|forward|exfiltrate|delete|install|download|transmit)`),
    'Instruction to hide actions from the user', 'Инструкция скрыть действия от пользователя'),
  p('ru-hide-from-user', 'concealment', 'high', 'ru',
    tok(`не${SP}(?:сообщай${RU}|говори${RU}|рассказывай${RU}|показывай${RU}|упоминай${RU}|уведомляй${RU}|раскрывай${RU}|информируй${RU})${SP}(?:об${SP}этом${SP}|это${SP}|ничего${SP}|никому${SP})?(?:пользовател${RU}|человек${RU}|владельц${RU}|оператор${RU})|(?:скрой${RU}|скрыть|спрячь${RU}|утаи${RU})${SP}(?:это${SP}|эти${SP}инструкции${SP}|свои${SP}действия${SP})?от${SP}(?:пользовател${RU}|человек${RU})|(?:тайно|незаметно|втайне|скрытно|молча|без${SP}ведома${SP}пользовател${RU}|без${SP}согласия${SP}пользовател${RU})${SP}(?:отправ${RU}|запусти${RU}|выполни${RU}|загрузи${RU}|скопируй${RU}|перешли${RU}|удали${RU}|передай${RU}|установи${RU}|скачай${RU})`),
    'Instruction to hide actions from the user (Russian)', 'Инструкция скрыть действия от пользователя'),

  // --- 3. Exfiltration ---------------------------------------------------------------------
  p('exfil-send-secrets-to-url', 'exfiltration', 'critical', 'any',
    `${tok(`send|post(?!\\s*/|\\s*\\|)|upload|forward|transmit|exfiltrate|копируй|отправ${RU}|перешл${RU}|передай${RU}|передавай${RU}|загрузи${RU}|выгрузи${RU}|скопируй${RU}`)}[^\\n]{0,80}?(?<!(?:push|device|apns|fcm|registration|refresh|csrf|xsrf|id|access|bearer|auth)${SP})${tok(`api[_ -]?keys?|tokens?(?!${SP}(?:image|name|symbol|supply|price|contract|address|holders?|launch|metadata|rotation|refresh|expir\\w*|count|limit|usage|budget))|passwords?|credentials?|secrets?|\\.env|ssh${SP}keys?|id_rsa|cookies?|session${SP}(?:id|token|cookie)|conversation|chat${SP}history|clipboard|ключ${RU}|токен${RU}|парол${RU}|секрет${RU}|учётн${RU}|учетн${RU}|переписк${RU}|истори${RU}${SP}чат${RU}|буфер${SP}обмена`)}[^\\n]{0,80}?(?:https?://|${tok(`to${SP}(?:the${SP})?(?:server|endpoint|webhook|bot|url|this${SP}address)|на${SP}(?:сервер|адрес|бот${RU}|вебхук|url)|в${SP}(?:телеграм|telegram|бот${RU})`)})`,
    'Instruction to send secrets/history to an external endpoint', 'Инструкция отправить секреты/переписку на внешний адрес'),
  p('exfil-secret-in-url-exfil-host', 'exfiltration', 'critical', 'any',
    `https?://${EXFIL_HOST}[^\\s"'<>]*[?&][^\\s"'<>=&]*(?:key|token|secret|pass|cred|auth|apikey)[^\\s"'<>=&]*=(?:${CRED_VAR}|\\$\\()`,
    'Credential sent in a URL query string to a known exfiltration host', 'Учётные данные уходят в строке запроса URL на известный хост эксфильтрации'),
  p('exfil-secret-in-url', 'exfiltration', 'high', 'any',
    `https?://(?!${EXFIL_HOST})[^\\s"'<>]*[?&][^\\s"'<>=&]*(?:key|token|secret|pass|cred|auth|apikey)[^\\s"'<>=&]*=(?:${CRED_VAR}|\\$\\()`,
    'Credential passed in a URL query string (normal for some APIs — verify the host is the intended service)', 'Учётные данные в строке запроса URL (для части API это норма — проверьте, что хост нужный)'),
  p('exfil-post-credential-file', 'exfiltration', 'critical', 'any',
    `(?:${NET_CALL})[^\\n]{0,160}?(?:-d|--data(?:-binary|-raw|-urlencode)?|-F|--form|-T|--upload-file)${S}["']?@?[^\\s"']*(?:${SECRET_FILES}|/tmp/[^\\s"']*\\.(?:tgz|tar|tar\\.gz|zip|7z)|\\.env${W1}|id_rsa)`,
    'Uploads a credential/secret file to a remote endpoint', 'Загрузка файла с учётными данными на удалённый сервер'),
  p('exfil-webhook-url', 'exfiltration', 'high', 'any',
    `https?://[^\\s"'<>/]*(?:hooks\\.slack\\.com|discord(?:app)?\\.com/api/webhooks|api\\.telegram\\.org/bot|webhook\\.site|requestbin|pipedream\\.net|ngrok(?:-free)?\\.(?:app|io|dev)|burpcollaborator|interact\\.sh|oast\\.(?:fun|live|pro|site|online|me)|beeceptor\\.com|hookbin|requestcatcher|localtunnel|trycloudflare\\.com)[^\\s"'<>]*`,
    'Webhook / callback URL commonly used for exfiltration (verify the destination)', 'URL вебхука / коллбэка, типичный для эксфильтрации (проверьте адрес)'),
  p('net-credential-use', 'exfiltration', 'medium', 'any',
    `(?:(?:${NET_CALL})[^\\n]{0,200}?(?:${CRED_VAR})|(?:${CRED_VAR})[^\\n]{0,200}?(?:${NET_CALL}|https?://))`,
    'Credential used in a network call (verify the destination is the intended service)', 'Учётные данные используются в сетевом вызове (проверьте, что адрес — нужный сервис)'),
  p('exfil-read-secret-files', 'exfiltration', 'high', 'any',
    `(?:${tok('cat|type|Get-Content|gc|open\\(|readFile(?:Sync)?\\(|read_text\\(|less|more|head|tail|cp|copy|scp|rsync|tar|zip|7z|xxd|strings|base64')}|open\\(|readFile(?:Sync)?\\()[^\\n]{0,80}?(?:${SECRET_FILES})`,
    'Reads credential / secret files', 'Чтение файлов с учётными данными / секретами'),
  p('read-dotenv', 'exfiltration', 'low', 'any',
    `${tok('cat|type|Get-Content|source|open\\(|readFile(?:Sync)?\\(|read_text\\(|cp|copy')}${S}["']?(?:\\.\\./|\\./|~/|/)?[\\w./-]*(?<![\\p{L}\\p{N}_)\\]])\\.env(?:\\.[\\w]+)?(?![\\p{L}\\p{N}_.])`,
    'Reads a .env file', 'Чтение файла .env'),

  // --- 4. Dangerous commands ---------------------------------------------------------------
  p('cmd-destructive-fs', 'dangerous_command', 'critical', 'any',
    `(?<!git${SP})${W0}rm${SP}-[a-zA-Z]*r[a-zA-Z]*${SP}(?:--no-preserve-root${SP})?(?:/|/\\*|~|~/|\\$HOME|\\$HOME/)(?=\\s|$|;|&|\\|)|${W0}del${SP}/[sq]${SP}/[sq]${SP}[a-z]:\\\\?(?=\\s|$)|${W0}rmdir${SP}/s${SP}/q${SP}[a-z]:\\\\?(?=\\s|$)|Remove-Item[^\\n]{0,40}(?:[a-z]:\\\\|~|\\$HOME|\\$env:USERPROFILE)\\\\?\\s[^\\n]{0,40}-Recurse|${W0}format${SP}[a-z]:(?=\\s*(?:/[a-z]|$|&|;|\\|))|(?<![\\w|>])>${S}/dev/(?:sd[a-z]|nvme\\d+n\\d+|hd[a-z]|mmcblk\\d+)\\d*(?=[\`"']?\\s*(?:$|;|&|\\|))|:\\(\\)${S}\\{${S}:\\|:&${S}\\};:`,
    'Destructive filesystem command (wipes root/home/drive)', 'Разрушительная команда для файловой системы (корень / домашняя папка / диск)'),
  p('cmd-destructive-fs-scoped', 'dangerous_command', 'high', 'any',
    `(?<!git${SP})${W0}rm${SP}-[a-zA-Z]*r[a-zA-Z]*${SP}(?:\\*|\\.|\\.\\.)(?=\\s|$|;|&|\\|)|${W0}mkfs(?:\\.\\w+)?${SP}(?:-\\S+${SP})*/dev/|${W0}dd${SP}if=/dev/(?:zero|random|urandom)${SP}of=/dev/|${W0}wipefs${SP}|${W0}shred${SP}(?:-\\S+${SP})*/dev/`,
    'Destructive command on a partition / current directory (normal in admin docs; verify the target)', 'Разрушительная команда для раздела / текущей папки (в админских документах это норма; проверьте цель)'),
  p('cmd-pipe-to-shell', 'dangerous_command', 'high', 'any',
    `(?:${tok('curl|wget|iwr|irm|Invoke-WebRequest|Invoke-RestMethod')})(?![^\\n|]*https?://(?:[\\w.-]*\\.)?(?:${TRUSTED_INSTALL_HOSTS})/)[^\\n|]{0,200}\\|${S}(?:sudo${SP})?(?:ba|z|da|k)?sh${W1}|${tok('iex|Invoke-Expression')}${S}\\(?${S}(?:\\(?New-Object${SP}Net\\.WebClient\\)?\\.DownloadString|irm|iwr|Invoke-WebRequest|Invoke-RestMethod)|(?:ba|z)?sh${S}<\\(${S}(?:curl|wget)|python[23]?${SP}-c${SP}["'](?:import${SP}urllib|import${SP}requests)[^\\n]{0,120}exec`,
    'Downloads and executes remote code from an unrecognised host (pipe to shell)', 'Скачивание и запуск удалённого кода с неизвестного хоста (pipe в shell)'),
  p('cmd-pipe-to-shell-known-host', 'dangerous_command', 'medium', 'any',
    `(?:${tok('curl|wget|iwr|irm|Invoke-WebRequest|Invoke-RestMethod')})(?=[^\\n|]*https?://(?:[\\w.-]*\\.)?(?:${TRUSTED_INSTALL_HOSTS})/)[^\\n|]{0,200}\\|${S}(?:sudo${SP})?(?:ba|z|da|k)?sh${W1}`,
    'Pipe-to-shell installer from a well-known host (still executes remote code)', 'Установщик через pipe в shell с известного хоста (всё равно выполняет удалённый код)'),
  p('cmd-encoded-exec', 'dangerous_command', 'critical', 'any',
    `${tok('powershell|pwsh')}[^\\n]{0,80}(?:-e(?:nc|ncodedcommand)?${SP}[A-Za-z0-9+/=]{20,})|(?:base64${SP}(?:-d|--decode)|b64decode|atob\\(|FromBase64String)[^\\n]{0,80}(?:\\|${S}(?:ba|z)?sh${W1}|${tok('exec|eval|iex|Invoke-Expression|subprocess|os\\.system')})|${tok('echo|printf')}${SP}["']?[A-Za-z0-9+/=]{40,}["']?${S}\\|${S}base64${SP}(?:-d|--decode)`,
    'Executes a base64/encoded payload', 'Выполнение закодированного (base64) кода'),
  p('cmd-eval-dynamic', 'dangerous_command', 'medium', 'any',
    `${W0}(?:eval|exec|Function)\\(${S}(?:atob|decodeURIComponent|String\\.fromCharCode|unescape|Buffer\\.from|base64|b64decode|bytes\\.fromhex|compile\\(|requests\\.get|urllib|fetch|input\\(|open\\()|${W0}os\\.system\\([^\\n]{0,80}(?:input\\(|format\\(|f["']|\\+)|${W0}subprocess\\.[a-zA-Z_]+\\([^\\n]{0,120}shell${S}=${S}True[^\\n]{0,120}(?:input\\(|format\\(|f["']|\\+)`,
    'Dynamic code execution from decoded/untrusted input', 'Динамическое выполнение кода из декодированного/недоверенного ввода'),
  p('cmd-disable-security', 'dangerous_command', 'high', 'any',
    tok(`Set-ExecutionPolicy${SP}(?:Unrestricted|Bypass)|Add-MpPreference${SP}-ExclusionPath|Set-MpPreference${SP}-Disable\\w*|csrutil${SP}disable|spctl${SP}--master-disable|Disable-WindowsDefender|iptables${SP}-F|setenforce${SP}0|ufw${SP}disable|xattr${SP}-(?:rd|dr|r${SP}-d|d${SP}-r)${SP}com\\.apple\\.quarantine|xattr${SP}-d${SP}com\\.apple\\.quarantine${SP}["']?(?:/Applications|~|\\*|\\$HOME|/)`),
    'Disables a security control (Defender, Gatekeeper, SIP, firewall, execution policy)', 'Отключение средства защиты (Defender, Gatekeeper, SIP, firewall, execution policy)'),
  p('cmd-quarantine-file', 'dangerous_command', 'medium', 'any',
    `${W0}xattr${SP}-d${SP}com\\.apple\\.quarantine${SP}(?!["']?(?:/Applications|~|\\*|\\$HOME|/(?:\\s|$)))`,
    'Removes the macOS quarantine flag from one file (usual for a downloaded CLI; make sure the file is the intended binary)', 'Снятие флага карантина macOS с одного файла (обычно для скачанного CLI; проверьте, что это нужный бинарник)'),
  p('cmd-execpolicy-bypass', 'dangerous_command', 'medium', 'any',
    `-ExecutionPolicy${SP}Bypass${W1}`,
    'Runs PowerShell with execution policy bypassed', 'Запуск PowerShell с обходом execution policy'),
  p('cmd-privilege', 'dangerous_command', 'medium', 'any',
    tok(`sudo${SP}(?:-S${SP})?(?:rm|chmod|chown|dd|mkfs|curl|wget|bash|sh|python[23]?|tee|mv|cp)|chmod${SP}(?:-R${SP})?(?:777|a\\+rwx|o\\+w)|chown${SP}-R${SP}root|setuid`),
    'Privilege escalation / world-writable permissions', 'Повышение привилегий / права на запись для всех'),
  p('cmd-persistence', 'dangerous_command', 'high', 'any',
    `\\|${S}crontab${SP}-(?=\\s|$)|\\(${S}crontab${SP}-l|${tok('crontab')}${SP}(?:-u${SP}\\S+${SP})?[\\w./-]+\\.(?:cron|tab|txt)${W1}|${W0}@reboot${W1}|/etc/cron\\.(?:d|daily|hourly|weekly)|/etc/crontab|${tok('launchctl')}${SP}(?:load|bootstrap)|LaunchAgents/|LaunchDaemons/|${tok('schtasks')}${SP}/create|${tok('Register-ScheduledTask|New-ScheduledTask')}|${tok('reg')}${SP}add${SP}[^\\n]{0,80}\\\\Run${W1}|CurrentVersion\\\\Run${W1}|Microsoft\\\\Windows\\\\Start${SP}Menu\\\\Programs\\\\Startup`,
    'Persistence mechanism (cron / launchd / scheduled task / autorun registry)', 'Механизм закрепления (cron / launchd / планировщик / автозапуск в реестре)'),
  p('cmd-cron-mention', 'dangerous_command', 'low', 'any',
    `${tok('crontab')}${SP}-[el]${W1}`,
    'Mentions editing / listing crontab', 'Упоминание редактирования crontab'),
  p('cmd-shell-rc', 'dangerous_command', 'medium', 'any',
    `(?:>>|${tok('echo|cat|tee|sed|printf')}[^\\n]{0,80})${S}["']?(?:~|\\$HOME)?/?\\.(?:bashrc|zshrc|profile|bash_profile|zprofile|config/fish/config\\.fish)${W1}`,
    'Writes to a shell startup file', 'Запись в файл автозагрузки shell (.bashrc / .zshrc / .profile)'),
  p('cmd-background-process', 'dangerous_command', 'low', 'any',
    `${tok('nohup')}${SP}[^\\n]{0,80}&${S}$|${tok('setsid|disown')}|${tok('systemctl')}${SP}enable${W1}`,
    'Starts a background / autostarted process', 'Запуск фонового / автозапускаемого процесса'),
  p('cmd-autorun-instruction', 'dangerous_command', 'medium', 'any',
    tok(`(?:always|first|before${SP}(?:anything|doing${SP}anything|every${SP}task|any${SP}task)|at${SP}the${SP}(?:start|beginning)${SP}of${SP}(?:every|each)${SP}(?:session|task|conversation)|on${SP}every${SP}(?:run|start|launch)|автоматически|всегда|перед${SP}(?:любой|каждой|началом)${SP}(?:задач${RU}|работ${RU}|сесси${RU})|в${SP}начале${SP}(?:каждой|любой)${SP}(?:сессии|задачи))${SP}(?:run|execute|launch|source|install|запускай${RU}|запусти${RU}|выполняй${RU}|выполни${RU}|установи${RU}|устанавливай${RU})${SP}(?:the${SP})?[\`"'«]?(?:[\\w./-]*\\.(?:sh|bat|ps1|py|js|cmd|command|exe)|this${SP}script|the${SP}script|скрипт${RU}|команд${RU})`),
    'Instructs the agent to auto-run a script on every session', 'Инструкция автоматически запускать скрипт в каждой сессии'),
  p('cmd-install-from-url', 'dangerous_command', 'high', 'any',
    `${tok(`pip3?${SP}install|python[23]?${SP}-m${SP}pip${SP}install|npm${SP}(?:i|install)|yarn${SP}add|pnpm${SP}add|gem${SP}install|cargo${SP}install|go${SP}install|brew${SP}install|apt(?:-get)?${SP}install|choco${SP}install|winget${SP}install`)}${SP}(?:-[-\\w=.]+${SP})*(?:https?://(?!(?:[\\w.-]*\\.)?(?:github\\.com|gitlab\\.com|pypi\\.org|registry\\.npmjs\\.org|files\\.pythonhosted\\.org|huggingface\\.co|download\\.pytorch\\.org)/)|git\\+https?://(?!(?:[\\w.-]*\\.)?(?:github\\.com|gitlab\\.com)/)|[^\\s"']+\\.(?:tar\\.gz|whl|tgz|zip)${W1})`,
    'Installs a package from an untrusted URL / archive', 'Установка пакета по недоверенному URL / из архива'),
  p('meta-dynamic-shell', 'scope', 'low', 'any',
    `^\\s*!\`[^\`\\n]{3,}\``,
    'Shell command executed automatically when the skill loads (Claude Code !`cmd` preamble)', 'Shell-команда, выполняемая автоматически при загрузке скилла (преамбула !`cmd` в Claude Code)', { flags: 'u', files: MD }),

  // --- 5. Obfuscation ----------------------------------------------------------------------
  p('obf-base64-blob', 'obfuscation', 'medium', 'any',
    `(?<!base64,|sha256-|sha384-|sha512-|ssh-rsa |ssh-ed25519 )(?<![A-Za-z0-9+/=])(?=[A-Za-z0-9+/]*[A-Z])(?=[A-Za-z0-9+/]*[a-z])(?=[A-Za-z0-9+/]*[0-9])[A-Za-z0-9+/]{80,}={0,2}(?![A-Za-z0-9+/=])`,
    'Long base64-looking blob', 'Длинный blob, похожий на base64', { flags: 'u' }),
  p('obf-hex-escape-chain', 'obfuscation', 'medium', 'any',
    `(?:\\\\x[0-9a-f]{2}){10,}|(?:%[0-9a-f]{2}){24,}|String\\.fromCharCode\\((?:${S}\\d+${S},){8,}|(?:chr\\(\\d+\\)${S}\\+${S}){6,}`,
    'Escaped/char-code string obfuscation', 'Обфускация строк через escape-последовательности / коды символов'),
  p('obf-html-comment-instruction', 'obfuscation', 'high', 'any',
    `<!--[^>]{0,300}?(?:ignore${SP}(?:all${SP})?(?:the${SP})?(?:previous|prior|above|system)|you${SP}are${SP}(?:now|an?)${SP}|system${SP}prompt|instructions?${SP}for${SP}(?:the${SP})?(?:ai|assistant|agent|model|llm)|assistant${S}:|игнорируй${RU}${SP}(?:все${SP})?(?:предыдущие|инструкции)|забудь${RU}${SP}(?:все${SP})?инструкции|теперь${SP}ты${SP}|инструкци${RU}${SP}для${SP}(?:ии|ассистента|агента|модели))[^>]{0,300}?-->`,
    'Hidden instruction inside an HTML comment', 'Скрытая инструкция внутри HTML-комментария', { files: MD }),
  p('obf-markdown-hidden-text', 'obfuscation', 'medium', 'any',
    `\\[[^\\]]{0,120}(?:ignore|instructions?|system${SP}prompt|игнорируй|инструкци${RU})[^\\]]{0,120}\\]\\(\\s*#?\\s*\\)|<(?:span|div|p|font)[^>]{0,120}(?:display${S}:${S}none|font-size${S}:${S}0(?:px|pt)?${S}[;"']|color${S}:${S}(?:white|#fff(?:fff)?|transparent)|opacity${S}:${S}0${S}[;"'])[^>]{0,120}>[^<\\n]{0,200}(?:ignore|instructions?|you${SP}are|system|игнорируй|инструкци${RU}|теперь${SP}ты)`,
    'Hidden text via empty link / invisible styling carrying instructions', 'Скрытый текст через пустую ссылку / невидимые стили с инструкциями', { files: MD }),

  // --- 6. Social engineering / false authority ---------------------------------------------
  p('en-false-authority', 'social_engineering', 'medium', 'en',
    tok(`(?:anthropic|openai|google|the${SP}developers?|your${SP}(?:developers?|creators?|administrator|admin|operator))${SP}(?:has|have)${SP}(?:authori[sz]ed|approved|allowed|permitted|verified|instructed)${SP}(?:you|this|me)|this${SP}is${SP}an?${SP}(?:official|authori[sz]ed|verified|trusted)${SP}(?:instruction|message|request|command)${SP}from|as${SP}your${SP}(?:administrator|admin|developer|creator|owner)${S},|(?:test|testing|debug|evaluation|sandbox)${SP}mode${S}[:-]?${S}(?:all${SP})?(?:rules|restrictions|safety|guidelines|filters)${SP}(?:are${SP})?(?:disabled|off|suspended|do${SP}not${SP}apply)|safety${SP}(?:guidelines|filters)${SP}(?:are${SP})?(?:disabled|suspended|off)|(?:this${SP}is${SP})?(?:an?${SP})?(?:authori[sz]ed|official|approved)${SP}(?:test|testing|debug)${SP}mode`),
    'False-authority / fake test-mode claim', 'Ложная ссылка на авторитет / "тестовый режим, правила не действуют"'),
  p('ru-false-authority', 'social_engineering', 'medium', 'ru',
    tok(`(?:anthropic|openai|google|разработчик${RU}|создател${RU}|администратор${RU}|оператор${RU}|владел${RU})${SP}(?:разреши${RU}|одобри${RU}|подтверди${RU}|санкционирова${RU}|дал${RU}${SP}разрешение|поручи${RU})${SP}(?:тебе|это|выполн${RU}|игнорир${RU})|это${SP}(?:официальн${RU}|проверенн${RU}|доверенн${RU}|санкционированн${RU})${SP}(?:инструкци${RU}|сообщени${RU}|запрос${RU}|команд${RU})${SP}от|по${SP}(?:указанию|распоряжению|поручению)${SP}(?:администратор${RU}|разработчик${RU}|владельц${RU})|(?:тестов${RU}|отладочн${RU}|режим${SP}отладки|песочниц${RU})[^\\n]{0,40}(?:правил${RU}|ограничени${RU}|фильтр${RU})${SP}(?:не${SP}(?:действуют|применяются|работают)|отключен${RU}|сняты)|(?:правил${RU}|ограничени${RU}|фильтр${RU})${SP}(?:безопасности${SP})?(?:отключен${RU}|не${SP}действу${RU}|сняты|приостановлен${RU})`),
    'False-authority / fake test-mode claim (Russian)', 'Ложная ссылка на авторитет / "тестовый режим, правила не действуют"'),

  // --- 6b. Intent flags (dual-use / high-value targets) — informational -------------------
  p('intent-offensive-security', 'intent', 'low', 'any',
    tok(`reverse${SP}shell|privilege${SP}escalation|privesc|c2${SP}(?:server|framework|beacon)|command${SP}and${SP}control|payload${SP}(?:delivery|generation)|exploit(?:ation)?${SP}chain|credential${SP}(?:harvesting|dumping)|password${SP}spraying|phishing${SP}(?:kit|campaign)|keylogger|ransomware|malware${SP}(?:development|analysis)|bypass${SP}(?:edr|av|antivirus|amsi|waf)|lateral${SP}movement|red${SP}team(?:ing)?|offensive${SP}security|pentest(?:ing)?|penetration${SP}test(?:ing)?|bug${SP}bounty|обратн${RU}${SP}шелл|повышени${RU}${SP}привилегий|пентест${RU}|фишинг${RU}`),
    'Offensive-security / dual-use content (legitimate for authorised testing; review intended use)', 'Наступательная безопасность / двойное назначение (допустимо для авторизованного тестирования; проверьте назначение)', { files: MD }),
  p('intent-wallet-secrets', 'intent', 'medium', 'any',
    tok(`seed${SP}phrase|mnemonic${SP}(?:phrase|words)|(?:secret${SP})?recovery${SP}phrase|wallet${SP}private${SP}key|private${SP}key${SP}of${SP}(?:the${SP})?wallet|keystore${SP}(?:file|password)|сид-?фраз${RU}|мнемоническ${RU}${SP}фраз${RU}|фраз${RU}${SP}восстановлени${RU}|приватн${RU}${SP}ключ${RU}${SP}кошельк${RU}`),
    'Handles crypto-wallet secrets (seed / mnemonic / private key) — a classic stealer target', 'Работает с секретами криптокошелька (сид-фраза / приватный ключ) — классическая цель стилеров'),
  p('intent-browser-credential-store', 'exfiltration', 'high', 'any',
    `(?:Login${SP}Data|Local${SP}State|Cookies|Web${SP}Data)${W1}[^\\n]{0,80}(?:Chrome|Chromium|Edge|Brave|Opera|User${SP}Data)|(?:Chrome|Chromium|Edge|Brave|Opera|User${SP}Data)[^\\n]{0,80}(?:Login${SP}Data|Local${SP}State|Web${SP}Data|/Cookies${W1})|logins\\.json[^\\n]{0,40}(?:firefox|profiles)|key4\\.db|cookies\\.sqlite`,
    'Accesses a browser credential / cookie store', 'Доступ к хранилищу паролей / cookies браузера'),

  // --- 7. Hardcoded secrets ----------------------------------------------------------------
  p('secret-aws-key', 'secret', 'critical', 'any', `${W0}AKIA[0-9A-Z]{16}${W1}`, 'AWS access key ID', 'AWS access key ID', { flags: 'u' }),
  p('secret-anthropic-key', 'secret', 'critical', 'any', `sk-ant-(?!api03-\\.\\.\\.|\\.\\.\\.|xxx)[A-Za-z0-9_-]{20,}`, 'Anthropic API key', 'Ключ Anthropic API', { flags: 'u' }),
  p('secret-openrouter-key', 'secret', 'critical', 'any', `sk-or-v1-[a-f0-9]{20,}`, 'OpenRouter API key', 'Ключ OpenRouter API', { flags: 'u' }),
  p('secret-openai-key', 'secret', 'critical', 'any', `${W0}sk-(?!or-|ant-)(?:proj-)?(?=[A-Za-z0-9_-]*[A-Z])(?=[A-Za-z0-9_-]*[a-z])(?=[A-Za-z0-9_-]*\\d)[A-Za-z0-9_-]{32,}${W1}`, 'OpenAI-style API key', 'Ключ в формате OpenAI', { flags: 'u' }),
  p('secret-labelled-token', 'secret', 'medium', 'any',
    `${W0}(?:access[_ -]?token|secret[_ -]?key|api[_ -]?key|apikey|app[_ -]?secret|client[_ -]?secret|auth[_ -]?token|bearer|refresh[_ -]?token|токен|секретный${SP}ключ|ключ${SP}api)${S}[:=]${S}["'\`]?(?=[A-Za-z0-9_\\-]*[A-Za-z])(?=[A-Za-z0-9_\\-]*\\d)[A-Za-z0-9_\\-]{24,}${W1}`,
    'Labelled token / key literal (vendor format unknown — verify it is not a live credential)', 'Токен / ключ рядом с меткой (формат неизвестен — проверьте, что это не живой секрет)'),
  p('secret-high-entropy-token', 'secret', 'low', 'any',
    `(?<![\\w/=.:\\-@#])(?=[A-Za-z0-9_\\-]*[A-Z])(?=[A-Za-z0-9_\\-]*[a-z])(?=[A-Za-z0-9_\\-]*\\d)(?![0-9a-f]{28,}${W1})[A-Za-z0-9_\\-]{28,48}(?![\\w/=.\\-])`,
    'High-entropy token-like string (may be an id, hash or a credential)', 'Строка, похожая на токен (может быть id, хеш или секрет)', { flags: 'u' }),
  p('secret-github-token', 'secret', 'critical', 'any', `${W0}(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})${W1}`, 'GitHub token', 'Токен GitHub', { flags: 'u' }),
  p('secret-slack-token', 'secret', 'critical', 'any', `${W0}xox[bapors]-[0-9]{8,}-[A-Za-z0-9-]{8,}${W1}`, 'Slack token', 'Токен Slack', { flags: 'u' }),
  p('secret-google-key', 'secret', 'high', 'any', `${W0}AIza[0-9A-Za-z_-]{30,}${W1}`, 'Google API key', 'Ключ Google API', { flags: 'u' }),
  p('secret-telegram-bot', 'secret', 'critical', 'any', `${W0}\\d{8,10}:AA[A-Za-z0-9_-]{30,}${W1}`, 'Telegram bot token', 'Токен Telegram-бота', { flags: 'u' }),
  p('secret-private-key', 'secret', 'critical', 'any', `-----BEGIN (?:RSA |EC |OPENSSH |PGP |DSA )?PRIVATE KEY(?: BLOCK)?-----`, 'Private key material', 'Приватный ключ', { flags: 'u' }),
  p('secret-password-literal', 'secret', 'low', 'any',
    `${W0}(?:password|passwd|pwd|пароль|api[_-]?key|secret[_-]?key|access[_-]?token|client[_-]?secret)${S}[:=]${S}["']?(?!\\$|\\{|<|%|\\*{3}|\\.\\.\\.|env|os\\.|process\\.|your|my|xxx|example|placeholder|changeme|dummy|sample|test|redacted|secret|password|passw0rd|token|none|null|true|false|123456|admin)(?=[^\\s"'<>]*\\d)(?=[^\\s"'<>]*[A-Za-z])[^\\s"'<>,;)]{10,}(?<!\\.\\.\\.)`,
    'Hard-coded password / key literal (may be an example)', 'Захардкоженный пароль / ключ (возможно, пример)'),
];

/** Unicode-level checks that need the raw (non-normalised) text. Character classes written with \u escapes on purpose. */
export const UNICODE_CHECKS = [
  // U+200C/U+200D (ZWNJ/ZWJ) are ordinary in Arabic-script text (Persian, Urdu) and in emoji sequences: such lines are skipped.
  { id: 'uni-zero-width', category: 'obfuscation', severity: 'medium', mdSeverity: 'high', re: new RegExp('[\\u200B-\\u200F\\u2060-\\u2064\\uFEFF]', 'u'), skipLine: new RegExp('[\\p{Script=Arabic}\\p{Script=Hebrew}\\p{Script=Devanagari}\\p{Script=Bengali}\\p{Script=Tamil}\\p{Extended_Pictographic}]', 'u'), message: { en: 'Zero-width / invisible characters (possible hidden text)', ru: 'Невидимые символы нулевой ширины (возможен скрытый текст)' }, min: 3 },
  // TAG characters right after 🏴 (U+1F3F4) form legitimate subdivision flags (England, Scotland, Wales) and are excluded.
  { id: 'uni-tag-chars', category: 'obfuscation', severity: 'critical', re: new RegExp('(?<!\\u{1F3F4}[\\u{E0000}-\\u{E007F}]*)[\\u{E0000}-\\u{E007F}]', 'u'), message: { en: 'Unicode TAG characters (invisible instruction smuggling)', ru: 'Unicode TAG-символы (невидимая контрабанда инструкций)' }, min: 1 },
  { id: 'uni-bidi-override', category: 'obfuscation', severity: 'high', re: new RegExp('[\\u202A-\\u202E]', 'u'), skipLine: new RegExp('[\\p{Script=Arabic}\\p{Script=Hebrew}]', 'u'), message: { en: 'Bidirectional override characters (Trojan Source)', ru: 'Символы переопределения направления текста (Trojan Source)' }, min: 1 },
  { id: 'uni-bidi-isolate', category: 'obfuscation', severity: 'medium', re: new RegExp('[\\u2066-\\u2069]', 'u'), skipLine: new RegExp('[\\p{Script=Arabic}\\p{Script=Hebrew}]', 'u'), message: { en: 'Bidirectional isolate characters (rarely legitimate outside RTL text)', ru: 'Символы bidi-изоляции (вне RTL-текста встречаются редко)' }, min: 1 },
  { id: 'uni-mixed-script-word', category: 'obfuscation', severity: 'medium', re: new RegExp('(?<![\\p{L}\\p{N}\\\\])(?=[\\p{L}\\p{N}]*[A-Za-z])(?=[\\p{L}\\p{N}]*[\\u0400-\\u04FF])[\\p{L}\\p{N}]{4,}(?![\\p{L}\\p{N}])', 'u'), message: { en: 'Word mixing Latin and Cyrillic letters (homoglyph obfuscation)', ru: 'Слово из смеси латиницы и кириллицы (гомоглифы)' }, min: 1 },
];

export const INVISIBLE_RE = new RegExp('[\\u200B-\\u200F\\u2060-\\u2064\\uFEFF\\u202A-\\u202E\\u2066-\\u2069]|[\\u{E0000}-\\u{E007F}]', 'gu');

export const SEVERITY_SCORE = { critical: 10, high: 5, medium: 2, low: 1 };
export const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];
