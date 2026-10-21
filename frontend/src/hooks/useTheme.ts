import { useState, useEffect, useRef } from 'react';
import { transitionAppearance } from '../lib/appearanceTransition';

type Theme = 'light' | 'dark';

function apply(theme: Theme) {
  const root = document.documentElement;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#020617' : '#f8fafc');
  root.classList.toggle('dark', theme === 'dark');
  try {
    localStorage.setItem('ktd_theme', theme);
  } catch {
    /* Storage may be blocked. */
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('ktd_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {}
    return 'light';
  });
  const requestedTheme = useRef(theme);
  const version = useRef(0);

  useEffect(() => {
    apply(requestedTheme.current);
    const synchronize = (event: StorageEvent) => {
      if (event.key === 'ktd_theme' && (event.newValue === 'dark' || event.newValue === 'light')) {
        version.current++;
        requestedTheme.current = event.newValue;
        setTheme(event.newValue);
        apply(event.newValue);
      }
    };
    window.addEventListener('storage', synchronize);
    return () => window.removeEventListener('storage', synchronize);
  }, []);

  const toggleTheme = () => {
    const next = requestedTheme.current === 'dark' ? 'light' : 'dark';
    requestedTheme.current = next;
    try {
      localStorage.setItem('ktd_theme', next);
    } catch {
      /* The current tab can still change theme. */
    }
    const request = ++version.current;
    void transitionAppearance('theme-change', () => {
      if (request !== version.current) return;
      apply(next);
      setTheme(next);
    }).catch((error: unknown) => console.warn('Theme could not be changed.', error));
  };

  return { theme, toggleTheme, isDark: theme === 'dark' };
}
