import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * useMxFieldPopover — interne au tronc, HORS BARREL (voir index.ts).
 *
 * LOT PICKERS-MX, S2. Ancrage « popover sous le champ » partage par
 * MxDatePicker / MxTimePicker / MxDateTimePicker / MxDateRangePicker — MEME
 * mecanique que MxMenu (position:fixed, recalcule au resize/scroll, clic
 * exterieur ferme, jamais conditionne a la resolution de la position tant que
 * `open` est vrai), simplifiee : un seul declencheur, pas de navigation
 * clavier de LISTE a porter ici (le calendrier/horloge gerent la leur).
 *
 * Reprend le PRINCIPE de MxMenu plutot que de l'importer : MxMenu impose
 * `role="menu"` et une liste `groups`/`actions`, non pertinents pour un
 * panneau de calendrier. Duplication volontaire d'un mecanisme court (~40
 * lignes), pas d'un composant entier.
 */
export interface MxFieldPopoverPosition {
  top: number | 'auto';
  left: number;
}

const OFFSCREEN: MxFieldPopoverPosition = { top: -9999, left: -9999 };
// 6px : ecart declencheur/panneau du catalogue (picker-popup `top:calc(100% + 6px)`),
// meme valeur que PANEL_GAP de MxMenu.
const GAP = 'calc(6px * var(--mx-scale, 1))';

export function useMxFieldPopover(open: boolean, onClose: () => void) {
  const triggerRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<MxFieldPopoverPosition>(OFFSCREEN);

  // `onClose` est le plus souvent une closure inline recreee a chaque rendu de
  // l'appelant (ex. `const close = () => setOpen(false)`). La lire via une ref
  // plutot qu'en dependance de useCallback garde `recompute`/`setPanelRef`
  // STABLES sur toute la duree de vie du composant : sans cette indirection,
  // une identite d'`onClose` qui change a chaque rendu rendrait `setPanelRef`
  // instable, et comme il est pose en `ref` sur le panneau, React le
  // rappellerait (null puis noeud) a CHAQUE rendu — `recompute` reappellerait
  // `setPos`, provoquant un rendu de plus : boucle infinie ("Maximum update
  // depth exceeded"), observee en test (LOT PICKERS-MX, S2).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const recompute = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const offscreen =
      rect.bottom <= 0 || rect.top >= window.innerHeight || rect.right <= 0 || rect.left >= window.innerWidth;
    if (offscreen) {
      onCloseRef.current();
      return;
    }
    const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    const viewportRight = window.innerWidth - scrollbarWidth;
    const panelEl = panelRef.current;
    const panelWidth = panelEl?.offsetWidth ?? 0;
    const panelHeight = panelEl?.offsetHeight ?? 0;

    let left = rect.left;
    if (panelWidth > 0 && left + panelWidth > viewportRight) {
      left = Math.max(0, rect.right - panelWidth);
    }
    let top: number | 'auto' = rect.bottom;
    if (panelHeight > 0 && rect.bottom + panelHeight > window.innerHeight) {
      // Deborderait en bas : bascule au-dessus du champ si la place y est meilleure.
      top = Math.max(0, rect.top - panelHeight);
    }
    setPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPos(OFFSCREEN);
      return;
    }
    recompute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    return () => {
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
  }, [open, recompute]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open, onClose]);

  const setPanelRef = useCallback(
    (node: HTMLDivElement | null) => {
      panelRef.current = node;
      if (node) recompute();
    },
    [recompute],
  );

  return { triggerRef, setPanelRef, pos, gap: GAP };
}

export default useMxFieldPopover;
