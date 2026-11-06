import React, { useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { duplicateProject, piloteError, type CpProject } from '../../lib/pilote';
import { dayNumberOf } from '../../lib/ganttModel';
import Button from '../common/Button';
import Modal from '../common/Modal';
import DateInput from '../common/DateInput';

interface Props {
  project: CpProject | null;
  onClose: () => void;
  // Appelée avec l'identifiant de la copie, une fois créée
  onDone: (newId: string) => void;
}

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

// « Dupliquer un projet » : nom, nouveau début (les dates suivent), équipe et assignations en option
const DuplicateProjectForm: React.FC<Props> = ({ project, onClose, onDone }) => {
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [copyTeam, setCopyTeam] = useState(true);
  const [copyAssignments, setCopyAssignments] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!project) return;
    setName(`Copie de ${project.name}`);
    setStart(project.starts_on ?? '');
    setCopyTeam(true);
    setCopyAssignments(false);
  }, [project]);

  // Un décalage qui n'est pas un multiple de 7 jours déplace les week-ends : on le dit (le début du projet sert de repère ; sans date, pas de repère)
  const shift = project?.starts_on && start ? dayNumberOf(start) - dayNumberOf(project.starts_on) : null;
  const weekendsMove = shift !== null && shift % 7 !== 0;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !project) return;
    setSaving(true);
    try {
      const id = await duplicateProject({ projectId: project.id, name: name.trim(), newStart: start || null, copyTeam, copyAssignments: copyTeam && copyAssignments });
      toast.success('Projet copié');
      onDone(id);
    } catch (error) {
      toast.error(piloteError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={!!project} onClose={onClose} title="Dupliquer le projet">
      {project && (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="dup-name" className={labelClass}>Nom de la copie</label>
            <input id="dup-name" className={inputClass} required value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="dup-start" className={labelClass}>Nouveau début</label>
            <DateInput id="dup-start" className={inputClass} value={start} onChange={e => setStart(e.target.value)} />
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              {project.starts_on ? 'Toutes les dates sont décalées du même nombre de jours. Vide : les dates sont gardées telles quelles.' : 'Ce projet n\'a pas de date de début : le décalage part de son premier élément daté. Vide : les dates sont gardées telles quelles.'}
            </p>
            {weekendsMove && <p role="status" className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">Le décalage n'est pas un multiple de 7 jours : les week-ends changent de place.</p>}
          </div>
          <fieldset className="space-y-2">
            <legend className={labelClass}>À copier aussi</legend>
            <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
              <input id="dup-team" type="checkbox" checked={copyTeam} onChange={e => { setCopyTeam(e.target.checked); if (!e.target.checked) setCopyAssignments(false); }} />
              L'équipe du projet
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
              <input id="dup-assign" type="checkbox" checked={copyTeam && copyAssignments} disabled={!copyTeam} onChange={e => setCopyAssignments(e.target.checked)} />
              Les assignations des tâches (avec l'équipe)
            </label>
          </fieldset>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Sont copiés : les phases, tâches, jalons et sous-tâches, leurs dépendances et leur liste à cocher (remise à zéro). L'état repart de « Pas commencé ». Ne sont pas copiés : le chantier lié, la discussion et les documents. Personne ne reçoit d'avis pour cette copie.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={onClose}>Annuler</Button>
            <Button type="submit" icon={<Copy size={14} />} loading={saving}>Dupliquer</Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default DuplicateProjectForm;
