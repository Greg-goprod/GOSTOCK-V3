import { LINK_MODE_LABEL, PRIORITY_LABEL, TYPE_LABEL, type LinkMode, type ProjectPriority, type ProjectType } from './pilote';

// Texte de l'historique d'une fiche (sans affichage) : transforme les lignes du journal d'audit (cp_history) en phrases lisibles.
export interface HistoryEntry { at: string; who: string; action: 'insert' | 'update' | 'delete'; changes: Record<string, unknown> }
export interface HistoryLabels {
  status: (id: string) => string;          // nom d'un état
  item?: (id: string) => string | undefined;   // nom d'un élément (parent)
  site?: (id: string) => string | undefined;   // nom d'un chantier
}
type Kind = 'item' | 'project';

const FIELDS: Record<Kind, Record<string, string>> = {
  item: { name: 'Nom', description: 'Description', status_id: 'État', priority: 'Priorité', starts_on: 'Début', ends_on: 'Fin', parent_id: 'Parent', estimate_hours: 'Estimation (h)' },
  project: { name: 'Nom', type: 'Type', description: 'Description', status_id: 'État', priority: 'Priorité', color: 'Couleur', starts_on: 'Début', ends_on: 'Fin', site_id: 'Chantier', link_mode: 'Mode de décalage', link_skip_weekends: 'Éviter les jours non travaillés' },
};
const LONG_TEXT = new Set(['description']);

function show(field: string, value: unknown, labels: HistoryLabels): string {
  if (value === null || value === undefined || value === '') return '—';
  const v = String(value);
  switch (field) {
    case 'status_id': return labels.status(v);
    case 'parent_id': return labels.item?.(v) ?? 'un autre élément';
    case 'site_id': return labels.site?.(v) ?? 'un chantier';
    case 'priority': return PRIORITY_LABEL[v as ProjectPriority] ?? v;
    case 'type': return TYPE_LABEL[v as ProjectType] ?? v;
    case 'link_mode': return LINK_MODE_LABEL[v as LinkMode] ?? v;
    case 'link_skip_weekends': return value === true || v === 'true' ? 'Oui' : 'Non';
    case 'starts_on': case 'ends_on': return /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v.slice(8, 10)}.${v.slice(5, 7)}.${v.slice(0, 4)}` : v;
    default: return v.length > 60 ? `${v.slice(0, 60)}…` : v;
  }
}

export function describeEntry(entry: HistoryEntry, kind: Kind, labels: HistoryLabels): string[] {
  if (entry.action === 'insert') return ['Création'];
  if (entry.action === 'delete') return ['Suppression'];
  const lines: string[] = [];
  for (const [field, label] of Object.entries(FIELDS[kind])) {
    const change = entry.changes[field];
    if (!Array.isArray(change) || change.length !== 2) continue;
    lines.push(LONG_TEXT.has(field) ? `${label} modifiée` : `${label} : ${show(field, change[0], labels)} → ${show(field, change[1], labels)}`);
  }
  return lines;
}
