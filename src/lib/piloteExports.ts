import { buildGantt, progressOf } from './ganttModel';
import { isOverdue } from './ganttFilters';
import { workingDaysBetween } from './holidays';
import { dayToNumber, numberToDay } from './timelineMath';
import { FAMILY_LABEL, ITEM_KIND_LABEL, PRIORITY_LABEL, TYPE_LABEL, TEAM_ROLE_LABEL, type GanttData } from './pilote';

// Exports PILOTE (sans affichage) : lignes pour Excel ou CSV, et fichier de calendrier .ics. Ils portent sur les données DÉJÀ filtrées par la vue.
type Row = Record<string, string | number>;

const fmt = (iso: string | null) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');

export function buildExportRows(data: GanttData, userName: (id: string) => string, today: string) {
  const status = new Map(data.statuses.map(s => [s.id, s]));
  const nonWorking = new Set((data.calendarDays ?? []).map(d => d.day));
  const model = buildGantt(data, 'status');
  const progress = new Map<string, number | null>();
  const effective = new Map<string, { start: string | null; end: string | null }>();
  for (const r of model.rows) {
    if (r.kind === 'group' || r.kind === 'add' || !r.id) continue;
    progress.set(r.key, progressOf(r));
    effective.set(r.key, { start: r.start, end: r.end });
  }
  const projectName = new Map(data.projects.map(p => [p.id, p.name]));
  const itemName = new Map(data.items.map(i => [i.id, i.name]));
  const itemUsers = new Map<string, string[]>();
  for (const m of data.itemMembers) { const l = itemUsers.get(m.item_id) ?? []; l.push(userName(m.user_id)); itemUsers.set(m.item_id, l); }
  const days = (start: string | null, end: string | null) => (start && end ? workingDaysBetween(start, end, nonWorking) : '');
  const pct = (key: string) => { const p = progress.get(key); return p === null || p === undefined ? '' : Math.round(p * 100); };

  const projects: Row[] = data.projects.map(p => {
    const st = status.get(p.status_id);
    const eff = effective.get(`p:${p.id}`) ?? { start: p.starts_on, end: p.ends_on };
    const lead = data.members.filter(m => m.project_id === p.id && m.role === 'lead').map(m => userName(m.user_id));
    const team = data.members.filter(m => m.project_id === p.id).map(m => `${userName(m.user_id)} (${TEAM_ROLE_LABEL[m.role]})`);
    return {
      'Projet': p.name, 'Type': TYPE_LABEL[p.type], 'État': st?.name ?? '', 'Famille': st ? FAMILY_LABEL[st.family] : '', 'Priorité': p.priority ? PRIORITY_LABEL[p.priority] : '',
      'Début': fmt(eff.start), 'Fin': fmt(eff.end), 'Jours ouvrés': days(eff.start, eff.end), 'Avancement (%)': pct(`p:${p.id}`),
      'En retard': isOverdue(eff.end, st?.family ?? null, today) ? 'Oui' : 'Non', 'Responsables': lead.join(', '), 'Équipe': team.join(', '), 'Description': p.description ?? '',
    };
  });

  const items: Row[] = data.items.map(i => {
    const st = status.get(i.status_id);
    const eff = effective.get(`i:${i.id}`) ?? { start: i.starts_on, end: i.ends_on };
    return {
      'Projet': projectName.get(i.project_id) ?? '', 'Parent': i.parent_id ? itemName.get(i.parent_id) ?? '' : '', 'Type': ITEM_KIND_LABEL[i.kind], 'Nom': i.name,
      'État': st?.name ?? '', 'Famille': st ? FAMILY_LABEL[st.family] : '', 'Priorité': i.priority ? PRIORITY_LABEL[i.priority] : '',
      'Début': fmt(eff.start), 'Fin': fmt(eff.end), 'Jours ouvrés': days(eff.start, eff.end), 'Avancement (%)': pct(`i:${i.id}`),
      'En retard': isOverdue(eff.end, st?.family ?? null, today) ? 'Oui' : 'Non', 'Assignés': (itemUsers.get(i.id) ?? []).join(', '), 'Description': i.description ?? '',
    };
  });
  return { projects, items };
}

// CSV pour Excel en Suisse : séparateur « ; », guillemets doublés, retour ligne Windows, BOM UTF-8 (les accents s'ouvrent bien)
export function toCsv(rows: Row[]): string {
  if (rows.length === 0) return '\uFEFF';
  const headers = Object.keys(rows[0]);
  const cell = (v: string | number | undefined) => {
    const s = v === undefined ? '' : String(v);
    // Une cellule qui commence par = + - @ serait lue comme une formule : on la protège
    const safe = /^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
    return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return '\uFEFF' + [headers.map(cell).join(';'), ...rows.map(r => headers.map(h => cell(r[h])).join(';'))].join('\r\n') + '\r\n';
}

/* ---------------------------------------------------------------- .ics */
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const compact = (iso: string) => iso.replace(/-/g, '');
// Lignes de plus de 75 octets coupées (RFC 5545) : la suite commence par une espace ; on coupe sur les caractères, jamais au milieu d'un caractère multi-octets
function fold(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = '', bytes = 0, limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > limit) { out.push(cur); cur = ' '; bytes = 1; limit = 75; }
    cur += ch; bytes += n;
  }
  out.push(cur);
  return out.join('\r\n');
}

// Un événement « journée entière » par tâche, sous-tâche ou jalon daté (les phases et les projets ne sont pas répétés). `stamp` = instant de création (AAAAMMJJTHHMMSSZ).
export function buildIcs(data: GanttData, userName: (id: string) => string, stamp: string): string {
  const status = new Map(data.statuses.map(s => [s.id, s]));
  const project = new Map(data.projects.map(p => [p.id, p]));
  const users = new Map<string, string[]>();
  for (const m of data.itemMembers) { const l = users.get(m.item_id) ?? []; l.push(userName(m.user_id)); users.set(m.item_id, l); }
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GO-Mat//PILOTE//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:GO-Mat PILOTE'];
  for (const i of data.items) {
    const p = project.get(i.project_id);
    if (!p || i.kind === 'phase') continue;
    const start = i.starts_on ?? i.ends_on, end = i.ends_on ?? i.starts_on;
    if (!start || !end) continue;
    const last = end < start ? start : end;
    const st = status.get(i.status_id);
    const desc = [`Projet : ${p.name}`, `Type : ${ITEM_KIND_LABEL[i.kind]}`, st ? `État : ${st.name}` : '', i.priority ? `Priorité : ${PRIORITY_LABEL[i.priority]}` : '', (users.get(i.id)?.length ? `Assignés : ${users.get(i.id)!.join(', ')}` : ''), i.description ?? '']
      .filter(Boolean).join('\n');
    lines.push('BEGIN:VEVENT', `UID:gomat-item-${i.id}@gomat`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${compact(start)}`, `DTEND;VALUE=DATE:${compact(numberToDay(dayToNumber(last) + 1))}`,
      `SUMMARY:${icsText(`${i.name} (${p.name})`)}`, `DESCRIPTION:${icsText(desc)}`, `CATEGORIES:${icsText(p.name)}`, `STATUS:${st?.family === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`, 'TRANSP:TRANSPARENT', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
