// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Miloslav Brada
//
// Google Analytics se souhlasem s cookies. Jen pro samostatný web: build.sh skript vloží do <head>.
// Consent Mode v2 v základním režimu: dokud návštěvník nesouhlasí, gtag.js se vůbec nenačte
// a Googlu nic neodchází. Volba se pamatuje v localStorage na 12 měsíců, pak se lišta ukáže znovu.
// Odmítnout jde stejně snadno jako přijmout a souhlas jde kdykoli odvolat odkazem v patičce.
(() => {
  const ID = 'G-GX5DWNWRNJ', KEY = 'segmentovka-consent', TTL = 365 * 864e5;
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });

  const read = () => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null');
      return s && (s.v === 'granted' || s.v === 'denied') && Date.now() - s.t < TTL ? s.v : null;
    } catch (_) { return null; }
  };
  const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify({ v, t: Date.now() })); } catch (_) { /* volba platí aspoň do zavření stránky */ } };

  let loaded = false;
  function grant() {
    window['ga-disable-' + ID] = false;
    gtag('consent', 'update', { analytics_storage: 'granted' });
    if (loaded) return;
    loaded = true;
    gtag('js', new Date());
    gtag('config', ID);
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
    document.head.appendChild(s);
  }
  // Odvolání: GA se úplně vypne (ani pingy bez cookies) a jeho cookies se smažou.
  function deny() {
    window['ga-disable-' + ID] = true;
    gtag('consent', 'update', { analytics_storage: 'denied' });
    const parts = location.hostname.split('.');
    const domains = [''];
    for (let i = 0; i < parts.length - 1; i++) domains.push('; domain=.' + parts.slice(i).join('.'));
    for (const c of document.cookie.split(';')) {
      const name = c.split('=')[0].trim();
      if (!/^_ga/.test(name)) continue;
      for (const d of domains) document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + d;
    }
  }

  const choice = read();
  if (choice === 'granted') grant();

  const css = `
.cc { position: fixed; z-index: 40; right: max(16px, env(safe-area-inset-right, 0px)); bottom: max(16px, env(safe-area-inset-bottom, 0px));
  width: 400px; max-width: calc(100vw - 32px); display: grid; gap: 10px; padding: 14px 16px;
  background: var(--panel, #f7f8f6); color: var(--ink, #161a18); border: 1px solid var(--line, #cbd2cd); border-radius: var(--r, 6px);
  box-shadow: 0 8px 28px rgb(0 0 0 / 0.28); font-size: 14px; line-height: 1.45; }
.cc h2 { font-size: 15px; }
.cc p { margin: 0; }
.cc a { color: inherit; }
.cc-btns { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
.cc-btns .btn { min-width: 110px; }
.cc-foot { max-width: 1480px; margin: 24px auto 0; text-align: center; font-size: 13px; color: var(--muted, #59625d); }
.cc-foot button { border: 0; background: none; padding: 2px 4px; color: inherit; text-decoration: underline; cursor: pointer; }
.cc-foot button:hover { color: var(--ink, #161a18); }
@media (max-width: 480px) { .cc { left: 16px; right: 16px; width: auto; max-width: none; } .cc-btns .btn { flex: 1; } }
`;

  function bar() {
    let el = document.getElementById('cc');
    if (el) { el.hidden = false; el.querySelector('button').focus(); return; }
    el = document.createElement('section');
    el.id = 'cc';
    el.className = 'cc';
    el.setAttribute('aria-labelledby', 'cc-t');
    el.innerHTML = '<h2 id="cc-t">Měření návštěvnosti</h2>'
      + '<p>S vaším souhlasem bude web měřit návštěvnost přes Google Analytics (analytické cookies). Pomůže to zjistit, jak se generátor používá. Bez souhlasu funguje všechno stejně. '
      + '<a href="https://policies.google.com/technologies/partner-sites?hl=cs" target="_blank" rel="noopener">Jak Google data zpracovává</a></p>'
      + '<div class="cc-btns"><button type="button" class="btn" data-v="denied">Odmítnout</button><button type="button" class="btn" data-v="granted">Přijmout</button></div>';
    el.addEventListener('click', (e) => {
      const v = e.target.closest('button')?.dataset.v;
      if (!v) return;
      write(v);
      if (v === 'granted') grant(); else deny();
      el.hidden = true;
    });
    document.body.appendChild(el);
  }

  function init() {
    const st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
    // patičku sdílí s feedback.js; kdo přijde první, ten ji založí
    let foot = document.querySelector('.cc-foot');
    if (!foot) {
      foot = document.createElement('footer');
      foot.className = 'cc-foot';
      (document.querySelector('.app') || document.body.lastElementChild).after(foot);
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Nastavení cookies';
    btn.addEventListener('click', bar);
    foot.append(btn);
    if (!choice) bar();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
