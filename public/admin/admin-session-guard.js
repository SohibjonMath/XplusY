(() => {
  // v189: All admin pages share this visibility rule. Some legacy component
  // styles set display:grid/flex on login blocks and accidentally override the
  // browser's native [hidden] rule. Keep hidden authoritative everywhere.
  const style = document.createElement('style');
  style.id = 'orzumall-admin-hidden-contract-v189';
  style.textContent = `
    [hidden] { display: none !important; }
    #login[hidden], #loginBox[hidden], #app[hidden],
    .login[hidden], .login-screen[hidden], .login-box[hidden], .app[hidden] {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
  `;
  (document.head || document.documentElement).appendChild(style);

  const LOGIN_PATH = '/admin/login.html';
  const DEFAULT_PATH = '/admin/panel.html';
  const KEY = 'orzumall_admin_next_v188';

  function safeNext(raw) {
    try {
      const value = String(raw || '').trim();
      const u = new URL(value || DEFAULT_PATH, location.origin);
      if (u.origin !== location.origin) return DEFAULT_PATH;
      if (!u.pathname.startsWith('/admin/')) return DEFAULT_PATH;
      if (u.pathname === LOGIN_PATH || u.pathname === '/admin/' || u.pathname === '/admin/index.html') return DEFAULT_PATH;
      return `${u.pathname}${u.search}${u.hash}`;
    } catch (_e) {
      return DEFAULT_PATH;
    }
  }

  function remember(next) {
    const safe = safeNext(next || `${location.pathname}${location.search}${location.hash}`);
    try { sessionStorage.setItem(KEY, safe); } catch (_e) {}
    return safe;
  }

  function loginUrl(next) {
    const safe = remember(next);
    return `${LOGIN_PATH}?next=${encodeURIComponent(safe)}`;
  }

  function requireLogin(next) {
    if (location.pathname === LOGIN_PATH) return;
    location.replace(loginUrl(next));
  }

  function afterLogin() {
    const params = new URLSearchParams(location.search);
    const fromQuery = params.get('next');
    let fromStore = '';
    try { fromStore = sessionStorage.getItem(KEY) || ''; } catch (_e) {}
    const safe = safeNext(fromQuery || fromStore || DEFAULT_PATH);
    try { sessionStorage.removeItem(KEY); } catch (_e) {}
    return safe;
  }

  window.OrzuAdminSession = Object.freeze({ safeNext, remember, loginUrl, requireLogin, afterLogin });
})();
