let current = 'en';

export function setLang(lang) {
  current = lang === 'ru' ? 'ru' : 'en';
}

export function getLang() {
  return current;
}

/** t('русский', 'english') */
export function t(ru, en) {
  return current === 'ru' ? ru : en;
}
