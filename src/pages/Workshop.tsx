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
import { MxEmpty } from '../components/mx/MxEmpty';
import { MxCardGrid } from '../components/mx/MxCardGrid';
import { MxEntityCard } from '../components/mx/MxEntityCard';
import { MxBadge } from '../components/mx/MxBadge';
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
          {repairs.length === 0 ? <MxEmpty icon={Wrench} title="Aucune réparation" /> : (
            <MxCardGrid
              items={repairs}
              getItemKey={r => r.id}
              renderItem={r => {
                const late = r.status === 'sent' && !!r.expected_on && r.expected_on < today;
                const eq = equipment.find(e => e.id === r.equipment_id);
                const tone = r.status === 'returned' ? 'success' : r.status === 'cancelled' ? 'neutral' : late ? 'danger' : 'info';
                const label = r.status === 'returned' ? 'Revenu' : r.status === 'cancelled' ? 'Annulé' : late ? 'En retard' : 'Chez le réparateur';
                const close = () => { setClosing(r); setCloseForm({ returned_on: today, cost: r.under_warranty ? '0' : '', notes: '' }); };
                return (
                  <MxEntityCard
                    avatarSrc={eq?.imageUrl || null}
                    avatarName={itemName(r.equipment_id)}
                    title={`${itemName(r.equipment_id)}${qr(r.instance_id) ? ` · ${qr(r.instance_id)}` : ''}`}
                    infoParts={[
                      { content: `${r.repairer}${r.reference ? ` · ${r.reference}` : ''}` },
                      { content: r.reason || '\u00A0' },
                    ]}
                    statusBadge={<span className="inline-flex gap-1"><MxBadge tone={tone}>{label}</MxBadge>{r.under_warranty && <MxBadge tone="success">Garantie</MxBadge>}</span>}
                    due={<span>{r.status === 'returned' ? `Revenu le ${fmt(r.returned_on!)}${r.cost !== null ? ` · ${chf(r.cost)}` : ''}` : r.status === 'sent' && r.expected_on ? `Retour prévu le ${fmt(r.expected_on)}` : `Envoyé le ${fmt(r.sent_on)}`}</span>}
                    menuLabel={`Actions pour ${itemName(r.equipment_id)}`}
                    menuActions={r.status === 'sent' && canAct ? [{ id: 'back', label: 'Revenu', icon: CheckCircle2, onSelect: close }] : []}
                    onOpen={() => { if (r.status === 'sent' && canAct) close(); }}
                  />
                );
              }}
            />
          )}
        </div>
      )}

      {tab === 'warranty' && (
        warranties.length === 0 ? <MxEmpty icon={ShieldCheck} title="Aucune garantie saisie" description="Renseigne la date dans la fiche de l'outil (Achat, garantie)." /> : (
          <MxCardGrid
            items={warranties}
            getItemKey={e => e.id}
            renderItem={e => {
              const expired = e.warrantyUntil! < today;
              const soon = !expired && e.warrantyUntil! <= in30;
              return (
                <MxEntityCard
                  avatarSrc={e.imageUrl || null}
                  avatarName={e.name}
                  title={e.name}
                  infoParts={[{ content: e.articleNumber || '\u00A0' }]}
                  statusBadge={<MxBadge tone={expired ? 'neutral' : soon ? 'warning' : 'success'}>{expired ? 'Expirée' : soon ? 'Bientôt expirée' : 'Sous garantie'}</MxBadge>}
                  due={<span>{`${expired ? 'Expirée le' : 'Jusqu\'au'} ${fmt(e.warrantyUntil!)}`}</span>}
                  menuLabel={`Actions pour ${e.name}`}
                  menuActions={!expired && canAct ? [{ id: 'repair', label: 'Faire réparer', icon: Send, onSelect: () => startSend(e.id) }] : []}
                  onOpen={() => { if (!expired && canAct) startSend(e.id); }}
                />
              );
            }}
          />
        )
      )}

      {tab === 'batteries' && (
        batteries.length === 0 ? <MxEmpty icon={BatteryWarning} title="Aucune batterie suivie" description="Dans la fiche de l'article, coche « Batterie »." /> : (
          <MxCardGrid
            items={batteries}
            getItemKey={b => `${b.equipment_id}:${b.instance_id ?? ''}`}
            renderItem={b => (
              <MxEntityCard
                avatarSrc={equipment.find(e => e.id === b.equipment_id)?.imageUrl || null}
                avatarName={b.name}
                title={b.name}
                infoParts={[
                  { content: b.code || '\u00A0' },
                  { content: `${b.age_months}${b.battery_life_months ? `/${b.battery_life_months}` : ''} mois · ${b.uses}${b.battery_max_uses ? `/${b.battery_max_uses}` : ''} sorties` },
                ]}
                statusBadge={<MxBadge tone={b.state === 'end' ? 'danger' : b.state === 'soon' ? 'warning' : 'success'}>{b.state === 'end' ? 'Fin de vie' : b.state === 'soon' ? 'Bientôt' : 'OK'}</MxBadge>}
                onOpen={() => undefined}
              />
            )}
          />
        )
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
