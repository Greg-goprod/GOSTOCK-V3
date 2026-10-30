import type { CSSProperties } from 'react';

/**
 * MX_VISUALLY_HIDDEN — libelle/texte masque visuellement, nom accessible
 * conserve ("sr-only"). EXTRAIT (LOT ARTISTES-LISTE, C2.3, 2026-10-03) de
 * MxFields.tsx (FieldShell) et MxTagInput.tsx, qui en avaient chacun une
 * copie locale identique (`SR_ONLY`) — valeur INCHANGEE, substitution
 * purement structurelle, meme motif que GROUP_LABEL_STYLE (mxGroupLabel.ts).
 *
 * CORRECTIF C2.3 : ce style pose `position:'absolute'` SANS `top`/`left`
 * explicites. Un `position:absolute` sans ancetre positionne (aucun
 * `position:relative/absolute/fixed/sticky` entre lui et `<html>`) prend
 * `<html>` comme bloc englobant ; sa "position statique" (ou il atterrit
 * faute de `top`/`left`) se calcule alors par rapport au flux ENTIER du
 * document, pas par rapport a la zone defilante qui le contient visuellement
 * — s'il est loin dans une liste/grille longue, ce calcul l'ancre tres bas,
 * et `html.scrollHeight` s'etire jusque-la (bug mesure sur la page Artistes :
 * le libelle cache du select de pagination etirait `html` a ~2454px pour une
 * fenetre de 1031px). TOUJOURS utiliser ce style a l'interieur d'un ancetre
 * `position:'relative'` (ou toute autre valeur de `position` non statique) —
 * les deux appelants ci-dessus posent desormais ce `position:'relative'` sur
 * le conteneur immediat du libelle pour cette raison exacte.
 */
export const MX_VISUALLY_HIDDEN: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};
