// Traduction de l'interface (allemand, italien, anglais) sans toucher au code des pages :
// les textes français affichés sont remplacés à la volée d'après un dictionnaire « texte français → traduction ».
// Les textes avec des parties variables (« {0} articles en sa possession ») sont reconnus par motif.
// Les données (noms d'articles, de personnes, chantiers) ne sont jamais traduites : seules les phrases connues le sont.

export type Language = 'fr' | 'de' | 'it' | 'en';
export const LANGUAGES: { id: Language; label: string }[] = [
  { id: 'fr', label: 'Français' },
  { id: 'de', label: 'Deutsch' },
  { id: 'it', label: 'Italiano' },
  { id: 'en', label: 'English' },
];

const STORAGE_KEY = 'gomat-language';
const ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'alt'];
const SKIP = 'script, style, textarea, code, pre, [translate="no"], .notranslate';

interface Pattern {
  regex: RegExp;
  target: string;
}

let current: Language = 'fr';
let exact = new Map<string, string>();
// Titres écrits en majuscules (« CHANTIERS ») : retrouvés sans tenir compte de la casse
let upper = new Map<string, string>();
let patterns: Pattern[] = [];
let observer: MutationObserver | null = null;
// Texte d'origine (français) et traduction posée, par nœud : React peut réécrire le texte à tout moment
const textState = new WeakMap<Text, { source: string; shown: string }>();
const attrState = new WeakMap<Element, Map<string, { source: string; shown: string }>>();

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const compile = (dictionary: Record<string, string>) => {
  exact = new Map();
  upper = new Map();
  patterns = [];
  for (const [source, target] of Object.entries(dictionary)) {
    if (!target) continue;
    if (/\{\d\}/.test(source)) {
      // « {0} articles » → ^(.+?) articles$ ; les variables gardent leur valeur
      const regex = new RegExp(`^${source.split(/(\{\d\})/).map(part => (/^\{\d\}$/.test(part) ? '([\\s\\S]*?)' : escapeRegex(part))).join('')}$`);
      patterns.push({ regex, target });
    } else {
      exact.set(source, target);
      if (!upper.has(source.toUpperCase())) upper.set(source.toUpperCase(), target.toUpperCase());
    }
  }
  // Les motifs les plus précis d'abord (plus de texte fixe)
  patterns.sort((a, b) => b.regex.source.replace(/\(\[\\s\\S\]\*\?\)/g, '').length - a.regex.source.replace(/\(\[\\s\\S\]\*\?\)/g, '').length);
};

export const translateText = (text: string): string => {
  if (current === 'fr' || !text) return text;
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (!trimmed || !/[a-zA-ZÀ-ÿ]/.test(trimmed)) return text;
  let result = exact.get(trimmed) ?? (trimmed === trimmed.toUpperCase() ? upper.get(trimmed) : undefined);
  if (result === undefined) {
    for (const p of patterns) {
      const m = trimmed.match(p.regex);
      if (m) {
        // Une variable peut elle-même être un texte connu (« État : En retard »)
        result = p.target.replace(/\{(\d)\}/g, (_, i) => {
          const value = m[Number(i) + 1] ?? '';
          return exact.get(value.trim()) ?? value;
        });
        break;
      }
    }
  }
  if (result === undefined) return text;
  // Les espaces autour du texte (mise en page JSX) sont conservés
  const lead = text.match(/^\s*/)?.[0] ?? '';
  const trail = text.match(/\s*$/)?.[0] ?? '';
  return lead + result + trail;
};

const skipped = (el: Element | null) => Boolean(el?.closest(SKIP));

const translateTextNode = (node: Text) => {
  if (skipped(node.parentElement)) return;
  const value = node.nodeValue ?? '';
  const state = textState.get(node);
  if (state && value === state.shown) return;
  const source = value;
  const shown = translateText(source);
  textState.set(node, { source, shown });
  if (shown !== value) node.nodeValue = shown;
};

const translateAttributes = (el: Element) => {
  if (skipped(el)) return;
  for (const name of ATTRIBUTES) {
    const value = el.getAttribute(name);
    if (value === null) continue;
    let states = attrState.get(el);
    const state = states?.get(name);
    if (state && value === state.shown) continue;
    const shown = translateText(value);
    if (!states) attrState.set(el, (states = new Map()));
    states.set(name, { source: value, shown });
    if (shown !== value) el.setAttribute(name, shown);
  }
};

const walk = (root: Node) => {
  if (root.nodeType === Node.TEXT_NODE) return translateTextNode(root as Text);
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  translateAttributes(root as Element);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) translateTextNode(node as Text);
    else translateAttributes(node as Element);
    node = walker.nextNode();
  }
};

// Retour au français : chaque nœud reprend son texte d'origine
const restore = (root: Node) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let node: Node | null = root;
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const state = textState.get(node as Text);
      if (state && node.nodeValue === state.shown) node.nodeValue = state.source;
      textState.delete(node as Text);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const states = attrState.get(node as Element);
      states?.forEach((s, name) => { if ((node as Element).getAttribute(name) === s.shown) (node as Element).setAttribute(name, s.source); });
      attrState.delete(node as Element);
    }
    node = walker.nextNode();
  }
};

const start = () => {
  if (observer) return;
  observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      if (m.type === 'characterData') translateTextNode(m.target as Text);
      else if (m.type === 'attributes') translateAttributes(m.target as Element);
      else m.addedNodes.forEach(walk);
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTES });
  walk(document.body);
};

// Boîtes de dialogue du navigateur (confirmations, saisies) traduites aussi
const nativeConfirm = window.confirm.bind(window);
const nativePrompt = window.prompt.bind(window);
const nativeAlert = window.alert.bind(window);
window.confirm = (message?: string) => nativeConfirm(translateText(message ?? ''));
window.prompt = (message?: string, value?: string) => nativePrompt(translateText(message ?? ''), value);
window.alert = (message?: unknown) => nativeAlert(translateText(String(message ?? '')));

// Dates (jours, mois) dans la langue choisie : le code demande « fr-CH », on répond dans la langue courante
const swissLocale = (locales?: Intl.LocalesArgument) => (current !== 'fr' && (locales === 'fr-CH' || locales === 'fr') ? `${current}-CH` : locales);
for (const method of ['toLocaleDateString', 'toLocaleString', 'toLocaleTimeString'] as const) {
  const native = Date.prototype[method];
  Date.prototype[method] = function (this: Date, locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) {
    return native.call(this, swissLocale(locales), options);
  };
}

const loaders: Record<Exclude<Language, 'fr'>, () => Promise<{ default: Record<string, string> }>> = {
  de: () => import('./de.json'),
  it: () => import('./it.json'),
  en: () => import('./en.json'),
};

export const getLanguage = () => current;

export async function setLanguage(language: Language) {
  try { localStorage.setItem(STORAGE_KEY, language); } catch { /* stockage indisponible */ }
  document.documentElement.lang = language;
  if (language === 'fr') {
    current = 'fr';
    observer?.disconnect();
    observer = null;
    restore(document.body);
    return;
  }
  const dictionary = (await loaders[language]()).default;
  if (current !== 'fr') restore(document.body);
  compile(dictionary);
  current = language;
  start();
  walk(document.body);
}

// Langue enregistrée, sinon celle du navigateur si elle est proposée
export function initLanguage() {
  let saved: string | null = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* stockage indisponible */ }
  const browser = navigator.language.slice(0, 2);
  const language = (LANGUAGES.some(l => l.id === saved) ? saved : LANGUAGES.some(l => l.id === browser) ? browser : 'fr') as Language;
  if (language !== 'fr') setLanguage(language);
  else document.documentElement.lang = 'fr';
}
