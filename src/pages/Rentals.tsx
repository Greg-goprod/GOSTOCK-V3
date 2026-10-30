import React, { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, CheckCircle2, ClipboardCheck, FileText, Pencil, Plus, Trash2 } from 'lucide-react';
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
import { confirmAction, promptAction } from '../lib/confirm';
import RentalInspectionModal from '../components/rentals/RentalInspectionModal';
import { InspectionKind, RentalInspection, RentalKind, loadInspections, printInspection } from '../lib/rentalInspection';
import { LICENSE_CATEGORIES } from '../lib/licenses';
import TrainingSelect from '../components/trainings/TrainingSelect';

interface Rental {
  id: string;
  rental_company: string;
  description: string;
  contract_ref: string | null;
  quantity: number;
  daily_rate: number;
  fixed_cost: number;
  start_on: string;
  end_on: string;
  returned_on: string | null;
  site_id: string | null;
  depot_id: string | null;
  responsible_id: string | null;
  contract_path: string | null;
  notes: string | null;
  state: 'active' | 'overdue' | 'returned';
  days_billed: number;
  cost: number;
  overdue_cost: number;
  site_name: string | null;
  // Lus dans « rentals » (la vue rental_status ne les a pas)
  kind: RentalKind;
  plate: string | null;
  license_category: string | null;
  required_training_id: string | null;
}

const KINDS: { id: RentalKind; label: string }[] = [
  { id: 'vehicle', label: 'Véhicule' },
  { id: 'equipment', label: 'Outil ou engin' },
  { id: 'other', label: 'Autre (coût seulement)' },
];

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const chf = (n: number) => n.toLocaleString('fr-CH', { style: 'currency', currency: 'CHF', minimumFractionDigits: 0, maximumFractionDigits: 2 });
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => iso(new Date());
const plusDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return iso(d);
};
const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('fr-CH');

const EMPTY = {
  kind: 'equipment' as RentalKind, plate: '', license_category: 'B', required_training_id: '',
  rental_company: '', description: '', contract_ref: '', quantity: '1', daily_rate: '', fixed_cost: '',
  start_on: today(), end_on: plusDays(today(), 7), site_id: '', depot_id: '', responsible_id: '', contract: [] as string[], notes: '',
};

// Matériel loué chez un loueur : rendre à temps, savoir ce que ça coûte et à quel chantier
const Rentals: React.FC = () => {
  const { users, depots, refreshData } = useApp();
  const { can, profile } = useAuth();
  const canEdit = can('manage_stock') || can('manage_fleet');
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [sites, setSites] = useState<{ id: string; name: string; status: string }[]>([]);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [editing, setEditing] = useState<Rental | 'new' | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [inspections, setInspections] = useState<RentalInspection[]>([]);
  const [inspecting, setInspecting] = useState<{ rental: Rental; kind: InspectionKind } | null>(null);

  const load = async () => {
    const [r, s, k] = await Promise.all([
      supabase.from('rental_status').select('*').order('end_on'),
      supabase.from('sites').select('id, name, status').order('name'),
      supabase.from('rentals').select('id, kind, plate, license_category, required_training_id'),
    ]);
    if (r.error) toast.error(errorMessage(r.error));
    const extra = new Map((k.data || []).map(x => [x.id as string, x]));
    const list = ((r.data || []) as Rental[]).map(x => ({
      ...x, daily_rate: Number(x.daily_rate), fixed_cost: Number(x.fixed_cost), cost: Number(x.cost),
      overdue_cost: Number(x.overdue_cost), days_billed: Number(x.days_billed),
      kind: (extra.get(x.id)?.kind ?? 'other') as RentalKind, plate: extra.get(x.id)?.plate ?? null,
      license_category: extra.get(x.id)?.license_category ?? null,
      required_training_id: extra.get(x.id)?.required_training_id ?? null,
    }));
    setRentals(list);
    setSites(s.data || []);
    try {
      setInspections(await loadInspections(list.filter(x => x.kind !== 'other').map(x => x.id)));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const open = rentals.filter(r => r.state !== 'returned');
  const shown = filter === 'open' ? open : [...rentals].sort((a, b) => b.start_on.localeCompare(a.start_on));
  const overdue = open.filter(r => r.state === 'overdue');
  const companies = useMemo(() => [...new Set(rentals.map(r => r.rental_company))].sort((a, b) => a.localeCompare(b, 'fr')), [rentals]);
  const name = (id: string | null) => {
    const u = users.find(x => x.id === id);
    return u ? `${u.first_name} ${u.last_name}` : null;
  };

  const openForm = (rental: Rental | 'new') => {
    setEditing(rental);
    setForm(rental === 'new' ? { ...EMPTY, start_on: today(), end_on: plusDays(today(), 7), depot_id: depots.find(d => d.isDefault)?.id ?? '' } : {
      kind: rental.kind, plate: rental.plate ?? '', license_category: rental.license_category ?? 'B',
      required_training_id: rental.required_training_id ?? '',
      rental_company: rental.rental_company, description: rental.description, contract_ref: rental.contract_ref ?? '',
      quantity: String(rental.quantity), daily_rate: String(rental.daily_rate), fixed_cost: rental.fixed_cost ? String(rental.fixed_cost) : '',
      start_on: rental.start_on, end_on: rental.end_on, site_id: rental.site_id ?? '', depot_id: rental.depot_id ?? '',
      responsible_id: rental.responsible_id ?? '', contract: rental.contract_path ? [rental.contract_path] : [], notes: rental.notes ?? '',
    });
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const row = {
      kind: form.kind,
      plate: form.kind === 'vehicle' ? form.plate.trim().toUpperCase() || null : null,
      license_category: form.kind === 'vehicle' ? form.license_category : null,
      required_training_id: form.kind === 'equipment' ? form.required_training_id || null : null,
      rental_company: form.rental_company.trim(),
      description: form.description.trim(),
      contract_ref: form.contract_ref.trim() || null,
      quantity: form.kind === 'vehicle' ? 1 : Math.max(1, Number(form.quantity) || 1),
      daily_rate: Number(form.daily_rate) || 0,
      fixed_cost: Number(form.fixed_cost) || 0,
      start_on: form.start_on,
      end_on: form.end_on,
      site_id: form.site_id || null,
      depot_id: form.depot_id || null,
      responsible_id: form.responsible_id || null,
      contract_path: form.contract[0] ?? null,
      notes: form.notes.trim() || null,
    };
    const { error } = editing === 'new'
      ? await supabase.from('rentals').insert(row)
      : await supabase.from('rentals').update(row).eq('id', (editing as Rental).id);
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    setEditing(null);
    await load();
  };

  const update = async (rental: Rental, changes: Partial<Rental>, message: string) => {
    const { error } = await supabase.from('rentals').update(changes).eq('id', rental.id);
    if (error) return toast.error(errorMessage(error));
    toast.success(message);
    await load();
  };

  const markReturned = async (rental: Rental) => {
    const day = await promptAction('Rendu au loueur le (JJ.MM.AAAA) :', fmt(today()));
    if (!day) return;
    const match = day.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (!match) return toast.error('Date attendue : JJ.MM.AAAA');
    const value = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
    if (value < rental.start_on) return toast.error('La date de retour précède le début de la location');
    update(rental, { returned_on: value }, 'Location rendue');
  };

  const extend = (rental: Rental) => update(rental, { end_on: plusDays(rental.end_on, 7) }, `Prolongée jusqu'au ${fmt(plusDays(rental.end_on, 7))}`);

  const inspectionOf = (rental: Rental, kind: InspectionKind) => inspections.find(i => i.rental_id === rental.id && i.kind === kind);

  const printPv = async (rental: Rental) => {
    try {
      await printInspection(rental, inspections.filter(i => i.rental_id === rental.id));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const remove = async (rental: Rental) => {
    if (inspectionOf(rental, 'reception')) {
      return toast.error('Cette location a un état des lieux : elle ne peut plus être supprimée');
    }
    if (!await confirmAction(`Supprimer la location « ${rental.description} » ? Son coût disparaîtra des chantiers.`)) return;
    const { error } = await supabase.from('rentals').delete().eq('id', rental.id);
    if (error) return toast.error(errorMessage(error));
    await load();
  };

  const openContract = async (path: string) => {
    const url = await fileUrl(path);
    if (url) window.open(url, '_blank', 'noopener');
  };

  const estimate = (Math.max(0, (new Date(form.end_on).getTime() - new Date(form.start_on).getTime()) / 86400000) + 1)
    * (Number(form.daily_rate) || 0) * Math.max(1, Number(form.quantity) || 1) + (Number(form.fixed_cost) || 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="mx-page-title">Locations</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Matériel loué chez un loueur. Alerte 2 jours avant la date de retour, puis chaque jour de retard.</p>
        </div>
        {canEdit && <Button icon={<Plus size={16} />} onClick={() => openForm('new')}>Nouvelle location</Button>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="font-mono text-2xl font-semibold text-gray-900 dark:text-white">{open.length}</p>
          <p className="text-sm text-gray-600 dark:text-gray-300">En cours</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className={`font-mono text-2xl font-semibold ${overdue.length ? 'text-danger-600 dark:text-danger-400' : 'text-gray-900 dark:text-white'}`}>{overdue.length}</p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            En retard{overdue.length ? ` · ${chf(overdue.reduce((s, r) => s + r.overdue_cost, 0))} de plus` : ''}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 col-span-2 lg:col-span-1">
          <p className="font-mono text-2xl font-semibold text-gray-900 dark:text-white">{chf(open.reduce((s, r) => s + r.cost, 0))}</p>
          <p className="text-sm text-gray-600 dark:text-gray-300">Coût à ce jour des locations en cours</p>
        </div>
      </div>

      <div className="inline-flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden" role="group" aria-label="Filtre">
        {([['open', 'En cours'], ['all', 'Historique']] as const).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}
            className={`px-3 py-2 min-h-[40px] text-sm font-semibold ${filter === id ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
            {label}
          </button>
        ))}
      </div>

      <ul className="rounded-lg bg-white dark:bg-gray-800 shadow divide-y divide-gray-200 dark:divide-gray-700">
        {shown.length === 0 && <li className="p-4 text-sm text-gray-600 dark:text-gray-400">Aucune location{filter === 'open' ? ' en cours' : ''}.</li>}
        {shown.map(r => {
          const daysLeft = Math.round((new Date(`${r.end_on}T12:00:00`).getTime() - new Date(`${today()}T12:00:00`).getTime()) / 86400000);
          return (
            <li key={r.id} className="p-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {r.quantity > 1 ? `${r.quantity} × ` : ''}{r.description}{r.plate ? ` · ${r.plate}` : ''}
                  {r.kind !== 'other' && inspectionOf(r, 'reception') && r.state !== 'returned' && (
                    <span className="ml-2 rounded-full bg-primary-50 dark:bg-primary-900/40 px-2 py-0.5 text-[11px] font-semibold text-primary-700 dark:text-primary-200">
                      {r.kind === 'vehicle' ? 'Dans la flotte' : 'Dans le stock'}
                    </span>
                  )}
                  <span className="text-gray-500 font-normal"> · {r.rental_company}{r.contract_ref ? ` · ${r.contract_ref}` : ''}</span>
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {fmt(r.start_on)} → {fmt(r.end_on)}
                  {r.site_name ? ` · ${r.site_name}` : ''}
                  {name(r.responsible_id) ? ` · ${name(r.responsible_id)}` : ''}
                  {' · '}{chf(r.daily_rate)}/jour · {r.days_billed} j facturés · <strong className="font-mono">{chf(r.cost)}</strong>
                </p>
                <p className={`text-xs font-semibold ${r.state === 'overdue' ? 'text-danger-700 dark:text-danger-300' : r.state === 'returned' ? 'text-success-700 dark:text-success-300' : daysLeft <= 2 ? 'text-warning-700 dark:text-warning-300' : 'text-gray-600 dark:text-gray-400'}`}>
                  {r.kind !== 'other' && r.state !== 'returned' && !inspectionOf(r, 'reception') ? 'Réception à faire chez le loueur'
                    : r.state === 'returned' ? `Rendu le ${fmt(r.returned_on!)}`
                    : r.state === 'overdue' ? `En retard de ${-daysLeft} jour${-daysLeft > 1 ? 's' : ''} (${chf(r.overdue_cost)} de plus)`
                    : daysLeft === 0 ? 'À rendre aujourd\'hui' : `À rendre dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                {r.contract_path && <Button size="sm" variant="outline" onClick={() => openContract(r.contract_path!)}>Contrat</Button>}
                {inspectionOf(r, 'reception') && (
                  <Button size="sm" variant="outline" icon={<FileText size={14} />} onClick={() => printPv(r)}>
                    {inspectionOf(r, 'return') ? 'PV réception et restitution' : 'PV de réception'}
                  </Button>
                )}
                {canEdit && r.state !== 'returned' && (
                  <>
                    <Button size="sm" variant="outline" icon={<CalendarPlus size={14} />} onClick={() => extend(r)}>+ 7 jours</Button>
                    {r.kind === 'other' && <Button size="sm" icon={<CheckCircle2 size={14} />} onClick={() => markReturned(r)}>Rendu</Button>}
                  </>
                )}
                {r.kind !== 'other' && r.state !== 'returned' && (canEdit || r.responsible_id === profile?.id) && (
                  inspectionOf(r, 'reception')
                    ? <Button size="sm" icon={<ClipboardCheck size={14} />} onClick={() => setInspecting({ rental: r, kind: 'return' })}>Restitution</Button>
                    : <Button size="sm" icon={<ClipboardCheck size={14} />} onClick={() => setInspecting({ rental: r, kind: 'reception' })}>Réception</Button>
                )}
                {canEdit && <Button size="sm" variant="outline" icon={<Pencil size={14} />} ariaLabel={`Modifier ${r.description}`} onClick={() => openForm(r)} />}
                {canEdit && <Button size="sm" variant="danger" icon={<Trash2 size={14} />} ariaLabel={`Supprimer ${r.description}`} onClick={() => remove(r)} />}
              </div>
            </li>
          );
        })}
      </ul>

      <Modal isOpen={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Nouvelle location' : 'Modifier la location'} size="lg">
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          <fieldset className="sm:col-span-2">
            <legend className={labelClass}>Type de location</legend>
            <div className="inline-flex flex-wrap rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden" role="group">
              {KINDS.map(k => {
                // Après la réception, le type ne change plus (l'objet est déjà dans le stock)
                const locked = editing !== 'new' && editing !== null && Boolean(inspectionOf(editing, 'reception'));
                return (
                  <button key={k.id} type="button" aria-pressed={form.kind === k.id} disabled={locked && form.kind !== k.id}
                    onClick={() => setForm({ ...form, kind: k.id })}
                    className={`px-3 py-2 min-h-[40px] text-sm font-semibold disabled:opacity-40 ${form.kind === k.id ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
                    {k.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              {form.kind === 'other'
                ? 'Suivi du coût seulement : rien n\'entre dans le stock.'
                : `À la réception chez le loueur, un état des lieux (photos, dégâts, accessoires) fait entrer ${form.kind === 'vehicle' ? 'le véhicule dans la flotte' : 'l\'outil dans le stock'} : il peut alors être réservé et sorti jusqu'à la date de fin.`}
            </p>
          </fieldset>
          <div>
            <label htmlFor="rental-company" className={labelClass}>Loueur</label>
            <input id="rental-company" list="rental-companies" autoComplete="off" value={form.rental_company} onChange={e => setForm({ ...form, rental_company: e.target.value })} className={inputClass} required placeholder="ex. Loxam Crissier" />
            <datalist id="rental-companies">{companies.map(c => <option key={c} value={c} />)}</datalist>
          </div>
          <div>
            <label htmlFor="rental-ref" className={labelClass}>N° de contrat</label>
            <input id="rental-ref" value={form.contract_ref} onChange={e => setForm({ ...form, contract_ref: e.target.value })} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="rental-desc" className={labelClass}>{form.kind === 'vehicle' ? 'Véhicule' : 'Matériel'}</label>
            <input id="rental-desc" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={inputClass} required placeholder={form.kind === 'vehicle' ? 'ex. Fourgon Fiat Ducato' : 'ex. Mini-pelle 1,8 t'} />
          </div>
          {form.kind === 'vehicle' ? (
            <>
              <div>
                <label htmlFor="rental-plate" className={labelClass}>Plaque</label>
                <input id="rental-plate" value={form.plate} onChange={e => setForm({ ...form, plate: e.target.value })} className={`${inputClass} font-mono uppercase`} required placeholder="ex. VD 123 456" />
              </div>
              <div>
                <label htmlFor="rental-license" className={labelClass}>Permis nécessaire</label>
                <select id="rental-license" value={form.license_category} onChange={e => setForm({ ...form, license_category: e.target.value })} className={inputClass}>
                  {LICENSE_CATEGORIES.map(l => <option key={l.code} value={l.code}>{l.code} · {l.label}</option>)}
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <label htmlFor="rental-qty" className={labelClass}>Quantité</label>
                <input id="rental-qty" type="number" min={1} value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} className={`${inputClass} font-mono`} />
              </div>
              {form.kind === 'equipment' && (
                <TrainingSelect id="rental-training" value={form.required_training_id} label="Permis machine exigé"
                  onChange={required_training_id => setForm({ ...form, required_training_id })} />
              )}
            </>
          )}
          <div>
            <label htmlFor="rental-rate" className={labelClass}>Prix par jour (CHF, par unité)</label>
            <input id="rental-rate" type="number" min={0} step="0.05" inputMode="decimal" value={form.daily_rate} onChange={e => setForm({ ...form, daily_rate: e.target.value })} className={`${inputClass} font-mono`} required />
          </div>
          <div>
            <label htmlFor="rental-start" className={labelClass}>Début</label>
            <DateInput id="rental-start" value={form.start_on} onChange={e => setForm({ ...form, start_on: e.target.value })} className={inputClass} required />
          </div>
          <div>
            <label htmlFor="rental-end" className={labelClass}>À rendre le</label>
            <DateInput id="rental-end" value={form.end_on} min={form.start_on} onChange={e => setForm({ ...form, end_on: e.target.value })} className={inputClass} required />
          </div>
          <div>
            <label htmlFor="rental-fixed" className={labelClass}>Forfait (transport, nettoyage…)</label>
            <input id="rental-fixed" type="number" min={0} step="0.05" inputMode="decimal" value={form.fixed_cost} onChange={e => setForm({ ...form, fixed_cost: e.target.value })} className={`${inputClass} font-mono`} />
          </div>
          <div>
            <label htmlFor="rental-site" className={labelClass}>Chantier</label>
            <select id="rental-site" value={form.site_id} onChange={e => setForm({ ...form, site_id: e.target.value })} className={inputClass}>
              <option value="">—</option>
              {sites.filter(s => s.status === 'open' || s.id === form.site_id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="rental-resp" className={labelClass}>Responsable (reçoit le rappel)</label>
            <select id="rental-resp" value={form.responsible_id} onChange={e => setForm({ ...form, responsible_id: e.target.value })} className={inputClass}>
              <option value="">—</option>
              {users.filter(u => u.active !== false).map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="rental-depot" className={labelClass}>Dépôt (pour les alertes)</label>
            <select id="rental-depot" value={form.depot_id} onChange={e => setForm({ ...form, depot_id: e.target.value })} className={inputClass}>
              <option value="">—</option>
              {depots.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <PhotoInput folder="locations" value={form.contract} onChange={contract => setForm({ ...form, contract })} label="Contrat (photo ou PDF)" allowPdf max={1} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="rental-notes" className={labelClass}>Remarques</label>
            <input id="rental-notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={inputClass} />
          </div>
          <p className="sm:col-span-2 text-sm text-gray-700 dark:text-gray-300">Coût prévu : <strong className="font-mono">{chf(estimate)}</strong></p>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(null)}>Annuler</Button>
            <Button type="submit" loading={saving}>Enregistrer</Button>
          </div>
        </form>
      </Modal>

      {inspecting && (
        <RentalInspectionModal
          rental={inspecting.rental}
          kind={inspecting.kind}
          reception={inspectionOf(inspecting.rental, 'reception')}
          onClose={() => setInspecting(null)}
          onDone={async () => {
            setInspecting(null);
            await Promise.all([load(), refreshData()]);
          }}
        />
      )}
    </div>
  );
};

export default Rentals;
