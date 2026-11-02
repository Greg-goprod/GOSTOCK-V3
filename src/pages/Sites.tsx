import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Copy, FileText, HardHat, LocateFixed, Lock, MapPin, Pencil, Plus, Unlock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { printSiteReport, similarSiteItems } from '../lib/siteReport';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { errorMessage } from '../lib/requests';
import { currentPosition, formatCoordinates, geocodeAddress } from '../lib/geo';
import { DateRangeInput } from '../components/common/DateInput';
import { confirmAction } from '../lib/confirm';
import { MxSegmented } from '../components/mx/MxSegmented';
import { MxEmpty } from '../components/mx/MxEmpty';
import { MxCardGrid } from '../components/mx/MxCardGrid';
import { MxEntityCard } from '../components/mx/MxEntityCard';
import { MxBadge } from '../components/mx/MxBadge';
import PageTitle from '../components/common/PageTitle';
import { PageCommands } from '../components/Layout/ModuleHeader';

interface Site {
  id: string;
  name: string;
  client: string | null;
  address: string | null;
  manager_id: string | null;
  start_on: string | null;
  end_on: string | null;
  budget: number | null;
  status: 'open' | 'closed';
  closed_at: string | null;
  notes: string | null;
  latitude?: number | null;
  longitude?: number | null;
  consumables_cost: number;
  tools_cost: number;
  rentals_cost: number;
  spent: number;
  open_tools: number;
  open_rentals: number;
}

interface OpenItem {
  site_id: string;
  kind: 'tool' | 'rental';
  item_id: string;
  label: string;
  holder: string | null;
  due_at: string;
  late: boolean;
}

const EMPTY = { name: '', client: '', address: '', manager_id: '', start_on: '', end_on: '', budget: '', notes: '', latitude: null as number | null, longitude: null as number | null };

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const chf = (n: number) => n.toLocaleString('fr-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 });
const date = (d: string | null) => (d ? new Date(d).toLocaleDateString('fr-CH') : '…');

// Fiches chantier : budget matériel, dépenses, et ce qui doit revenir à la clôture
const Sites: React.FC = () => {
  const { users, equipment } = useApp();
  const navigate = useNavigate();
  const { can } = useAuth();
  const canEdit = can('manage_stock') || can('approve');
  const hasPlanning = can('module:cp.planning');
  const [sites, setSites] = useState<Site[]>([]);
  const [openItems, setOpenItems] = useState<OpenItem[]>([]);
  const [filter, setFilter] = useState<'open' | 'closed' | 'all'>('open');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<Site | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<Site | 'new' | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [s, o, c] = await Promise.all([
      supabase.from('site_summary').select('*').order('name'),
      supabase.from('site_open_items').select('*').order('due_at'),
      supabase.from('sites').select('id, latitude, longitude'),
    ]);
    if (s.error) toast.error(errorMessage(s.error));
    const coordinates = new Map(((c.data || []) as { id: string; latitude: number | null; longitude: number | null }[]).map(x => [x.id, x]));
    setSites(((s.data || []) as Site[]).map(x => ({
      ...x,
      latitude: coordinates.get(x.id)?.latitude ?? null,
      longitude: coordinates.get(x.id)?.longitude ?? null,
      budget: x.budget === null ? null : Number(x.budget),
      consumables_cost: Number(x.consumables_cost), tools_cost: Number(x.tools_cost), rentals_cost: Number(x.rentals_cost),
      spent: Number(x.spent), open_tools: Number(x.open_tools), open_rentals: Number(x.open_rentals),
    })));
    setOpenItems((o.data || []) as OpenItem[]);
  };

  useEffect(() => {
    load();
  }, []);

  const shown = useMemo(() => sites
    .filter(s => filter === 'all' || s.status === filter)
    .filter(s => `${s.name} ${s.client ?? ''} ${s.address ?? ''}`.toLowerCase().includes(search.toLowerCase())), [sites, filter, search]);

  const openForm = (site: Site | 'new') => {
    setEditing(site);
    setForm(site === 'new' ? EMPTY : {
      name: site.name, client: site.client ?? '', address: site.address ?? '', manager_id: site.manager_id ?? '',
      start_on: site.start_on ?? '', end_on: site.end_on ?? '', budget: site.budget === null ? '' : String(site.budget), notes: site.notes ?? '',
      latitude: site.latitude ?? null, longitude: site.longitude ?? null,
    });
  };

  const [locating, setLocating] = useState(false);
  const locate = async (source: 'address' | 'device') => {
    setLocating(true);
    try {
      const found = source === 'address' ? await geocodeAddress(form.address) : await currentPosition();
      if (!found) return toast.error('Adresse introuvable sur la carte : précise la localité');
      setForm(f => ({ ...f, ...found }));
      toast.success(`Position enregistrée : ${formatCoordinates(found)}`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLocating(false);
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    // Adresse sans position (ou adresse changée) : on la cherche sur la carte, sans bloquer si elle est introuvable
    let position = { latitude: form.latitude, longitude: form.longitude };
    const original = editing === 'new' ? null : editing;
    const addressChanged = form.address.trim() !== (original?.address ?? '').trim();
    const placedByHand = form.latitude !== (original?.latitude ?? null) || form.longitude !== (original?.longitude ?? null);
    if (form.address.trim() && !placedByHand && (position.latitude === null || addressChanged)) {
      position = await geocodeAddress(form.address).catch(() => null) ?? position;
    }
    const row = {
      latitude: position.latitude,
      longitude: position.longitude,
      name: form.name.trim().replace(/\s+/g, ' '),
      client: form.client.trim() || null,
      address: form.address.trim() || null,
      manager_id: form.manager_id || null,
      start_on: form.start_on || null,
      end_on: form.end_on || null,
      budget: form.budget === '' ? null : Number(form.budget),
      notes: form.notes.trim() || null,
    };
    const { error } = editing === 'new'
      ? await supabase.from('sites').insert(row)
      : await supabase.from('sites').update(row).eq('id', (editing as Site).id);
    setSaving(false);
    if (error) {
      toast.error(error.code === '23505' ? 'Un chantier porte déjà ce nom' : errorMessage(error));
      return;
    }
    toast.success(editing === 'new' ? 'Chantier créé : les sorties déjà faites sous ce nom y sont rattachées' : 'Chantier enregistré');
    setEditing(null);
    await load();
  };

  const toggleClosed = async (site: Site) => {
    const closing = site.status === 'open';
    const remaining = site.open_tools + site.open_rentals;
    if (closing && remaining > 0
      && !await confirmAction(`${remaining} élément${remaining > 1 ? 's sont' : ' est'} encore sur ce chantier. Clôturer quand même ? La liste reste visible ici.`)) return;
    const { error } = await supabase.from('sites')
      .update({ status: closing ? 'closed' : 'open', closed_at: closing ? new Date().toISOString() : null })
      .eq('id', site.id);
    if (error) return toast.error(errorMessage(error));
    toast.success(closing ? 'Chantier clôturé : plus aucune sortie possible' : 'Chantier rouvert');
    await load();
  };

  const report = (site: Site) => printSiteReport(site).catch(error => toast.error(errorMessage(error)));

  // Nouvelle demande préremplie avec le matériel utilisé sur ce chantier
  const prepareSimilar = async (site: Site) => {
    try {
      const items = await similarSiteItems(site.id, id => equipment.find(e => e.id === id)?.totalQuantity ?? 1);
      if (!items.length) return toast.error('Aucun matériel enregistré sur ce chantier');
      navigate('/demandes', { state: { prefill: { items, destination: null } } });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const name = (id: string | null) => {
    const u = users.find(x => x.id === id);
    return u ? `${u.first_name} ${u.last_name}` : null;
  };

  return (
    <div className="space-y-6">
      <div>
          <PageTitle>Chantiers</PageTitle>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Budget matériel, dépenses et matériel encore sur place. Les sorties sont rattachées par le nom du chantier.</p>
      </div>
      <PageCommands search={<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom, client, adresse…" aria-label="Rechercher un chantier" className={`${inputClass} w-full`} />} filters={<MxSegmented aria-label="Filtre" value={filter} onChange={v => setFilter(v as typeof filter)}
          options={[{ value: 'open', label: 'En cours' }, { value: 'closed', label: 'Clôturés' }, { value: 'all', label: 'Tous' }]} />} primary={canEdit ? <Button icon={<Plus size={16} />} onClick={() => openForm('new')}>Nouveau chantier</Button> : undefined} />

      {shown.length === 0 && (
        <MxEmpty icon={HardHat} title={sites.length === 0 ? 'Aucun chantier' : 'Aucun chantier dans ce filtre'}
          description={sites.length === 0 ? 'Crées-en un : le nom doit être celui saisi dans « Chantier ou service » lors des sorties.' : undefined} />
      )}

      <MxCardGrid
        items={shown}
        getItemKey={site => site.id}
        renderItem={site => {
          const ratio = site.budget ? site.spent / site.budget : 0;
          const remaining = site.open_tools + site.open_rentals;
          return (
            <MxEntityCard
              avatarName={site.name}
              title={site.name}
              infoParts={[
                { content: [site.client, name(site.manager_id) && `resp. ${name(site.manager_id)}`].filter(Boolean).join(' · ') || '\u00A0' },
                { content: site.budget !== null ? `${chf(site.spent)} / ${chf(site.budget)}` : `Dépensé ${chf(site.spent)}` },
              ]}
              statusBadge={site.status === 'closed' ? <MxBadge tone="neutral">Clôturé</MxBadge> : ratio > 1 ? <MxBadge tone="danger">Budget dépassé</MxBadge> : <MxBadge tone="success">En cours</MxBadge>}
              due={<span>{remaining ? `${remaining} élément${remaining > 1 ? 's' : ''} sur place` : 'Rien sur place'}</span>}
              menuLabel={`Actions pour ${site.name}`}
              menuActions={[
                { id: 'report', label: 'Rapport PDF', icon: FileText, onSelect: () => report(site) },
                ...(hasPlanning ? [{ id: 'planning', label: 'Planning', icon: CalendarClock, onSelect: () => navigate(`/pilote/planning?site=${site.id}`) }] : []),
                { id: 'similar', label: 'Préparer un chantier semblable', icon: Copy, onSelect: () => prepareSimilar(site) },
                ...(canEdit ? [
                  { id: 'edit', label: 'Modifier', icon: Pencil, onSelect: () => openForm(site) },
                  { id: 'toggle', label: site.status === 'open' ? 'Clôturer' : 'Rouvrir', icon: site.status === 'open' ? Lock : Unlock, onSelect: () => toggleClosed(site) },
                ] : []),
              ]}
              onOpen={() => setDetail(site)}
            />
          );
        }}
      />

      {detail && (() => {
        const site = sites.find(x => x.id === detail.id) ?? detail;
        const items = openItems.filter(i => i.site_id === site.id);
        const ratio = site.budget ? site.spent / site.budget : 0;
        const remaining = site.open_tools + site.open_rentals;
        return (
          <Modal isOpen onClose={() => setDetail(null)} title={site.name} size="lg">
            <div className="space-y-4">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {[site.client, site.address, name(site.manager_id) && `resp. ${name(site.manager_id)}`].filter(Boolean).join(' · ') || 'Aucun détail'}
                {(site.start_on || site.end_on) && ` · du ${date(site.start_on)} au ${date(site.end_on)}`}
              </p>
              <div>
            <div className="flex justify-between text-sm text-gray-800 dark:text-gray-200">
              <span>Dépensé <strong className="font-mono">{chf(site.spent)}</strong></span>
              {site.budget !== null && <span className="font-mono">budget {chf(site.budget)}</span>}
            </div>
            {site.budget !== null && site.budget > 0 && (
              <div className="mt-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)} aria-label="Part du budget dépensée">
                <div className={`h-full ${ratio > 1 ? 'bg-danger-600' : ratio > 0.8 ? 'bg-warning-500' : 'bg-success-600'}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
              </div>
            )}
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              Consommables {chf(site.consumables_cost)} · Outils {chf(site.tools_cost)} · Locations {chf(site.rentals_cost)}
              {ratio > 1 && <span className="text-tone-danger font-semibold"> · budget dépassé</span>}
            </p>
          </div>

          <div>
            <button type="button" aria-expanded={expanded === site.id} onClick={() => setExpanded(expanded === site.id ? null : site.id)}
              className={`text-sm font-semibold ${remaining ? 'text-tone-warning' : 'text-gray-600 dark:text-gray-400'} hover:underline`}>
              {remaining ? `${remaining} élément${remaining > 1 ? 's' : ''} encore sur le chantier` : 'Rien sur le chantier'}
            </button>
            {expanded === site.id && items.length > 0 && (
              <ul className="mt-2 divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                {items.map(i => (
                  <li key={i.item_id} className="py-1.5 flex justify-between gap-2 text-gray-800 dark:text-gray-200">
                    <span className="truncate">{i.kind === 'rental' ? 'Location · ' : ''}{i.label}{i.holder ? <span className="text-gray-500"> · {i.holder}</span> : null}</span>
                    <span className={`shrink-0 text-xs ${i.late ? 'text-tone-danger font-semibold' : 'text-gray-500'}`}>
                      {i.late ? 'en retard' : `→ ${new Date(i.due_at).toLocaleDateString('fr-CH')}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {site.notes && <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-line">{site.notes}</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="outline" icon={<FileText size={14} />} onClick={() => report(site)}>Rapport PDF</Button>
            <Button size="sm" variant="outline" icon={<Copy size={14} />} onClick={() => prepareSimilar(site)}>Préparer un chantier semblable</Button>
          </div>
              {site.notes && <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-line">{site.notes}</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                {hasPlanning && <Button size="sm" variant="outline" icon={<CalendarClock size={14} />} onClick={() => navigate(`/pilote/planning?site=${site.id}`)}>Planning</Button>}
                <Button size="sm" variant="outline" icon={<FileText size={14} />} onClick={() => report(site)}>Rapport PDF</Button>
                <Button size="sm" variant="outline" icon={<Copy size={14} />} onClick={() => prepareSimilar(site)}>Préparer un chantier semblable</Button>
              </div>
            </div>
          </Modal>
        );
      })()}

      <Modal isOpen={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Nouveau chantier' : 'Modifier le chantier'}>
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="site-name" className={labelClass}>Nom du chantier</label>
            <input id="site-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} required placeholder="ex. Chantier Renens" />
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">Le même nom que dans « Chantier ou service » : les sorties s'y rattachent toutes seules.</p>
          </div>
          <div>
            <label htmlFor="site-client" className={labelClass}>Client</label>
            <input id="site-client" value={form.client} onChange={e => setForm({ ...form, client: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="site-manager" className={labelClass}>Responsable</label>
            <select id="site-manager" value={form.manager_id} onChange={e => setForm({ ...form, manager_id: e.target.value })} className={inputClass}>
              <option value="">—</option>
              {users.filter(u => u.active !== false).map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="site-address" className={labelClass}>Adresse</label>
            <input id="site-address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className={inputClass} />
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <span>{form.latitude !== null && form.longitude !== null ? `Sur la carte : ${formatCoordinates({ latitude: form.latitude, longitude: form.longitude })}` : 'Pas encore sur la carte'}</span>
              <Button type="button" size="sm" variant="outline" icon={<MapPin size={14} />} onClick={() => locate('address')} disabled={!form.address.trim() || locating}>Depuis l'adresse</Button>
              <Button type="button" size="sm" variant="outline" icon={<LocateFixed size={14} />} onClick={() => locate('device')} disabled={locating}>Ma position (sur place)</Button>
            </div>
          </div>
          <div>
            <label htmlFor="site-period" className={labelClass}>Période (début et fin prévue)</label>
            <DateRangeInput id="site-period" start={form.start_on} end={form.end_on} onChange={(a, b) => setForm({ ...form, start_on: a, end_on: b })} className={inputClass} placeholder="Choisir le début et la fin" />
          </div>
          <div>
            <label htmlFor="site-budget" className={labelClass}>Budget matériel (CHF)</label>
            <input id="site-budget" type="number" min={0} step="1" inputMode="decimal" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} className={`${inputClass} font-mono`} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="site-notes" className={labelClass}>Remarques</label>
            <textarea id="site-notes" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={inputClass} />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(null)}>Annuler</Button>
            <Button type="submit" loading={saving}>Enregistrer</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Sites;
