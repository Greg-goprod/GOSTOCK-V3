import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { MX_TEXT } from './tokens';
import { MxAvatar } from './MxAvatar';
import { validateMxTableColumns } from './mxTableValidation';

/**
 * MxTable — LOT ARTISTES-LISTE, B1 (2026-10-03). `MxTableIdentityCell`
 * recoit en C2.4 (meme lot, 2026-10-03) un `uppercaseName` optionnel,
 * voir son commentaire de tete.
 *
 * Source qui fait foi : `reference/Mannyx Components V2.html`, section
 * `#s-tables` (L.624-646) — `<table>` simple, en-tete `th` sur fond
 * `--mx-surface2`, cellule « identite » = carre d'initiales + nom en gras,
 * bouton `···` en fin de ligne pour les actions. Le catalogue NE maquette
 * NI tri cliquable, NI selection multiple, NI densite, NI defilement
 * horizontal pour ce composant — ces points sont inventes ici, a l'usage du
 * premier consommateur (`ArtistesPageViewMx`, B2).
 *
 * PAS DE SELECTION MULTIPLE (decision de Greg, Phase A de ce lot, confirmee
 * en B1) : aucun besoin reel observe dans le projet a ce jour. Ne pas en
 * ajouter sans un consommateur concret qui le demande — meme principe que
 * la palette categorielle (DOCTRINE-GRAPHIQUES.md, §5).
 *
 * COLONNES DECLARATIVES (`MxTableColumn<T>`) : l'appelant fournit `header`
 * (ReactNode, jamais resolu par le tronc — i18n reste a sa charge) et
 * `render(row)` (ReactNode QUELCONQUE) pour chaque colonne. Pas de type de
 * colonne special pour la cellule « identite » (MxAvatar + nom) : elle se
 * compose avec `render` comme n'importe quelle autre cellule, via
 * `MxTableIdentityCell` ci-dessous (helper, pas une colonne a part dans
 * l'API — une table qui n'a pas d'avatar n'a pas a l'importer).
 *
 * TRI : CONTROLE par l'appelant (`sortColumn`/`sortDirection`/`onSort`),
 * jamais calcule ici — la page garde l'entiere responsabilite du tri des
 * `rows` qu'elle transmet (Sens A : logique de tri inchangee, seul le
 * rendu de l'en-tete change). `aria-sort` pose sur le `<th>` (position ARIA
 * correcte, pas sur le bouton interieur), valeurs `'ascending'`/
 * `'descending'`/`'none'`. Indicateur visuel : `ChevronUp`/`ChevronDown`
 * (lucide-react), affiche uniquement sur la colonne triee.
 *
 * EN-TETES EN MAJUSCULES COMME LES ONGLETS : `MX_TEXT.segmentedLabel`
 * (12px/700/0.02em/majuscules) — MEME preset que les onglets (MxTabs/
 * MxTabPanels) et le bandeau de filtres (MxSegmented), pas un nouveau
 * reglage pour ce 3e consommateur.
 *
 * LIGNE CLIQUABLE, CLAVIER COMPRIS : si `onRowClick` est fourni, chaque
 * `<tr>` recoit `tabIndex=0`, `data-mx-focus=""` (anneau de focus clavier,
 * EXCEPTION 1/2 de tokens-mx.css) et un gestionnaire Entree/Espace en plus
 * du clic. Les colonnes marquees `interactive` (actions : menu « ··· »,
 * boutons) ARRETENT la propagation du clic ET du clavier vers la ligne —
 * sans cela, cliquer sur « Supprimer » ouvrirait AUSSI la fiche.
 *
 * ETATS VIDE/CHARGEMENT : `empty`/`loading` sont des `ReactNode` FOURNIS par
 * l'appelant (jamais resolus ici), rendus dans une ligne unique
 * `colSpan={columns.length}` — le tronc ne decide ni du texte ni de l'icone
 * (typiquement un `<MxEmpty>` pour `empty`, un `<MxLoadingLine>` pour
 * `loading`), seulement de leur emplacement dans la grille.
 *
 * DEFILEMENT HORIZONTAL DANS SON CONTENEUR : le wrapper (`overflowX:'auto'`)
 * est INTERNE a la primitive, pas a la charge de l'appelant — meme
 * raisonnement que le `overflow-x:auto` du bandeau `MxSegmented` de
 * `ContratsListMx` (`style={{ overflowX: 'auto' }}` pose par la PAGE,
 * faute d'une telle prise en charge interne a `MxSegmented`) : ici, puisque
 * c'est systematiquement necessaire a toute table un jour trop large, la
 * primitive la fournit elle-meme plutot que de l'imposer a chaque appelant.
 *
 * LARGEURS DE COLONNES DECLAREES, JAMAIS DEDUITES DU CONTENU — LOT
 * TABLE-MODELE (2026-10-16, retour de Greg : page Offres, vue « Qui doit
 * agir », colonne « Échéance » et menu « ··· » qui ne s'alignent pas d'une
 * section a l'autre). Cause : `table-layout: auto` (le defaut HTML) calcule
 * la largeur de chaque colonne a partir du CONTENU de CETTE table precise ;
 * deux `<table>` differents (une section = une instance `MxTable` separee)
 * avec le MEME jeu de colonnes mais des contenus differents (nom d'artiste
 * plus ou moins long, nombre de boutons d'action different selon le statut
 * de la ligne) aboutissent a des largeurs de colonnes DIFFERENTES — d'ou le
 * desalignement visuel entre sections empilees sur une meme page.
 *
 * Correctif : `table-layout: fixed` + un `<colgroup>` qui declare la largeur
 * de chaque colonne (`col.width`, ex. `'150px'`) via un `<col>` — la largeur
 * devient alors un CONTRAT, identique pour toute instance de `MxTable`
 * recevant le meme tableau `columns`, quel que soit le contenu des lignes.
 * AU PLUS UNE colonne par tableau peut omettre `width` : elle absorbe alors
 * tout l'espace restant (comportement natif de `table-layout:fixed` pour
 * une colonne `auto` unique — avec plusieurs colonnes `auto`, l'espace
 * restant serait partage A EGALITE entre elles, jamais ce qu'on veut ici).
 * `validateMxTableColumns` (fichier `mxTableValidation.ts`, separe pour
 * respecter `react-refresh/only-export-components`) verifie cette regle et
 * avertit en developpement (`console.warn`) si elle est violee — garde-fou
 * pour tout futur appelant, voir aussi `MxTable.test.tsx`.
 *
 * TRONCATURE : `col.truncate` coupe le contenu de la cellule avec une
 * ellipse CSS (`overflow:hidden` + `text-overflow:ellipsis` +
 * `white-space:nowrap`, necessite `table-layout:fixed` pour etre fiable) et
 * pose un `title` (infobulle navigateur standard) — `col.getTitle(row)` si
 * fourni, sinon le texte de `render(row)` SI c'est une chaine simple (aucun
 * texte derive d'un `ReactNode` complexe : pas de risque de `title`
 * incoherent avec un rendu riche comme `MxStatusPill`).
 *
 * COLONNE D'ACTIONS (`col.actionsColumn: true`) : doit etre la DERNIERE
 * colonne, avoir une largeur declaree, `align:'right'` et `interactive:
 * true` — regle du pied des drawers (`MxEntityActionFooter`) transposee a
 * la ligne de tableau : le bouton « ··· » (menu de debordement) toujours a
 * gauche DANS cette colonne, l'action principale toujours a droite en
 * variante primaire. Une largeur FIXE (pas a largeur variable selon le
 * nombre de boutons visibles sur la ligne) est ce qui garantit que le
 * bouton « ··· » reste au MEME endroit d'une ligne et d'une section a
 * l'autre — `validateMxTableColumns` verifie aussi cette regle.
 */
export interface MxTableColumn<T> {
  /** Cle React ET identifiant transmis a `onSort`. */
  id: string;
  /** Libelle d'en-tete. Fourni par l'appelant (i18n) — jamais resolu ici. */
  header: ReactNode;
  /** Rendu de la cellule pour une ligne. */
  render: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  /**
   * Largeur CSS declaree (ex. `'220px'`). Absente : colonne FLEXIBLE, qui
   * absorbe l'espace restant (`table-layout:fixed, voir le commentaire de
   * tete) — AU PLUS UNE colonne par tableau doit omettre `width`.
   */
  width?: string;
  /** Active le tri sur cette colonne (en-tete cliquable + `aria-sort`). */
  sortable?: boolean;
  /**
   * Cellule INTERACTIVE (menu d'actions, boutons) : arrete la propagation du
   * clic et du clavier vers `onRowClick` de la ligne. Sans ce marqueur, une
   * action dans la cellule ouvrirait AUSSI la ligne.
   */
  interactive?: boolean;
  /**
   * Coupe le contenu avec une ellipse CSS + pose un `title` (infobulle) —
   * `getTitle(row)` si fourni, sinon le texte de `render(row)` s'il s'agit
   * d'une chaine simple. Voir le commentaire de tete (LOT TABLE-MODELE).
   */
  truncate?: boolean;
  /** `title` de la cellule tronquee — prioritaire sur le texte de `render`. */
  getTitle?: (row: T) => string;
  /**
   * Marque la colonne d'actions (menu « ··· » + boutons) — doit etre la
   * DERNIERE colonne, avec `width`, `align:'right'` et `interactive:true`.
   * Verifie par `validateMxTableColumns`. Voir le commentaire de tete.
   */
  actionsColumn?: boolean;
}

export interface MxTableProps<T> {
  columns: MxTableColumn<T>[];
  rows: T[];
  /** Cle React de chaque ligne. */
  getRowId: (row: T) => string;
  /** Absent : lignes non cliquables, aucun `tabIndex`/gestionnaire pose. */
  onRowClick?: (row: T) => void;
  /** Colonne triee courante (`id` d'une colonne `sortable`). */
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  /** Appele avec l'`id` de la colonne cliquee — le TRI reste a la charge de l'appelant. */
  onSort?: (columnId: string) => void;
  /**
   * Verite -> remplace les lignes par CE contenu (ligne unique, pleine
   * largeur). Prevaut sur `empty` : un chargement en cours n'est jamais un
   * etat vide.
   */
  loading?: ReactNode;
  /** `rows` vide ET `loading` absent -> ce contenu (ligne unique, pleine largeur). */
  empty?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const HEADER_CELL_STYLE: CSSProperties = {
  padding: 'var(--mx-space-12)',
  textAlign: 'left',
  background: 'var(--mx-surface2)',
  borderBottom: 'var(--mx-border-w) solid var(--mx-border)',
  whiteSpace: 'nowrap',
};

const HEADER_BUTTON_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--mx-space-4)',
  border: 'none',
  background: 'transparent',
  padding: 0,
  cursor: 'pointer',
  color: 'inherit',
  ...MX_TEXT.segmentedLabel,
};

const CELL_STYLE: CSSProperties = {
  padding: 'var(--mx-space-12)',
  borderBottom: 'var(--mx-border-w) solid var(--mx-border)',
  ...MX_TEXT.meta,
  color: 'var(--mx-text)',
};

/** `overflow:hidden` + ellipse CSS — necessite `table-layout:fixed` (poseé sur `<table>`). */
const TRUNCATE_STYLE: CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

function alignToTextAlign(align: MxTableColumn<unknown>['align']): CSSProperties['textAlign'] {
  return align ?? 'left';
}

/** Arrete la propagation d'un clic/clavier de cellule `interactive` vers la ligne. */
function stopRowPropagation<T extends ReactMouseEvent | ReactKeyboardEvent>(e: T) {
  e.stopPropagation();
}

/** `col.getTitle(row)` si fourni, sinon le texte de `render(row)` s'il s'agit d'une chaine simple. */
function resolveCellTitle<T>(col: MxTableColumn<T>, row: T, rendered: ReactNode): string | undefined {
  if (col.getTitle) return col.getTitle(row);
  return typeof rendered === 'string' ? rendered : undefined;
}

export function MxTable<T>({
  columns,
  rows,
  getRowId,
  onRowClick,
  sortColumn,
  sortDirection = 'asc',
  onSort,
  loading,
  empty,
  className,
  style,
}: MxTableProps<T>) {
  const showLoading = !!loading;
  const showEmpty = !showLoading && rows.length === 0 && !!empty;
  const colCount = columns.length;

  if (import.meta.env.DEV) {
    const violations = validateMxTableColumns(columns);
    if (violations.length > 0) {
      console.warn('[MxTable] Colonnes non conformes (LOT TABLE-MODELE) :\n' + violations.join('\n'));
    }
  }

  return (
    <div className={className} style={{ overflowX: 'auto', ...style }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          {columns.map((col) => (
            <col key={col.id} style={col.width ? { width: col.width } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((col) => {
              const isSorted = col.sortable && sortColumn === col.id;
              const ariaSort = col.sortable
                ? isSorted
                  ? sortDirection === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
                : undefined;

              return (
                <th
                  key={col.id}
                  scope="col"
                  aria-sort={ariaSort}
                  style={{
                    ...HEADER_CELL_STYLE,
                    textAlign: alignToTextAlign(col.align),
                    width: col.width,
                  }}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      data-mx-focus=""
                      onClick={() => onSort?.(col.id)}
                      style={{ ...HEADER_BUTTON_STYLE, color: isSorted ? 'var(--mx-accent)' : 'var(--mx-text3)' }}
                    >
                      {col.header}
                      {isSorted ? (
                        sortDirection === 'asc' ? (
                          <ChevronUp aria-hidden="true" style={{ width: 12, height: 12 }} />
                        ) : (
                          <ChevronDown aria-hidden="true" style={{ width: 12, height: 12 }} />
                        )
                      ) : null}
                    </button>
                  ) : (
                    <span style={{ ...MX_TEXT.segmentedLabel, color: 'var(--mx-text3)' }}>{col.header}</span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {showLoading ? (
            <tr>
              <td style={{ ...CELL_STYLE, textAlign: 'center' }} colSpan={colCount}>
                {loading}
              </td>
            </tr>
          ) : showEmpty ? (
            <tr>
              <td style={{ ...CELL_STYLE, textAlign: 'center', borderBottom: 'none' }} colSpan={colCount}>
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const rowId = getRowId(row);
              const clickable = !!onRowClick;

              return (
                <tr
                  key={rowId}
                  tabIndex={clickable ? 0 : undefined}
                  data-mx-focus={clickable ? '' : undefined}
                  onClick={clickable ? () => onRowClick!(row) : undefined}
                  onKeyDown={
                    clickable
                      ? (e: ReactKeyboardEvent<HTMLTableRowElement>) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onRowClick!(row);
                          }
                        }
                      : undefined
                  }
                  style={{ cursor: clickable ? 'pointer' : undefined }}
                >
                  {columns.map((col) => {
                    const rendered = col.render(row);
                    return (
                      <td
                        key={col.id}
                        style={{
                          ...CELL_STYLE,
                          textAlign: alignToTextAlign(col.align),
                          ...(col.truncate ? TRUNCATE_STYLE : null),
                        }}
                        title={col.truncate ? resolveCellTitle(col, row, rendered) : undefined}
                        onClick={col.interactive ? stopRowPropagation : undefined}
                        onKeyDown={col.interactive ? stopRowPropagation : undefined}
                      >
                        {rendered}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export interface MxTableIdentityCellProps {
  avatarSrc?: string | null;
  name?: string | null;
  /** Ligne secondaire optionnelle sous le nom. */
  subtitle?: ReactNode;
  /**
   * `textTransform:'uppercase'` sur le nom affiche — PAS le defaut (`false`),
   * aucun changement de comportement pour les usages existants. LOT
   * ARTISTES-LISTE, C2.4 (2026-10-03) : regle metier propre a la table
   * Artistes (noms en majuscules), jamais imposee par la primitive elle-meme.
   */
  uppercaseName?: boolean;
  /** LOT PHOTOS-OPTIM, O1/O2 (2026-10-17) -- reporte a `MxAvatar` (`queued`). Defaut `false` (comportement inchange pour les tables qui n'ont pas ce besoin). */
  avatarQueued?: boolean;
}

/**
 * MxTableIdentityCell — cellule « identite » du catalogue (`#s-tables`,
 * L.640 : avatar 30px + nom en gras, `gap:10px`). Helper de composition,
 * PAS une colonne a part dans l'API de `MxTable` — une table sans avatar
 * n'a pas a l'importer.
 */
export function MxTableIdentityCell({
  avatarSrc,
  name,
  subtitle,
  uppercaseName,
  avatarQueued = false,
}: MxTableIdentityCellProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--mx-space-8)', minWidth: 0 }}>
      <MxAvatar src={avatarSrc} name={name} size="sm" queued={avatarQueued} />
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span
          style={{
            ...MX_TEXT.itemTitle,
            color: 'var(--mx-text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textTransform: uppercaseName ? 'uppercase' : undefined,
          }}
        >
          {name}
        </span>
        {subtitle ? <span style={{ ...MX_TEXT.help, color: 'var(--mx-text3)' }}>{subtitle}</span> : null}
      </div>
    </div>
  );
}

export default MxTable;
