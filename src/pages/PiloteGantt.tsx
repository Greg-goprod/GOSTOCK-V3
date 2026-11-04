import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarCheck, ChevronsDownUp, ChevronsUpDown, MoreHorizontal, PanelLeft, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { getLanguage } from '../i18n/translator';
import { buildGantt, defaultExpanded, undatedRows, visibleRows, withAddRows, type ColorBy, type Grouping, type GanttRow } from '../lib/ganttModel';
import { isPreset, makePeriod, periodDays, type ViewPeriod } from '../lib/viewPeriod';
import { ITEM_KIND_LABEL, loadGantt, loadPiloteRights, piloteError, setDates, shiftItem, shiftProject, type GanttData, type ItemKind, type PiloteRights, type ProjectType } from '../lib/pilote';
import { dayFromNumber, dayNumberOf } from '../lib/ganttModel';
import PageTitle from '../components/common/PageTitle';
import { MxEmpty } from '../components/mx/MxEmpty';
import PeriodControls from '../components/common/PeriodControls';
import MenuButton from '../components/common/MenuButton';
import GanttChart from '../components/pilote/GanttChart';
import ItemDrawer, { type ItemTarget } from '../components/pilote/ItemDrawer';
import ProjectForm, { type ProjectTarget } from '../components/pilote/ProjectForm';

const NO_RIGHTS: PiloteRights = { create: false, update: false, delete: false };
const LOCALES = { fr: 'fr-CH', de: 'de-CH', it: 'it-CH', en: 'en-GB' } as const;
const todayZurich = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(new Date());
// Regroupements proposés
const GROUPING_CHOICES: Grouping[] = ['status', 'type'];
const GROUPING_LABEL: Record<Grouping, string> = { status: 'État', type: 'Type' };
const EMPTY: GanttData = { statuses: [], projects: [], members: [], sites: [], items: [], itemMembers: [], links: [] };

// PILOTE › Gantt (module payant) : projets et leurs éléments sur une échelle de temps
// `embedded` : affiché comme onglet de la page Projets, qui porte déjà le titre et l'introduction
const PiloteGantt: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const [data, setData] = useState<GanttData | null>(null);
  const [rights, setRights] = useState<PiloteRights>(NO_RIGHTS);
  const [grouping, setGrouping] = useState<Grouping>('status');
  const [period, setPeriod] = useState<ViewPeriod | null>(null);
  // Préférences d'affichage mémorisées dans le navigateur : couleur des barres (par état, par défaut) et liste des noms (affichée ou masquée)
  const [colorBy, setColorByState] = useState<ColorBy>(() => { try { return localStorage.getItem('gomat-gantt-colorby') === 'project' ? 'project' : 'status'; } catch { return 'status'; } });
  const [showNames, setShowNamesState] = useState<boolean>(() => { try { return localStorage.getItem('gomat-gantt-names') !== 'hidden'; } catch { return true; } });
  const setColorBy = (v: ColorBy) => { setColorByState(v); try { localStorage.setItem('gomat-gantt-colorby', v); } catch { /* préférence facultative */ } };
  const setShowNames = (v: boolean) => { setShowNamesState(v); try { localStorage.setItem('gomat-gantt-names', v ? 'shown' : 'hidden'); } catch { /* préférence facultative */ } };
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [itemTarget, setItemTarget] = useState<ItemTarget | null>(null);
  const [projectTarget, setProjectTarget] = useState<ProjectTarget | null>(null);
  const today = todayZurich();

  const reload = useCallback(async () => {
    try { setData(await loadGantt()); } catch (e) { toast.error(piloteError(e)); setData(prev => prev ?? EMPTY); }
  }, []);
  useEffect(() => { void reload(); void loadPiloteRights().then(setRights); }, [reload]);

  const model = useMemo(() => buildGantt(data ?? EMPTY, grouping, colorBy), [data, grouping, colorBy]);
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
    // Depuis un groupe : un projet qui reprend l'état (ou le type) du groupe
    if (row.kind === 'group') setProjectTarget(grouping === 'status' ? { mode: 'new', status_id: row.id ?? undefined } : { mode: 'new', type: (row.id ?? undefined) as ProjectType | undefined });
    else if (row.kind === 'project') setItemTarget({ mode: 'new', projectId: row.id ?? undefined, parentId: null });
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

  // Flèche ← / → d'une ligne hors de la fenêtre : on amène la période sur elle (même durée pour une période libre)
  const jumpTo = (row: GanttRow) => {
    if (!row.start || !period) return;
    if (period.preset === 'custom') changePeriod({ preset: 'custom', start: row.start, end: dayFromNumber(dayNumberOf(row.start) + periodDays(period) - 1) });
    else changePeriod(makePeriod(period.preset, row.start));
  };
  // Barre fantôme : un clic sur une ligne sans date lui donne la plage survolée
  const placeAt = (row: GanttRow, start: string, end: string) => run(() => setDates(row.kind === 'project' ? 'project' : 'item', row.id as string, start, end), 'Dates ajoutées');

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
      {!embedded && (
        <div>
          <PageTitle>Gantt</PageTitle>
          <p className="text-gray-600 dark:text-gray-400 mt-1 font-medium">
            Tes projets, leurs phases, tâches et jalons sur une échelle de temps. Clique sur une barre pour ouvrir sa fiche.
          </p>
        </div>
      )}

      {/* Une seule ligne d'outils, comme Notion : regroupement et échelle en menus, « sans date » et « nouveau » à droite */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <MenuButton id="gantt-group" menuLabel="Regroupement" prefix="Grouper :" value={GROUPING_LABEL[grouping]}
            groups={[{ id: 'grouping', items: GROUPING_CHOICES.map(g => ({ id: g, label: GROUPING_LABEL[g], checked: grouping === g, onSelect: () => setGrouping(g) })) }]} />
          {period && <PeriodControls compact value={period} today={today} onChange={changePeriod} />}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {undated.length > 0 && (
            <MenuButton id="gantt-undated" menuLabel="Éléments sans date" value={`Sans date (${undated.length})`}
              header={<p className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400">{rights.update ? 'Clique sur un élément pour le placer aujourd\'hui' : 'Éléments qui n\'ont pas encore de dates'}</p>}
              groups={[{ id: 'undated', items: undated.map(r => ({
                id: r.key,
                label: `${r.name} · ${kindName(r)}${r.kind !== 'project' && r.projectId ? ` · ${projectName.get(r.projectId) ?? ''}` : ''}`,
                onSelect: () => { if (rights.update) void place(r); else openRow(r); },
              })) }]} />
          )}
          <MenuButton id="gantt-more" menuLabel="Affichage" iconOnly ariaLabel="Plus d'options d'affichage" icon={<MoreHorizontal size={16} />}
            groups={[{ id: 'colorby', label: 'Couleur des barres', items: [
              { id: 'status', label: 'Par état', checked: colorBy === 'status', onSelect: () => setColorBy('status') },
              { id: 'project', label: 'Par projet', checked: colorBy === 'project', onSelect: () => setColorBy('project') },
            ] }]}
            actions={[
              { id: 'expand', label: 'Tout déplier', icon: ChevronsUpDown, onSelect: () => setExpanded(new Set(model.expandable)) },
              { id: 'collapse', label: 'Replier', icon: ChevronsDownUp, onSelect: () => setExpanded(defaultExpanded(model)) },
              { id: 'names', label: showNames ? 'Masquer la liste' : 'Afficher la liste', icon: PanelLeft, onSelect: () => setShowNames(!showNames) },
            ]} />
          {rights.create && (
            <MenuButton id="gantt-new" menuLabel="Créer" variant="primary" icon={<Plus size={14} />} value="Nouveau"
              actions={[
                { id: 'project', label: 'Nouveau projet', onSelect: () => setProjectTarget({ mode: 'new' }) },
                ...(data.projects.length > 0 ? [
                  { id: 'task', label: 'Nouvelle tâche', onSelect: () => setItemTarget({ mode: 'new', kind: 'task' }) },
                  { id: 'phase', label: 'Nouvelle phase', onSelect: () => setItemTarget({ mode: 'new', kind: 'phase' }) },
                  { id: 'milestone', label: 'Nouveau jalon', onSelect: () => setItemTarget({ mode: 'new', kind: 'milestone' }) },
                ] : []),
              ]} />
          )}
        </div>
      </div>

      {!period ? null : rows.length === 0 ? (
        <MxEmpty icon={CalendarCheck} title="Rien à afficher" description="Crée d'abord un projet dans PILOTE › Projets : il apparaîtra ici avec ses phases, tâches et jalons." />
      ) : (
        <GanttChart rows={rows} links={data.links} period={period} today={today} locale={LOCALES[getLanguage()]} expanded={expanded} canCreate={rights.create}
          onToggle={toggle} onOpen={openRow} onAdd={addIn} canEdit={rights.update} onMove={moveRow} onResize={resizeRow} onCreate={createInline}
          showNames={showNames} onJump={jumpTo} onPlace={rights.update ? placeAt : undefined} />
      )}

      <ItemDrawer data={data} target={itemTarget} canUpdate={rights.update} canCreate={rights.create} canDelete={rights.delete} onClose={() => setItemTarget(null)} onSaved={reload} />
      <ProjectForm data={data} target={projectTarget} readOnly={projectTarget?.mode === 'edit' && !rights.update} onClose={() => setProjectTarget(null)} onSaved={reload} />
    </div>
  );
};

export default PiloteGantt;
