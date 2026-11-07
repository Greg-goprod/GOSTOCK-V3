import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Gauge } from 'lucide-react';
import toast from 'react-hot-toast';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../lib/supabase';
import { addDays, mondayOf } from '../lib/boardCalendarModel';
import { computeWorkload, type LoadLevel, type WorkloadCell } from '../lib/workload';
import { loadGantt, loadPiloteRights, piloteError, type GanttData, type PiloteRights } from '../lib/pilote';
import { MxEmpty } from '../components/mx/MxEmpty';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import ItemDrawer, { type ItemTarget } from '../components/pilote/ItemDrawer';

const NO_RIGHTS: PiloteRights = { create: false, update: false, delete: false };
const EMPTY: GanttData = { statuses: [], projects: [], templates: [], members: [], sites: [], items: [], itemMembers: [], links: [], calendarDays: [], capacities: [] };
const WEEKS = 8;
const todayZurich = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(new Date());
const dm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
const hoursText = (h: number) => (Math.round(h * 10) / 10).toLocaleString('fr-CH', { maximumFractionDigits: 1 });
// Numéro de semaine ISO d'une date « AAAA-MM-JJ »
function isoWeek(iso: string): number {
  const d = new Date(`${iso}T12:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}
const LEVEL_CLASS: Record<LoadLevel, string> = {
  none: 'text-gray-400 dark:text-gray-500',
  ok: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100',
  warn: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100',
  over: 'bg-red-100 font-semibold text-red-900 dark:bg-red-900/40 dark:text-red-100',
};
const LEVEL_LABEL: Record<LoadLevel, string> = { none: 'libre', ok: 'confortable', warn: 'presque plein', over: 'surcharge' };

// PILOTE › Projets › Charge : les heures estimées des éléments, réparties sur leurs jours ouvrés et partagées entre les assignés,
// additionnées par personne et par semaine, comparées à la capacité hebdomadaire de chacun (modifiable ici, 40 h par défaut).
const PiloteWorkload: React.FC = () => {
  const [data, setData] = useState<GanttData | null>(null);
  const [rights, setRights] = useState<PiloteRights>(NO_RIGHTS);
  const today = todayZurich();
  const [from, setFrom] = useState(mondayOf(today));
  const { users } = useApp();
  const [itemTarget, setItemTarget] = useState<ItemTarget | null>(null);
  const [detail, setDetail] = useState<{ user: string; cell: WorkloadCell } | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    try { setData(await loadGantt()); } catch (e) { toast.error(piloteError(e)); setData(prev => prev ?? EMPTY); }
  }, []);
  useEffect(() => { void reload(); void loadPiloteRights().then(setRights); }, [reload]);

  const userName = useMemo(() => new Map(users.map(u => [u.id, `${u.first_name} ${u.last_name}`.trim()])), [users]);
  // Les personnes qui comptent : équipes de projets, assignations et capacités déjà saisies
  const people = useMemo(() => {
    const ids = new Set<string>();
    for (const m of data?.members ?? []) ids.add(m.user_id);
    for (const m of data?.itemMembers ?? []) ids.add(m.user_id);
    for (const c of data?.capacities ?? []) ids.add(c.user_id);
    return [...ids].filter(id => userName.has(id)).sort((a, b) => (userName.get(a) ?? '').localeCompare(userName.get(b) ?? '', 'fr'));
  }, [data, userName]);
  const workload = useMemo(() => computeWorkload(data ?? EMPTY, from, WEEKS, people), [data, from, people]);
  const overloaded = useMemo(() => workload.rows.reduce((n, r) => n + r.cells.filter(c => c.level === 'over').length, 0), [workload]);

  const saveCapacity = async (userId: string) => {
    const raw = (draft[userId] ?? '').trim().replace(',', '.');
    setDraft(d => { const next = { ...d }; delete next[userId]; return next; });
    if (raw === '') return;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 80) return void toast.error('Capacité : un nombre d\'heures par semaine entre 0 et 80');
    const { error } = await supabase.from('cp_user_capacity').upsert({ user_id: userId, hours_per_week: Math.round(value * 10) / 10 }, { onConflict: 'organization_id,user_id' });
    if (error) return void toast.error(piloteError(error));
    toast.success('Capacité enregistrée');
    await reload();
  };

  if (!data) return <p className="text-gray-500 dark:text-gray-400 font-medium">Chargement…</p>;
  const canEditCapacity = rights.create && rights.update;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" ariaLabel="Semaines précédentes" onClick={() => setFrom(f => addDays(f, -7 * 4))} icon={<ChevronLeft size={14} />} />
          <Button variant="outline" size="sm" onClick={() => setFrom(mondayOf(today))}>Cette semaine</Button>
          <Button variant="outline" size="sm" ariaLabel="Semaines suivantes" onClick={() => setFrom(f => addDays(f, 7 * 4))} icon={<ChevronRight size={14} />} />
          <span className="ml-1 text-sm font-semibold text-gray-900 dark:text-white" data-workload-range>{`${dm(workload.weeks[0])} → ${dm(addDays(workload.weeks[WEEKS - 1], 6))}.${addDays(workload.weeks[WEEKS - 1], 6).slice(0, 4)}`}</span>
        </div>
        <p role="status" className={`flex items-center gap-1.5 text-sm font-medium ${overloaded > 0 ? 'text-danger-600' : 'text-gray-600 dark:text-gray-400'}`} data-overload-count={overloaded}>
          {overloaded > 0 && <AlertTriangle size={14} aria-hidden />}
          {overloaded === 0 ? 'Aucune surcharge sur cette période' : overloaded === 1 ? '1 semaine en surcharge' : `${overloaded} semaines en surcharge`}
        </p>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400">
        Les heures estimées de chaque tâche (fiche de la tâche › « Estimation ») sont réparties sur ses jours ouvrés et partagées entre ses assignés. Une case compare le total de la semaine à la capacité de la personne,
        réduite des jours fériés et fermetures. Vert : jusqu'à 80 % ; orange : jusqu'à 100 % ; rouge : surcharge.
      </p>

      {people.length === 0 ? (
        <MxEmpty icon={Gauge} title="Aucune charge à afficher" description="Assigne des tâches à des personnes et estime leurs heures : la charge de chacun apparaîtra ici." />
      ) : (
        <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
          <table className="min-w-full text-sm" aria-label="Charge par personne et par semaine">
            <thead className="bg-gray-50 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Personne</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">h / semaine</th>
                {workload.weeks.map(w => (
                  <th key={w} scope="col" className="min-w-24 px-2 py-2 text-center font-semibold">
                    <div>{`Sem. ${isoWeek(w)}`}</div>
                    <div className="font-normal">{dm(w)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {workload.rows.map(row => (
                <tr key={row.userId} data-user={row.userId}>
                  <th scope="row" className="whitespace-nowrap px-3 py-2 text-left font-medium text-gray-900 dark:text-gray-100">{userName.get(row.userId)}</th>
                  <td className="px-3 py-1.5">
                    <input type="number" inputMode="decimal" min={0} max={80} step={0.5} aria-label={`Capacité de ${userName.get(row.userId)} (heures par semaine)`}
                      disabled={!canEditCapacity} value={draft[row.userId] ?? String(row.capacityPerWeek)}
                      onChange={e => setDraft(d => ({ ...d, [row.userId]: e.target.value }))}
                      onBlur={() => { if (draft[row.userId] !== undefined && draft[row.userId] !== String(row.capacityPerWeek)) void saveCapacity(row.userId); else setDraft(d => { const n = { ...d }; delete n[row.userId]; return n; }); }}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 disabled:opacity-70 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
                  </td>
                  {row.cells.map(cell => (
                    <td key={cell.weekStart} className="p-1 text-center">
                      <button type="button" disabled={cell.parts.length === 0} onClick={() => setDetail({ user: row.userId, cell })}
                        data-level={cell.level} data-week-start={cell.weekStart}
                        aria-label={`${userName.get(row.userId)}, semaine du ${dm(cell.weekStart)} : ${hoursText(cell.hours)} heures sur ${hoursText(cell.capacity)} (${LEVEL_LABEL[cell.level]})`}
                        className={`w-full rounded px-1 py-1.5 text-xs tabular-nums ${LEVEL_CLASS[cell.level]} ${cell.parts.length > 0 ? 'cursor-pointer hover:ring-2 hover:ring-primary-300' : 'cursor-default'}`}>
                        {cell.level === 'none' ? '—' : `${hoursText(cell.hours)} / ${hoursText(cell.capacity)}`}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {workload.unestimated.length > 0 && (
        <section aria-label="Tâches à estimer">
          <h3 className="mb-1 text-sm font-bold text-gray-900 dark:text-white">{`À estimer (${workload.unestimated.length})`}</h3>
          <p className="mb-2 text-xs text-gray-600 dark:text-gray-400">Tâches assignées, pas terminées, dans la période, sans estimation : elles ne comptent pas encore dans la charge.</p>
          <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
            {workload.unestimated.map(u => (
              <li key={u.itemId} className="flex items-center justify-between gap-3 p-2.5">
                <div className="min-w-0">
                  <button type="button" onClick={() => setItemTarget({ mode: 'edit', itemId: u.itemId })} className="text-left text-sm font-medium text-gray-900 hover:underline dark:text-gray-100">{u.name}</button>
                  <span className="ml-2 text-xs text-gray-600 dark:text-gray-400">{`${u.projectName} · ${u.assignees.map(id => userName.get(id) ?? '—').join(', ')}`}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={detail ? `${userName.get(detail.user) ?? ''} · semaine du ${dm(detail.cell.weekStart)}` : ''}>
        {detail && (
          <div className="space-y-3">
            <p className="text-sm text-gray-700 dark:text-gray-300">{`${hoursText(detail.cell.hours)} h sur ${hoursText(detail.cell.capacity)} h de capacité (${LEVEL_LABEL[detail.cell.level]}).`}</p>
            <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
              {detail.cell.parts.map(p => (
                <li key={p.itemId} className="flex items-center justify-between gap-3 p-2.5">
                  <div className="min-w-0">
                    <button type="button" onClick={() => { setDetail(null); setItemTarget({ mode: 'edit', itemId: p.itemId }); }} className="text-left text-sm font-medium text-gray-900 hover:underline dark:text-gray-100">{p.name}</button>
                    <div className="text-xs text-gray-600 dark:text-gray-400">{p.projectName}</div>
                  </div>
                  <span className="shrink-0 text-sm tabular-nums">{`${hoursText(p.hours)} h`}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>

      <ItemDrawer data={data} target={itemTarget} canUpdate={rights.update} canCreate={rights.create} canDelete={rights.delete} onClose={() => setItemTarget(null)} onSaved={reload} />
    </div>
  );
};

export default PiloteWorkload;
