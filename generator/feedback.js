// Zpětná vazba: tlačítko pod častými otázkami a v patičce otevře formulář, který zprávu pošle
// na api/zpetna-vazba (služba v zpetna-vazba/ z ní založí issue v Gitea). Jen pro samostatný web:
// build.sh skript vloží do <head>; v Claude Artifact (page.html) žádný backend není.
// K hlášení se dá přiložit aktuální nastavení – stránka ho průběžně ukládá do localStorage.
import { DEFAULTS } from './gen.js';

const API = 'api/zpetna-vazba';
const PARAMS_KEY = 'segmentovka.params.v1';
const DRAFT_KEY = 'segmentovka.feedback.draft';
const KINDS = [
  ['chyba', 'Chyba', 'Co jste dělali, co se stalo a co jste čekali?'],
  ['napad', 'Nápad', 'Co by generátor měl umět?'],
  ['dotaz', 'Dotaz', 'Na co se chcete zeptat?'],
  ['jine', 'Jiné', 'Co nám chcete vzkázat?'],
];

const css = `
.fb { width: 520px; max-width: calc(100vw - 32px); max-height: calc(100dvh - 32px); padding: 0; overflow: auto;
  background: var(--panel); color: var(--ink); border: 1px solid var(--line); border-radius: var(--r);
  box-shadow: 0 12px 40px rgb(0 0 0 / 0.35); }
.fb::backdrop { background: rgb(0 0 0 / 0.45); }
.fb form, .fb .fb-done { display: grid; gap: 12px; padding: 18px 20px 20px; }
.fb-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.fb-head h2 { font-size: 19px; font-weight: 750; }
.fb-x { border: 0; background: none; font-size: 24px; line-height: 1; padding: 2px 6px; cursor: pointer; color: var(--muted); border-radius: 4px; }
.fb-x:hover { color: var(--ink); }
.fb p { margin: 0; }
.fb-lead { color: var(--muted); }
.fb fieldset { border: 0; margin: 0; padding: 0; display: grid; gap: 6px; }
.fb legend, .fb-label { font-weight: 600; padding: 0; }
.fb-label span, .fb-check span { font-weight: 400; color: var(--muted); }
.fb-kinds { display: flex; flex-wrap: wrap; gap: 6px; }
.fb-kinds label { position: relative; }
.fb-kinds input { position: absolute; opacity: 0; inset: 0; margin: 0; cursor: pointer; }
.fb-kinds span { display: block; border: 1px solid var(--line); background: var(--bg); border-radius: 999px; padding: 4px 14px; cursor: pointer; }
.fb-kinds input:checked + span { background: var(--led); border-color: var(--led); color: var(--led-ink); font-weight: 700; }
.fb-kinds input:focus-visible + span { outline: 2px solid var(--focus); outline-offset: 2px; }
.fb-field { display: grid; gap: 4px; }
.fb textarea, .fb input[type="email"] { font: inherit; color: inherit; width: 100%; border: 1px solid var(--line); border-radius: 5px; background: var(--bg); padding: 7px 9px; }
.fb textarea { resize: vertical; min-height: 7.5em; }
.fb-count { justify-self: end; font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
.fb-check { display: grid; grid-template-columns: auto 1fr; gap: 2px 8px; align-items: start; cursor: pointer; }
.fb-check input { accent-color: var(--led); width: 17px; height: 17px; margin: 2px 0 0; }
.fb-check span { grid-column: 2; font-size: 13px; }
.fb-hp { position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden; }
.fb-note { font-size: 13px; color: var(--muted); }
.fb-msg:empty { display: none; }
.fb-msg { background: var(--warn-bg); color: var(--warn-ink); border-radius: 5px; padding: 8px 10px; font-size: 14px; }
.fb-btns { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
.fb-btns .btn { min-width: 110px; }
.fb .btn:disabled { cursor: progress; }
.fb-done .fb-big { font-size: 17px; font-weight: 700; }
.fb-cta { border-top: 1px solid var(--line); padding-top: 12px; display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; justify-content: space-between; }
.fb-cta p { margin: 0; color: var(--muted); max-width: 46ch; }
.cc-foot { display: flex; justify-content: center; flex-wrap: wrap; gap: 4px 18px; }
@media (max-width: 480px) { .fb form, .fb .fb-done { padding: 16px; } .fb-btns .btn { flex: 1; } }
`;

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* koncept se neuloží, nevadí */ } },
  del(k) { try { localStorage.removeItem(k); } catch (_) { /* nevadí */ } },
};

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Aktuální nastavení generátoru a parametry, které se liší od výchozích. Stránka ukládá
// parametry až po první změně, takže prázdné úložiště znamená výchozí; null = úložiště nejde.
function settings() {
  let p;
  try { p = JSON.parse(localStorage.getItem(PARAMS_KEY) || '{}'); } catch (_) { return null; }
  const params = { ...DEFAULTS, ...(p && typeof p === 'object' ? p : {}) };
  const changed = Object.keys(DEFAULTS).filter((k) => !same(params[k], DEFAULTS[k])).map((k) => [k, params[k], DEFAULTS[k]]);
  return { params, changed };
}

function context() {
  const warn = document.getElementById('warnings');
  const st = document.getElementById('status');
  const tab = document.querySelector('.tab[aria-selected="true"]');
  return {
    lang: navigator.language || '',
    viewport: `${innerWidth}×${innerHeight}`,
    screen: `${screen.width}×${screen.height} @${Math.round(devicePixelRatio * 100) / 100}x`,
    view: tab ? tab.textContent.trim() : '',
    warnings: warn && !warn.hidden ? warn.innerText.trim() : '',
    status: st && st.classList.contains('err') ? st.textContent.trim() : '',
  };
}

const plural = (n, one, few, many) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many);

let dlg = null;
let openedAt = 0;
let opener = null;

function build() {
  const st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);
  dlg = document.createElement('dialog');
  dlg.className = 'fb';
  dlg.setAttribute('aria-labelledby', 'fb-t');
  dlg.innerHTML = `
<form novalidate>
  <div class="fb-head"><h2 id="fb-t">Zpětná vazba</h2><button type="button" class="fb-x" data-close aria-label="Zavřít">×</button></div>
  <p class="fb-lead">Narazili jste na chybu, chybí vám nějaká funkce, nebo si nevíte rady? Zprávu dostane přímo autor generátoru.</p>
  <fieldset>
    <legend>O co jde</legend>
    <div class="fb-kinds">${KINDS.map(([v, l]) => `<label><input type="radio" name="kind" value="${v}"><span>${l}</span></label>`).join('')}</div>
  </fieldset>
  <div class="fb-field">
    <label class="fb-label" for="fb-text">Zpráva</label>
    <textarea id="fb-text" name="message" rows="6" maxlength="5000" required></textarea>
    <span class="fb-count" id="fb-count" aria-live="off"></span>
  </div>
  <div class="fb-field">
    <label class="fb-label" for="fb-email">E-mail <span>– nepovinný, jen pokud chcete odpověď</span></label>
    <input id="fb-email" name="email" type="email" maxlength="200" autocomplete="email" inputmode="email" spellcheck="false">
  </div>
  <label class="fb-check"><input type="checkbox" name="attach" checked>Přiložit nastavení generátoru<span id="fb-attach-note"></span></label>
  <div class="fb-hp" aria-hidden="true"><label>Web <input name="website" tabindex="-1" autocomplete="off"></label></div>
  <p class="fb-note">Zpráva se uloží jako úkol v systému Gitea na serveru autora a nikam jinam neodchází. Přiloží se k ní typ prohlížeče a velikost okna. E-mail poslouží jen k odpovědi.</p>
  <p class="fb-msg" id="fb-msg" role="alert"></p>
  <div class="fb-btns"><button type="button" class="btn" data-close>Zrušit</button><button type="submit" class="btn primary">Odeslat</button></div>
</form>
<div class="fb-done" hidden>
  <div class="fb-head"><h2 tabindex="-1">Děkujeme</h2><button type="button" class="fb-x" data-close aria-label="Zavřít">×</button></div>
  <p class="fb-big">Zpráva dorazila.</p>
  <p class="fb-reply"></p>
  <div class="fb-btns"><button type="button" class="btn primary" data-close>Zavřít</button></div>
</div>`;
  document.body.appendChild(dlg);

  const form = dlg.querySelector('form');
  const text = form.message;
  const count = dlg.querySelector('#fb-count');
  const updateCount = () => { count.textContent = text.value.length > 4000 ? `${text.value.length} / 5000` : ''; };
  const saveDraft = () => store.set(DRAFT_KEY, { kind: form.kind.value, message: text.value, email: form.email.value });

  form.addEventListener('input', () => { saveDraft(); updateCount(); setMsg(''); });
  form.addEventListener('change', (e) => {
    if (e.target.name === 'kind') text.placeholder = KINDS.find((k) => k[0] === e.target.value)[2];
    saveDraft();
  });
  // kliknutí vedle dialog nezavírá – tažením výběru textu ven by se omylem zavřel
  dlg.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) dlg.close(); });
  dlg.addEventListener('close', () => { if (opener && opener.isConnected) opener.focus(); });
  form.addEventListener('submit', (e) => { e.preventDefault(); send(form); });

  dlg.updateCount = updateCount;
}

function setMsg(s) { dlg.querySelector('#fb-msg').textContent = s; }

function open(e) {
  if (!dlg) build();
  opener = e && e.currentTarget;
  const form = dlg.querySelector('form');
  const done = dlg.querySelector('.fb-done');
  if (!done.hidden) { done.hidden = true; form.hidden = false; form.reset(); }
  const draft = store.get(DRAFT_KEY);
  if (draft && !form.message.value) {
    if (draft.kind) { const r = form.querySelector(`input[name="kind"][value="${CSS.escape(draft.kind)}"]`); if (r) r.checked = true; }
    form.message.value = draft.message || '';
    form.email.value = draft.email || '';
  }
  const kind = KINDS.find((k) => k[0] === form.kind.value);
  form.message.placeholder = kind ? kind[2] : 'Napište, co máte na srdci.';
  dlg.updateCount();

  const s = settings();
  const note = dlg.querySelector('#fb-attach-note');
  form.attach.disabled = !s;
  if (s) {
    const n = s.changed.filter(([k]) => k !== 'layout').length;
    note.textContent = `rozložení „${s.params.layout}“ a ${n ? `${n} ${plural(n, 'změněný parametr', 'změněné parametry', 'změněných parametrů')}` : 'jinak výchozí parametry'} – pomůže chybu zopakovat`;
  } else {
    note.textContent = 'nastavení se nepodařilo zjistit (prohlížeč nepovoluje úložiště)';
    form.attach.checked = false;
  }
  setMsg('');
  openedAt = Date.now();
  dlg.showModal();
  (form.kind.value ? form.message : form.querySelector('input[name="kind"]')).focus();
}

async function send(form) {
  const kind = form.kind.value;
  const message = form.message.value.trim();
  const email = form.email.value.trim();
  if (!kind) { setMsg('Vyberte, o co jde.'); form.querySelector('input[name="kind"]').focus(); return; }
  if (message.length < 3) { setMsg('Napište prosím zprávu.'); form.message.focus(); return; }
  if (email && !form.email.checkValidity()) { setMsg('E-mail nevypadá správně. Opravte ho, nebo pole nechte prázdné.'); form.email.focus(); return; }

  const payload = { kind, message, email, website: form.website.value, elapsed: Date.now() - openedAt, context: context() };
  const s = form.attach.checked && settings();
  if (s) { payload.params = s.params; payload.changed = s.changed; }

  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Odesílám…';
  setMsg('');
  try {
    const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '');
    store.del(DRAFT_KEY);
    const done = dlg.querySelector('.fb-done');
    done.querySelector('.fb-reply').textContent = email
      ? `Kdyby bylo potřeba něco doplnit nebo odpovědět, ozveme se na ${email}.`
      : 'Bez e-mailu vám nemůžeme odpovědět, ale zprávu si přečteme.';
    form.hidden = true;
    form.reset();
    done.hidden = false;
    done.querySelector('h2').focus();
    if (window.gtag) window.gtag('event', 'feedback_sent', { kind });
  } catch (err) {
    setMsg(err.message || 'Zprávu se nepodařilo odeslat. Zkontrolujte připojení k internetu a zkuste to znovu – text zůstal ve formuláři.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Odeslat';
  }
}

function button(cls, label) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.textContent = label;
  b.addEventListener('click', open);
  return b;
}

function init() {
  const faq = document.querySelector('.about-faq');
  if (faq) {
    const cta = document.createElement('div');
    cta.className = 'fb-cta';
    cta.innerHTML = '<p>Nenašli jste odpověď, něco nefunguje nebo máte nápad?</p>';
    cta.append(button('btn', 'Napsat zpětnou vazbu'));
    faq.append(cta);
  }
  // patičku sdílí s consent.js; kdo přijde první, ten ji založí
  let foot = document.querySelector('.cc-foot');
  if (!foot) {
    foot = document.createElement('footer');
    foot.className = 'cc-foot';
    (document.querySelector('.app') || document.body.lastElementChild).after(foot);
  }
  foot.prepend(button('', 'Zpětná vazba'));
  if (location.hash === '#zpetna-vazba') open();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
