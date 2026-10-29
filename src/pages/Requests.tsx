import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Circle, Minus, PackageCheck, Plus, Search, Truck, X, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import FuelInput from '../components/common/FuelInput';
import SignaturePad from '../components/common/SignaturePad';
import QRCodeScanner from '../components/QRCode/QRCodeScanner';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { DeclareIncidentModal } from './Incidents';
import PhotoInput from '../components/common/PhotoInput';
import { supabase } from '../lib/supabase';
import { useSiteSuggestions } from '../lib/sites';
import { findEquipmentByCode } from '../lib/scan';
import { REQUEST_STATUS, errorMessage, formatPeriod, toLocalInput } from '../lib/requests';
import { RequestItemRow, RequestOverview, RequestStatus } from '../types';

type Filter = 'todo' | 'approve' | 'out' | 'all';

const FILTERS: { id: Filter; label: string; statuses: RequestStatus[] | null }[] = [
  { id: 'todo', label: 'À préparer', statuses: ['approved', 'ready'] },
  { id: 'approve', label: 'À valider', statuses: ['requested'] },
  { id: 'out', label: 'Sorties', statuses: ['out'] },
  { id: 'all', label: 'Toutes', statuses: null },
];

const inputClass =
  'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

const StatusPill: React.FC<{ status: RequestStatus }> = ({ status }) => (
  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${REQUEST_STATUS[status].className}`}>
    {REQUEST_STATUS[status].label}
  </span>
);

const contentSummary = (r: RequestOverview) =>
  [
    r.tool_lines > 0 && `${r.tool_lines} outil${r.tool_lines > 1 ? 's' : ''}`,
    r.consumable_lines > 0 && `${r.consumable_lines} consommable${r.consumable_lines > 1 ? 's' : ''}`,
    r.vehicle_names,
  ].filter(Boolean).join(' · ');

const DAY_MS = 24 * 60 * 60 * 1000;

// Avis personnels : demande validée, refusée, prête à retirer
const MyNotices: React.FC = () => {
  const { stockNotifications, markStockNotificationRead } = useApp();
  const { profile } = useAuth();
  const mine = stockNotifications.filter(n => n.recipientUserId && n.recipientUserId === profile?.id);
  if (mine.length === 0) return null;
  return (
    <ul className="space-y-2" aria-label="Avis sur mes demandes">
      {mine.map(n => (
        <li
          key={n.id}
          className={`flex items-start justify-between gap-3 rounded-lg p-3 text-sm ${n.kind === 'request_rejected' ? 'bg-danger-50 text-danger-900 dark:bg-danger-900/30 dark:text-danger-100' : n.kind === 'request_ready' ? 'bg-success-50 text-success-900 dark:bg-success-900/30 dark:text-success-100' : 'bg-info-50 text-gray-900 dark:bg-info-900 dark:text-info-100'}`}
        >
          <div>
            <p className="font-semibold">{n.title}</p>
            <p>{n.message}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => markStockNotificationRead(n.id)}>OK</Button>
        </li>
      ))}
    </ul>
  );
};

// Ce que la personne connectée a en sa possession (le magasin le voit dans « Sorties »)
const MyEquipment: React.FC = () => {
  const { checkouts, equipment, equipmentInstances } = useApp();
  const { profile } = useAuth();
  const [reporting, setReporting] = useState<{ checkoutId: string; equipmentId: string } | null>(null);
  const mine = checkouts
    .filter(c => c.userId === profile?.id && (c.status === 'active' || c.status === 'overdue'))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  if (mine.length === 0) return null;

  return (
    <section className="rounded-lg bg-white dark:bg-gray-800 shadow p-4" aria-labelledby="my-equipment">
      <h2 id="my-equipment" className="font-bold text-gray-900 dark:text-white mb-2">Matériel chez moi ({mine.length})</h2>
      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
        {mine.map(c => {
          const item = equipment.find(e => e.id === c.equipmentId);
          const instance = c.instanceId ? equipmentInstances.find(i => i.id === c.instanceId) : undefined;
          const late = c.status === 'overdue' || new Date(c.dueDate).getTime() < Date.now();
          const daysLate = Math.max(1, Math.floor((Date.now() - new Date(c.dueDate).getTime()) / DAY_MS));
          return (
            <li key={c.id} className="flex justify-between items-center gap-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{item?.name ?? 'Article'}</div>
                <div className="font-mono text-xs text-gray-600 dark:text-gray-400">
                  {[instance?.qrCode ?? item?.articleNumber, `à rendre le ${new Date(c.dueDate).toLocaleDateString('fr-CH')}`].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {late && (
                  <span className="rounded-full bg-danger-100 text-danger-800 dark:bg-danger-900/40 dark:text-danger-200 px-2 py-0.5 text-xs font-semibold">
                    {daysLate} j de retard
                  </span>
                )}
                <Button size="sm" variant="outline" onClick={() => setReporting({ checkoutId: c.id, equipmentId: c.equipmentId })}>Signaler</Button>
              </div>
            </li>
          );
        })}
      </ul>
      {reporting && (
        <DeclareIncidentModal
          checkoutId={reporting.checkoutId}
          equipmentId={reporting.equipmentId}
          onClose={() => setReporting(null)}
          onDone={async () => setReporting(null)}
        />
      )}
    </section>
  );
};

const Requests: React.FC = () => {
  const [requests, setRequests] = useState<RequestOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const { can } = useAuth();
  const staff = can('scan') || can('approve') || can('view_all');
  const [filter, setFilter] = useState<Filter>(staff ? 'todo' : 'all');
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  // Demande préremplie (« Refaire cette demande »)
  const [prefill, setPrefill] = useState<RequestPrefill | null>(null);
  const [selected, setSelected] = useState<RequestOverview | null>(null);

  const load = async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase.from('requests_overview').select('*').order('start_at');
    setLoading(false);
    if (error) {
      toast.error('Impossible de charger les demandes');
      return;
    }
    setRequests((data || []) as RequestOverview[]);
  };

  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map(f => [f.id, f.statuses ? requests.filter(r => f.statuses!.includes(r.status)).length : requests.length])),
    [requests]
  );

  const visible = useMemo(() => {
    const statuses = FILTERS.find(f => f.id === filter)?.statuses;
    const term = search.trim().toLowerCase();
    return requests
      .filter(r => !statuses || statuses.includes(r.status))
      .filter(r => !term || [r.number, r.requester_name, r.destination, r.vehicle_names].some(v => (v || '').toLowerCase().includes(term)))
      // Toutes : les plus récentes d'abord ; sinon par date de début
      .sort((a, b) => filter === 'all'
        ? new Date(b.start_at).getTime() - new Date(a.start_at).getTime()
        : new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  }, [requests, filter, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-800 dark:text-white tracking-tight uppercase">{staff ? 'Demandes' : 'Mes demandes'}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Réservations d'outils, de consommables et de véhicules</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setShowNew(true)}>Nouvelle demande</Button>
      </div>

      <MyNotices />
      {!staff && <MyEquipment />}

      <div className="flex flex-wrap gap-2 items-center">
        {FILTERS.filter(f => staff || f.id === 'all').map(f => (
          <Button key={f.id} size="sm" variant={filter === f.id ? 'primary' : 'outline'} onClick={() => setFilter(f.id)}>
            {f.label} ({counts[f.id] ?? 0})
          </Button>
        ))}
        <div className="relative basis-full sm:basis-auto sm:flex-1 sm:min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 w-4 h-4" aria-hidden="true" />
          <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Numéro, personne, chantier, véhicule…" aria-label="Rechercher une demande" className={`${inputClass} pl-10`} />
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-600 dark:text-gray-400">Chargement…</div>
      ) : visible.length === 0 ? (
        <div className="py-12 text-center text-gray-600 dark:text-gray-400">
          {requests.length === 0 ? 'Aucune demande pour l\'instant. Créez la première avec « Nouvelle demande ».' : 'Aucune demande dans cette liste.'}
        </div>
      ) : (
        <ul className="grid gap-3">
          {visible.map(r => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setSelected(r)}
                className="w-full text-left bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:ring-2 hover:ring-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 transition"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm text-gray-600 dark:text-gray-300">{r.number}</span>
                      <StatusPill status={r.status} />
                    </div>
                    <div className="mt-1 font-semibold text-gray-900 dark:text-gray-100">
                      {r.requester_name}{r.destination && <span className="font-normal text-gray-600 dark:text-gray-300"> · {r.destination}</span>}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{contentSummary(r) || '—'}</div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-mono text-gray-900 dark:text-gray-100">{formatPeriod(r.start_at, r.end_at)}</div>
                    <div className="text-gray-600 dark:text-gray-400">{r.depot_name}</div>
                  </div>
                </div>
                {r.status === 'requested' && r.approval_reason && (
                  <p className="mt-2 text-sm text-warning-800 dark:text-warning-200">Validation requise : {r.approval_reason}</p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {showNew && (
        <NewRequestModal
          initial={prefill ?? undefined}
          onClose={() => { setShowNew(false); setPrefill(null); }}
          onCreated={async created => {
            setShowNew(false);
            setPrefill(null);
            await load();
            toast.success(created.status === 'approved'
              ? `Demande ${created.number} validée automatiquement`
              : `Demande ${created.number} envoyée en validation`);
          }}
        />
      )}

      {selected && (
        <RequestDetailModal
          request={selected}
          onClose={() => setSelected(null)}
          onChanged={async () => {
            setSelected(null);
            await load();
          }}
          onRepeat={repeat => {
            setSelected(null);
            setPrefill(repeat);
            setShowNew(true);
          }}
        />
      )}
    </div>
  );
};

/* ------------------------------------------------------------------------ */

export interface RequestPrefill {
  items: { kind: 'tool' | 'consumable' | 'vehicle'; id: string; quantity: number }[];
  destination?: string | null;
}

interface RequestTemplate {
  id: string;
  name: string;
  destination: string | null;
  items: RequestPrefill['items'];
}

interface DraftItem {
  kind: 'tool' | 'consumable' | 'vehicle';
  id: string;
  name: string;
  unit?: string;
  quantity: number;
}

const NewRequestModal: React.FC<{ initial?: RequestPrefill; onClose: () => void; onCreated: (r: { number: string; status: RequestStatus }) => Promise<void> }> = ({ initial, onClose, onCreated }) => {
  const sites = useSiteSuggestions();
  const { users, depots, equipment, vehicles, consumableStock } = useApp();
  const { profile, can } = useAuth();
  // Le magasin et les responsables peuvent saisir une demande pour quelqu'un d'autre
  const forOthers = can('scan') || can('approve');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(7, 30, 0, 0);
  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(17, 0, 0, 0);

  const [requesterId, setRequesterId] = useState(forOthers ? '' : profile?.id ?? '');
  const [destination, setDestination] = useState(initial?.destination ?? '');
  const [depotId, setDepotId] = useState(depots.find(d => d.isDefault)?.id || depots[0]?.id || '');
  const [start, setStart] = useState(toLocalInput(tomorrow));
  const [end, setEnd] = useState(toLocalInput(tomorrowEnd));
  const [notes, setNotes] = useState('');
  // Lignes d'un panier favori ou d'une demande précédente (articles retirés entre-temps ignorés)
  const toDraft = (list: RequestPrefill['items']): DraftItem[] => list.flatMap((i): DraftItem[] => {
    if (i.kind === 'vehicle') {
      const v = vehicles.find(x => x.id === i.id);
      return v ? [{ kind: 'vehicle', id: v.id, name: `${v.name} · ${v.plate}`, quantity: 1 }] : [];
    }
    const e = equipment.find(x => x.id === i.id && x.status !== 'retired');
    return e ? [{ kind: i.kind, id: e.id, name: e.name, unit: e.unit, quantity: i.quantity }] : [];
  });
  const [items, setItems] = useState<DraftItem[]>(() => toDraft(initial?.items ?? []));
  const [templates, setTemplates] = useState<RequestTemplate[]>([]);

  useEffect(() => {
    supabase.from('request_templates').select('id, name, destination, items').order('name')
      .then(({ data }) => setTemplates((data || []) as RequestTemplate[]));
  }, []);

  const applyTemplate = (id: string) => {
    const t = templates.find(x => x.id === id);
    if (!t) return;
    setItems(toDraft(t.items));
    if (t.destination) setDestination(t.destination);
    toast.success(`Panier « ${t.name} » chargé`);
  };

  const saveTemplate = async () => {
    if (!profile || items.length === 0) return;
    const name = window.prompt('Nom du panier (ex. Kit carottage, Mon lundi) :')?.trim();
    if (!name) return;
    const { error } = await supabase.from('request_templates').upsert({
      user_id: profile.id,
      name,
      destination: destination || null,
      items: items.map(i => ({ kind: i.kind, id: i.id, quantity: i.quantity })),
    }, { onConflict: 'user_id,name' });
    if (error) return toast.error(errorMessage(error));
    toast.success(`Panier « ${name} » enregistré`);
    const { data } = await supabase.from('request_templates').select('id, name, destination, items').order('name');
    setTemplates((data || []) as RequestTemplate[]);
  };
  const [tab, setTab] = useState<DraftItem['kind']>('tool');
  const [search, setSearch] = useState('');
  const [availability, setAvailability] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const startIso = start ? new Date(start).toISOString() : '';
  const endIso = end ? new Date(end).toISOString() : '';
  const periodOk = !!startIso && !!endIso && endIso > startIso;

  // Disponibilité sur la période des outils et véhicules choisis
  useEffect(() => {
    if (!supabase || !periodOk) return;
    let cancelled = false;
    (async () => {
      const result: Record<string, string> = {};
      for (const item of items) {
        if (item.kind === 'tool') {
          const { data } = await supabase!.rpc('tool_availability', { p_equipment_id: item.id, p_start: startIso, p_end: endIso });
          result[item.id] = typeof data === 'number' ? `${data} disponible${data > 1 ? 's' : ''} sur la période` : '';
        } else if (item.kind === 'vehicle') {
          const { data } = await supabase!.rpc('vehicle_unavailability', { p_vehicle_id: item.id, p_start: startIso, p_end: endIso });
          result[item.id] = data ? String(data) : 'Libre sur la période';
        } else {
          const stock = consumableStock.find(s => s.equipmentId === item.id && s.depotId === depotId)?.quantity ?? 0;
          result[item.id] = `${stock} ${item.unit ?? ''} en stock au dépôt`;
        }
      }
      if (!cancelled) setAvailability(result);
    })();
    return () => { cancelled = true; };
  }, [items, startIso, endIso, depotId, periodOk, consumableStock]);

  const candidates = useMemo(() => {
    const term = search.trim().toLowerCase();
    const chosen = new Set(items.map(i => i.id));
    if (tab === 'vehicle') {
      return vehicles
        .filter(v => v.status !== 'retired' && !chosen.has(v.id))
        .filter(v => !term || `${v.name} ${v.plate}`.toLowerCase().includes(term))
        .map(v => ({ id: v.id, name: v.name, detail: v.plate, unit: undefined }));
    }
    return equipment
      .filter(e => (tab === 'consumable' ? e.itemType === 'consumable' : e.itemType !== 'consumable') && e.status !== 'retired' && !chosen.has(e.id))
      .filter(e => !term || `${e.name} ${e.articleNumber ?? ''} ${e.serialNumber ?? ''}`.toLowerCase().includes(term))
      .slice(0, 30)
      .map(e => ({ id: e.id, name: e.name, detail: e.articleNumber || e.serialNumber || '', unit: e.unit }));
  }, [tab, search, items, vehicles, equipment]);

  const addItem = (c: { id: string; name: string; unit?: string }) => {
    if (tab === 'vehicle' && items.some(i => i.kind === 'vehicle')) {
      toast.error('Un seul véhicule par demande');
      return;
    }
    setItems(prev => [...prev, { kind: tab, id: c.id, name: c.name, unit: c.unit, quantity: 1 }]);
  };

  const setQty = (id: string, qty: number) =>
    setItems(prev => prev.map(i => (i.id === id ? { ...i, quantity: Math.max(1, qty) } : i)));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    if (!requesterId) return toast.error('Choisissez la personne qui fait la demande');
    if (!periodOk) return toast.error('La fin doit être après le début');
    if (items.length === 0) return toast.error('Ajoutez au moins un article ou un véhicule');
    setSaving(true);
    const { data, error } = await supabase.rpc('create_request', {
      p_requester_id: requesterId,
      p_depot_id: depotId,
      p_start: startIso,
      p_end: endIso,
      p_items: items.map(i => ({ kind: i.kind, id: i.id, quantity: i.quantity })),
      p_destination: destination || null,
      p_notes: notes || null,
    });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    await onCreated(data);
  };

  const TABS: { id: DraftItem['kind']; label: string }[] = [
    { id: 'tool', label: 'Outils' },
    { id: 'consumable', label: 'Consommables' },
    { id: 'vehicle', label: 'Véhicule' },
  ];

  return (
    <Modal isOpen onClose={onClose} title="Nouvelle demande" size="xl">
      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="req-user" className={labelClass}>Pour qui</label>
            {forOthers ? (
              <select id="req-user" value={requesterId} onChange={e => setRequesterId(e.target.value)} className={inputClass} required>
                <option value="">— Choisir une personne —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
              </select>
            ) : (
              <input id="req-user" value={`${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`} className={inputClass} readOnly />
            )}
          </div>
          <div>
            <label htmlFor="req-dest" className={labelClass}>Chantier ou service</label>
            <input id="req-dest" list="req-dest-sites" autoComplete="off" value={destination} onChange={e => setDestination(e.target.value)} className={inputClass} placeholder="ex. Chantier Renens" />
            <datalist id="req-dest-sites">{sites.map(site => <option key={site} value={site} />)}</datalist>
          </div>
          <div>
            <label htmlFor="req-start" className={labelClass}>Du</label>
            <input id="req-start" type="datetime-local" value={start} onChange={e => setStart(e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label htmlFor="req-end" className={labelClass}>Au</label>
            <input id="req-end" type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label htmlFor="req-depot" className={labelClass}>Dépôt</label>
            <select id="req-depot" value={depotId} onChange={e => setDepotId(e.target.value)} className={inputClass} required>
              {depots.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="req-notes" className={labelClass}>Remarque (facultatif)</label>
            <input id="req-notes" value={notes} onChange={e => setNotes(e.target.value)} className={inputClass} />
          </div>
        </div>

        {/* Paniers favoris */}
        {(templates.length > 0 || items.length > 0) && (
          <div className="flex flex-wrap items-end gap-2">
            {templates.length > 0 && (
              <div>
                <label htmlFor="req-template" className={labelClass}>Mes paniers</label>
                <select id="req-template" value="" onChange={e => applyTemplate(e.target.value)} className={inputClass}>
                  <option value="">— Charger un panier —</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
            {items.length > 0 && <Button size="sm" variant="outline" onClick={saveTemplate}>Enregistrer comme panier</Button>}
          </div>
        )}

        {/* Choix des articles */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Type d'article">
            {TABS.map(t => (
              <Button key={t.id} size="sm" variant={tab === t.id ? 'primary' : 'outline'} onClick={() => { setTab(t.id); setSearch(''); }}>
                {t.label}
              </Button>
            ))}
          </div>
          <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…" aria-label="Rechercher un article" className={inputClass} />
          <ul className="max-h-48 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700 rounded-md border border-gray-200 dark:border-gray-700">
            {candidates.length === 0 ? (
              <li className="p-3 text-sm text-gray-600 dark:text-gray-400">Aucun résultat</li>
            ) : candidates.map(c => (
              <li key={c.id}>
                <button type="button" onClick={() => addItem(c)} className="w-full flex justify-between items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 min-h-[44px]">
                  <span className="text-sm text-gray-900 dark:text-gray-100">{c.name} <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{c.detail}</span></span>
                  <Plus size={16} className="text-primary-600 dark:text-primary-300 shrink-0" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Contenu de la demande ({items.length})</h3>
          {items.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">Rien pour l'instant : choisissez des articles ci-dessus.</p>
          ) : (
            <ul className="space-y-2">
              {items.map(item => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-gray-50 dark:bg-gray-700/40 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {item.kind === 'vehicle' && <Truck size={14} className="inline mr-1 align-text-bottom" aria-hidden="true" />}
                      {item.name}
                    </div>
                    <div className={`text-xs ${/réservé|échue|dépassé|maintenance|retiré|^0 /.test(availability[item.id] || '') ? 'text-danger-700 dark:text-danger-300' : 'text-gray-600 dark:text-gray-400'}`}>
                      {availability[item.id] || (periodOk ? 'Vérification…' : 'Choisissez une période valide')}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {item.kind !== 'vehicle' && (
                      <>
                        <Button size="sm" variant="outline" icon={<Minus size={14} />} onClick={() => setQty(item.id, item.quantity - 1)} ariaLabel="Diminuer la quantité" />
                        <input
                          type="number" min="1" step="1" inputMode="numeric" value={item.quantity}
                          onChange={e => setQty(item.id, Number(e.target.value) || 1)}
                          aria-label={`Quantité : ${item.name}`}
                          className="w-16 text-center font-mono rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-gray-900 dark:text-gray-100"
                        />
                        <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={() => setQty(item.id, item.quantity + 1)} ariaLabel="Augmenter la quantité" />
                      </>
                    )}
                    <Button size="sm" variant="outline" icon={<X size={14} />} onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))} ariaLabel={`Retirer ${item.name}`} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {items.some(i => i.kind === 'vehicle') && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Une demande avec véhicule est toujours validée par un responsable.</p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button type="submit" loading={saving}>Envoyer la demande</Button>
        </div>
      </form>
    </Modal>
  );
};

/* ------------------------------------------------------------------------ */

const RequestDetailModal: React.FC<{ request: RequestOverview; onClose: () => void; onChanged: () => Promise<void>; onRepeat: (prefill: RequestPrefill) => void }> = ({ request, onClose, onChanged, onRepeat }) => {
  const { equipment, vehicles, users, refreshData } = useApp();
  const { profile, can } = useAuth();
  const isOwner = profile?.id === request.requester_id;
  // Retrait par un tiers (chef d'équipe…) : le demandeur reste responsable du matériel
  const [pickupBy, setPickupBy] = useState(request.requester_id);
  const pickupName = (() => {
    const u = users.find(x => x.id === pickupBy);
    return u ? `${u.first_name} ${u.last_name}` : request.requester_name;
  })();
  const [items, setItems] = useState<RequestItemRow[]>([]);
  const [deliveryNumber, setDeliveryNumber] = useState<string | null>(null);
  // La base remplace de toute façon ce nom par celui de la personne connectée
  const decider = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim();
  const [decisionNote, setDecisionNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [prepared, setPrepared] = useState<Record<string, boolean>>({});
  const [issuing, setIssuing] = useState(false);
  const vehicleItem = items.find(i => i.item_kind === 'vehicle');
  const vehicle = vehicles.find(v => v.id === vehicleItem?.vehicle_id);
  const [km, setKm] = useState('');
  const [fuel, setFuel] = useState(8);
  const [damages, setDamages] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  // Photos du véhicule au départ : comparées à celles du retour
  const [startPhotos, setStartPhotos] = useState<string[]>([]);

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data, error } = await supabase!.from('request_items').select('*').eq('request_id', request.id);
      if (error) return toast.error('Impossible de charger le contenu de la demande');
      setItems((data || []).map(i => ({ ...i, quantity: Number(i.quantity) })));
      if (request.delivery_note_id) {
        const { data: note } = await supabase!.from('delivery_notes').select('note_number').eq('id', request.delivery_note_id).maybeSingle();
        setDeliveryNumber(note?.note_number ?? null);
      }
    })();
  }, [request.id, request.delivery_note_id]);

  useEffect(() => {
    if (vehicle) {
      setKm(String(vehicle.currentKm));
      setFuel(vehicle.fuelLevel);
    }
  }, [vehicle]);

  const itemName = (i: RequestItemRow) =>
    i.item_kind === 'vehicle'
      ? `${vehicles.find(v => v.id === i.vehicle_id)?.name ?? 'Véhicule'} · ${vehicles.find(v => v.id === i.vehicle_id)?.plate ?? ''}`
      : equipment.find(e => e.id === i.equipment_id)?.name ?? 'Article supprimé';
  const itemUnit = (i: RequestItemRow) => (i.item_kind === 'consumable' ? equipment.find(e => e.id === i.equipment_id)?.unit : undefined);

  const run = async (fn: () => PromiseLike<{ error: unknown }>, success: string) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) {
      toast.error(errorMessage(error));
      return false;
    }
    toast.success(success);
    await refreshData();
    await onChanged();
    return true;
  };

  const decide = (approve: boolean) =>
    run(() => supabase!.rpc('decide_request', { p_request_id: request.id, p_approve: approve, p_decided_by: decider, p_note: decisionNote || null }),
      approve ? `Demande ${request.number} validée` : `Demande ${request.number} refusée`);

  const setStatus = (status: 'ready' | 'approved' | 'cancelled', message: string) =>
    run(() => supabase!.rpc('set_request_status', { p_request_id: request.id, p_status: status }), message);

  const issue = async () => {
    if (pickupBy !== request.requester_id) {
      const { error } = await supabase.from('requests').update({ picked_up_by: pickupBy }).eq('id', request.id);
      if (error) return toast.error(errorMessage(error));
    }
    const ok = await run(() => supabase!.rpc('issue_request', {
      p_request_id: request.id,
      p_vehicle: vehicleItem ? { km: Number(km), fuel, damages: damages || null, signature } : null,
    }), `Demande ${request.number} sortie`);
    if (ok && vehicleItem && startPhotos.length) {
      const { error } = await supabase.from('vehicle_trips').update({ start_photos: startPhotos }).eq('request_id', request.id).is('end_at', null);
      if (error) toast.error(`Photos non enregistrées : ${errorMessage(error)}`);
    }
  };

  // Préparation : le magasinier scanne chaque article de la demande
  const onScan = async (code: string) => {
    try {
      const found = await findEquipmentByCode(code);
      const match = found && items.find(i => i.equipment_id === found.equipment.id);
      if (!match) {
        toast.error(found ? `${found.equipment.name} ne fait pas partie de cette demande` : `Code inconnu : ${code}`);
        return;
      }
      setPrepared(prev => ({ ...prev, [match.id]: true }));
      toast.success(`${found!.equipment.name} préparé`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const articleLines = items.filter(i => i.item_kind !== 'vehicle');
  const allPrepared = articleLines.every(i => prepared[i.id]);
  // Préparer et sortir : le magasin uniquement (le collaborateur ne scanne jamais)
  const canIssue = can('scan') && ['approved', 'ready'].includes(request.status);
  const canCancelOwn = isOwner && !can('scan') && request.status === 'approved';

  return (
    <Modal isOpen onClose={onClose} title={`Demande ${request.number}`} size="lg">
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 rounded-md bg-gray-50 dark:bg-gray-700/40 p-3 text-sm">
          <div><div className="text-gray-600 dark:text-gray-400">Pour</div><div className="font-medium text-gray-900 dark:text-gray-100">{request.requester_name}{request.destination ? ` · ${request.destination}` : ''}</div></div>
          <div><div className="text-gray-600 dark:text-gray-400">Période</div><div className="font-mono text-gray-900 dark:text-gray-100">{formatPeriod(request.start_at, request.end_at)}</div></div>
          <div><div className="text-gray-600 dark:text-gray-400">Dépôt</div><div className="text-gray-900 dark:text-gray-100">{request.depot_name}</div></div>
          <div><div className="text-gray-600 dark:text-gray-400">État</div><div className="flex items-center gap-2"><StatusPill status={request.status} />{deliveryNumber && <span className="font-mono text-gray-700 dark:text-gray-300">Bon {deliveryNumber}</span>}</div></div>
          {request.notes && <div className="sm:col-span-2"><div className="text-gray-600 dark:text-gray-400">Remarque</div><div className="text-gray-900 dark:text-gray-100">{request.notes}</div></div>}
          {request.decided_by && (
            <div className="sm:col-span-2 text-gray-700 dark:text-gray-300">
              {request.status === 'rejected' ? 'Refusée' : 'Validée'} par {request.decided_by}
              {request.decision_note && ` : ${request.decision_note}`}
            </div>
          )}
          {(isOwner || can('scan') || can('approve')) && items.length > 0 && (
            <div className="sm:col-span-2 flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRepeat({
                  destination: request.destination,
                  items: items.map(i => ({ kind: i.item_kind, id: (i.item_kind === 'vehicle' ? i.vehicle_id : i.equipment_id) as string, quantity: Number(i.quantity) })),
                })}
              >
                Refaire cette demande
              </Button>
            </div>
          )}
        </div>

        <div>
          <div className="flex justify-between items-baseline mb-2">
            <h3 className="font-semibold text-gray-900 dark:text-white">Contenu</h3>
            {canIssue && articleLines.length > 0 && (
              <span className="text-sm text-gray-600 dark:text-gray-400">{articleLines.filter(i => prepared[i.id]).length} / {articleLines.length} préparé(s)</span>
            )}
          </div>
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {items.map(i => (
              <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  {canIssue && i.item_kind !== 'vehicle' ? (
                    <button
                      type="button"
                      onClick={() => setPrepared(prev => ({ ...prev, [i.id]: !prev[i.id] }))}
                      aria-label={prepared[i.id] ? `${itemName(i)} préparé` : `Marquer ${itemName(i)} comme préparé`}
                      className="min-h-[44px] min-w-[44px] lg:min-h-0 lg:min-w-0 flex items-center justify-center"
                    >
                      {prepared[i.id]
                        ? <CheckCircle2 size={20} className="text-success-600 dark:text-success-400" />
                        : <Circle size={20} className="text-gray-400" />}
                    </button>
                  ) : i.item_kind === 'vehicle' ? <Truck size={18} className="text-gray-500 dark:text-gray-400" aria-hidden="true" /> : null}
                  <span className="text-sm text-gray-900 dark:text-gray-100">{itemName(i)}</span>
                </div>
                <span className="font-mono text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {i.item_kind === 'vehicle' ? '' : `${i.quantity} ${itemUnit(i) ?? ''}`}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Validation */}
        {request.status === 'requested' && (
          <div className="space-y-3 rounded-md border border-warning-200 dark:border-warning-800 p-3">
            <p className="text-sm text-gray-800 dark:text-gray-200">Validation requise : {request.approval_reason}</p>
            {can('approve') ? (
              <>
                <div>
                  <label htmlFor="decision-note" className={labelClass}>Remarque (obligatoire si refus)</label>
                  <input id="decision-note" value={decisionNote} onChange={e => setDecisionNote(e.target.value)} className={inputClass} />
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="danger" icon={<XCircle size={16} />} onClick={() => decide(false)} loading={busy}>Refuser</Button>
                  <Button variant="success" icon={<CheckCircle2 size={16} />} onClick={() => decide(true)} loading={busy}>Valider</Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400">En attente de la décision d'un responsable.</p>
            )}
            {isOwner && !can('approve') && (
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setStatus('cancelled', `Demande ${request.number} annulée`)} loading={busy}>Annuler ma demande</Button>
              </div>
            )}
          </div>
        )}

        {/* Préparation et sortie */}
        {canIssue && !issuing && (
          <div className="space-y-3">
            <div className="max-w-xs">
              <label htmlFor="pickup-by" className={labelClass}>Retiré par</label>
              <select id="pickup-by" value={pickupBy} onChange={e => setPickupBy(e.target.value)} className={inputClass}>
                {users.filter(u => u.active !== false).map(u => (
                  <option key={u.id} value={u.id}>{u.first_name} {u.last_name}{u.id === request.requester_id ? ' (demandeur)' : ''}</option>
                ))}
              </select>
            </div>
            {articleLines.length > 0 && (
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">Scannez chaque article préparé (ou cochez-le à la main).</p>
                <QRCodeScanner onScan={onScan} disableAutoFocus />
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setStatus('cancelled', `Demande ${request.number} annulée`)} loading={busy}>Annuler la demande</Button>
              {request.status === 'approved' ? (
                <Button variant="outline" icon={<PackageCheck size={16} />} onClick={() => setStatus('ready', `Demande ${request.number} prête`)} loading={busy}>Marquer prête</Button>
              ) : (
                <Button variant="outline" onClick={() => setStatus('approved', 'Remise en préparation')} loading={busy}>Remettre en préparation</Button>
              )}
              <Button
                onClick={() => (vehicleItem ? setIssuing(true) : issue())}
                loading={busy}
                disabled={!allPrepared}
              >
                {vehicleItem ? 'Sortir : état des lieux' : 'Sortir'}
              </Button>
            </div>
            {!allPrepared && <p className="text-right text-xs text-gray-600 dark:text-gray-400">Tous les articles doivent être préparés avant la sortie.</p>}
          </div>
        )}

        {canCancelOwn && (
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setStatus('cancelled', `Demande ${request.number} annulée`)} loading={busy}>Annuler ma demande</Button>
          </div>
        )}

        {/* État des lieux du véhicule au départ */}
        {canIssue && issuing && vehicle && (
          <div className="space-y-4 rounded-md border border-gray-200 dark:border-gray-700 p-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">État des lieux au départ · {vehicle.name}</h3>
            <div>
              <label htmlFor="start-km" className={labelClass}>Kilométrage (dernier relevé : <span className="font-mono">{vehicle.currentKm.toLocaleString('fr-CH')} km</span>)</label>
              <input id="start-km" type="number" min={vehicle.currentKm} inputMode="numeric" value={km} onChange={e => setKm(e.target.value)} className={`${inputClass} font-mono`} required />
            </div>
            <FuelInput value={fuel} onChange={setFuel} />
            <div>
              <label htmlFor="start-damages" className={labelClass}>Dégâts constatés (facultatif)</label>
              <textarea id="start-damages" value={damages} onChange={e => setDamages(e.target.value)} rows={2} className={inputClass} placeholder="ex. rayure porte arrière droite" />
            </div>
            <PhotoInput folder="vehicules" value={startPhotos} onChange={setStartPhotos} label="Photos du véhicule au départ (au moins une : chaque côté si possible)" />
            <SignaturePad label={`Signature de ${pickupName}`} onChange={setSignature} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setIssuing(false)} disabled={busy}>Retour</Button>
              <Button onClick={issue} loading={busy} disabled={!km || !signature || startPhotos.length === 0}>Valider la sortie</Button>
            </div>
          </div>
        )}

        {request.status === 'out' && vehicleItem && (
          <p className="text-sm text-gray-700 dark:text-gray-300">Le retour du véhicule se fait depuis la page Véhicules (état des lieux de retour).</p>
        )}
      </div>
    </Modal>
  );
};

export default Requests;
