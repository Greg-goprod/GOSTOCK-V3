import React, { useEffect, useMemo, useState } from 'react';
import { BatteryWarning, CheckCircle2, Send, ShieldCheck, Wrench } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { errorMessage } from '../lib/requests';
import DateInput from '../components/common/DateInput';
import { MxSegmented } from '../components/mx/MxSegmented';
import PageTitle from '../components/common/PageTitle';
import { PageCommands } from '../components/Layout/ModuleHeader';

interface Repair {
  id: string;
  equipment_id: string;
  instance_id: string | null;
  supplier_id: string | null;
  repairer: string;
  reason: string;
  reference: string | null;
  under_warranty: boolean;
  sent_on: string;
  expected_on: string | null;
  returned_on: string | null;
  cost: number | null;
  status: 'sent' | 'returned' | 'cancelled';
}

interface Battery {
  equipment_id: string;
  instance_id: string | null;
  name: string;
  code: string | null;
  since: string;
  age_months: number;
  uses: number;
  battery_life_months: number | null;
  battery_max_uses: number | null;
  state: 'ok' | 'soon' | 'end';
}

type Tab = 'repairs' | 'warranty' | 'batteries';

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const fmt = (d: string) => new Date(d).toLocaleDateString('fr-CH');
const iso = (d: Date) => d.toISOString().slice(0, 10);
const chf = (n: number) => n.toLocaleString('fr-CH', { style: 'currency', currency: 'CHF' });
const EMPTY_SEND = { equipment_id: '', instance_id: '', supplier_id: '', repairer: '', reason: '', expected_on: '', reference: '' };

// Atelier : réparations chez le fournisseur, garanties qui se terminent, batteries en fin de vie
const Workshop: React.FC = () => {
  const { equipment, equipmentInstances, suppliers, refreshData } = useApp();
  const { can } = useAuth();
  const canAct = can('manage_stock') || can('scan');
  const [tab, setTab] = useState<Tab>('repairs');
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [batteries, setBatteries] = useState<Battery[]>([]);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState(EMPTY_SEND);
  const [search, setSearch] = useState('');
  const [closing, setClosing] = useState<Repair | null>(null);
  const [closeForm, setCloseForm] = useState({ returned_on: iso(new Date()), cost: '', notes: '' });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [r, b] = await Promise.all([
      supabase.from('repair_orders').select('*').order('sent_on', { ascending: false }).limit(300),
      supabase.from('battery_status').select('*'),
    ]);
    if (r.error) toast.error(errorMessage(r.error));
    setRepairs(((r.data || []) as Repair[]).map(x => ({ ...x, cost: x.cost === null ? null : Number(x.cost) })));
    const order = { end: 0, soon: 1, ok: 2 };
    setBatteries(((b.data || []) as Battery[]).sort((x, y) => order[x.state] - order[y.state] || y.age_months - x.age_months));
  };

  useEffect(() => {
    load();
  }, []);

  const itemName = (id: string) => equipment.find(e => e.id === id)?.name ?? 'Article';
  const qr = (id: string | null) => (id ? equipmentInstances.find(i => i.id === id)?.qrCode : undefined);
  const open = repairs.filter(r => r.status === 'sent');
  const today = iso(new Date());
  const in30 = iso(new Date(Date.now() + 30 * 86400000));
  const warranties = equipment
    .filter(e => e.warrantyUntil && e.status !== 'retired')
    .sort((a, b) => (a.warrantyUntil ?? '').localeCompare(b.warrantyUntil ?? ''));
  const yearCost = repairs.filter(r => r.returned_on?.startsWith(String(new Date().getFullYear()))).reduce((s, r) => s + (r.cost ?? 0), 0);

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return equipment.filter(e => e.itemType !== 'consumable' && e.status !== 'retired' && `${e.name} ${e.articleNumber ?? ''} ${e.serialNumber ?? ''}`.toLowerCase().includes(q)).slice(0, 8);
  }, [search, equipment]);

  const startSend = (equipmentId = '') => {
    const item = equipment.find(e => e.id === equipmentId);
    const supplier = suppliers.find(s => s.id === item?.supplier);
    setForm({ ...EMPTY_SEND, equipment_id: equipmentId, supplier_id: supplier?.id ?? '', repairer: supplier?.name ?? '' });
    setSearch('');
    setSending(true);
  };

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.equipment_id) return toast.error('Choisis l\'outil');
    setBusy(true);
    const { data, error } = await supabase.rpc('send_repair', {
      p_equipment_id: form.equipment_id,
      p_instance_id: form.instance_id || null,
      p_repairer: form.repairer,
      p_supplier_id: form.supplier_id || null,
      p_reason: form.reason,
      p_expected_on: form.expected_on || null,
      p_reference: form.reference || null,
    });
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(`${itemName(form.equipment_id)} envoyé chez ${form.repairer}${data?.under_warranty ? ' (sous garantie)' : ''}`);
    setSending(false);
    await Promise.all([load(), refreshData()]);
  };

  const close = async (cancel: boolean) => {
    if (!closing) return;
    setBusy(true);
    const { error } = await supabase.rpc('close_repair', {
      p_repair_id: closing.id,
      p_returned_on: closeForm.returned_on,
      p_cost: closeForm.cost === '' ? null : Number(closeForm.cost),
      p_notes: closeForm.notes || null,
      p_cancel: cancel,
    });
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(cancel ? 'Envoi annulé : l\'outil est de nouveau disponible' : `${itemName(closing.equipment_id)} de retour`);
    setClosing(null);
    await Promise.all([load(), refreshData()]);
  };

  const tabs: [Tab, string, number][] = [
    ['repairs', 'Réparations', open.length],
    ['warranty', 'Garanties', warranties.filter(e => e.warrantyUntil! >= today && e.warrantyUntil! <= in30).length],
    ['batteries', 'Batteries', batteries.filter(b => b.state !== 'ok').length],
  ];

  return (
    <div className="space-y-6">
      <div>
          <PageTitle>Atelier</PageTitle>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Réparations chez le fournisseur, garanties et batteries. Un outil en réparation ne peut pas sortir.</p>
      </div>
      <PageCommands filters={<MxSegmented aria-label="Rubrique" value={tab} onChange={v => setTab(v as Tab)}
        options={tabs.map(([id, label, n]) => ({ value: id, label: `${label}${n ? ` (${n})` : ''}` }))} />}
        primary={canAct ? <Button icon={<Send size={16} />} onClick={() => startSend()}>Envoyer en réparation</Button> : undefined} />

      {tab === 'repairs' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">Coût des réparations {new Date().getFullYear()} : <strong className="font-mono">{chf(yearCost)}</strong></p>
          <ul className="rounded-lg bg-white dark:bg-gray-800 shadow divide-y divide-gray-200 dark:divide-gray-700">
            {repairs.length === 0 && <li className="p-4 text-sm text-gray-600 dark:text-gray-400">Aucune réparation.</li>}
            {repairs.map(r => {
              const late = r.status === 'sent' && r.expected_on && r.expected_on < today;
              return (
                <li key={r.id} className="p-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-gray-100 flex flex-wrap items-center gap-2">
                      <Wrench size={16} aria-hidden="true" className="text-primary-600" />
                      {itemName(r.equipment_id)}{qr(r.instance_id) ? <span className="font-mono text-xs text-gray-500">{qr(r.instance_id)}</span> : null}
                      <span className="text-gray-500 font-normal">· {r.repairer}{r.reference ? ` · ${r.reference}` : ''}</span>
                      {r.under_warranty && <span className="rounded mx-tint-badge-success px-2 py-0.5 text-[length:calc(11px*var(--mx-scale,1))] font-bold">sous garantie</span>}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {r.reason} · envoyé le {fmt(r.sent_on)}
                      {r.status === 'sent' && r.expected_on ? ` · retour prévu le ${fmt(r.expected_on)}` : ''}
                      {r.status === 'returned' ? ` · revenu le ${fmt(r.returned_on!)}${r.cost !== null ? ` · ${chf(r.cost)}` : ''}` : ''}
                      {r.status === 'cancelled' ? ' · annulé' : ''}
                    </p>
                    {late && <p className="text-xs font-semibold text-tone-danger">En retard : relancer {r.repairer}</p>}
                  </div>
                  {r.status === 'sent' && canAct && (
                    <Button size="sm" icon={<CheckCircle2 size={14} />} onClick={() => { setClosing(r); setCloseForm({ returned_on: today, cost: r.under_warranty ? '0' : '', notes: '' }); }}>Revenu</Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {tab === 'warranty' && (
        <ul className="rounded-lg bg-white dark:bg-gray-800 shadow divide-y divide-gray-200 dark:divide-gray-700">
          {warranties.length === 0 && <li className="p-4 text-sm text-gray-600 dark:text-gray-400">Aucune date de garantie saisie (fiche de l'outil → Achat, garantie).</li>}
          {warranties.map(e => {
            const expired = e.warrantyUntil! < today;
            const soon = !expired && e.warrantyUntil! <= in30;
            return (
              <li key={e.id} className="p-3 flex flex-wrap items-center gap-2 text-sm">
                <ShieldCheck size={16} aria-hidden="true" className={expired ? 'text-gray-400' : soon ? 'text-tone-warning' : 'text-tone-success'} />
                <span className={`flex-1 min-w-[12rem] ${expired ? 'text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>{e.name}{e.articleNumber ? <span className="font-mono text-xs text-gray-500"> · {e.articleNumber}</span> : null}</span>
                <span className={`text-xs ${soon ? 'font-semibold text-tone-warning' : 'text-gray-600 dark:text-gray-400'}`}>
                  {expired ? 'expirée le' : 'jusqu\'au'} {fmt(e.warrantyUntil!)}
                </span>
                {!expired && canAct && <Button size="sm" variant="outline" onClick={() => startSend(e.id)}>Faire réparer</Button>}
              </li>
            );
          })}
        </ul>
      )}

      {tab === 'batteries' && (
        <ul className="rounded-lg bg-white dark:bg-gray-800 shadow divide-y divide-gray-200 dark:divide-gray-700">
          {batteries.length === 0 && <li className="p-4 text-sm text-gray-600 dark:text-gray-400">Aucune batterie suivie (fiche de l'article → cocher « Batterie »).</li>}
          {batteries.map(b => (
            <li key={`${b.equipment_id}:${b.instance_id ?? ''}`} className="p-3 flex flex-wrap items-center gap-2 text-sm">
              <BatteryWarning size={16} aria-hidden="true" className={b.state === 'end' ? 'text-tone-danger' : b.state === 'soon' ? 'text-tone-warning' : 'text-tone-success'} />
              <span className="flex-1 min-w-[12rem] text-gray-900 dark:text-gray-100">{b.name}{b.code ? <span className="font-mono text-xs text-gray-500"> · {b.code}</span> : null}</span>
              <span className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                {b.age_months}{b.battery_life_months ? `/${b.battery_life_months}` : ''} mois · {b.uses}{b.battery_max_uses ? `/${b.battery_max_uses}` : ''} sorties
              </span>
              <span className={`rounded px-2 py-0.5 text-[length:calc(11px*var(--mx-scale,1))] font-bold ${b.state === 'end' ? 'mx-tint-badge-danger' : b.state === 'soon' ? 'mx-tint-badge-warning' : 'mx-tint-badge-success'}`}>
                {b.state === 'end' ? 'fin de vie' : b.state === 'soon' ? 'bientôt' : 'ok'}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Modal isOpen={sending} onClose={() => setSending(false)} title="Envoyer en réparation" size="lg">
        <form onSubmit={send} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="rep-search" className={labelClass}>Outil</label>
            {form.equipment_id ? (
              <div className="flex items-center gap-2">
                <span className="flex-1 text-sm text-gray-900 dark:text-gray-100">{itemName(form.equipment_id)}</span>
                <Button size="sm" variant="outline" onClick={() => setForm({ ...form, equipment_id: '', instance_id: '' })}>Changer</Button>
              </div>
            ) : (
              <>
                <input id="rep-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom, numéro d'article ou de série…" className={inputClass} />
                {candidates.length > 0 && (
                  <ul className="mt-1 rounded-md border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
                    {candidates.map(e => (
                      <li key={e.id}>
                        <button type="button" onClick={() => startSend(e.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100">
                          {e.name}{e.warrantyUntil && e.warrantyUntil >= today ? <span className="text-xs text-tone-success"> · garantie jusqu'au {fmt(e.warrantyUntil)}</span> : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
          {form.equipment_id && equipmentInstances.some(i => i.equipmentId === form.equipment_id) && (
            <div>
              <label htmlFor="rep-instance" className={labelClass}>Exemplaire</label>
              <select id="rep-instance" value={form.instance_id} onChange={e => setForm({ ...form, instance_id: e.target.value })} className={inputClass}>
                <option value="">Un exemplaire (sans précision)</option>
                {equipmentInstances.filter(i => i.equipmentId === form.equipment_id).map(i => <option key={i.id} value={i.id}>{i.qrCode}</option>)}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="rep-supplier" className={labelClass}>Fournisseur</label>
            <select id="rep-supplier" value={form.supplier_id} onChange={e => {
              const s = suppliers.find(x => x.id === e.target.value);
              setForm({ ...form, supplier_id: e.target.value, repairer: s?.name ?? form.repairer });
            }} className={inputClass}>
              <option value="">Autre réparateur</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="rep-repairer" className={labelClass}>Réparateur</label>
            <input id="rep-repairer" value={form.repairer} onChange={e => setForm({ ...form, repairer: e.target.value })} className={inputClass} required placeholder="ex. Makita SAV Dietlikon" />
          </div>
          <div>
            <label htmlFor="rep-expected" className={labelClass}>Retour prévu</label>
            <DateInput id="rep-expected" min={today} value={form.expected_on} onChange={e => setForm({ ...form, expected_on: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="rep-ref" className={labelClass}>N° de dossier</label>
            <input id="rep-ref" value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} className={inputClass} placeholder="RMA, bon de réparation…" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="rep-reason" className={labelClass}>Panne</label>
            <input id="rep-reason" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className={inputClass} required placeholder="ex. mandrin bloqué, ne charge plus" />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setSending(false)}>Annuler</Button>
            <Button type="submit" icon={<Send size={16} />} loading={busy}>Envoyer</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={closing !== null} onClose={() => setClosing(null)} title={closing ? `Retour : ${itemName(closing.equipment_id)}` : 'Retour'}>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="rep-back" className={labelClass}>Revenu le</label>
              <DateInput id="rep-back" value={closeForm.returned_on} max={today} onChange={e => setCloseForm({ ...closeForm, returned_on: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label htmlFor="rep-cost" className={labelClass}>Coût (CHF)</label>
              <input id="rep-cost" type="number" min={0} step="0.05" inputMode="decimal" value={closeForm.cost} onChange={e => setCloseForm({ ...closeForm, cost: e.target.value })} className={`${inputClass} font-mono`} />
            </div>
          </div>
          <div>
            <label htmlFor="rep-notes" className={labelClass}>Remarque</label>
            <input id="rep-notes" value={closeForm.notes} onChange={e => setCloseForm({ ...closeForm, notes: e.target.value })} className={inputClass} placeholder="ex. moteur remplacé" />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => close(true)} loading={busy}>Annuler l'envoi</Button>
            <Button icon={<CheckCircle2 size={16} />} onClick={() => close(false)} loading={busy}>Remettre en service</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Workshop;
