import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Plus , ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import PhotoInput from '../components/common/PhotoInput';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { fileUrl } from '../lib/files';
import { errorMessage } from '../lib/requests';
import { MxEmpty } from '../components/mx/MxEmpty';

export type IncidentKind = 'lost' | 'stolen' | 'broken';
type Decision = 'pending' | 'replaced' | 'deducted' | 'insurance' | 'written_off' | 'found';

interface Incident {
  id: string;
  kind: IncidentKind;
  equipment_id: string;
  checkout_id: string | null;
  responsible_id: string | null;
  reported_by: string | null;
  occurred_at: string;
  description: string | null;
  photos: string[];
  cost: number | null;
  decision: Decision;
  decision_note: string | null;
  decided_by: string | null;
  decided_at: string | null;
}

export const INCIDENT_KINDS: Record<IncidentKind, string> = { lost: 'Perte', stolen: 'Vol', broken: 'Casse' };
const DECISIONS: Record<Decision, string> = {
  pending: 'À décider',
  replaced: 'Remplacé par l\'entreprise',
  deducted: 'Retenue sur salaire',
  insurance: 'Pris en charge par l\'assurance',
  written_off: 'Passé en perte',
  found: 'Retrouvé',
};

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const chf = (n: number) => `CHF ${n.toLocaleString('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Pertes, vols et casse : qui, quoi, combien, et la décision du responsable
const Incidents: React.FC = () => {
  const { users, equipment } = useApp();
  const { can } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [declaring, setDeclaring] = useState(false);
  const [deciding, setDeciding] = useState<Incident | null>(null);

  const load = async () => {
    const { data, error } = await supabase.from('incidents').select('*').order('occurred_at', { ascending: false });
    if (error) toast.error(errorMessage(error));
    setIncidents((data || []) as Incident[]);
  };

  useEffect(() => {
    load();
  }, []);

  const name = (id: string | null) => {
    const u = users.find(x => x.id === id);
    return u ? `${u.first_name} ${u.last_name}` : '—';
  };
  const itemName = (id: string) => equipment.find(e => e.id === id)?.name ?? 'Article';
  // Valeur par défaut d'une perte : le prix d'achat de l'article
  const valueOf = (i: Incident) => i.cost ?? equipment.find(e => e.id === i.equipment_id)?.purchasePrice ?? 0;

  const shown = filter === 'pending' ? incidents.filter(i => i.decision === 'pending') : incidents;

  // Totaux de l'année par personne responsable (hors « retrouvé »)
  const year = new Date().getFullYear();
  const byPerson = useMemo(() => {
    const totals = new Map<string, { count: number; value: number }>();
    incidents
      .filter(i => new Date(i.occurred_at).getFullYear() === year && i.decision !== 'found')
      .forEach(i => {
        const key = i.responsible_id ?? '—';
        const t = totals.get(key) ?? { count: 0, value: 0 };
        totals.set(key, { count: t.count + 1, value: t.value + valueOf(i) });
      });
    return [...totals.entries()].sort((a, b) => b[1].value - a[1].value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidents, equipment, year]);

  const openPhoto = async (path: string) => {
    const url = await fileUrl(path);
    if (url) window.open(url, '_blank', 'noopener');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="mx-page-title">Pertes et casse</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Déclarations, valeur et suite donnée par le responsable.</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setDeclaring(true)}>Déclarer</Button>
      </div>

      {byPerson.length > 0 && (
        <section className="rounded-lg bg-white dark:bg-gray-800 shadow p-4">
          <h2 className="font-bold text-gray-900 dark:text-white mb-2">{year} par personne</h2>
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {byPerson.map(([id, t]) => (
              <li key={id} className="flex justify-between py-1.5 text-sm text-gray-800 dark:text-gray-200">
                <span>{id === '—' ? 'Personne non désignée' : name(id)}</span>
                <span className="font-mono">{t.count} · {chf(t.value)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex gap-2">
        <Button size="sm" variant={filter === 'pending' ? 'primary' : 'outline'} onClick={() => setFilter('pending')}>
          À décider ({incidents.filter(i => i.decision === 'pending').length})
        </Button>
        <Button size="sm" variant={filter === 'all' ? 'primary' : 'outline'} onClick={() => setFilter('all')}>Tous ({incidents.length})</Button>
      </div>

      {shown.length === 0 ? (
        <MxEmpty icon={ShieldCheck} title="Aucun incident" />
      ) : (
        <ul className="space-y-2">
          {shown.map(i => (
            <li key={i.id} className="rounded-lg bg-white dark:bg-gray-800 shadow p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-tone-danger" aria-hidden="true" />
                  {INCIDENT_KINDS[i.kind]} · {itemName(i.equipment_id)}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {new Date(i.occurred_at).toLocaleDateString('fr-CH')} · responsable : {name(i.responsible_id)} · valeur {chf(valueOf(i))}
                  {i.description ? ` · ${i.description}` : ''}
                </p>
                <p className="text-xs mt-1">
                  <span className={i.decision === 'pending' ? 'text-tone-warning font-semibold' : 'text-gray-700 dark:text-gray-300'}>{DECISIONS[i.decision]}</span>
                  {i.decided_by ? <span className="text-gray-500"> · {i.decided_by}{i.decision_note ? ` : ${i.decision_note}` : ''}</span> : null}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                {i.photos.map((p, n) => <Button key={p} size="sm" variant="outline" onClick={() => openPhoto(p)}>Photo {n + 1}</Button>)}
                {can('approve') && <Button size="sm" onClick={() => setDeciding(i)}>{i.decision === 'pending' ? 'Décider' : 'Modifier'}</Button>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {declaring && <DeclareIncidentModal onClose={() => setDeclaring(false)} onDone={async () => { setDeclaring(false); await load(); }} />}
      {deciding && <DecideModal incident={deciding} defaultCost={valueOf(deciding)} onClose={() => setDeciding(null)} onDone={async () => { setDeciding(null); await load(); }} />}
    </div>
  );
};

/* ------------------------------------------------------------------------ */

interface DeclareProps {
  onClose: () => void;
  onDone: () => Promise<void>;
  // Déclaration depuis un emprunt précis (ex. « Mes demandes » d'un collaborateur)
  checkoutId?: string;
  equipmentId?: string;
}

export const DeclareIncidentModal: React.FC<DeclareProps> = ({ onClose, onDone, checkoutId, equipmentId }) => {
  const { users, equipment, checkouts, refreshData } = useApp();
  const { can } = useAuth();
  const [kind, setKind] = useState<IncidentKind>('lost');
  const [itemId, setItemId] = useState(equipmentId ?? '');
  const [checkout, setCheckout] = useState(checkoutId ?? '');
  const [responsible, setResponsible] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Emprunts en cours de l'article choisi : la perte se rattache à celui de la personne
  const openCheckouts = checkouts.filter(c => c.equipmentId === itemId && ['active', 'overdue'].includes(c.status));
  const userName = (id: string) => {
    const u = users.find(x => x.id === id);
    return u ? `${u.first_name} ${u.last_name}` : 'Inconnu';
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!itemId) return toast.error('Choisis l\'article');
    setSaving(true);
    const { error } = await supabase.rpc('declare_incident', {
      p_kind: kind,
      p_equipment_id: itemId,
      p_checkout_id: checkout || null,
      p_responsible_id: responsible || null,
      p_description: description || null,
      p_photos: photos,
      p_occurred_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(`${INCIDENT_KINDS[kind]} déclarée`);
    await refreshData();
    await onDone();
  };

  return (
    <Modal isOpen onClose={onClose} title="Déclarer une perte, un vol ou une casse" size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Type d'incident">
          {(Object.keys(INCIDENT_KINDS) as IncidentKind[]).map(k => (
            <Button key={k} size="sm" variant={kind === k ? 'primary' : 'outline'} onClick={() => setKind(k)}>{INCIDENT_KINDS[k]}</Button>
          ))}
        </div>
        {!equipmentId && (
          <div>
            <label htmlFor="incident-item" className={labelClass}>Article</label>
            <select id="incident-item" value={itemId} onChange={e => { setItemId(e.target.value); setCheckout(''); }} className={inputClass} required>
              <option value="">— Choisir —</option>
              {equipment.filter(e => e.itemType !== 'consumable').sort((a, b) => a.name.localeCompare(b.name)).map(e => (
                <option key={e.id} value={e.id}>{e.name}{e.articleNumber ? ` · ${e.articleNumber}` : ''}</option>
              ))}
            </select>
          </div>
        )}
        {!checkoutId && openCheckouts.length > 0 && (
          <div>
            <label htmlFor="incident-checkout" className={labelClass}>Emprunt concerné</label>
            <select id="incident-checkout" value={checkout} onChange={e => setCheckout(e.target.value)} className={inputClass}>
              <option value="">Aucun (au dépôt)</option>
              {openCheckouts.map(c => <option key={c.id} value={c.id}>{userName(c.userId)} · depuis le {new Date(c.checkoutDate).toLocaleDateString('fr-CH')}</option>)}
            </select>
          </div>
        )}
        {can('scan') && !checkout && (
          <div>
            <label htmlFor="incident-person" className={labelClass}>Personne responsable</label>
            <select id="incident-person" value={responsible} onChange={e => setResponsible(e.target.value)} className={inputClass}>
              <option value="">Non désignée</option>
              {users.filter(u => u.active !== false).map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="incident-desc" className={labelClass}>Circonstances</label>
          <textarea id="incident-desc" rows={3} value={description} onChange={e => setDescription(e.target.value)} className={inputClass} placeholder="Où, quand, comment…" />
        </div>
        <PhotoInput folder="incidents" value={photos} onChange={setPhotos} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button type="submit" variant="danger" loading={saving}>Déclarer</Button>
        </div>
      </form>
    </Modal>
  );
};

const DecideModal: React.FC<{ incident: Incident; defaultCost: number; onClose: () => void; onDone: () => Promise<void> }> = ({ incident, defaultCost, onClose, onDone }) => {
  const { refreshData } = useApp();
  const [decision, setDecision] = useState<Decision>(incident.decision === 'pending' ? 'replaced' : incident.decision);
  const [cost, setCost] = useState(String(incident.cost ?? defaultCost ?? ''));
  const [note, setNote] = useState(incident.decision_note ?? '');
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const { error } = await supabase.rpc('decide_incident', {
      p_id: incident.id,
      p_decision: decision,
      p_cost: cost ? Number(cost.replace(',', '.')) : null,
      p_note: note || null,
    });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success('Décision enregistrée');
    await refreshData();
    await onDone();
  };

  return (
    <Modal isOpen onClose={onClose} title="Suite à donner" size="md">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="decision" className={labelClass}>Décision</label>
          <select id="decision" value={decision} onChange={e => setDecision(e.target.value as Decision)} className={inputClass}>
            {(Object.keys(DECISIONS) as Decision[]).map(d => <option key={d} value={d}>{DECISIONS[d]}</option>)}
          </select>
          {decision === 'found' && <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">L'article revient en stock.</p>}
        </div>
        <div>
          <label htmlFor="decision-cost" className={labelClass}>Coût retenu (CHF)</label>
          <input id="decision-cost" inputMode="decimal" value={cost} onChange={e => setCost(e.target.value)} className={`${inputClass} font-mono`} />
        </div>
        <div>
          <label htmlFor="decision-note" className={labelClass}>Remarque</label>
          <input id="decision-note" value={note} onChange={e => setNote(e.target.value)} className={inputClass} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button type="submit" loading={saving}>Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
};

export default Incidents;
