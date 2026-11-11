/* =====================================================================
   Falcare – Google sign-in gate + per-account data
   Add this as the FIRST script in <head> of every page:
   <script src="auth.js"></script>
   ===================================================================== */
(function () {
  /* ============ SETTINGS ============ */
  var CONFIG = {
    CLIENT_ID: 'PASTE_YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
    GMAIL_ONLY: true,   // true = only @gmail.com / @googlemail.com; false = any Google account
    SESSION_DAYS: 7     // how long a login lasts on this device
  };
  /* ================================== */

  var SKEY = 'falcare_session';
  var PER_USER = /^falcare_(cart|orders|profile)$/; // keys that become private to each account
  var ls = window.localStorage;
  var getI = Storage.prototype.getItem, setI = Storage.prototype.setItem, remI = Storage.prototype.removeItem;

  function readSession() {
    try {
      var s = JSON.parse(getI.call(ls, SKEY));
      if (s && s.email && s.exp > Date.now()) return s;
    } catch (e) {}
    try { remI.call(ls, SKEY); } catch (e) {}
    return null;
  }
  var USER = readSession();

  /* Every page that reads/writes falcare_cart / falcare_orders / falcare_profile
     is transparently pointed at "<key>:<email>", so each Gmail has its own data.
     Signed-out visitors can't read or write any of it. */
  Storage.prototype.getItem = function (k) {
    if (this === ls && PER_USER.test(k)) return USER ? getI.call(this, k + ':' + USER.email) : null;
    return getI.call(this, k);
  };
  Storage.prototype.setItem = function (k, v) {
    if (this === ls && PER_USER.test(k)) { if (USER) setI.call(this, k + ':' + USER.email, v); return; }
    return setI.call(this, k, v);
  };
  Storage.prototype.removeItem = function (k) {
    if (this === ls && PER_USER.test(k)) { if (USER) remI.call(this, k + ':' + USER.email); return; }
    return remI.call(this, k);
  };

  window.FalcareAuth = {
    user: USER,
    signOut: function () {
      try { remI.call(ls, SKEY); } catch (e) {}
      try { window.google && google.accounts.id.disableAutoSelect(); } catch (e) {}
      location.reload();
    }
  };

  /* ---------- signed in: add account chip to the dashboard sidebar ---------- */
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function addChip() {
    var side = document.querySelector('aside.side');
    if (!side || document.getElementById('fc-acct')) return;
    var st = document.createElement('style');
    st.textContent = '#fc-acct{display:flex;align-items:center;gap:10px;margin-top:auto;padding:10px;border-radius:14px;background:rgba(255,255,255,.08)}' +
      '#fc-acct+.bottom{margin-top:0}#fc-acct img,#fc-acct .fc-av{width:38px;height:38px;border-radius:50%;flex:none;object-fit:cover;background:#6428B3;display:grid;place-items:center;font-weight:700}' +
      '#fc-acct div{min-width:0;font-size:.8rem;line-height:1.25}#fc-acct b{display:block;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '#fc-acct small{display:block;color:#b8a3cc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '#fc-acct button{margin-top:2px;background:none;border:0;padding:0;color:#CBA5ED;text-decoration:underline;font:inherit;cursor:pointer}';
    document.head.appendChild(st);
    var d = document.createElement('div');
    d.id = 'fc-acct';
    var av = USER.picture ? '<img src="' + esc(USER.picture) + '" alt="" referrerpolicy="no-referrer">' : '<span class="fc-av">' + esc((USER.name || USER.email)[0].toUpperCase()) + '</span>';
    d.innerHTML = av + '<div><b>' + esc(USER.name || 'My account') + '</b><small>' + esc(USER.email) + '</small><button type="button" id="fc-out">Sign out</button></div>';
    var bottom = side.querySelector('.bottom');
    side.insertBefore(d, bottom || null);
    d.querySelector('#fc-out').onclick = window.FalcareAuth.signOut;
  }

  if (USER) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addChip); else addChip();
    return;
  }

  /* ---------- signed out: lock the page behind a Google sign-in ---------- */
  var root = document.documentElement;
  root.classList.add('fc-locked');
  var css = document.createElement('style');
  css.textContent =
    'html.fc-locked,html.fc-locked body{overflow:hidden!important;height:100%}' +
    'html.fc-locked body>*:not(#fc-gate){visibility:hidden!important}' +
    '#fc-gate{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:20px;' +
    'background:radial-gradient(circle at 50% 30%,#7c4ddb 0,#4b2a9a 50%,#1c0f47 100%);font-family:Outfit,Inter,system-ui,sans-serif;visibility:visible!important}' +
    '#fc-gate .box{width:min(420px,100%);background:#fff;color:#2E1A40;border-radius:28px;padding:34px 28px;text-align:center;box-shadow:0 30px 70px -20px rgba(0,0,0,.6)}' +
    '#fc-gate .brand{font:700 2.2rem/1 Galada,Outfit,cursive;color:#6428B3;margin-bottom:6px}' +
    '#fc-gate h1{font-size:1.35rem;font-weight:700;margin:10px 0 6px}' +
    '#fc-gate p{color:#8A67A9;font-size:.95rem;line-height:1.5}' +
    '#fc-gbtn{display:flex;justify-content:center;margin:22px 0 6px;min-height:44px}' +
    '#fc-gerr{color:#c0392b;font-size:.88rem;font-weight:600;margin-top:10px;min-height:1.2em}' +
    '#fc-gate small{display:block;margin-top:14px;color:#a995bd;font-size:.78rem}';
  document.head.appendChild(css);

  function buildGate() {
    var g = document.createElement('div');
    g.id = 'fc-gate';
    g.setAttribute('role', 'dialog');
    g.setAttribute('aria-modal', 'true');
    g.setAttribute('aria-label', 'Sign in to Falcare');
    g.innerHTML = '<div class="box"><div class="brand">Falcare</div><h1>Sign in to continue</h1>' +
      '<p>Use your Gmail account to browse workers, place orders and see your own dashboard.</p>' +
      '<div id="fc-gbtn"></div><div id="fc-gerr" role="alert"></div>' +
      '<small>We only use your name and email to set up your account.</small></div>';
    document.body.appendChild(g);
    return g;
  }

  function fail(msg) { var e = document.getElementById('fc-gerr'); if (e) e.textContent = msg; }

  function decode(t) {
    var b = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(atob(b).split('').map(function (c) { return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }).join('')));
  }

  function onCredential(resp) {
    var p;
    try { p = decode(resp.credential); } catch (e) { return fail('Sign-in failed. Please try again.'); }
    var email = String(p.email || '').toLowerCase();
    if (!email || p.email_verified === false) return fail('Your Google email is not verified.');
    if (CONFIG.GMAIL_ONLY && !/@(gmail|googlemail)\.com$/.test(email)) return fail('Please sign in with a Gmail account.');
    var sess = { email: email, name: p.name || '', picture: p.picture || '', sub: p.sub, exp: Date.now() + CONFIG.SESSION_DAYS * 864e5 };
    try {
      setI.call(ls, SKEY, JSON.stringify(sess));
      /* give a first-time account a starter profile (name + email) */
      var pk = 'falcare_profile:' + email;
      if (!getI.call(ls, pk)) setI.call(ls, pk, JSON.stringify({ name: sess.name, email: email }));
    } catch (e) { return fail('Your browser blocked saving the login. Allow site data and try again.'); }
    location.reload(); /* reload so the page starts up with this account's data */
  }

  function init() {
    buildGate();
    if (/^PASTE_/.test(CONFIG.CLIENT_ID)) {
      fail('Sign-in is not set up yet: add your Google Client ID in auth.js.');
      return;
    }
    var s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true;
    s.onload = function () {
      try {
        google.accounts.id.initialize({ client_id: CONFIG.CLIENT_ID, callback: onCredential, auto_select: false, ux_mode: 'popup' });
        google.accounts.id.renderButton(document.getElementById('fc-gbtn'), { theme: 'filled_blue', size: 'large', shape: 'pill', text: 'continue_with', width: 280 });
      } catch (e) { fail('Could not load Google sign-in.'); }
    };
    s.onerror = function () { fail('Could not reach Google. Check your internet connection.'); };
    document.head.appendChild(s);
  }
  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
})();
