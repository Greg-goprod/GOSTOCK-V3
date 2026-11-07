import { dayToNumber, numberToDay } from './timelineMath';
import { workingDaysBetween } from './holidays';
import type { GanttData } from './pilote';

// Chemin critique (sans affichage) : la chaîne de dépendances « serrées » qui décide de la date de fin d'un projet. Un retard sur
// l'un de ses éléments décale la fin du projet. On part des éléments qui finissent en dernier (hors phases, annulés et terminés)
// et on remonte de prédécesseur en prédécesseur tant que rien ne sépare leurs dates (ni jour ouvré libre : week-ends, jours fériés
// et fermetures du calendrier de travail ne comptent pas). Une chaîne d'un seul élément n'est pas un chemin : rien n'est marqué.
export interface CriticalPath { items: Set<string>; links: Set<string> }

const startOf = (i: { starts_on: string | null; ends_on: string | null }) => i.starts_on ?? i.ends_on;
const endOf = (i: { starts_on: string | null; ends_on: string | null }) => i.ends_on ?? i.starts_on;

export function criticalPath(data: GanttData): CriticalPath {
  const nonWorking = new Set((data.calendarDays ?? []).map(d => d.day));
  const family = new Map(data.statuses.map(s => [s.id, s.family]));
  const items = new Map(data.items.map(i => [i.id, i]));
  const live = (id: string) => {
    const i = items.get(id);
    if (!i || i.kind === 'phase') return false;
    const f = family.get(i.status_id);
    return f !== 'done' && f !== 'cancelled' && !!startOf(i) && !!endOf(i);
  };
  // Un successeur est « tenu » par son prédécesseur quand aucun jour ouvré libre ne les sépare
  const tight = (predId: string, succId: string) => {
    const p = endOf(items.get(predId)!)!, s = startOf(items.get(succId)!)!;
    if (dayToNumber(s) <= dayToNumber(p) + 1) return true;
    return workingDaysBetween(numberToDay(dayToNumber(p) + 1), numberToDay(dayToNumber(s) - 1), nonWorking) === 0;
  };
  const preds = new Map<string, { id: string; pred: string }[]>();
  for (const l of data.links) {
    if (!live(l.predecessor_id) || !live(l.successor_id)) continue;
    const list = preds.get(l.successor_id) ?? []; list.push({ id: l.id, pred: l.predecessor_id }); preds.set(l.successor_id, list);
  }

  const outItems = new Set<string>(), outLinks = new Set<string>();
  for (const p of data.projects) {
    const ids = data.items.filter(i => i.project_id === p.id && live(i.id));
    if (ids.length === 0) continue;
    const last = ids.reduce((m, i) => (endOf(i)! > m ? endOf(i)! : m), endOf(ids[0])!);
    const seen = new Set<string>();
    const queue = ids.filter(i => endOf(i) === last).map(i => i.id);
    while (queue.length) {
      const cur = queue.pop()!;
      if (seen.has(cur)) continue;
      seen.add(cur);
      for (const { id, pred } of preds.get(cur) ?? []) {
        if (!tight(pred, cur)) continue;
        outLinks.add(id); outItems.add(cur); outItems.add(pred);
        queue.push(pred);
      }
    }
  }
  return { items: outItems, links: outLinks };
}
