// Vite compiles and embeds this initializer; the API permits its exact SHA-256 hash in CSP.
try {
  const language = localStorage.getItem('ktd_language') === 'ja' ? 'ja' : 'en';
  document.documentElement.lang = language;
  if (language === 'ja')
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        const loading = document.getElementById('initial-loading-message');
        if (loading) loading.textContent = 'KitchenToDoorを開いています…';
      },
      { once: true },
    );
  const dark = localStorage.getItem('ktd_theme') === 'dark';
  document.documentElement.classList.toggle('dark', dark);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#020617' : '#f8fafc');
} catch {
  // Keep the default light theme when browser storage is unavailable.
}

// Request the menu hero early, before the route's JavaScript is evaluated.
if (window.location.pathname === '/') {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = '/menu/burger-3ee0ea75-640.webp';
  link.imageSrcset =
    '/menu/burger-3ee0ea75-480.webp 480w, /menu/burger-3ee0ea75-640.webp 640w, /menu/burger-3ee0ea75-720.webp 720w, /menu/burger-3ee0ea75-960.webp 960w';
  link.imageSizes =
    '(min-width: 1536px) 23vw, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw';
  link.fetchPriority = 'high';
  document.head.append(link);
}
