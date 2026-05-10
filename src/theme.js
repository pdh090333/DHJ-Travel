const STORAGE_KEY = 'theme';

export function getThemePreference() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === 'light' || saved === 'dark' ? saved : 'auto';
}

function resolve(preference) {
  if (preference === 'light' || preference === 'dark') return preference;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(preference) {
  document.documentElement.dataset.theme = resolve(preference);
}

export function setThemePreference(preference) {
  if (preference === 'auto') {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, preference);
  }
  applyTheme(preference);
}

export function watchSystemTheme() {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => {
    if (getThemePreference() === 'auto') applyTheme('auto');
  };
  media.addEventListener('change', handler);
  return () => media.removeEventListener('change', handler);
}

export const THEME_CYCLE = { auto: 'light', light: 'dark', dark: 'auto' };
