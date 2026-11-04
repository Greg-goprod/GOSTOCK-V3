import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, Layers, ListChecks, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import { FAMILY_LABEL, FAMILY_ORDER, loadPilote, loadPiloteRights, piloteError, SHOW_PROGRAMS, STATE_COLORS, type CpProgram, type CpStatus, type PiloteData, type PiloteRights } from '../lib/pilote';
import { formatDay } from '../lib/zurichTime';
import PageTitle from '../components/common/PageTitle';
import { MxBadge } from '../components/mx/MxBadge';
import { MxSegmented } from '../components/mx/MxSegmented';
import { CrudSection } from '../components/sitePlanning/CrudSection';
import ProjectsSection from '../components/pilote/ProjectsSection';
import MyTasks from '../components/pilote/MyTasks';
import MenuButton from '../components/common/MenuButton';
import PiloteGantt from './PiloteGantt';

type Section = 'gantt' | 'projects' | 'mytasks' | 'programs' | 'statuses';
const VIEWS: Section[] = ['gantt', 'projects', 'mytasks'];

const NO_RIGHTS: PiloteRights = { create: false, update: false, delete: false };
const Dot = ({ color }: { color: string }) => <span aria-hidden className="inline-block h-3 w-3 rounded-full align-middle" style={{ background: color }} />;
const TONE = { not_started: 'neutral', in_progress: 'info', done: 'success', cancelled: 'danger' } as const;

// PILOTE › Projets (module payant) : une seule page, quatre vues (Gantt, Projets en liste ou en cartes, Mes tâches) ;
// les états d'avancement se règlent derrière l'icône des réglages. L'ancienne adresse /pilote/gantt ouvre la vue Gantt.
const PiloteProjects: React.FC<{ initialView?: Section }> = ({ initialView }) => {
  const [data, setData] = useState<PiloteData | null>(null);
  const [rights, setRights] = useState<PiloteRights>(NO_RIGHTS);
  // Les avis PILOTE ouvrent directement « Mes tâches » (?section=mytasks)
  const [params] = useSearchParams();
  const asked = params.get('view') ?? params.get('section');
  const [section, setSection] = useState<Section>(initialView ?? (VIEWS.includes(asked as Section) ? (asked as Section) : 'projects'));

  const reload = useCallback(async () => {
    try { setData(await loadPilote()); } catch (e) { toast.error(piloteError(e)); setData(prev => prev ?? { statuses: [], programs: [], projects: [], members: [], sites: [] }); }
  }, []);
  useEffect(() => { void reload(); void loadPiloteRights().then(setRights); }, [reload]);

  if (!data) return <p className="text-gray-500 dark:text-gray-400 font-medium">Chargement…</p>;

  const settingsOpen = section === 'statuses';

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
          <MxSegmented aria-label="Vues des projets" value={section} onChange={v => setSection(v as Section)} options={[
            { value: 'gantt', label: 'Gantt' },
            { value: 'projects', label: `Projets (${data.projects.length})` },
            { value: 'mytasks', label: 'Mes tâches' },
            ...(SHOW_PROGRAMS ? [{ value: 'programs', label: `Programmes (${data.programs.length})` }] : []),
          ]} />
          <MenuButton id="pilote-settings" menuLabel="Réglages des projets" iconOnly ariaLabel="Réglages des projets" icon={<Settings size={16} />}
            actions={[{ id: 'statuses', label: `États d'avancement (${data.statuses.length})`, icon: ListChecks, onSelect: () => setSection('statuses') }]} />
        </div>
      )}

      {section === 'gantt' && <PiloteGantt embedded />}

      {section === 'projects' && <ProjectsSection data={data} rights={rights} onChanged={reload} />}

      {section === 'mytasks' && <MyTasks rights={rights} />}

      {SHOW_PROGRAMS && section === 'programs' && (
        <CrudSection<CpProgram>
          title="Programmes" addLabel="Nouveau programme" table="cp_programs" rights={rights} onChanged={reload} errorText={piloteError}
          rows={data.programs} emptyIcon={Layers} emptyTitle="Aucun programme" emptyText="Un programme regroupe plusieurs projets : une année, une gamme, un client…"
          deleteMessage={p => `Supprimer le programme « ${p.name} » ? Ses projets sont conservés, sans programme.`}
          fields={[
            { key: 'name', label: 'Nom', type: 'text', required: true },
            { key: 'description', label: 'Description', type: 'textarea' },
            { key: 'starts_on', endKey: 'ends_on', label: 'Période (début et fin)', type: 'daterange' },
            { key: 'color', label: 'Couleur', type: 'color' },
          ]}
          columns={[
            { id: 'name', label: 'Programme', render: p => <span className="inline-flex items-center gap-2"><Dot color={p.color} /><span className="font-medium">{p.name}</span></span> },
            { id: 'period', label: 'Période', hideOnMobile: true, render: p => (p.starts_on || p.ends_on ? `${formatDay(p.starts_on)} → ${formatDay(p.ends_on)}` : '—') },
            { id: 'projects', label: 'Projets', render: p => data.projects.filter(x => x.program_id === p.id).length },
          ]}
        />
      )}

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
