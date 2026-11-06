import type { CSSProperties } from 'react';

import { MX_TEXT, MX_TONE_FILL, type MxTone } from './tokens';

/**
 * MxCountBadge — LOT NOTIFICATIONS B1 (2026-09-30). Pastille de COMPTEUR
 * (nombre), pensee pour etre surimprimee au coin d'un MxIconButton — jamais
 * une etiquette de TEXTE (c'est le role de MxBadge, rectangulaire, voir son
 * commentaire de bornage).
 *
 * DECORATIVE, jamais le porteur du nom accessible : `aria-hidden="true"` fixe,
 * non desactivable. Le compte doit etre annonce par le controle qui la porte
 * (ex. `aria-label` du bouton, "Notifications, 3 non lues") — jamais par le
 * contenu texte de cette pastille, que les lecteurs d'ecran doivent ignorer.
 * Aucun consommateur de ce tronc ne doit lire son `textContent` pour en tirer
 * une information : elle n'existe que pour l'oeil.
 *
 * PLAFOND : `count > max` affiche `${max}+` (defaut 99, donc "99+"). Reprend
 * le plafond de la pastille pre-existante de NotificationButton.tsx.
 *
 * MASQUEE a `count <= 0` : rend `null`, ne pose aucun noeud vide dans le DOM
 * (une pastille a "0" n'a pas de sens pour un compteur de non-lus).
 *
 * FORME : gelule courte (rayon --mx-radius-pill, jamais scale — meme motif que
 * MxAvatar), aplat SATURE du ton (MX_TONE_FILL, jamais delave — meme regle que
 * MxBadge/MxNote/MxDrawer, voir tokens.ts). Ton par defaut `accent` : reprend
 * la teinte violette de la pastille existante (bg-violetNeon-500), pas un rouge
 * d'alarme absent du langage visuel actuel du produit.
 */
export interface MxCountBadgeProps {
  /** Valeur a afficher. `count <= 0` masque la pastille (rend `null`). */
  count: number;
  /** Plafond d'affichage. Au-dela, affiche `${max}+`. Defaut 99. */
  max?: number;
  tone?: MxTone;
  className?: string;
  style?: CSSProperties;
}

export function MxCountBadge({
  count,
  max = 99,
  tone = 'accent',
  className,
  style,
}: MxCountBadgeProps) {
  if (count <= 0) return null;

  const fill = MX_TONE_FILL[tone];
  const label = count > max ? `${max}+` : String(count);

  return (
    <span aria-hidden="true" className={className} style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxSizing: 'border-box',
      minWidth: 'var(--mx-countbadge-size)',
      height: 'var(--mx-countbadge-size)',
      padding: '0 var(--mx-space-4)',
      borderRadius: 'var(--mx-radius-pill)',
      background: fill.bg,
      color: fill.fg,
      ...MX_TEXT.badge,
      lineHeight: 1,
      whiteSpace: 'nowrap',
      ...style,
    }}>
      {label}
    </span>
  );
}

export default MxCountBadge;
