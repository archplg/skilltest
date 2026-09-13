/**
 * Which third-party software a skill works against: Obsidian, Word, Notion, Figma, GitHub…
 *
 * This is a third axis, independent of the other two. `platforms` says which agent can run the skill, `topics` say
 * what field it serves, and this says what program or service it touches — the question a buyer actually asks
 * ("покажи всё для Obsidian"). Patterns are deliberately narrow: a bare "word" or "teams" means nothing, so every
 * entry demands a distinctive form (Microsoft Word, .docx, linear.app).
 */

export const APPS = {
  // documents and notes
  word: { ru: 'Word', en: 'Word', re: /(?<![\p{L}\p{N}_])(?:microsoft\s+word|ms\s+word|word\s+document|\.docx\b|\bdocx\b)/iu },
  excel: { ru: 'Excel', en: 'Excel', re: /(?<![\p{L}\p{N}_])(?:microsoft\s+excel|ms\s+excel|excel\s+(?:file|workbook|sheet|spreadsheet)|\.xlsx\b|\bxlsx\b)/iu },
  powerpoint: { ru: 'PowerPoint', en: 'PowerPoint', re: /(?<![\p{L}\p{N}_])(?:powerpoint|\.pptx\b|\bpptx\b|keynote\s+deck)/iu },
  pdf: { ru: 'PDF', en: 'PDF', re: /(?<![\p{L}\p{N}_])(?:pdf\s+(?:file|document|form|report)|\.pdf\b|edit\s+pdfs?)/iu },
  googledocs: { ru: 'Google Docs', en: 'Google Docs', re: /\bgoogle\s+docs?\b|\bdocs\.google\.com/iu },
  googlesheets: { ru: 'Google Sheets', en: 'Google Sheets', re: /\bgoogle\s+sheets?\b|\bsheets\.google\.com/iu },
  googledrive: { ru: 'Google Drive', en: 'Google Drive', re: /\bgoogle\s+drive\b|\bdrive\.google\.com/iu },
  notion: { ru: 'Notion', en: 'Notion', re: /\bnotion(?:\.so|\s+(?:api|page|database|workspace))(?![\p{L}\p{N}_])|\bnotion\b/iu },
  obsidian: { ru: 'Obsidian', en: 'Obsidian', re: /\bobsidian\b/iu },
  confluence: { ru: 'Confluence', en: 'Confluence', re: /\bconfluence\b/iu },
  airtable: { ru: 'Airtable', en: 'Airtable', re: /\bairtable\b/iu },
  latex: { ru: 'LaTeX', en: 'LaTeX', re: /(?<![\p{L}\p{N}_])(?:latex|overleaf|\\documentclass)(?![\p{L}\p{N}_])/iu },
  // communication
  slack: { ru: 'Slack', en: 'Slack', re: /\bslack\b/iu },
  discord: { ru: 'Discord', en: 'Discord', re: /\bdiscord\b/iu },
  telegram: { ru: 'Telegram', en: 'Telegram', re: /\btelegram\b|(?<![\p{L}\p{N}_])телеграм/iu },
  whatsapp: { ru: 'WhatsApp', en: 'WhatsApp', re: /\bwhatsapp\b/iu },
  gmail: { ru: 'Gmail', en: 'Gmail', re: /\bgmail\b/iu },
  outlook: { ru: 'Outlook', en: 'Outlook', re: /(?<![\p{L}\p{N}_])(?:outlook|microsoft\s+exchange)(?![\p{L}\p{N}_])/iu },
  teams: { ru: 'Microsoft Teams', en: 'Microsoft Teams', re: /\bmicrosoft\s+teams\b|\bms\s+teams\b/iu },
  zoom: { ru: 'Zoom', en: 'Zoom', re: /\bzoom\s+(?:meeting|call|recording|api)(?![\p{L}\p{N}_])/iu },
  // development
  github: { ru: 'GitHub', en: 'GitHub', re: /\bgithub\b|\bgh\s+(?:pr|issue|repo)(?![\p{L}\p{N}_])/iu },
  gitlab: { ru: 'GitLab', en: 'GitLab', re: /\bgitlab\b/iu },
  jira: { ru: 'Jira', en: 'Jira', re: /\bjira\b/iu },
  linearapp: { ru: 'Linear', en: 'Linear', re: /\blinear\.app\b|\blinear\s+(?:issue|ticket|project|team)(?![\p{L}\p{N}_])/iu },
  vscode: { ru: 'VS Code', en: 'VS Code', re: /(?<![\p{L}\p{N}_])(?:vs\s?code|visual\s+studio\s+code)(?![\p{L}\p{N}_])/iu },
  docker: { ru: 'Docker', en: 'Docker', re: /\bdocker(?:file|-compose)?\b/iu },
  kubernetes: { ru: 'Kubernetes', en: 'Kubernetes', re: /(?<![\p{L}\p{N}_])(?:kubernetes|kubectl|k8s)(?![\p{L}\p{N}_])/iu },
  terraform: { ru: 'Terraform', en: 'Terraform', re: /\bterraform\b/iu },
  postgres: { ru: 'PostgreSQL', en: 'PostgreSQL', re: /(?<![\p{L}\p{N}_])(?:postgres(?:ql)?|psql)(?![\p{L}\p{N}_])/iu },
  mysql: { ru: 'MySQL', en: 'MySQL', re: /(?<![\p{L}\p{N}_])(?:mysql|mariadb)(?![\p{L}\p{N}_])/iu },
  mongodb: { ru: 'MongoDB', en: 'MongoDB', re: /\bmongo(?:db)?\b/iu },
  supabase: { ru: 'Supabase', en: 'Supabase', re: /\bsupabase\b/iu },
  firebase: { ru: 'Firebase', en: 'Firebase', re: /\bfirebase\b/iu },
  playwright: { ru: 'Playwright', en: 'Playwright', re: /(?<![\p{L}\p{N}_])(?:playwright|puppeteer|selenium)(?![\p{L}\p{N}_])/iu },
  // cloud
  aws: { ru: 'AWS', en: 'AWS', re: /(?<![\p{L}\p{N}_])(?:aws|amazon\s+web\s+services|s3\s+bucket|lambda\s+function)(?![\p{L}\p{N}_])/iu },
  gcp: { ru: 'Google Cloud', en: 'Google Cloud', re: /(?<![\p{L}\p{N}_])(?:google\s+cloud|gcp|bigquery)(?![\p{L}\p{N}_])/iu },
  azure: { ru: 'Azure', en: 'Azure', re: /\bazure\b/iu },
  cloudflare: { ru: 'Cloudflare', en: 'Cloudflare', re: /\bcloudflare\b/iu },
  // design and media
  figma: { ru: 'Figma', en: 'Figma', re: /\bfigma\b/iu },
  photoshop: { ru: 'Photoshop', en: 'Photoshop', re: /(?<![\p{L}\p{N}_])(?:photoshop|adobe\s+illustrator|lightroom)(?![\p{L}\p{N}_])/iu },
  canva: { ru: 'Canva', en: 'Canva', re: /\bcanva\b/iu },
  blender: { ru: 'Blender', en: 'Blender', re: /\bblender\b/iu },
  youtube: { ru: 'YouTube', en: 'YouTube', re: /\byoutube\b/iu },
  // business
  salesforce: { ru: 'Salesforce', en: 'Salesforce', re: /\bsalesforce\b/iu },
  hubspot: { ru: 'HubSpot', en: 'HubSpot', re: /\bhubspot\b/iu },
  stripe: { ru: 'Stripe', en: 'Stripe', re: /\bstripe\b/iu },
  shopify: { ru: 'Shopify', en: 'Shopify', re: /\bshopify\b/iu },
  wordpress: { ru: 'WordPress', en: 'WordPress', re: /\bwordpress\b|\bwoocommerce\b/iu },
  zapier: { ru: 'Zapier', en: 'Zapier', re: /(?<![\p{L}\p{N}_])(?:zapier|make\.com|n8n)(?![\p{L}\p{N}_])/iu },
  trello: { ru: 'Trello', en: 'Trello', re: /\btrello\b/iu },
  asana: { ru: 'Asana', en: 'Asana', re: /\basana\b/iu },
  clickup: { ru: 'ClickUp', en: 'ClickUp', re: /\bclickup\b/iu },
  miro: { ru: 'Miro', en: 'Miro', re: /\bmiro\b/iu },
  onec: { ru: '1С', en: '1C', re: /\b1с[:\s]|\b1c\s+(?:enterprise|предприятие)/iu },
  // analytics
  tableau: { ru: 'Tableau', en: 'Tableau', re: /\btableau\b/iu },
  powerbi: { ru: 'Power BI', en: 'Power BI', re: /\bpower\s?bi\b/iu },
  ga4: { ru: 'Google Analytics', en: 'Google Analytics', re: /\bgoogle\s+analytics\b|\bga4\b/iu },
};

/** Apps a skill works with, most clearly stated first. The title counts for more than a passing mention. */
export function detectApps(skill, { limit = 4 } = {}) {
  const title = `${skill.name || ''} ${skill.description || ''} ${skill.whenToUse || ''}`;
  const body = String(skill.body || '').slice(0, 20000);
  const scored = [];
  for (const [id, app] of Object.entries(APPS)) {
    const inTitle = app.re.test(title);
    const hits = (body.match(new RegExp(app.re.source, 'giu')) || []).length;
    // A single mention deep in the body is noise; a title mention, or a few body mentions, is a real target.
    if (!inTitle && hits < 3) continue;
    scored.push({ id, score: (inTitle ? 10 : 0) + Math.min(hits, 5) });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.id);
}

export function appLabel(id, lang) { const a = APPS[id]; return a ? (lang === 'ru' ? a.ru : a.en) : id; }
