import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Pencil, Plus, Undo2, Wrench , Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import FuelInput from '../components/common/FuelInput';
import SignaturePad from '../components/common/SignaturePad';
import PhotoInput from '../components/common/PhotoInput';
import { fileUrl } from '../lib/files';
import LogbookModal from '../components/vehicles/LogbookModal';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { REQUEST_STATUS, VEHICLE_STATUS, deadlineState, errorMessage } from '../lib/requests';
import { RequestOverview, Vehicle } from '../types';
import DateInput from '../components/common/DateInput';
import RentalBadge from '../components/common/RentalBadge';
import { LICENSE_CATEGORIES } from '../lib/licenses';
import { MxEmpty } from '../components/mx/MxEmpty';
import PageTitle from '../components/common/PageTitle';
import { PageCommands } from '../components/Layout/ModuleHeader';

const inputClass =
  'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

const DAY = 24 * 60 * 60 * 1000;

const startOfWeek = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // lundi
  return d;
};

const formatDate = (date?: string) => (date ? new Date(date).toLocaleDateString('fr-CH') : '—');

const Deadline: React.FC<{ label: string; date?: string }> = ({ label, date }) => {
  const state = deadlineState(date);
  if (!state) return null;
  const cls = state === 'overdue'
    ? 'mx-tint-badge-danger'
    : state === 'soon'
      ? 'mx-tint-badge-warning'
      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-[length:calc(11px*var(--mx-scale,1))] font-bold ${cls}`}>
      {label} {state === 'overdue' ? 'échu' : ''} {formatDate(date)}
    </span>
  );
};

const Vehicles: React.FC = () => {
  const { vehicles, depots, refreshData } = useApp();
  const { can } = useAuth();
  // Fiches et maintenance : gestion de flotte ; retour d'un véhicule : le magasin
  const canManage = can('manage_fleet');
  const canReturn = can('scan') || canManage;
  const [logbookOf, setLogbookOf] = useState<Vehicle | null>(null);
  const [bookings, setBookings] = useState<RequestOverview[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [editing, setEditing] = useState<Vehicle | 'new' | null>(null);
  const [returning, setReturning] = useState<Vehicle | null>(null);

  const weekEnd = new Date(weekStart.getTime() + 7 * DAY);

  const loadBookings = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('requests_overview')
      .select('*')
      .not('vehicle_names', 'is', null)
      .in('status', ['requested', 'approved', 'ready', 'out'])
      .lt('start_at', weekEnd.toISOString())
      .gt('end_at', weekStart.toISOString());
    if (error) return toast.error('Impossible de charger les réservations');
    setBookings((data || []) as RequestOverview[]);
  };

  // Liens demande → véhicule pour placer les barres sur la bonne ligne
  const [bookingVehicle, setBookingVehicle] = useState<Record<string, string>>({});
  const weekKey = weekStart.getTime();
  useEffect(() => {
    loadBookings();
    // loadBookings ne dépend que de la semaine affichée
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKey]);
  useEffect(() => {
    if (!supabase || bookings.length === 0) return;
    (async () => {
      const { data } = await supabase!.from('request_items').select('request_id, vehicle_id').in('request_id', bookings.map(b => b.id)).eq('item_kind', 'vehicle');
      setBookingVehicle(Object.fromEntries((data || []).map(r => [r.request_id, r.vehicle_id])));
    })();
  }, [bookings]);

  const activeVehicles = useMemo(() => vehicles.filter(v => v.status !== 'retired'), [vehicles]);
  const days = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY));
  const today = new Date().toDateString();

  const barStyle = (b: RequestOverview) => {
    const start = Math.max(new Date(b.start_at).getTime(), weekStart.getTime());
    const end = Math.min(new Date(b.end_at).getTime(), weekEnd.getTime());
    const span = 7 * DAY;
    return { left: `${((start - weekStart.getTime()) / span) * 100}%`, width: `${Math.max(((end - start) / span) * 100, 3)}%` };
  };

  const barClass = (b: RequestOverview) =>
    b.status === 'requested' ? 'mx-fill-warning' : b.status === 'out' ? 'mx-fill-success' : 'mx-fill-accent';

  const toggleMaintenance = async (v: Vehicle) => {
    if (!supabase) return;
    const next = v.status === 'maintenance' ? 'available' : 'maintenance';
    const { error } = await supabase.from('vehicles').update({ status: next }).eq('id', v.id);
    if (error) return toast.error(errorMessage(error));
    toast.success(next === 'maintenance' ? `${v.name} en maintenance` : `${v.name} de nouveau disponible`);
    await refreshData();
  };

  return (
    <div className="space-y-6">
      <div>
        <PageTitle>Véhicules</PageTitle>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Flotte, réservations et états des lieux</p>
      </div>
      <PageCommands primary={canManage ? <Button icon={<Plus size={16} />} onClick={() => setEditing('new')}>Ajouter un véhicule</Button> : undefined} />

      {/* Planning de la semaine */}
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <h2 className="font-bold text-gray-900 dark:text-white">
            Semaine du {weekStart.toLocaleDateString('fr-CH', { day: 'numeric', month: 'long' })}
          </h2>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" icon={<ChevronLeft size={16} />} onClick={() => setWeekStart(new Date(weekStart.getTime() - 7 * DAY))} ariaLabel="Semaine précédente" />
            <Button size="sm" variant="outline" onClick={() => setWeekStart(startOfWeek(new Date()))}>Cette semaine</Button>
            <Button size="sm" variant="outline" icon={<ChevronRight size={16} />} onClick={() => setWeekStart(new Date(weekStart.getTime() + 7 * DAY))} ariaLabel="Semaine suivante" />
          </div>
        </div>
        {activeVehicles.length === 0 ? (
          <MxEmpty icon={Truck} title="Aucun véhicule" description="Ajoutes-en un pour voir son planning." />
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[640px] grid grid-cols-[10rem_1fr] gap-x-3 gap-y-2 items-center">
              <span />
              <div className="grid grid-cols-7 text-xs font-mono text-gray-600 dark:text-gray-400">
                {days.map(d => (
                  <span key={d.toISOString()} className={d.toDateString() === today ? 'font-bold text-gray-900 dark:text-white' : ''}>
                    {d.toLocaleDateString('fr-CH', { weekday: 'short', day: '2-digit' })}
                  </span>
                ))}
              </div>
              {activeVehicles.map(v => (
                <React.Fragment key={v.id}>
                  <div className="text-sm min-w-0">
                    <div className="truncate text-gray-900 dark:text-gray-100">{v.name}</div>
                    <div className="font-mono text-xs text-gray-500 dark:text-gray-400">{v.plate}</div>
                  </div>
                  <div className="relative h-8 rounded bg-gray-100 dark:bg-gray-700/50 grid grid-cols-7">
                    {days.map((d, i) => <span key={i} className={`border-r border-white/60 dark:border-gray-800 ${d.toDateString() === today ? 'bg-primary-100/60 dark:bg-primary-950/60' : ''}`} />)}
                    {bookings.filter(b => bookingVehicle[b.id] === v.id).map(b => (
                      <span
                        key={b.id}
                        title={`${b.number} · ${b.requester_name} · ${REQUEST_STATUS[b.status].label}`}
                        className={`absolute top-1 bottom-1 rounded px-1.5 text-xs font-semibold flex items-center overflow-hidden whitespace-nowrap ${barClass(b)}`}
                        style={barStyle(b)}
                      >
                        {b.requester_name}{b.status === 'requested' ? ' · à valider' : ''}
                      </span>
                    ))}
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-400">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded mx-fill-warning" aria-hidden="true" />À valider</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded mx-fill-accent" aria-hidden="true" />Validée</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded mx-fill-success" aria-hidden="true" />Sortie</span>
        </div>
      </section>

      {/* Flotte */}
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {vehicles.map(v => (
          <li key={v.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3">
            <div className="flex justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">{v.name}<RentalBadge until={v.rentalUntil} /></div>
                <div className="font-mono text-sm text-gray-600 dark:text-gray-300">{v.plate} · permis {v.licenseCategory}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">{depots.find(d => d.id === v.depotId)?.name ?? 'Sans dépôt'}</div>
              </div>
              <span className={`self-start inline-flex rounded px-2 py-0.5 text-[length:calc(11px*var(--mx-scale,1))] font-bold ${VEHICLE_STATUS[v.status].className}`}>{VEHICLE_STATUS[v.status].label}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Kilométrage</div>
                <div className="font-mono text-gray-900 dark:text-gray-100">{v.currentKm.toLocaleString('fr-CH')} km</div>
              </div>
              <FuelInput value={v.fuelLevel} />
            </div>
            <div className="flex flex-wrap gap-1">
              <Deadline label="Service" date={v.nextServiceDate} />
              <Deadline label="Pneus" date={v.tiresDate} />
              <Deadline label="Expertise" date={v.inspectionDate} />
            </div>
            <div className="flex flex-wrap gap-2">
              {canReturn && v.status === 'in_use' && <Button size="sm" icon={<Undo2 size={14} />} onClick={() => setReturning(v)}>Retour</Button>}
              <Button size="sm" variant="outline" icon={<BookOpen size={14} />} onClick={() => setLogbookOf(v)}>Carnet</Button>
              {canManage && <Button size="sm" variant="outline" icon={<Pencil size={14} />} onClick={() => setEditing(v)}>Modifier</Button>}
              {canManage && (v.status === 'available' || v.status === 'maintenance') && (
                <Button size="sm" variant="outline" icon={<Wrench size={14} />} onClick={() => toggleMaintenance(v)}>
                  {v.status === 'maintenance' ? 'Fin de maintenance' : 'Maintenance'}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {editing && (
        <VehicleFormModal
          vehicle={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await refreshData(); }}
        />
      )}
      {returning && (
        <VehicleReturnModal
          vehicle={returning}
          onClose={() => setReturning(null)}
          onDone={async () => { setReturning(null); await refreshData(); await loadBookings(); }}
        />
      )}
      {logbookOf && <LogbookModal vehicle={logbookOf} onClose={() => setLogbookOf(null)} />}
    </div>
  );
};

/* ------------------------------------------------------------------------ */

const VehicleFormModal: React.FC<{ vehicle: Vehicle | null; onClose: () => void; onSaved: () => Promise<void> }> = ({ vehicle, onClose, onSaved }) => {
  const { depots } = useApp();
  const [form, setForm] = useState({
    name: vehicle?.name ?? '',
    plate: vehicle?.plate ?? '',
    depotId: vehicle?.depotId ?? depots.find(d => d.isDefault)?.id ?? '',
    licenseCategory: vehicle?.licenseCategory ?? 'B',
    seats: vehicle?.seats ? String(vehicle.seats) : '',
    currentKm: vehicle ? String(vehicle.currentKm) : '',
    nextServiceDate: vehicle?.nextServiceDate ?? '',
    nextServiceKm: vehicle?.nextServiceKm ? String(vehicle.nextServiceKm) : '',
    tiresDate: vehicle?.tiresDate ?? '',
    inspectionDate: vehicle?.inspectionDate ?? '',
    notes: vehicle?.notes ?? '',
    retired: vehicle?.status === 'retired',
  });
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setSaving(true);
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      plate: form.plate.trim().toUpperCase(),
      depot_id: form.depotId || null,
      license_category: form.licenseCategory,
      seats: form.seats ? Number(form.seats) : null,
      next_service_date: form.nextServiceDate || null,
      next_service_km: form.nextServiceKm ? Number(form.nextServiceKm) : null,
      tires_date: form.tiresDate || null,
      inspection_date: form.inspectionDate || null,
      notes: form.notes || null,
    };
    // Le kilométrage d'un véhicule existant évolue par les états des lieux ; on ne le fixe qu'à la création
    if (!vehicle) payload.current_km = Number(form.currentKm) || 0;
    if (vehicle && vehicle.status !== 'in_use') payload.status = form.retired ? 'retired' : vehicle.status === 'retired' ? 'available' : vehicle.status;
    const { error } = vehicle
      ? await supabase.from('vehicles').update(payload).eq('id', vehicle.id)
      : await supabase.from('vehicles').insert(payload);
    setSaving(false);
    if (error) return toast.error(error.code === '23505' ? 'Un véhicule porte déjà cette plaque' : errorMessage(error));
    toast.success(vehicle ? `${form.name} mis à jour` : `${form.name} ajouté`);
    await onSaved();
  };

  return (
    <Modal isOpen onClose={onClose} title={vehicle ? `Modifier ${vehicle.name}` : 'Nouveau véhicule'} size="lg">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div><label htmlFor="v-name" className={labelClass}>Nom</label><input id="v-name" value={form.name} onChange={set('name')} className={inputClass} required placeholder="ex. Renault Master" /></div>
        <div><label htmlFor="v-plate" className={labelClass}>Plaque</label><input id="v-plate" value={form.plate} onChange={set('plate')} className={`${inputClass} font-mono uppercase`} required placeholder="VD 123 456" /></div>
        <div>
          <label htmlFor="v-depot" className={labelClass}>Dépôt</label>
          <select id="v-depot" value={form.depotId} onChange={set('depotId')} className={inputClass}>
            <option value="">— Aucun —</option>
            {depots.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label htmlFor="v-license" className={labelClass}>Permis</label>
            <select id="v-license" value={form.licenseCategory} onChange={set('licenseCategory')} className={inputClass}>
              {LICENSE_CATEGORIES.map(l => <option key={l.code} value={l.code}>{l.code} · {l.label}</option>)}
            </select>
          </div>
          <div><label htmlFor="v-seats" className={labelClass}>Places</label><input id="v-seats" type="number" min="1" value={form.seats} onChange={set('seats')} className={inputClass} /></div>
        </div>
        {!vehicle && <div><label htmlFor="v-km" className={labelClass}>Kilométrage actuel</label><input id="v-km" type="number" min="0" inputMode="numeric" value={form.currentKm} onChange={set('currentKm')} className={`${inputClass} font-mono`} /></div>}
        <div><label htmlFor="v-service" className={labelClass}>Prochain service</label><DateInput id="v-service" value={form.nextServiceDate} onChange={set('nextServiceDate')} className={inputClass} /></div>
        <div><label htmlFor="v-service-km" className={labelClass}>Prochain service (km)</label><input id="v-service-km" type="number" min="0" value={form.nextServiceKm} onChange={set('nextServiceKm')} className={`${inputClass} font-mono`} /></div>
        <div><label htmlFor="v-tires" className={labelClass}>Changement de pneus</label><DateInput id="v-tires" value={form.tiresDate} onChange={set('tiresDate')} className={inputClass} /></div>
        <div><label htmlFor="v-inspection" className={labelClass}>Prochaine expertise</label><DateInput id="v-inspection" value={form.inspectionDate} onChange={set('inspectionDate')} className={inputClass} /></div>
        <div className="sm:col-span-2"><label htmlFor="v-notes" className={labelClass}>Remarques</label><textarea id="v-notes" value={form.notes} onChange={set('notes')} rows={2} className={inputClass} /></div>
        {vehicle && vehicle.status !== 'in_use' && (
          <label className="sm:col-span-2 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 min-h-[44px] lg:min-h-0">
            <input type="checkbox" checked={form.retired} onChange={e => setForm(prev => ({ ...prev, retired: e.target.checked }))} className="h-4 w-4" />
            Retiré du service (n'apparaît plus dans les réservations)
          </label>
        )}
        <p className="sm:col-span-2 text-xs text-gray-600 dark:text-gray-400">Une alerte est créée 30 jours avant chaque échéance. Une réservation est refusée si l'expertise ou le service sont dépassés.</p>
        <div className="sm:col-span-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button type="submit" loading={saving}>Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
};

/* ------------------------------------------------------------------------ */

const VehicleReturnModal: React.FC<{ vehicle: Vehicle; onClose: () => void; onDone: () => Promise<void> }> = ({ vehicle, onClose, onDone }) => {
  const [trip, setTrip] = useState<{ id: string; start_km: number; start_fuel: number; start_damages?: string; start_photos: string[]; driver?: string } | null>(null);
  const [endPhotos, setEndPhotos] = useState<string[]>([]);
  const [startUrls, setStartUrls] = useState<string[]>([]);
  const [km, setKm] = useState('');
  const [fuel, setFuel] = useState(vehicle.fuelLevel);
  const [damages, setDamages] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data } = await supabase!
        .from('vehicle_trips')
        .select('id, start_km, start_fuel, start_damages, start_photos, users(first_name, last_name)')
        .eq('vehicle_id', vehicle.id)
        .is('end_at', null)
        .maybeSingle();
      if (data) {
        const driver = (data as unknown as { users?: { first_name: string; last_name: string } }).users;
        setTrip({ id: data.id, start_km: data.start_km, start_fuel: data.start_fuel, start_damages: data.start_damages ?? undefined, start_photos: data.start_photos || [], driver: driver ? `${driver.first_name} ${driver.last_name}` : undefined });
        setKm(String(data.start_km));
        const urls = await Promise.all((data.start_photos || []).map((p: string) => fileUrl(p)));
        setStartUrls(urls.filter((u): u is string => !!u));
      }
    })();
  }, [vehicle.id]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setSaving(true);
    const { error } = await supabase.rpc('return_vehicle', {
      p_vehicle_id: vehicle.id, p_km: Number(km), p_fuel: fuel, p_damages: damages || null, p_signature: signature,
    });
    if (!error && trip && endPhotos.length) {
      const photos = await supabase.from('vehicle_trips').update({ end_photos: endPhotos }).eq('id', trip.id);
      if (photos.error) toast.error(`Photos non enregistrées : ${errorMessage(photos.error)}`);
    }
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    const distance = trip ? Number(km) - trip.start_km : 0;
    toast.success(`${vehicle.name} rendu${distance > 0 ? ` · ${distance.toLocaleString('fr-CH')} km parcourus` : ''}`);
    await onDone();
  };

  return (
    <Modal isOpen onClose={onClose} title={`Retour · ${vehicle.name}`} size="md">
      <form onSubmit={submit} className="space-y-4">
        {trip && (
          <div className="rounded-md bg-gray-50 dark:bg-gray-700/40 p-3 text-sm text-gray-700 dark:text-gray-300">
            Départ : <span className="font-mono">{trip.start_km.toLocaleString('fr-CH')} km</span>, carburant {trip.start_fuel}/8
            {trip.driver && <> · conducteur {trip.driver}</>}
            {trip.start_damages && <div className="mt-1">Dégâts déjà notés : {trip.start_damages}</div>}
            {startUrls.length > 0 && (
              <div className="mt-2">
                <p className="text-xs mb-1">Photos au départ : compare avec l'état actuel</p>
                <div className="flex flex-wrap gap-2">
                  {startUrls.map(url => (
                    <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt="Véhicule au départ" className="h-20 w-28 rounded object-cover" /></a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <div>
          <label htmlFor="end-km" className={labelClass}>Kilométrage au retour</label>
          <input id="end-km" type="number" min={trip?.start_km ?? 0} inputMode="numeric" value={km} onChange={e => setKm(e.target.value)} className={`${inputClass} font-mono`} required autoFocus />
        </div>
        <FuelInput value={fuel} onChange={setFuel} />
        <div>
          <label htmlFor="end-damages" className={labelClass}>Nouveaux dégâts (facultatif)</label>
          <textarea id="end-damages" value={damages} onChange={e => setDamages(e.target.value)} rows={2} className={inputClass} />
        </div>
        <PhotoInput folder="vehicules" value={endPhotos} onChange={setEndPhotos} label="Photos au retour (au moins une)" />
        <SignaturePad label={trip?.driver ? `Signature de ${trip.driver}` : 'Signature du conducteur'} onChange={setSignature} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button type="submit" loading={saving} disabled={!signature || endPhotos.length === 0}>Valider le retour</Button>
        </div>
      </form>
    </Modal>
  );
};

export default Vehicles;
