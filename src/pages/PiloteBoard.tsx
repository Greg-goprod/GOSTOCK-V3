import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarRange, Columns3, MoreHorizontal, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useApp } from '../contexts/AppContext';
import { filterGantt, hasFilters } from '../lib/ganttFilters';
import { buildBoard, type BoardCard, type BoardMode } from '../lib/boardCalendarModel';
import { ITEM_KIND_LABEL, loadGantt, loadPiloteRights, piloteError, PRIORITY_LABEL, updateIfUnchanged, isConflict, type GanttData, type ItemKind, type PiloteRights } from '../lib/pilote';
import { formatDay } from '../lib/zurichTime';
import { MxEmpty } from '../components/mx/MxEmpty';
import { MxSegmented } from '../components/mx/MxSegmented';
import MenuButton from '../components/common/MenuButton';
import Button from '../components/common/Button';
import ItemDrawer, { type ItemTarget } from '../components/pilote/ItemDrawer';
import ProjectForm, { type ProjectTarget } from '../components/pilote/ProjectForm';
import GanttFilterBar from '../components/pilote/GanttFilterBar';
import { useViewFilters } from '../components/pilote/useViewFilters';

const NO_RIGHTS: PiloteRights = { create: false, update: false, delete: false };
const EMPTY: GanttData = { statuses: [], projects: [], templates: [], members: [], sites: [], items: [], itemMembers: [], links: [], calendarDays: [], };
const todayZurich = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(new Date());
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('');

// PILOTE › Projets › Tableau : une colonne par état, une carte par élément (ou par projet). Glisser une carte dans une autre colonne
// change son état ; le menu « … » de la carte fait la même chose au clavier ou au toucher. Mêmes recherche et filtres que le Gantt.
const PiloteBoard: React.FC = () => {
  const [data, setData] = useState<GanttData | null>(null);
  const [rights, setRights] = useState<PiloteRights>(NO_RIGHTS);
  const [mode, setModeState] = useState<BoardMode>(() => { try { return localStorage.getItem('gomat-board-mode') === 'projects' ? 'projects' : 'items'; } catch { return 'items'; } });
  const setMode = (m: BoardMode) => { setModeState(m); try { localStorage.setItem('gomat-board-mode', m); } catch { /* préférence facultative */ } };
  const { filters, setFilters, views, saveView, deleteView, applyView } = useViewFilters();
  const { users } = useApp();
  const [itemTarget, setItemTarget] = useState<ItemTarget | null>(null);
  const [projectTarget, setProjectTarget] = useState<ProjectTarget | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);
  const busy = useRef(false);
  const today = todayZurich();

  const reload = useCallback(async () => {
    try { setData(await loadGantt()); } catch (e) { toast.error(piloteError(e)); setData(prev => prev ?? EMPTY); }
  }, []);
  useEffect(() => { void reload(); void loadPiloteRights().then(setRights); }, [reload]);

  const userName = useMemo(() => new Map(users.map(u => [u.id, `${u.first_name} ${u.last_name}`.trim()])), [users]);
  const people = useMemo(() => [...userName].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'fr')), [userName]);
  const shown = useMemo(() => filterGantt(data ?? EMPTY, filters, today), [data, filters, today]);
  // Les phases ne sont pas des cartes : elles regroupent des tâches, qui ont leur propre état
  const columns = useMemo(() => buildBoard({ ...shown, items: shown.items.filter(i => i.kind !== 'phase') }, mode, today), [shown, mode, today]);
  const total = columns.reduce((n, c) => n + c.cards.length, 0);
  const overdueCount = useMemo(() => columns.flatMap(c => c.cards).filter(c => c.overdue).length, [columns]);

  const move = async (card: BoardCard, statusId: string) => {
    if (!rights.update || busy.current || card.statusId === statusId) return;
    busy.current = true;
    try {
      await updateIfUnchanged(card.kind === 'project' ? 'cp_projects' : 'cp_items', card.id, card.version, { status_id: statusId });
      toast.success(`Déplacé vers « ${data?.statuses.find(s => s.id === statusId)?.name ?? ''} »`);
    } catch (e) {
      toast.error(e instanceof Error && isConflict(e) ? e.message : piloteError(e));
    } finally { busy.current = false; await reload(); }
  };
  const open = (card: BoardCard) => {
    if (card.kind === 'project') { const row = data?.projects.find(p => p.id === card.id); if (row) setProjectTarget({ mode: 'edit', row }); }
    else setItemTarget({ mode: 'edit', itemId: card.id });
  };

  if (!data) return <p className="text-gray-500 dark:text-gray-400 font-medium">Chargement…</p>;

  const dates = (c: BoardCard) => (c.start && c.end ? (c.start === c.end ? formatDay(c.start) : `${formatDay(c.start)} → ${formatDay(c.end)}`) : c.end ? `jusqu'au ${formatDay(c.end)}` : c.start ? `dès le ${formatDay(c.start)}` : 'Sans date');
  const kindLabel = (c: BoardCard) => (c.kind === 'project' ? 'Projet' : ITEM_KIND_LABEL[c.kind as ItemKind]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MxSegmented aria-label="Contenu du tableau" value={mode} onChange={v => setMode(v as BoardMode)} options={[{ value: 'items', label: 'Tâches et jalons' }, { value: 'projects', label: 'Projets' }]} />
        {rights.create && mode === 'items' && data.projects.length > 0 && (
          <Button icon={<Plus size={14} />} onClick={() => setItemTarget({ mode: 'new', kind: 'task' })}>Nouvelle tâche</Button>
        )}
        {rights.create && mode === 'projects' && <Button icon={<Plus size={14} />} onClick={() => setProjectTarget({ mode: 'new' })}>Nouveau projet</Button>}
      </div>

      <GanttFilterBar filters={filters} onChange={setFilters} people={people} overdueCount={overdueCount} views={views}
        onApplyView={applyView} onSaveView={() => void saveView()} onDeleteView={v => void deleteView(v)} />

      {total === 0 && hasFilters(filters) ? (
        <MxEmpty icon={Columns3} title="Aucun résultat" description="Aucune carte ne correspond à ces filtres. Utilise « Tout afficher » pour revenir à la liste complète." />
      ) : total === 0 ? (
        <MxEmpty icon={Columns3} title="Rien à afficher" description="Crée d'abord un projet et ses tâches : ils apparaîtront ici, rangés par état." />
      ) : null}

      <div className="flex items-start gap-3 overflow-x-auto pb-3" role="list" aria-label="Colonnes par état">
        {columns.map(col => (
          <section key={col.status.id} role="listitem" aria-label={`${col.status.name} (${col.cards.length})`}
            onDragOver={e => { if (rights.update) { e.preventDefault(); setOverColumn(col.status.id); } }}
            onDragLeave={() => setOverColumn(o => (o === col.status.id ? null : o))}
            onDrop={e => { e.preventDefault(); setOverColumn(null); const key = e.dataTransfer.getData('text/plain'); const card = columns.flatMap(c => c.cards).find(c => c.key === key); if (card) void move(card, col.status.id); }}
            className={`flex w-72 shrink-0 flex-col gap-2 rounded-md border bg-gray-50 p-2 dark:bg-gray-800/60 ${overColumn === col.status.id ? 'border-primary-500 ring-2 ring-primary-300' : 'border-gray-200 dark:border-gray-700'}`}>
            <header className="flex items-center gap-2 px-1">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: col.status.color }} />
              <h3 className="min-w-0 flex-1 truncate text-sm font-bold text-gray-900 dark:text-white">{col.status.name}</h3>
              <span className="rounded-full bg-gray-200 px-2 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">{col.cards.length}</span>
            </header>
            {col.cards.length === 0 && <p className="px-1 py-3 text-center text-xs text-gray-500 dark:text-gray-400">{rights.update ? 'Dépose une carte ici' : 'Aucune carte'}</p>}
            {col.cards.map(card => (
              <article key={card.key} draggable={rights.update} data-card={card.key}
                onDragStart={e => { e.dataTransfer.setData('text/plain', card.key); e.dataTransfer.effectAllowed = 'move'; }}
                className={`rounded-md border border-gray-200 bg-white p-2.5 shadow-sm dark:border-gray-700 dark:bg-gray-900 ${rights.update ? 'cursor-grab active:cursor-grabbing' : ''}`}
                style={{ borderLeft: `4px solid ${card.color}` }}>
                <div className="flex items-start gap-1.5">
                  <button type="button" onClick={() => open(card)} className="min-w-0 flex-1 break-words text-left text-sm font-medium text-gray-900 hover:underline dark:text-gray-100" title={`${kindLabel(card)} · ${card.name}`}>
                    {card.name}
                  </button>
                  {rights.update && (
                    <MenuButton id={`board-move-${card.key}`} menuLabel={`Déplacer ${card.name}`} iconOnly ariaLabel={`Déplacer « ${card.name} » vers un autre état`} icon={<MoreHorizontal size={14} />}
                      groups={[{ id: 'status', label: 'Déplacer vers', items: columns.map(c => ({ id: c.status.id, label: c.status.name, checked: c.status.id === card.statusId, onSelect: () => void move(card, c.status.id) })) }]} />
                  )}
                </div>
                {card.kind !== 'project' && <p className="mt-0.5 truncate text-xs text-gray-600 dark:text-gray-400">{`${kindLabel(card)} · ${card.projectName}`}</p>}
                <p className={`mt-1 flex items-center gap-1 text-xs ${card.overdue ? 'font-semibold text-danger-600' : 'text-gray-600 dark:text-gray-400'}`}>
                  {card.overdue ? <AlertTriangle size={12} role="img" aria-label="En retard" /> : <CalendarRange size={12} aria-hidden />}
                  <span>{dates(card)}</span>
                </p>
                {(card.priority || card.assignees.length > 0) && (
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    {card.priority ? <span className="text-xs text-gray-700 dark:text-gray-300"><span>Priorité :</span> <span>{PRIORITY_LABEL[card.priority]}</span></span> : <span />}
                    <span className="flex -space-x-1">
                      {card.assignees.slice(0, 3).map(id => (
                        <span key={id} title={userName.get(id) ?? ''} className="flex h-6 w-6 items-center justify-center rounded-full border border-white bg-primary-100 text-[10px] font-bold text-primary-800 dark:border-gray-900 dark:bg-primary-900 dark:text-primary-100">{initials(userName.get(id) ?? '?')}</span>
                      ))}
                      {card.assignees.length > 3 && <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white bg-gray-200 text-[10px] font-bold text-gray-700 dark:border-gray-900 dark:bg-gray-700 dark:text-gray-200">{`+${card.assignees.length - 3}`}</span>}
                    </span>
                  </div>
                )}
              </article>
            ))}
          </section>
        ))}
      </div>

      <ItemDrawer data={data} target={itemTarget} canUpdate={rights.update} canCreate={rights.create} canDelete={rights.delete} onClose={() => setItemTarget(null)} onSaved={reload} />
      <ProjectForm data={data} target={projectTarget} readOnly={projectTarget?.mode === 'edit' && !rights.update} onClose={() => setProjectTarget(null)} onSaved={reload} />
    </div>
  );
};

export default PiloteBoard;
