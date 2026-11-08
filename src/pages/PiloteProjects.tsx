import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, CalendarOff, ListChecks, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import { loadBudgetRights } from '../lib/budget';
import { FAMILY_LABEL, FAMILY_ORDER, loadGantt, loadPilote, loadPiloteRights, piloteError, STATE_COLORS, type CpStatus, type GanttData, type PiloteData, type PiloteRights } from '../lib/pilote';
import PageTitle from '../components/common/PageTitle';
import { MxBadge } from '../components/mx/MxBadge';
import { MxSegmented } from '../components/mx/MxSegmented';
import { CrudSection } from '../components/sitePlanning/CrudSection';
import ProjectsSection from '../components/pilote/ProjectsSection';
import ItemDrawer from '../components/pilote/ItemDrawer';
import MyTasks from '../components/pilote/MyTasks';
import CalendarSettings from '../components/pilote/CalendarSettings';
import TemplatesSection from '../components/pilote/TemplatesSection';
import MenuButton from '../components/common/MenuButton';
import PiloteGantt from './PiloteGantt';
import PiloteBoard from './PiloteBoard';
import PiloteCalendar from './PiloteCalendar';
import PiloteWorkload from './PiloteWorkload';
import PiloteDashboard from './PiloteDashboard';
import PiloteBudget from './PiloteBudget';
import { usePiloteLive } from '../components/pilote/usePiloteLive';

type Section = 'dashboard' | 'budget' | 'gantt' | 'board' | 'agenda' | 'workload' | 'projects' | 'mytasks' | 'templates' | 'statuses' | 'calendar';
const VIEWS: Section[] = ['dashboard', 'budget', 'gantt', 'board', 'agenda', 'workload', 'projects', 'mytasks', 'templates'];
// « Pilotage » regroupe trois vues de pilotage du portefeuille : la synthèse, le budget et la charge (les adresses ?view=dashboard, budget et workload restent valables)
type PilotageView = 'dashboard' | 'budget' | 'workload';
const PILOTAGE: PilotageView[] = ['dashboard', 'budget', 'workload'];
const isPilotage = (s: Section): s is PilotageView => (PILOTAGE as Section[]).includes(s);

const NO_RIGHTS: PiloteRights = { create: false, update: false, delete: false };
const Dot = ({ color }: { color: string }) => <span aria-hidden className="inline-block h-3 w-3 rounded-full align-middle" style={{ background: color }} />;
const TONE = { not_started: 'neutral', in_progress: 'info', done: 'success', cancelled: 'danger' } as const;

// PILOTE › Projets (module payant) : une seule page, quatre vues (Gantt, Projets en liste ou en cartes, Mes tâches) ;
// les états d'avancement se règlent derrière l'icône des réglages. L'ancienne adresse /pilote/gantt ouvre la vue Gantt.
const PiloteProjects: React.FC<{ initialView?: Section }> = ({ initialView }) => {
  const [data, setData] = useState<PiloteData | null>(null);
  const [rights, setRights] = useState<PiloteRights>(NO_RIGHTS);
  // Liens des avis PILOTE : ?item=… ouvre la fiche de l'élément, ?project=… celle du projet (&focus=discussion : sur la discussion) ;
  // sans lien précis, ?section=mytasks ouvre « Mes tâches ». Les paramètres sont effacés une fois la fiche ouverte (actualiser ne la rouvre pas).
  const [params, setParams] = useSearchParams();
  const asked = params.get('view') ?? params.get('section');
  const itemParam = params.get('item');
  const projectParam = params.get('project');
  const focus: 'discussion' | undefined = params.get('focus') === 'discussion' ? 'discussion' : undefined;
  const [section, setSection] = useState<Section>(initialView ?? (VIEWS.includes(asked as Section) ? (asked as Section) : 'projects'));
  // Le budget est réservé aux personnes qui ont le droit « budget » : sans lui, la sous-vue n'est pas proposée
  const [canBudget, setCanBudget] = useState(false);
  const [lastPilotage, setLastPilotage] = useState<PilotageView>('dashboard');
  const [deepItem, setDeepItem] = useState<{ itemId: string; data: GanttData; focus?: 'discussion' } | null>(null);

  const clearLink = useCallback(() => {
    setParams(prev => { const next = new URLSearchParams(prev); ['item', 'project', 'focus'].forEach(k => next.delete(k)); return next; }, { replace: true });
  }, [setParams]);
  const clearLinkRef = useRef(clearLink);
  clearLinkRef.current = clearLink;
  const gone = () => toast("Cet élément n'existe plus, ou tu n'y as plus accès.");

  useEffect(() => {
    if (!itemParam) return;
    let cancelled = false;
    void (async () => {
      try {
        const g = await loadGantt();
        if (cancelled) return;
        if (g.items.some(i => i.id === itemParam)) setDeepItem({ itemId: itemParam, data: g, focus });
        else { gone(); }
      } catch (e) { if (!cancelled) toast.error(piloteError(e)); }
      if (!cancelled) clearLinkRef.current();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seul le changement d'élément demandé relance le chargement
  }, [itemParam]);
  useEffect(() => { if (projectParam) setSection('projects'); }, [projectParam]);
  const reload = useCallback(async () => {
    try { setData(await loadPilote()); } catch (e) { toast.error(piloteError(e)); setData(prev => prev ?? { statuses: [], projects: [], templates: [], members: [], sites: [] }); }
  }, []);
  useEffect(() => { void reload(); void loadPiloteRights().then(setRights); void loadBudgetRights().then(r => setCanBudget(r.read)); }, [reload]);
  useEffect(() => { if (isPilotage(section)) setLastPilotage(section); }, [section]);
  usePiloteLive(reload, !!deepItem);
  const closeDeepItem = useCallback(() => setDeepItem(null), []);
  const refreshDeepItem = useCallback(async () => {
    const g = await loadGantt();
    setDeepItem(prev => (prev ? { ...prev, data: g } : prev));
    await reload();
  }, [reload]);


  if (!data) return <p className="text-gray-500 dark:text-gray-400 font-medium">Chargement…</p>;

  const settingsOpen = section === 'statuses' || section === 'calendar';

  return (
    <div className="space-y-4">
      <div>
        <PageTitle>Projets</PageTitle>
        <p className="text-gray-600 dark:text-gray-400 mt-1 font-medium">
          Tes projets de toute nature (chantier, R&amp;D, conception, recrutement, administratif, évènement), avec leur état et leur équipe. « Mes tâches » rassemble ce qui t'est assigné.
        </p>
      </div>

      {settingsOpen ? (
        <button type="button" onClick={() => setSection('projects')} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:underline dark:text-primary-300">
          <ArrowLeft size={14} aria-hidden /> Retour aux projets
        </button>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <MxSegmented aria-label="Vues des projets" value={isPilotage(section) ? 'pilotage' : section} onChange={v => setSection(v === 'pilotage' ? lastPilotage : v as Section)} options={[
            { value: 'pilotage', label: 'Pilotage' },
            { value: 'gantt', label: 'Gantt' },
            { value: 'board', label: 'Tableau' },
            { value: 'agenda', label: 'Calendrier' },
            { value: 'projects', label: `Projets (${data.projects.length})` },
            { value: 'mytasks', label: 'Mes tâches' },
            { value: 'templates', label: `Modèles (${data.templates.length})` },
          ]} />
          <MenuButton id="pilote-settings" menuLabel="Réglages des projets" iconOnly ariaLabel="Réglages des projets" icon={<Settings size={16} />}
            actions={[
              { id: 'statuses', label: `États d'avancement (${data.statuses.length})`, icon: ListChecks, onSelect: () => setSection('statuses') },
              { id: 'calendar', label: 'Calendrier de travail', icon: CalendarOff, onSelect: () => setSection('calendar') },
            ]} />
        </div>
      )}

      {!settingsOpen && isPilotage(section) && (
        <MxSegmented aria-label="Pilotage" value={section} onChange={v => setSection(v as Section)} options={[
          { value: 'dashboard', label: 'Synthèse' },
          ...(canBudget || section === 'budget' ? [{ value: 'budget', label: 'Budget' }] : []),
          { value: 'workload', label: 'Charge' },
        ]} />
      )}

      {section === 'dashboard' && <PiloteDashboard />}

      {section === 'budget' && <PiloteBudget />}

      {section === 'gantt' && <PiloteGantt embedded />}

      {section === 'board' && <PiloteBoard />}

      {section === 'agenda' && <PiloteCalendar />}

      {section === 'workload' && <PiloteWorkload />}

      {section === 'projects' && (
        <ProjectsSection data={data} rights={rights} onChanged={reload} linkedProjectId={projectParam} linkedFocus={focus}
          onLinkHandled={found => { if (!found) toast("Ce projet n'existe plus, ou tu n'y as plus accès."); clearLink(); }} />
      )}

      {section === 'mytasks' && <MyTasks rights={rights} />}

      {section === 'templates' && (
        <TemplatesSection data={data} rights={rights} onChanged={reload} onCreated={id => { setSection('projects'); setParams(prev => { const next = new URLSearchParams(prev); next.set('project', id); return next; }, { replace: true }); }} />
      )}

      {deepItem && (
        <ItemDrawer data={deepItem.data} target={{ mode: 'edit', itemId: deepItem.itemId }} canUpdate={rights.update} canCreate={rights.create} canDelete={rights.delete}
          focus={deepItem.focus} onClose={closeDeepItem} onSaved={refreshDeepItem} />
      )}

      {section === 'calendar' && <CalendarSettings rights={rights} />}

      {section === 'statuses' && (
        <CrudSection<CpStatus>
          title="États d'avancement" addLabel="Nouvel état" table="cp_statuses" baseValues={{ position: 10 }} rights={rights} onChanged={reload} errorText={piloteError}
          rows={data.statuses} emptyIcon={ListChecks} emptyTitle="Aucun état" emptyText="Les 4 états de base sont créés avec l'entreprise."
          deleteMessage={s => `Supprimer l'état « ${s.name} » ?`}
          canDelete={s => !s.is_system}
          fields={[
            { key: 'name', label: 'Nom', type: 'text', required: true },
            { key: 'family', label: 'Famille', type: 'select', required: true, lockedOnEdit: true, options: FAMILY_ORDER.map(f => ({ value: f, label: FAMILY_LABEL[f] })),
              hint: 'La famille décide du calcul d\'avancement et des filtres ; elle ne change plus après la création.' },
            { key: 'color', label: 'Couleur', type: 'color', palette: STATE_COLORS },
          ]}
          columns={[
            { id: 'name', label: 'État', render: s => <span className="inline-flex items-center gap-2"><Dot color={s.color} /><span className="font-medium">{s.name}</span>{s.is_system && <MxBadge tone="neutral">De base</MxBadge>}</span> },
            { id: 'family', label: 'Famille', render: s => <MxBadge tone={TONE[s.family]}>{FAMILY_LABEL[s.family]}</MxBadge> },
            { id: 'projects', label: 'Projets', render: s => data.projects.filter(x => x.status_id === s.id).length },
          ]}
        />
      )}
    </div>
  );
};

export default PiloteProjects;
