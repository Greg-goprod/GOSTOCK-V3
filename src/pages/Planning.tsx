import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../lib/supabase';
import { MxSegmented } from '../components/mx/MxSegmented';

interface RequestRow {
  id: string;
  number: string;
  requester_name: string;
  destination: string | null;
  start_at: string;
  end_at: string;
  status: 'requested' | 'approved' | 'ready' | 'out';
}

interface ItemRow {
  request_id: string;
  item_kind: 'tool' | 'consumable' | 'vehicle';
  equipment_id: string | null;
  vehicle_id: string | null;
  quantity: number;
}

interface Booking {
  key: string;
  start: number;
  end: number;
  units: number;
  site: string;
  who: string;
  label: string;
  // Réservation à venir (demande) ou sortie réelle
  kind: 'request' | 'out';
  pending: boolean;
}

const DAY = 24 * 60 * 60 * 1000;
const DAYS = 14;
const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
const STATUS_LABEL = { requested: 'à valider', approved: 'validée', ready: 'prête', out: 'sortie' };

// Planning : qui a quoi, sur quel chantier, et les jours où un outil ou un véhicule est demandé deux fois
const Planning: React.FC = () => {
  const { equipment, vehicles, checkouts, users } = useApp();
  const [mode, setMode] = useState<'tools' | 'vehicles'>('vehicles');
  const [from, setFrom] = useState(() => startOfDay(Date.now()));
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [siteFilter, setSiteFilter] = useState('');
  const [onlyConflicts, setOnlyConflicts] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('requests_overview').select('id, number, requester_name, destination, start_at, end_at, status')
      .in('status', ['requested', 'approved', 'ready', 'out'])
      .then(async ({ data }) => {
        const rows = (data || []) as RequestRow[];
        setRequests(rows);
        if (!rows.length) return setItems([]);
        const { data: lines } = await supabase.from('request_items').select('request_id, item_kind, equipment_id, vehicle_id, quantity')
          .in('request_id', rows.map(r => r.id));
        setItems(((lines || []) as ItemRow[]).map(l => ({ ...l, quantity: Number(l.quantity) })));
      });
  }, []);

  const to = from + DAYS * DAY;
  const days = Array.from({ length: DAYS }, (_, i) => from + i * DAY);

  // Réservations par outil / véhicule
  const bookings = useMemo(() => {
    const map = new Map<string, Booking[]>();
    const add = (id: string, b: Booking) => map.set(id, [...(map.get(id) ?? []), b]);
    for (const line of items) {
      const r = requests.find(x => x.id === line.request_id);
      if (!r) continue;
      const base = { start: new Date(r.start_at).getTime(), end: new Date(r.end_at).getTime(), site: r.destination?.trim() || 'Sans chantier', who: r.requester_name, kind: 'request' as const, pending: r.status === 'requested' };
      if (mode === 'vehicles' && line.item_kind === 'vehicle' && line.vehicle_id) {
        add(line.vehicle_id, { ...base, key: `${r.id}:${line.vehicle_id}`, units: 1, label: `${r.number} · ${STATUS_LABEL[r.status]}` });
      }
      // Outils : une demande déjà sortie apparaît par ses emprunts réels
      if (mode === 'tools' && line.item_kind === 'tool' && line.equipment_id && r.status !== 'out') {
        add(line.equipment_id, { ...base, key: `${r.id}:${line.equipment_id}`, units: line.quantity, label: `${r.number} · ${STATUS_LABEL[r.status]}` });
      }
    }
    if (mode === 'tools') {
      for (const c of checkouts) {
        if (c.status !== 'active' && c.status !== 'overdue') continue;
        const u = users.find(x => x.id === c.userId);
        add(c.equipmentId, {
          key: c.id, start: new Date(c.checkoutDate).getTime(), end: Math.max(new Date(c.dueDate).getTime(), Date.now()), units: 1,
          site: c.notes?.split(' · ').find(p => !p.startsWith('Demande ') && !p.startsWith('retiré par'))?.trim() || 'Sans chantier',
          who: u ? `${u.first_name} ${u.last_name}` : '', label: new Date(c.dueDate).getTime() < Date.now() ? 'sorti · en retard' : 'sorti', kind: 'out', pending: false,
        });
      }
    }
    return map;
  }, [items, requests, checkouts, users, mode]);

  const rows = useMemo(() => {
    const list = mode === 'vehicles'
      ? vehicles.filter(v => v.status !== 'retired').map(v => ({ id: v.id, name: v.name, sub: v.plate, capacity: 1 }))
      : equipment.filter(e => e.itemType !== 'consumable' && e.status !== 'retired' && bookings.has(e.id))
          .map(e => ({ id: e.id, name: e.name, sub: e.articleNumber ?? '', capacity: Math.max(1, e.totalQuantity ?? 1) }));
    const site = siteFilter.trim().toLowerCase();
    return list.map(row => {
      const all = (bookings.get(row.id) ?? []).filter(b => b.end > from && b.start < to);
      const shown = site ? all.filter(b => b.site.toLowerCase().includes(site)) : all;
      const perDay = days.map(day => {
        const inDay = all.filter(b => b.start < day + DAY && b.end > day);
        const units = inDay.reduce((s, b) => s + b.units, 0);
        return { units, conflict: units > row.capacity, mine: site ? inDay.some(b => b.site.toLowerCase().includes(site)) : units > 0, inDay };
      });
      return { ...row, bookings: shown, perDay, conflicts: perDay.filter(d => d.conflict).length };
    })
      .filter(r => !site || r.bookings.length)
      .filter(r => !onlyConflicts || r.conflicts)
      .sort((a, b) => b.conflicts - a.conflicts || a.name.localeCompare(b.name, 'fr'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, vehicles, equipment, bookings, from, siteFilter, onlyConflicts]);

  const conflictCount = rows.reduce((s, r) => s + (r.conflicts ? 1 : 0), 0);
  const fmt = (t: number) => new Date(t).toLocaleDateString('fr-CH', { weekday: 'short', day: 'numeric' });
  const inputClass = 'rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mx-page-title">Planning</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Demandes à venir et sorties en cours, jour par jour. En rouge : plus de demandes que d'exemplaires.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <MxSegmented aria-label="Type" value={mode} onChange={v => { setMode(v as typeof mode); setOpen(null); }}
          options={[{ value: 'vehicles', label: 'Véhicules' }, { value: 'tools', label: 'Outils' }]} />
        <div className="inline-flex items-center gap-1">
          <button type="button" aria-label="Semaine précédente" onClick={() => setFrom(f => f - 7 * DAY)} className="mx-btn mx-btn-secondary min-h-[34px] min-w-[34px] flex items-center justify-center"><ChevronLeft size={18} /></button>
          <button type="button" onClick={() => setFrom(startOfDay(Date.now()))} className="mx-btn mx-btn-secondary min-h-[34px] px-3.5 text-[12.5px]">Aujourd'hui</button>
          <button type="button" aria-label="Semaine suivante" onClick={() => setFrom(f => f + 7 * DAY)} className="mx-btn mx-btn-secondary min-h-[34px] min-w-[34px] flex items-center justify-center"><ChevronRight size={18} /></button>
        </div>
        <input type="search" value={siteFilter} onChange={e => setSiteFilter(e.target.value)} placeholder="Chantier…" aria-label="Filtrer par chantier" className={`${inputClass} w-44`} />
        <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={onlyConflicts} onChange={e => setOnlyConflicts(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary-600" />
          Conflits seulement {conflictCount ? <span className="font-semibold text-tone-danger">({conflictCount})</span> : null}
        </label>
      </div>

      <div className="rounded-lg bg-white dark:bg-gray-800 shadow overflow-x-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="text-xs text-gray-600 dark:text-gray-300">
              <th className="sticky left-0 z-10 bg-white dark:bg-gray-800 px-3 py-2 text-left min-w-[11rem]">{mode === 'vehicles' ? 'Véhicule' : 'Outil'}</th>
              {days.map(d => {
                const weekend = [0, 6].includes(new Date(d).getDay());
                const today = d === startOfDay(Date.now());
                return <th key={d} className={`px-1 py-2 font-medium text-center min-w-[3.2rem] ${weekend ? 'bg-gray-50 dark:bg-gray-900/40' : ''} ${today ? 'text-primary-700 dark:text-primary-300 font-bold' : ''}`}>{fmt(d)}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={DAYS + 1} className="px-3 py-6 text-gray-600 dark:text-gray-400">{mode === 'tools' ? 'Aucun outil demandé ou sorti sur cette période.' : 'Aucun véhicule.'}</td></tr>
            )}
            {rows.map(row => (
              <React.Fragment key={row.id}>
                <tr className="border-t border-gray-200 dark:border-gray-700">
                  <th scope="row" className="sticky left-0 z-10 bg-white dark:bg-gray-800 px-3 py-1.5 text-left font-normal">
                    <button type="button" aria-expanded={open === row.id} onClick={() => setOpen(open === row.id ? null : row.id)} className="text-left">
                      <span className="block font-medium text-gray-900 dark:text-gray-100 truncate max-w-[14rem]">{row.name}</span>
                      <span className="block text-xs text-gray-500 font-mono">{row.sub}{row.capacity > 1 ? ` · ${row.capacity} ex.` : ''}</span>
                    </button>
                  </th>
                  {row.perDay.map((d, i) => (
                    <td key={days[i]} className="px-0.5 py-1">
                      {d.units > 0 && (
                        <div title={d.inDay.map(b => `${b.who} · ${b.site} · ${b.label}`).join('\n')}
                          className={`h-8 rounded flex items-center justify-center text-xs font-semibold ${d.conflict ? 'mx-fill-danger' : d.inDay.every(b => b.pending) ? 'bg-warning-200 text-warning-900 dark:bg-warning-800 dark:text-warning-100' : d.mine ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}>
                          {row.capacity > 1 || d.conflict ? `${d.units}/${row.capacity}` : ''}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
                {open === row.id && (
                  <tr className="bg-gray-50 dark:bg-gray-900/40">
                    <td colSpan={DAYS + 1} className="px-3 py-2">
                      {row.bookings.length === 0 ? <p className="text-xs text-gray-600 dark:text-gray-400">Rien sur cette période.</p> : (
                        <ul className="text-xs text-gray-800 dark:text-gray-200 space-y-0.5">
                          {[...row.bookings].sort((a, b) => a.start - b.start).map(b => (
                            <li key={b.key}>
                              {new Date(b.start).toLocaleDateString('fr-CH')} → {new Date(b.end).toLocaleDateString('fr-CH')} · <strong>{b.site}</strong> · {b.who}{b.units > 1 ? ` · ${b.units} ex.` : ''} · {b.label}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400">
        <span className="inline-block w-3 h-3 rounded bg-primary-500 align-middle" /> réservé ou sorti ·{' '}
        <span className="inline-block w-3 h-3 rounded bg-warning-200 align-middle" /> demande à valider ·{' '}
        <span className="inline-block w-3 h-3 rounded bg-danger-600 align-middle" /> conflit. Touche une ligne pour le détail.
      </p>
    </div>
  );
};

export default Planning;
