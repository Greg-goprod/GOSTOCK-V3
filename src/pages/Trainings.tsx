import React, { useEffect, useMemo, useState } from 'react';
import { GraduationCap, Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import PhotoInput from '../components/common/PhotoInput';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { fileUrl } from '../lib/files';
import { errorMessage } from '../lib/requests';
import DateInput from '../components/common/DateInput';
import { confirmAction } from '../lib/confirm';

interface Training {
  id: string;
  name: string;
  validity_months: number | null;
  description: string | null;
  kind: 'training' | 'machine_permit';
}

interface UserTraining {
  id: string;
  user_id: string;
  training_id: string;
  obtained_on: string;
  expires_on: string | null;
  certificate_path: string | null;
  notes: string | null;
}

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const DAY = 24 * 60 * 60 * 1000;
const today = () => new Date().toISOString().slice(0, 10);

const stateOf = (ut: UserTraining) => {
  if (!ut.expires_on) return { label: 'Sans échéance', className: 'bg-success-100 text-success-800 dark:bg-success-900/40 dark:text-success-200' };
  const days = Math.floor((new Date(ut.expires_on).getTime() - Date.now()) / DAY);
  const until = new Date(ut.expires_on).toLocaleDateString('fr-CH');
  if (days < 0) return { label: `Expirée le ${until}`, className: 'bg-danger-100 text-danger-800 dark:bg-danger-900/40 dark:text-danger-200' };
  if (days <= 30) return { label: `Expire le ${until}`, className: 'bg-warning-100 text-warning-800 dark:bg-warning-900/40 dark:text-warning-200' };
  return { label: `Valable jusqu'au ${until}`, className: 'bg-success-100 text-success-800 dark:bg-success-900/40 dark:text-success-200' };
};

// Formations obligatoires : qui peut utiliser la nacelle, le chariot, la tronçonneuse…
const Trainings: React.FC = () => {
  const { users, equipment } = useApp();
  const { can } = useAuth();
  const canEdit = can('manage_people');
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [holders, setHolders] = useState<UserTraining[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [editingTraining, setEditingTraining] = useState<Training | 'new' | null>(null);
  const [trainingForm, setTrainingForm] = useState({ name: '', validity_months: '', description: '', kind: 'machine_permit' as Training['kind'] });
  const [editingHolder, setEditingHolder] = useState<UserTraining | 'new' | null>(null);
  const [holderForm, setHolderForm] = useState({ user_id: '', obtained_on: today(), expires_on: '', certificate: [] as string[], notes: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [t, h] = await Promise.all([
      supabase.from('trainings').select('*').order('name'),
      supabase.from('user_trainings').select('*'),
    ]);
    if (t.error) toast.error(errorMessage(t.error));
    const list = (t.data || []) as Training[];
    setTrainings(list);
    setHolders((h.data || []) as UserTraining[]);
    setSelected(current => current ?? list[0]?.id ?? null);
  };

  useEffect(() => {
    load();
  }, []);

  const training = trainings.find(t => t.id === selected) ?? null;
  const name = (id: string) => {
    const u = users.find(x => x.id === id);
    return u ? `${u.first_name} ${u.last_name}` : 'Personne supprimée';
  };
  const selectedHolders = useMemo(
    () => holders.filter(h => h.training_id === selected).sort((a, b) => name(a.user_id).localeCompare(name(b.user_id), 'fr')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [holders, selected, users]
  );
  const requiredBy = equipment.filter(e => e.requiredTrainingId && e.requiredTrainingId === selected);
  const soonCount = (id: string) => holders.filter(h => h.training_id === id && h.expires_on && new Date(h.expires_on).getTime() - Date.now() <= 30 * DAY).length;

  const openTraining = (t: Training | 'new') => {
    setEditingTraining(t);
    setTrainingForm(t === 'new' ? { name: '', validity_months: '', description: '', kind: 'machine_permit' } : {
      name: t.name, validity_months: t.validity_months === null ? '' : String(t.validity_months), description: t.description ?? '',
      kind: t.kind ?? 'training',
    });
  };

  const saveTraining = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const row = {
      name: trainingForm.name.trim(),
      validity_months: trainingForm.validity_months === '' ? null : Number(trainingForm.validity_months),
      description: trainingForm.description.trim() || null,
      kind: trainingForm.kind,
    };
    const result = editingTraining === 'new'
      ? await supabase.from('trainings').insert(row).select('id').single()
      : await supabase.from('trainings').update(row).eq('id', (editingTraining as Training).id).select('id').single();
    setSaving(false);
    if (result.error) {
      toast.error(result.error.code === '23505' ? 'Cette formation existe déjà' : errorMessage(result.error));
      return;
    }
    setEditingTraining(null);
    setSelected(result.data.id);
    await load();
  };

  const removeTraining = async (t: Training) => {
    if (!await confirmAction(`Supprimer la formation « ${t.name} » ? Les attestations saisies et l'exigence sur les outils seront retirées.`)) return;
    const { error } = await supabase.from('trainings').delete().eq('id', t.id);
    if (error) return toast.error(errorMessage(error));
    setSelected(null);
    await load();
  };

  const openHolder = (h: UserTraining | 'new') => {
    setEditingHolder(h);
    setHolderForm(h === 'new'
      ? { user_id: '', obtained_on: today(), expires_on: '', certificate: [], notes: '' }
      : { user_id: h.user_id, obtained_on: h.obtained_on, expires_on: h.expires_on ?? '', certificate: h.certificate_path ? [h.certificate_path] : [], notes: h.notes ?? '' });
  };

  const saveHolder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    const row = {
      user_id: holderForm.user_id,
      training_id: selected,
      obtained_on: holderForm.obtained_on,
      // Vide : calculée d'après la validité de la formation
      expires_on: holderForm.expires_on || null,
      certificate_path: holderForm.certificate[0] ?? null,
      notes: holderForm.notes.trim() || null,
    };
    const { error } = editingHolder === 'new'
      ? await supabase.from('user_trainings').insert(row)
      : await supabase.from('user_trainings').update(row).eq('id', (editingHolder as UserTraining).id);
    setSaving(false);
    if (error) {
      toast.error(error.code === '23505' ? 'Cette personne a déjà cette formation : modifie la ligne existante' : errorMessage(error));
      return;
    }
    setEditingHolder(null);
    await load();
  };

  const removeHolder = async (h: UserTraining) => {
    if (!await confirmAction(`Retirer la formation à ${name(h.user_id)} ?`)) return;
    const { error } = await supabase.from('user_trainings').delete().eq('id', h.id);
    if (error) return toast.error(errorMessage(error));
    await load();
  };

  const openCertificate = async (path: string) => {
    const url = await fileUrl(path);
    if (url) window.open(url, '_blank', 'noopener');
  };

  const holderIds = new Set(selectedHolders.map(h => h.user_id));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="mx-page-title">Formations et permis machines</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Un outil qui exige un permis machine ou une formation ne sort pas pour quelqu'un qui ne l'a pas, ou dont l'attestation est expirée.</p>
        </div>
        {canEdit && <Button icon={<Plus size={16} />} onClick={() => openTraining('new')}>Nouveau permis ou formation</Button>}
      </div>

      {trainings.length === 0 ? (
        <div className="rounded-lg bg-white dark:bg-gray-800 shadow p-6 text-sm text-gray-600 dark:text-gray-400">
          Aucun permis ni formation. Exemples : nacelle PEMP IPAF 3b (5 ans), chariot élévateur, grutier, travail en hauteur.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          <ul className="rounded-lg bg-white dark:bg-gray-800 shadow divide-y divide-gray-200 dark:divide-gray-700 self-start">
            {[...trainings].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'machine_permit' ? -1 : 1)).map((t, index, list) => {
              const soon = soonCount(t.id);
              const header = index === 0 || list[index - 1].kind !== t.kind;
              return (
                <li key={t.id}>
                  {header && <p className="mx-section-label px-4 pt-3 pb-1">{t.kind === 'machine_permit' ? 'Permis machines' : 'Formations'}</p>}
                  <button type="button" aria-current={selected === t.id} onClick={() => setSelected(t.id)}
                    className={`w-full text-left px-4 py-3 min-h-[44px] text-sm ${selected === t.id ? 'bg-primary-50 dark:bg-primary-900/40 font-bold text-primary-800 dark:text-primary-200' : 'text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                    <span className="flex items-center gap-2">
                      <GraduationCap size={16} aria-hidden="true" className="shrink-0" />
                      <span className="flex-1 truncate">{t.name}</span>
                      <span className="font-mono text-xs text-gray-500">{holders.filter(h => h.training_id === t.id).length}</span>
                    </span>
                    {soon > 0 && <span className="block text-xs text-tone-warning font-normal">{soon} à renouveler</span>}
                  </button>
                </li>
              );
            })}
          </ul>

          {training && (
            <section className="rounded-lg bg-white dark:bg-gray-800 shadow p-4 space-y-4 min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-bold text-gray-900 dark:text-white">{training.name}</h2>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {training.validity_months ? `Valable ${training.validity_months} mois` : 'Sans échéance'}
                    {training.description ? ` · ${training.description}` : ''}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Exigée pour : {requiredBy.length ? requiredBy.map(e => e.name).join(', ') : 'aucun outil (à choisir dans la fiche de l\'outil)'}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" icon={<Pencil size={14} />} ariaLabel="Modifier la formation" onClick={() => openTraining(training)} />
                    <Button size="sm" variant="danger" icon={<Trash2 size={14} />} ariaLabel="Supprimer la formation" onClick={() => removeTraining(training)} />
                  </div>
                )}
              </div>

              {selectedHolders.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">Personne n'a encore cette formation.</p>
              ) : (
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {selectedHolders.map(h => {
                    const state = stateOf(h);
                    return (
                      <li key={h.id} className="py-2 flex flex-wrap items-center gap-2 text-sm">
                        <span className="flex-1 min-w-[10rem] font-medium text-gray-900 dark:text-gray-100">{name(h.user_id)}</span>
                        <span className="text-xs text-gray-600 dark:text-gray-400">obtenue le {new Date(h.obtained_on).toLocaleDateString('fr-CH')}</span>
                        <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${state.className}`}>{state.label}</span>
                        {h.certificate_path && (
                          <Button size="sm" variant="outline" onClick={() => openCertificate(h.certificate_path!)}>Attestation</Button>
                        )}
                        {canEdit && (
                          <>
                            <Button size="sm" variant="outline" icon={<Pencil size={14} />} ariaLabel={`Modifier pour ${name(h.user_id)}`} onClick={() => openHolder(h)} />
                            <Button size="sm" variant="outline" icon={<Trash2 size={14} />} ariaLabel={`Retirer à ${name(h.user_id)}`} onClick={() => removeHolder(h)} />
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {canEdit && <Button variant="outline" icon={<Plus size={16} />} onClick={() => openHolder('new')}>Ajouter une personne</Button>}
            </section>
          )}
        </div>
      )}

      <Modal isOpen={editingTraining !== null} onClose={() => setEditingTraining(null)} title={editingTraining === 'new' ? 'Nouveau permis ou formation' : 'Modifier'}>
        <form onSubmit={saveTraining} className="space-y-3">
          <div>
            <label htmlFor="training-kind" className={labelClass}>Type</label>
            <select id="training-kind" value={trainingForm.kind} onChange={e => setTrainingForm({ ...trainingForm, kind: e.target.value as Training['kind'] })} className={inputClass}>
              <option value="machine_permit">Permis machine (cariste, nacelle, grutier, machiniste…)</option>
              <option value="training">Formation (travail en hauteur, premiers secours…)</option>
            </select>
          </div>
          <div>
            <label htmlFor="training-name" className={labelClass}>Nom</label>
            <input id="training-name" value={trainingForm.name} onChange={e => setTrainingForm({ ...trainingForm, name: e.target.value })} className={inputClass} required placeholder="ex. Nacelle PEMP 3B" />
          </div>
          <div>
            <label htmlFor="training-validity" className={labelClass}>Validité (mois)</label>
            <input id="training-validity" type="number" min={1} value={trainingForm.validity_months} onChange={e => setTrainingForm({ ...trainingForm, validity_months: e.target.value })} className={`${inputClass} font-mono`} placeholder="vide = sans échéance" />
          </div>
          <div>
            <label htmlFor="training-desc" className={labelClass}>Remarque</label>
            <input id="training-desc" value={trainingForm.description} onChange={e => setTrainingForm({ ...trainingForm, description: e.target.value })} className={inputClass} placeholder="ex. cours SUVA, organisme" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditingTraining(null)}>Annuler</Button>
            <Button type="submit" loading={saving}>Enregistrer</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={editingHolder !== null} onClose={() => setEditingHolder(null)} title={training ? `${training.name} : attestation` : 'Attestation'}>
        <form onSubmit={saveHolder} className="space-y-3">
          <div>
            <label htmlFor="holder-user" className={labelClass}>Personne</label>
            <select id="holder-user" value={holderForm.user_id} onChange={e => setHolderForm({ ...holderForm, user_id: e.target.value })} className={inputClass} required disabled={editingHolder !== 'new'}>
              <option value="">Choisir…</option>
              {users.filter(u => u.active !== false && (editingHolder !== 'new' || !holderIds.has(u.id))).map(u => (
                <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="holder-obtained" className={labelClass}>Obtenue le</label>
              <DateInput id="holder-obtained" value={holderForm.obtained_on} max={today()} onChange={e => setHolderForm({ ...holderForm, obtained_on: e.target.value })} className={inputClass} required />
            </div>
            <div>
              <label htmlFor="holder-expires" className={labelClass}>Valable jusqu'au</label>
              <DateInput id="holder-expires" value={holderForm.expires_on} min={holderForm.obtained_on} onChange={e => setHolderForm({ ...holderForm, expires_on: e.target.value })} className={inputClass} />
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                {training?.validity_months ? `Vide : ${training.validity_months} mois après l'obtention` : 'Vide : sans échéance'}
              </p>
            </div>
          </div>
          <PhotoInput folder="formations" value={holderForm.certificate} onChange={certificate => setHolderForm({ ...holderForm, certificate })} label="Attestation (photo ou PDF)" allowPdf max={1} />
          <div>
            <label htmlFor="holder-notes" className={labelClass}>Remarque</label>
            <input id="holder-notes" value={holderForm.notes} onChange={e => setHolderForm({ ...holderForm, notes: e.target.value })} className={inputClass} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditingHolder(null)}>Annuler</Button>
            <Button type="submit" loading={saving}>Enregistrer</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Trainings;
