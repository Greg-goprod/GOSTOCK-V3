import { Grid3x3, List } from 'lucide-react';

import { MxSegmented, type MxSegmentedOption } from './MxSegmented';

/**
 * MxEntityViewToggle -- LOT VUES-CARTES-LISTE, V2 (Greg, 2026-10-16).
 * Bascule de vue UNIQUE du tronc : « toute page de liste d'entites propose
 * une bascule cartes / liste... memes icones et libelles sur toutes les
 * pages » -- auparavant, chaque page composait sa propre `MxSegmented` avec
 * ses propres options (ex. `ArtistesListMx` : `grid`/`list`, cles i18n
 * dediees). Ce composant FIXE les valeurs (`cards`/`list`), les icones
 * (`Grid3x3`/`List`, memes que l'ancienne bascule Artistes) et les libelles
 * (« Cartes »/« Liste »), consommes EN `iconOnly` (seul le libelle textuel
 * change, jamais affiche -- sert de nom accessible/`title` au bouton, voir
 * `MxSegmented`) -- une page ne peut donc plus faire deriver le texte ou les
 * icones d'une page a l'autre.
 *
 * Libelles EN DUR (pas de cle i18n) : ce composant est un CONTROLE
 * TRANSVERSE dont l'identite visuelle doit rester identique quelle que soit
 * la page -- le confier a l'i18n par page recree le risque de divergence
 * que ce lot corrige (cf. l'ancienne paire `artists_mx.view_cards`/
 * `view_table`, propre a Artistes, desormais remplacee ici).
 */
export type MxEntityViewMode = 'cards' | 'list';

export interface MxEntityViewToggleProps {
  value: MxEntityViewMode;
  onChange: (mode: MxEntityViewMode) => void;
  /** Nom accessible du radiogroup -- par defaut "Mode d'affichage", a preciser si le contexte l'exige (ex. "Mode d'affichage des offres"). */
  'aria-label'?: string;
}

const OPTIONS: MxSegmentedOption[] = [
  { value: 'cards', label: 'Cartes', icon: Grid3x3 },
  { value: 'list', label: 'Liste', icon: List },
];

export function MxEntityViewToggle({
  value,
  onChange,
  'aria-label': ariaLabel = "Mode d'affichage",
}: MxEntityViewToggleProps) {
  return (
    <MxSegmented
      aria-label={ariaLabel}
      options={OPTIONS}
      value={value}
      onChange={(next) => onChange(next as MxEntityViewMode)}
      iconOnly
    />
  );
}

export default MxEntityViewToggle;
