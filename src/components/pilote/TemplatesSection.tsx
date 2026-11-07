import React, { useEffect, useMemo, useState } from 'react';
import { FileStack, Plus, Rocket, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { confirmAction, promptAction } from '../../lib/confirm';
import { dayNumberOf } from '../../lib/ganttModel';
import { createFromTemplate, piloteError, seedStarterTemplates, TYPE_LABEL, type CpProject, type PiloteData, type PiloteRights } from '../../lib/pilote';
import Button from '../common/Button';
import Modal from '../common/Modal';
import DateInput from '../common/DateInput';
import { MxBadge } from '../mx/MxBadge';
import { MxEmpty } from '../mx/MxEmpty';

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const todayZurich = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(new Date());

interface Props {
  data: PiloteData;
  rights: PiloteRights;
  onChanged: () => Promise<void>;
  // Appelée avec l'identifiant du projet créé (la page l'ouvre)
  onCreated: (projectId: string) => void;
}

// PILOTE › Projets › Modèles : projets types, sans équipe ni assignation. « Utiliser » crée un vrai projet dont les dates partent du début choisi.
const TemplatesSection: React.FC<Props> = ({ data, rights, onChanged, onCreated }) => {
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [using, setUsing] = useState<CpProject | null>(null);
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const ids = useMemo(() => data.templates.map(t => t.id), [data.templates]);
  useEffect(() => {
    if (ids.length === 0) { setCounts(new Map()); return; }
    let cancelled = false;
    void supabase.from('cp_items').select('project_id').in('project_id', ids).then(({ data: rows }) => {
      if (cancelled) return;
      const m = new Map<string, number>();
      for (const r of (rows || []) as { project_id: string }[]) m.set(r.project_id, (m.get(r.project_id) ?? 0) + 1);
      setCounts(m);
    });
    return () => { cancelled = true; };
  }, [ids]);

  const openUse = (t: CpProject) => { setUsing(t); setName(t.name.replace(/^Modèle\s+/i, '')); setStart(todayZurich()); };
  const submitUse = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!using || saving || !name.trim() || !start) return;
    setSaving(true);
    try {
      const id = await createFromTemplate(using.id, name.trim(), start);
      toast.success('Projet créé à partir du modèle');
      setUsing(null);
      await onChanged();
      onCreated(id);
    } catch (e) {
      toast.error(piloteError(e));
    } finally {
      setSaving(false);
    }
  };

  const seed = async () => {
    if (seeding) return;
    setSeeding(true);
    try {
      const n = await seedStarterTemplates();
      toast.success(n === 0 ? 'Les modèles de départ existent déjà' : `${n} modèle${n > 1 ? 's' : ''} créé${n > 1 ? 's' : ''}`);
      await onChanged();
    } catch (e) {
      toast.error(piloteError(e));
    } finally {
      setSeeding(false);
    }
  };

  const rename = async (t: CpProject) => {
    const next = (await promptAction('Nom du modèle', t.name))?.trim();
    if (!next || next === t.name) return;
    const { error } = await supabase.from('cp_projects').update({ name: next }).eq('id', t.id);
    if (error) return void toast.error(piloteError(error));
    await onChanged();
  };

  const remove = async (t: CpProject) => {
    if (!(await confirmAction(`Supprimer le modèle « ${t.name} » ? Les projets déjà créés avec ce modèle ne changent pas.`))) return;
    const { error } = await supabase.from('cp_projects').delete().eq('id', t.id);
    if (error) return void toast.error(piloteError(error));
    toast.success('Modèle supprimé');
    await onChanged();
  };

  const duration = (t: CpProject) => (t.starts_on && t.ends_on ? dayNumberOf(t.ends_on) - dayNumberOf(t.starts_on) + 1 : null);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Un modèle est un projet type : ses phases, tâches, jalons, dépendances et listes à cocher, sans équipe ni assignation. « Utiliser ce modèle » crée un vrai projet dont les dates partent du début que tu choisis.
        Pour en faire un à partir d'un de tes projets, ouvre ce projet puis « Enregistrer comme modèle ».
      </p>

      {rights.create && (
        <div>
          <Button variant="outline" icon={<Plus size={14} />} onClick={() => void seed()} loading={seeding}>Ajouter les modèles de départ</Button>
          <span className="ml-2 text-xs text-gray-600 dark:text-gray-400">Montage d'un événement, Recrutement, Conception / R&amp;D (ceux qui existent déjà ne sont pas recréés).</span>
        </div>
      )}

      {data.templates.length === 0 ? (
        <MxEmpty icon={FileStack} title="Aucun modèle" description="Ajoute les modèles de départ ci-dessus, ou enregistre un de tes projets comme modèle." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Modèles de projet">
          {data.templates.map(t => {
            const n = counts.get(t.id) ?? 0;
            const d = duration(t);
            return (
              <li key={t.id} className="flex flex-col gap-2 rounded-md border border-gray-200 p-3 dark:border-gray-700" style={{ borderLeft: `4px solid ${t.color}` }}>
                <div className="flex items-start gap-2">
                  <h3 className="min-w-0 flex-1 break-words text-sm font-bold text-gray-900 dark:text-white">{t.name}</h3>
                  <MxBadge tone="neutral">{TYPE_LABEL[t.type]}</MxBadge>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  <span>{`${n} élément${n > 1 ? 's' : ''}`}</span>
                  {d !== null && <> · <span>{`${d} jour${d > 1 ? 's' : ''}`}</span></>}
                </p>
                {t.description && <p className="whitespace-pre-line break-words text-xs text-gray-600 dark:text-gray-400">{t.description}</p>}
                <div className="mt-auto flex flex-wrap gap-2">
                  {rights.create && <Button size="sm" icon={<Rocket size={14} />} onClick={() => openUse(t)}>Utiliser ce modèle</Button>}
                  {rights.update && <Button size="sm" variant="outline" onClick={() => void rename(t)}>Renommer</Button>}
                  {rights.delete && <Button size="sm" variant="outline" icon={<Trash2 size={14} />} onClick={() => void remove(t)}>Supprimer</Button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal isOpen={!!using} onClose={() => setUsing(null)} title="Créer un projet à partir du modèle">
        {using && (
          <form onSubmit={submitUse} className="space-y-4">
            <div>
              <label htmlFor="tpl-name" className={labelClass}>Nom du projet</label>
              <input id="tpl-name" className={inputClass} required maxLength={200} value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="tpl-start" className={labelClass}>Début du projet</label>
              <DateInput id="tpl-start" className={inputClass} required value={start} onChange={e => setStart(e.target.value)} />
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">Toutes les dates du modèle sont décalées pour que le projet commence ce jour-là. Aucune équipe n'est reprise : tu l'ajoutes ensuite dans le projet.</p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setUsing(null)}>Annuler</Button>
              <Button type="submit" icon={<Rocket size={14} />} loading={saving} disabled={!name.trim() || !start}>Créer le projet</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default TemplatesSection;
