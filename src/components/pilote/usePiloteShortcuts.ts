import { useEffect, useRef } from 'react';

// Raccourcis clavier de PILOTE. Ils ne se déclenchent jamais pendant une saisie (champ, liste déroulante) ni quand une fenêtre ou une fiche est ouverte.
// Clés : « / », « n », « t », « ArrowLeft », « ArrowRight », « ? » et « ctrl+z ».
export type ShortcutMap = Partial<Record<'/' | 'n' | 't' | 'ArrowLeft' | 'ArrowRight' | '?' | 'ctrl+z', () => void>>;

export function usePiloteShortcuts(map: ShortcutMap, enabled = true): void {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey) return;
      const el = e.target as HTMLElement | null;
      // Une saisie de texte, une liste déroulante ou un champ modifiable : pas de raccourci (une case à cocher ou un bouton, si)
      const NOT_TEXT = ['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image'];
      const typing = !!el && (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable || (el.tagName === 'INPUT' && !NOT_TEXT.includes((el as HTMLInputElement).type)));
      const key = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' ? 'ctrl+z' : e.ctrlKey || e.metaKey ? '' : e.key;
      const run = ref.current[key as keyof ShortcutMap];
      if (!run || typing) return;
      // Fenêtre ou fiche OUVERTE : les volets fermés restent dans la page (cachés, « inert »), ils ne comptent pas
      if (document.querySelector('[role="dialog"]:not([aria-hidden="true"]):not([inert]), [aria-modal="true"]:not([aria-hidden="true"]):not([inert])')) return;
      e.preventDefault();
      run();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
