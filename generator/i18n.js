// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Miloslav Brada
//
// Jazyk textů v JS. page.html je česky; build.sh z ní složí i anglickou verzi (dist/en/),
// kde statické HTML přeloží podle page.en.py a dá do <html lang="en"> a <div class="app" lang="en">.
// Každý text v kódu je dvakrát vedle sebe: T('česky', 'English') – při úpravě češtiny je hned
// vidět i angličtina. Jazyk se bere z obsahu stránky (.app[lang]), aby page.html jako Claude
// Artifact zůstala česká, ať má obálka jakýkoli <html lang>. Ve workeru a v Node (testy)
// document není – tam je čeština.
const doc = typeof document !== 'undefined' ? document : null;
const root = doc && (doc.querySelector('.app[lang]') || doc.documentElement);

export const LANG = root && /^en\b/i.test(root.lang || '') ? 'en' : 'cs';
export const T = (cs, en) => (LANG === 'en' ? en : cs);
export const LOCALE = T('cs-CZ', 'en-US');
// desetinná čárka česky, tečka anglicky
export const dec = (v) => (LANG === 'en' ? String(v) : String(v).replace('.', ','));
