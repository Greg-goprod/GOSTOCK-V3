import type { CSSProperties, ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { MX_TEXT } from './tokens';
import { MxIconButton } from './MxIconButton';
import { MxSelectField, type MxSelectOption } from './MxFields';

/**
 * MxPagination — LOT ARTISTES-LISTE, C3.2 (2026-10-04). Pagination compacte
 * et REUTILISABLE du tronc : extraite de la barre de pagination (en bas de
 * page) d'`ArtistesListMx` (C2), qui composait a la main les memes 4
 * elements (precedent/suivant, « page sur total », total, nombre par page) —
 * destinee a devenir l'emplacement `pagination` de `MxToolbar` (C3.1) pour
 * Artistes D'ABORD, puis Contrats/Notifications dans un lot ultérieur (voir
 * `docs/design/handoff-mannyx-ds/DOCTRINE-BARRE-OUTILS.md`).
 *
 * AUCUN LIBELLE EN DUR (regle du tronc) : `previousLabel`/`nextLabel`
 * (aria-label des 2 `MxIconButton`) et `pageSizeLabel` (nom accessible du
 * select, hideLabel) sont des props i18n DEJA traduites par l'appelant,
 * meme convention que `aria-label` de `MxSegmented`/`label` de `MxTabs` : ce
 * composant ne resout jamais lui-meme de cle.
 *
 * `totalLabel` — texte DEJA compose par l'appelant (ex. « 163 artistes »,
 * singulier/pluriel resolu cote appelant via `_one`/`_many`, meme
 * convention que `notification_panel.group_count_one/_many`) : le mot
 * (« artistes », « contrats »…) varie par entite, le tronc ne le connait
 * jamais. Optionnel — absent, rien n'est affiche a cet endroit (ex. un
 * appelant qui n'a pas encore de texte de total pret).
 *
 * `« {currentPage} / {totalPages} »` — PAS de mot (« sur »/« of »/« von »,
 * cle `of` deja existante ailleurs dans le projet) : un simple « / » n'a
 * besoin d'aucune traduction, decision explicite de Greg (C3.2) pour CE
 * composant precis. La cle `of` reste utilisee par d'autres call sites
 * (hors perimetre de ce lot) : seul l'appel dans ArtistesListMx est
 * remplace par ce composant, la cle elle-meme n'est pas touchee.
 *
 * `onPageChange` recoit toujours une valeur DEJA bornee a `[1, totalPages]`
 * (le composant fait le `Math.max`/`Math.min` lui-meme, comme le faisait
 * l'ancienne barre) : l'appelant n'a jamais besoin de re-clamper.
 *
 * Boutons desactives aux extremites (`currentPage <= 1` / `currentPage >=
 * totalPages`) — meme regle que l'ancienne barre, portee ici une fois pour
 * tous les futurs appelants.
 */
export interface MxPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** aria-label du bouton « page precedente ». */
  previousLabel: string;
  /** aria-label du bouton « page suivante ». */
  nextLabel: string;
  /** Texte de total DEJA compose (ex. « 163 artistes ») — absent, rien n'est rendu. */
  totalLabel?: ReactNode;
  pageSize: number;
  pageSizeOptions: MxSelectOption[];
  onPageSizeChange: (size: number) => void;
  /** Nom accessible du select (hideLabel) — DEJA traduit par l'appelant. */
  pageSizeLabel: string;
  className?: string;
  style?: CSSProperties;
}

const META_TEXT: CSSProperties = {
  ...MX_TEXT.help,
  color: 'var(--mx-text3)',
  whiteSpace: 'nowrap',
};

export function MxPagination({
  currentPage,
  totalPages,
  onPageChange,
  previousLabel,
  nextLabel,
  totalLabel,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
  pageSizeLabel,
  className,
  style,
}: MxPaginationProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--mx-space-8)',
        flexWrap: 'wrap',
        ...style,
      }}
    >
      <MxIconButton
        icon={ChevronLeft}
        aria-label={previousLabel}
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage <= 1}
      />
      <span style={META_TEXT}>{`${currentPage} / ${totalPages}`}</span>
      <MxIconButton
        icon={ChevronRight}
        aria-label={nextLabel}
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage >= totalPages}
      />
      {totalLabel ? <span style={META_TEXT}>{'\u00b7'} {totalLabel}</span> : null}
      <div style={{ width: 'calc(90px * var(--mx-scale, 1))' }}>
        <MxSelectField
          label={pageSizeLabel}
          hideLabel
          value={String(pageSize)}
          onChange={(next) => onPageSizeChange(Number(next))}
          options={pageSizeOptions}
        />
      </div>
    </div>
  );
}

export default MxPagination;
