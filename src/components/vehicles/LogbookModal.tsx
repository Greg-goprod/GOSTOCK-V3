import React, { useEffect, useMemo, useState } from 'react';
import { Fuel, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../common/Modal';
import Button from '../common/Button';
import PhotoInput from '../common/PhotoInput';
import { supabase } from '../../lib/supabase';
import { fileUrl } from '../../lib/files';
import { errorMessage, toLocalInput } from '../../lib/requests';
import { useAuth } from '../../contexts/AuthContext';
import { Vehicle } from '../../types';
import { DateTimeInput } from '../common/DateInput';

interface Trip {
  id: string;
  driver_name: string | null;
  request_number: string | null;
  site: string;
  start_at: string;
  end_at: string | null;
  start_km: number;
  end_km: number | null;
  distance: number | null;
  start_damages: string | null;
  end_damages: string | null;
  start_photos: string[];
  end_photos: string[];
}

interface FuelEntry {
  id: string;
  filled_at: string;
  km: number;
  liters: number;
  amount: number | null;
  full_tank: boolean;
  receipt_path: string | null;
}

const chf = (n: number) => n.toLocaleString('fr-CH', { style: 'currency', currency: 'CHF' });
const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

// Photos privées affichées par liens temporaires
const Photos: React.FC<{ paths: string[]; label: string }> = ({ paths, label }) => {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    Promise.all(paths.map(p => fileUrl(p))).then(list => setUrls(list.filter((u): u is string => !!u)));
  }, [paths]);
  if (!paths.length) return <p className="text-xs text-gray-500">{label} : pas de photo</p>;
  return (
    <div>
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{label}</p>
      <div className="flex flex-wrap gap-1">
        {urls.map(url => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt={label} className="h-16 w-24 rounded object-cover" /></a>)}
      </div>
    </div>
  );
};

// Carnet de bord d'un véhicule : trajets, pleins, consommation, dégâts en photos
const LogbookModal: React.FC<{ vehicle: Vehicle; onClose: () => void }> = ({ vehicle, onClose }) => {
  const { profile } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [fuel, setFuel] = useState<FuelEntry[]>([]);
  const [stats, setStats] = useState<{ liters_per_100km: number | null; amount_total: number | null } | null>(null);
  const [adding, setAdding] = useState(false);
  const [openTrip, setOpenTrip] = useState<string | null>(null);

  const load = async () => {
    const [tripsRes, fuelRes, statsRes] = await Promise.all([
      supabase.from('vehicle_logbook').select('*').eq('vehicle_id', vehicle.id).order('start_at', { ascending: false }).limit(100),
      supabase.from('fuel_entries').select('*').eq('vehicle_id', vehicle.id).order('filled_at', { ascending: false }).limit(100),
      supabase.from('vehicle_fuel_stats').select('liters_per_100km, amount_total').eq('vehicle_id', vehicle.id).maybeSingle(),
    ]);
    setTrips((tripsRes.data || []) as Trip[]);
    setFuel(((fuelRes.data || []) as FuelEntry[]).map(f => ({ ...f, liters: Number(f.liters), amount: f.amount === null ? null : Number(f.amount) })));
    setStats(statsRes.data ? { liters_per_100km: statsRes.data.liters_per_100km === null ? null : Number(statsRes.data.liters_per_100km), amount_total: statsRes.data.amount_total === null ? null : Number(statsRes.data.amount_total) } : null);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle.id]);

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const kmThisMonth = trips.filter(t => new Date(t.start_at) >= monthStart).reduce((s, t) => s + (t.distance ?? 0), 0);
  const fuelThisMonth = fuel.filter(f => new Date(f.filled_at) >= monthStart).reduce((s, f) => s + (f.amount ?? 0), 0);
  const kmBySite = useMemo(() => {
    const m = new Map<string, number>();
    trips.filter(t => new Date(t.start_at) >= monthStart).forEach(t => m.set(t.site, (m.get(t.site) ?? 0) + (t.distance ?? 0)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trips]);

  const openReceipt = async (path: string) => {
    const url = await fileUrl(path);
    if (url) window.open(url, '_blank', 'noopener');
  };

  return (
    <Modal isOpen onClose={onClose} title={`Carnet de bord · ${vehicle.name} (${vehicle.plate})`} size="xl" closeOnBackdrop>
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-xs text-gray-600 dark:text-gray-400">Ce mois</p>
            <p className="font-mono text-xl font-semibold text-gray-900 dark:text-white">{kmThisMonth.toLocaleString('fr-CH')} km</p>
          </div>
          <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-xs text-gray-600 dark:text-gray-400">Consommation moyenne</p>
            <p className="font-mono text-xl font-semibold text-gray-900 dark:text-white">{stats?.liters_per_100km ? `${stats.liters_per_100km} L/100 km` : '—'}</p>
          </div>
          <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-xs text-gray-600 dark:text-gray-400">Carburant ce mois</p>
            <p className="font-mono text-xl font-semibold text-gray-900 dark:text-white">{chf(fuelThisMonth)}</p>
          </div>
        </div>

        {kmBySite.length > 0 && (
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Km par chantier ce mois : {kmBySite.map(([site, km]) => `${site} ${km.toLocaleString('fr-CH')} km`).join(' · ')}
          </p>
        )}

        <section>
          <h3 className="font-bold text-gray-900 dark:text-white mb-2">Trajets</h3>
          {trips.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">Aucun trajet enregistré.</p>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {trips.map(t => (
                <li key={t.id} className="py-2">
                  <button type="button" onClick={() => setOpenTrip(openTrip === t.id ? null : t.id)} aria-expanded={openTrip === t.id} className="w-full text-left flex flex-wrap justify-between gap-2 text-sm">
                    <span className="text-gray-900 dark:text-gray-100">
                      {new Date(t.start_at).toLocaleDateString('fr-CH')} · {t.driver_name ?? '—'} · {t.site}
                      {t.request_number && <span className="font-mono text-xs text-gray-500"> · {t.request_number}</span>}
                    </span>
                    <span className="font-mono text-gray-700 dark:text-gray-300">
                      {t.start_km.toLocaleString('fr-CH')} → {t.end_km !== null ? t.end_km.toLocaleString('fr-CH') : 'en cours'}
                      {t.distance !== null ? ` · ${t.distance.toLocaleString('fr-CH')} km` : ''}
                    </span>
                  </button>
                  {(t.end_damages || t.start_damages) && (
                    <p className="text-xs text-warning-700 dark:text-warning-300 mt-0.5">
                      {[t.start_damages && `Départ : ${t.start_damages}`, t.end_damages && `Retour : ${t.end_damages}`].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {openTrip === t.id && (
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      <Photos paths={t.start_photos} label="Au départ" />
                      <Photos paths={t.end_photos} label="Au retour" />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><Fuel size={16} aria-hidden="true" /> Pleins</h3>
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setAdding(true)}>Ajouter un plein</Button>
          </div>
          {fuel.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">Aucun plein enregistré.</p>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              {fuel.map(f => (
                <li key={f.id} className="py-1.5 flex flex-wrap justify-between gap-2 text-gray-800 dark:text-gray-200">
                  <span>{new Date(f.filled_at).toLocaleDateString('fr-CH')} · <span className="font-mono">{f.km.toLocaleString('fr-CH')} km</span>{f.full_tank ? '' : ' · partiel'}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono">{f.liters.toLocaleString('fr-CH')} L{f.amount !== null ? ` · ${chf(f.amount)}` : ''}</span>
                    {f.receipt_path && <Button size="sm" variant="outline" onClick={() => openReceipt(f.receipt_path!)}>Ticket</Button>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {adding && profile && (
        <FuelModal vehicle={vehicle} userId={profile.id} onClose={() => setAdding(false)} onDone={async () => { setAdding(false); await load(); }} />
      )}
    </Modal>
  );
};

const FuelModal: React.FC<{ vehicle: Vehicle; userId: string; onClose: () => void; onDone: () => Promise<void> }> = ({ vehicle, userId, onClose, onDone }) => {
  const [filledAt, setFilledAt] = useState(toLocalInput(new Date()));
  const [km, setKm] = useState(String(vehicle.currentKm));
  const [liters, setLiters] = useState('');
  const [amount, setAmount] = useState('');
  const [full, setFull] = useState(true);
  const [receipt, setReceipt] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const { error } = await supabase.from('fuel_entries').insert({
      vehicle_id: vehicle.id,
      user_id: userId,
      filled_at: new Date(filledAt).toISOString(),
      km: Number(km),
      liters: Number(liters.replace(',', '.')),
      amount: amount ? Number(amount.replace(',', '.')) : null,
      full_tank: full,
      receipt_path: receipt[0] ?? null,
    });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success('Plein enregistré');
    await onDone();
  };

  return (
    <Modal isOpen onClose={onClose} title={`Plein · ${vehicle.name}`} size="md">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="fuel-date" className={labelClass}>Date</label>
            <DateTimeInput id="fuel-date" value={filledAt} onChange={e => setFilledAt(e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label htmlFor="fuel-km" className={labelClass}>Kilométrage</label>
            <input id="fuel-km" type="number" min={0} inputMode="numeric" value={km} onChange={e => setKm(e.target.value)} className={`${inputClass} font-mono`} required />
          </div>
          <div>
            <label htmlFor="fuel-liters" className={labelClass}>Litres</label>
            <input id="fuel-liters" inputMode="decimal" value={liters} onChange={e => setLiters(e.target.value)} className={`${inputClass} font-mono`} required />
          </div>
          <div>
            <label htmlFor="fuel-amount" className={labelClass}>Montant (CHF)</label>
            <input id="fuel-amount" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} className={`${inputClass} font-mono`} />
          </div>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
          <input type="checkbox" checked={full} onChange={e => setFull(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
          Plein complet (sert au calcul de la consommation)
        </label>
        <PhotoInput folder="tickets" value={receipt} onChange={setReceipt} label="Ticket" max={1} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button type="submit" loading={saving}>Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
};

export default LogbookModal;
