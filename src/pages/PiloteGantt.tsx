import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarCheck, ChevronLeft, ChevronRight, ChevronsDownUp, ChevronsUpDown, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { getLanguage } from '../i18n/translator';
import { buildGantt, defaultExpanded, makeScale, undatedRows, visibleRows, type Grouping, type GanttRow, type Zoom } from '../lib/ganttModel';
import { ITEM_KIND_LABEL, loadGantt, loadPiloteRights, piloteError, TYPE_LABEL, type GanttData, type ItemKind, type PiloteRights } from '../lib/pilote';
import { dayFromNumber, dayNumberOf } from '../lib/ganttModel';
import PageTitle from '../components/common/PageTitle';
import Button from '../components/common/Button';
import { MxEmpty } from '../components/mx/MxEmpty';
import { MxSegmented } from '../components/mx/MxSegmented';
import GanttChart from '../components/pilote/GanttChart';
import ItemDrawer, { type ItemTarget } from '../components/pilote/ItemDrawer';
import ProjectForm, { type ProjectTarget } from '../components/pilote/ProjectForm';

const NO_RIGHTS: PiloteRights = { create: false, update: false, delete: false };
const LOCALES = { fr: 'fr-CH', de: 'de-CH', it: 'it-CH', en: 'en-GB' } as const;
const todayZurich = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(new Date());
const EMPTY: GanttData = { statuses: [], programs: [], projects: [], members: [], sites: [], items: [], itemMembers: [] };

// PILOTE › Gantt (module payant) : programmes, projets et leurs éléments sur une échelle de temps
const PiloteGantt: React.FC = () => {
  const [data, setData] = useState<GanttData | null>(null);
  const [rights, setRights] = useState<PiloteRights>(NO_RIGHTS);
  const [grouping, setGrouping] = useState<Grouping>('program');
  const [zoom, setZoom] = useState<Zoom>('quarter');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [itemTarget, setItemTarget] = useState<ItemTarget | null>(null);
  const [projectTarget, setProjectTarget] = useState<ProjectTarget | null>(null);
  const [scrollTo, setScrollTo] = useState<{ day: string; nonce: number } | null>(null);
  const [scrollBy, setScrollBy] = useState<{ dir: -1 | 1; nonce: number } | null>(null);
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
  useEffect(() => { if (loaded) { setExpanded(defaultExpanded(model)); setScrollTo({ day: startDay, nonce: Date.now() }); } }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Jour montré à l'ouverture : aujourd'hui s'il est dans le plan, sinon le bord le plus proche du plan (pour voir des barres tout de suite)
  const startDay = model.range ? (today < model.range.min ? model.range.min : today > model.range.max ? model.range.max : today) : today;
  const rows = useMemo(() => visibleRows(model, expanded), [model, expanded]);
  const scale = useMemo(() => makeScale(model.range, today, zoom), [model.range, today, zoom]);
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
          <MxSegmented aria-label="Zoom" value={zoom} onChange={v => setZoom(v as Zoom)} options={[
            { value: 'week', label: 'Semaine' }, { value: 'month', label: 'Mois' }, { value: 'quarter', label: 'Trimestre' }, { value: 'year', label: 'Année' },
          ]} />
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" aria-label="Période précédente" icon={<ChevronLeft size={14} />} onClick={() => setScrollBy({ dir: -1, nonce: Date.now() })} />
            <Button size="sm" variant="outline" icon={<CalendarCheck size={14} />} onClick={() => setScrollTo({ day: today, nonce: Date.now() })}>Aujourd'hui</Button>
            <Button size="sm" variant="outline" aria-label="Période suivante" icon={<ChevronRight size={14} />} onClick={() => setScrollBy({ dir: 1, nonce: Date.now() })} />
          </div>
          <Button size="sm" variant="outline" icon={<ChevronsUpDown size={14} />} onClick={() => setExpanded(new Set(model.expandable))}>Tout déplier</Button>
          <Button size="sm" variant="outline" icon={<ChevronsDownUp size={14} />} onClick={() => setExpanded(defaultExpanded(model))}>Replier</Button>
        </div>
        {rights.create && <Button icon={<Plus size={16} />} onClick={() => setItemTarget({ mode: 'new' })} disabled={data.projects.length === 0}>Nouvel élément</Button>}
      </div>

      {rows.length === 0 ? (
        <MxEmpty icon={CalendarCheck} title="Rien à afficher" description="Crée d'abord un projet dans PILOTE › Projets : il apparaîtra ici avec ses phases, tâches et jalons." />
      ) : (
        <GanttChart rows={rows} scale={scale} today={today} locale={LOCALES[getLanguage()]} expanded={expanded} canCreate={rights.create} scrollTo={scrollTo} scrollBy={scrollBy}
          onToggle={toggle} onOpen={openRow} onAdd={addIn} />
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

      <ItemDrawer data={data} target={itemTarget} canUpdate={rights.update} canDelete={rights.delete} onClose={() => setItemTarget(null)} onSaved={reload} />
      <ProjectForm data={data} target={projectTarget} onClose={() => setProjectTarget(null)} onSaved={reload} />
    </div>
  );
};

export default PiloteGantt;
