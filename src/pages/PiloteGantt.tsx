import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarCheck, ChevronsDownUp, ChevronsUpDown, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { getLanguage } from '../i18n/translator';
import { buildGantt, defaultExpanded, undatedRows, visibleRows, withAddRows, type Grouping, type GanttRow } from '../lib/ganttModel';
import { isPreset, makePeriod, type ViewPeriod } from '../lib/viewPeriod';
import { ITEM_KIND_LABEL, loadGantt, loadPiloteRights, piloteError, setDates, shiftItem, shiftProject, TYPE_LABEL, type GanttData, type ItemKind, type PiloteRights } from '../lib/pilote';
import { dayFromNumber, dayNumberOf } from '../lib/ganttModel';
import PageTitle from '../components/common/PageTitle';
import Button from '../components/common/Button';
import { MxEmpty } from '../components/mx/MxEmpty';
import { MxSegmented } from '../components/mx/MxSegmented';
import PeriodControls from '../components/common/PeriodControls';
import GanttChart from '../components/pilote/GanttChart';
import ItemDrawer, { type ItemTarget } from '../components/pilote/ItemDrawer';
import ProjectForm, { type ProjectTarget } from '../components/pilote/ProjectForm';

const NO_RIGHTS: PiloteRights = { create: false, update: false, delete: false };
const LOCALES = { fr: 'fr-CH', de: 'de-CH', it: 'it-CH', en: 'en-GB' } as const;
const todayZurich = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(new Date());
const EMPTY: GanttData = { statuses: [], programs: [], projects: [], members: [], sites: [], items: [], itemMembers: [], links: [] };

// PILOTE › Gantt (module payant) : programmes, projets et leurs éléments sur une échelle de temps
const PiloteGantt: React.FC = () => {
  const [data, setData] = useState<GanttData | null>(null);
  const [rights, setRights] = useState<PiloteRights>(NO_RIGHTS);
  const [grouping, setGrouping] = useState<Grouping>('program');
  const [period, setPeriod] = useState<ViewPeriod | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [itemTarget, setItemTarget] = useState<ItemTarget | null>(null);
  const [projectTarget, setProjectTarget] = useState<ProjectTarget | null>(null);
  const today = todayZurich();

  const reload = useCallback(async () => {
    try { setData(await loadGantt()); } catch (e) { toast.error(piloteError(e)); setData(prev => prev ?? EMPTY); }
  }, []);
  useEffect(() => { void reload(); void loadPiloteRights().then(setRights); }, [reload]);

  const model = useMemo(() => buildGantt(data ?? EMPTY, grouping), [data, grouping]);
  // Ouverture sur 2 niveaux, à chaque changement de regroupement
  useEffect(() => { setExpanded(defaultExpanded(model)); }, [grouping]); // eslint-disable-line react-hooks/exhaustive-deps
  // Première arrivée des données : même ouverture
  const loaded = data !== null;
  useEffect(() => {
    if (!loaded) return;
    setExpanded(defaultExpanded(model));
    let stored: string | null = null;
    try { stored = localStorage.getItem('gomat-gantt-period'); } catch { /* préférence facultative */ }
    setPeriod(makePeriod(isPreset(stored) ? stored : '3m', startDay));
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  const changePeriod = (p: ViewPeriod) => {
    setPeriod(p);
    if (p.preset !== 'custom') { try { localStorage.setItem('gomat-gantt-period', p.preset); } catch { /* préférence facultative */ } }
  };

  // Jour montré à l'ouverture : aujourd'hui s'il est dans le plan, sinon le bord le plus proche du plan (pour voir des barres tout de suite)
  const startDay = model.range ? (today < model.range.min ? model.range.min : today > model.range.max ? model.range.max : today) : today;
  const rows = useMemo(() => (rights.create ? withAddRows(visibleRows(model, expanded), expanded) : visibleRows(model, expanded)), [model, expanded, rights.create]);
  const undated = useMemo(() => undatedRows(model), [model]);
  const projectName = useMemo(() => new Map((data?.projects ?? []).map(p => [p.id, p.name])), [data]);

  const toggle = (key: string) => setExpanded(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const openRow = (row: GanttRow) => {
    if (row.kind === 'project') { const p = data?.projects.find(x => x.id === row.id); if (p) setProjectTarget({ mode: 'edit', row: p }); }
    else if (row.id) setItemTarget({ mode: 'edit', itemId: row.id });
  };
  const addIn = (row: GanttRow) => {
    if (row.kind === 'project') setItemTarget({ mode: 'new', projectId: row.id ?? undefined, parentId: null });
    else if (row.id) setItemTarget({ mode: 'new', parentId: row.id });
  };

  // Gestes du Gantt : un seul enregistrement à la fois (une touche maintenue ne doit pas empiler des requêtes)
  const busy = useRef(false);
  const run = async (action: () => Promise<void>, done: string) => {
    if (busy.current) return;
    busy.current = true;
    try { await action(); toast.success(done); await reload(); } catch (e) { toast.error(piloteError(e)); await reload(); } finally { busy.current = false; }
  };
  const moveRow = (row: GanttRow, days: number) => run(
    () => (row.kind === 'project' ? shiftProject(row.id as string, days) : shiftItem(row.id as string, days)),
    days > 0 ? `Décalé de ${days} jour${days > 1 ? 's' : ''}` : `Avancé de ${-days} jour${days < -1 ? 's' : ''}`,
  );
  const resizeRow = (row: GanttRow, start: string, end: string) => run(() => setDates(row.kind === 'project' ? 'project' : 'item', row.id as string, start, end), 'Dates modifiées');

  // « + Nouveau » dans la liste : crée l'élément sous son parent, avec une semaine à partir du début du parent (ou d'aujourd'hui) pour qu'il apparaisse tout de suite
  const createInline = async (row: GanttRow, name: string, kind: ItemKind): Promise<boolean> => {
    const start = row.start ?? today;
    const rawEnd = dayFromNumber(dayNumberOf(start) + 6);
    const end = kind === 'milestone' ? start : row.end && row.end >= start && row.end < rawEnd ? row.end : rawEnd;
    const { error } = await supabase.from('cp_items').insert({ project_id: row.projectId, parent_id: row.parentId, kind, name, starts_on: start, ends_on: end });
    if (error) { toast.error(piloteError(error)); return false; }
    toast.success('Élément créé');
    await reload();
    return true;
  };

  // « Placer » : donne une date à un élément ou à un projet sans date (aujourd'hui ; une semaine pour tout sauf un jalon)
  const place = async (row: GanttRow) => {
    if (!row.id) return;
    const end = row.kind === 'milestone' ? today : dayFromNumber(dayNumberOf(today) + 6);
    const { error } = await supabase.from(row.kind === 'project' ? 'cp_projects' : 'cp_items').update({ starts_on: today, ends_on: end }).eq('id', row.id);
    if (error) return void toast.error(piloteError(error));
    toast.success('Placé aujourd\'hui');
    await reload();
  };

  if (!data) return <p className="text-gray-500 dark:text-gray-400 font-medium">Chargement…</p>;

  const kindName = (r: GanttRow) => (r.kind === 'project' ? 'Projet' : ITEM_KIND_LABEL[r.kind as ItemKind]);

  return (
    <div className="space-y-4">
      <div>
        <PageTitle>Gantt</PageTitle>
        <p className="text-gray-600 dark:text-gray-400 mt-1 font-medium">
          Tous tes projets et leurs phases, tâches et jalons sur une même échelle de temps. Clique sur une ligne ou une barre pour ouvrir sa fiche.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <MxSegmented aria-label="Regroupement" value={grouping} onChange={v => setGrouping(v as Grouping)} options={[
            { value: 'program', label: 'Programme' }, { value: 'status', label: 'État' }, { value: 'type', label: 'Type' },
          ]} />
          {period && <PeriodControls value={period} today={today} onChange={changePeriod} />}
          <Button size="sm" variant="outline" icon={<ChevronsUpDown size={14} />} onClick={() => setExpanded(new Set(model.expandable))}>Tout déplier</Button>
          <Button size="sm" variant="outline" icon={<ChevronsDownUp size={14} />} onClick={() => setExpanded(defaultExpanded(model))}>Replier</Button>
        </div>
        {rights.create && <Button icon={<Plus size={16} />} onClick={() => setItemTarget({ mode: 'new' })} disabled={data.projects.length === 0}>Nouvel élément</Button>}
      </div>

      {!period ? null : rows.length === 0 ? (
        <MxEmpty icon={CalendarCheck} title="Rien à afficher" description="Crée d'abord un projet dans PILOTE › Projets : il apparaîtra ici avec ses phases, tâches et jalons." />
      ) : (
        <GanttChart rows={rows} links={data.links} period={period} today={today} locale={LOCALES[getLanguage()]} expanded={expanded} canCreate={rights.create}
          onToggle={toggle} onOpen={openRow} onAdd={addIn} canEdit={rights.update} onMove={moveRow} onResize={resizeRow} onCreate={createInline} />
      )}

      {undated.length > 0 && (
        <section aria-label="Sans date" className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
          <h2 className="mb-2 text-sm font-bold text-gray-900 dark:text-white">{`Sans date (${undated.length})`}</h2>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {undated.map(r => (
              <li key={r.key} className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                <button type="button" onClick={() => openRow(r)} className="font-medium text-gray-900 hover:underline dark:text-white">{r.name}</button>
                <span className="text-gray-600 dark:text-gray-400">{kindName(r)}{r.kind !== 'project' && r.projectId ? ` · ${projectName.get(r.projectId) ?? ''}` : r.kind === 'project' && data ? ` · ${TYPE_LABEL[data.projects.find(p => p.id === r.id)?.type ?? 'site']}` : ''}</span>
                {rights.update && <Button size="sm" variant="outline" onClick={() => void place(r)} className="ml-auto">Placer aujourd'hui</Button>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ItemDrawer data={data} target={itemTarget} canUpdate={rights.update} canCreate={rights.create} canDelete={rights.delete} onClose={() => setItemTarget(null)} onSaved={reload} />
      <ProjectForm data={data} target={projectTarget} onClose={() => setProjectTarget(null)} onSaved={reload} />
    </div>
  );
};

export default PiloteGantt;
