import type { MxTableColumn } from './MxTable';

/**
 * Verifie les regles de largeur/colonne d'actions du LOT TABLE-MODELE
 * (2026-10-16) sur un jeu de colonnes — utilisee en developpement par
 * `MxTable` (avertissement console, voir son commentaire de tete) et par
 * les tests de non-regression (`MxTable.test.tsx`,
 * `offersMxListColumns.conformance.test.ts`,
 * `ArtistesListMx.conformance.test.ts`). Retourne la liste des violations
 * (vide = conforme).
 *
 * Fichier separe de `MxTable.tsx` (plutot qu'exportee depuis ce dernier) :
 * `react-refresh/only-export-components` interdit d'exporter une fonction
 * non-composant depuis un fichier qui exporte aussi un composant React.
 */
export function validateMxTableColumns<T>(columns: MxTableColumn<T>[]): string[] {
  const violations: string[] = [];

  const withoutWidth = columns.filter((c) => !c.width);
  if (withoutWidth.length > 1) {
    violations.push(
      `${withoutWidth.length} colonnes sans largeur declaree (${withoutWidth
        .map((c) => c.id)
        .join(', ')}) — une seule colonne flexible est autorisee par tableau.`,
    );
  }

  columns.forEach((col, index) => {
    if (!col.actionsColumn) return;
    if (index !== columns.length - 1) {
      violations.push(`Colonne d'actions « ${col.id} » doit etre la derniere colonne du tableau.`);
    }
    if (!col.width) {
      violations.push(`Colonne d'actions « ${col.id} » doit declarer une largeur fixe.`);
    }
    if (col.align !== 'right') {
      violations.push(`Colonne d'actions « ${col.id} » doit etre alignee a droite (align:'right').`);
    }
    if (!col.interactive) {
      violations.push(`Colonne d'actions « ${col.id} » doit etre marquee interactive:true.`);
    }
  });

  return violations;
}
