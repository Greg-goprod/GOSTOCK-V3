import React, { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Briefcase, Pencil, Plus, Printer, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { errorMessage } from '../lib/requests';
import { Kit, KitItem, kitValue } from '../lib/kits';
import { confirmAction } from '../lib/confirm';

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

// Kits et mallettes : un QR pour sortir et rendre tout le contenu
const Kits: React.FC = () => {
  const { equipment, equipmentInstances, checkouts, depots, users } = useApp();
  const { can } = useAuth();
  const canEdit = can('manage_stock');
  const [kits, setKits] = useState<Kit[]>([]);
  const [editing, setEditing] = useState<Kit | 'new' | null>(null);
  const [form, setForm] = useState({ name: '', depot_id: '', description: '' });
  const [lines, setLines] = useState<KitItem[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState<Kit | null>(null);

  const load = async () => {
    const { data, error } = await supabase.from('kits').select('*, kit_items(*)').order('name');
    if (error) toast.error(errorMessage(error));
    setKits((data || []) as Kit[]);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(null);
    window.addEventListener('afterprint', done);
    const timer = window.setTimeout(() => window.print(), 50);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', done);
    };
  }, [printing]);

  const itemName = (id: string) => equipment.find(e => e.id === id)?.name ?? 'Article supprimé';
  const instanceCode = (id: string | null) => (id ? equipmentInstances.find(i => i.id === id)?.qrCode : undefined);
  const active = checkouts.filter(c => c.status === 'active' || c.status === 'overdue');

  // Où est le kit : chez qui, et ce qui manque pour pouvoir le sortir complet
  const kitState = (kit: Kit) => {
    const out = active.filter(c => c.kitId === kit.id);
    const holders = [...new Set(out.map(c => c.userId))].map(id => {
      const u = users.find(x => x.id === id);
      return u ? `${u.first_name} ${u.last_name}` : 'Quelqu\'un';
    });
    const missing = kit.kit_items.filter(line => {
      if (line.instance_id) return active.some(c => c.instanceId === line.instance_id);
      const item = equipment.find(e => e.id === line.equipment_id);
      return (item?.availableQuantity ?? 0) < line.quantity;
    });
    return { out, holders, missing };
  };

  const openForm = (kit: Kit | 'new') => {
    setEditing(kit);
    setSearch('');
    if (kit === 'new') {
      setForm({ name: '', depot_id: depots.find(d => d.isDefault)?.id ?? '', description: '' });
      setLines([]);
    } else {
      setForm({ name: kit.name, depot_id: kit.depot_id ?? '', description: kit.description ?? '' });
      setLines(kit.kit_items.map(({ equipment_id, instance_id, quantity }) => ({ equipment_id, instance_id, quantity })));
    }
  };

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return equipment
      .filter(e => e.itemType !== 'consumable' && e.status !== 'retired')
      .filter(e => `${e.name} ${e.articleNumber ?? ''} ${e.serialNumber ?? ''}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [equipment, search]);

  const addLine = (equipmentId: string) => {
    setLines(ls => [...ls, { equipment_id: equipmentId, instance_id: null, quantity: 1 }]);
    setSearch('');
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!lines.length) {
      toast.error('Ajoutez au moins un outil au kit');
      return;
    }
    setSaving(true);
    try {
      const row = { name: form.name.trim(), depot_id: form.depot_id || null, description: form.description.trim() || null };
      let kitId: string;
      if (editing === 'new') {
        const { data, error } = await supabase.from('kits').insert(row).select('id').single();
        if (error) throw error;
        kitId = data.id;
      } else {
        kitId = (editing as Kit).id;
        const { error } = await supabase.from('kits').update(row).eq('id', kitId);
        if (error) throw error;
        const { error: delError } = await supabase.from('kit_items').delete().eq('kit_id', kitId);
        if (delError) throw delError;
      }
      const { error } = await supabase.from('kit_items').insert(lines.map(l => ({ ...l, kit_id: kitId, quantity: l.instance_id ? 1 : l.quantity })));
      if (error) throw error;
      toast.success('Kit enregistré');
      setEditing(null);
      await load();
    } catch (error) {
      toast.error((error as { code?: string }).code === '23505' ? 'Un exemplaire est déjà dans un autre kit' : errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (kit: Kit) => {
    if (!await confirmAction(`Supprimer le kit « ${kit.name} » ? Les outils restent dans le stock ; son étiquette ne marchera plus.`)) return;
    const { error } = await supabase.from('kits').delete().eq('id', kit.id);
    if (error) return toast.error(errorMessage(error));
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3 print:hidden">
        <div>
          <h1 className="mx-page-title">Kits</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Au comptoir, le QR du kit fait sortir tout son contenu ; au retour, il signale ce qui manque.</p>
        </div>
        {canEdit && <Button icon={<Plus size={16} />} onClick={() => openForm('new')}>Nouveau kit</Button>}
      </div>

      {kits.length === 0 && (
        <div className="rounded-lg bg-white dark:bg-gray-800 shadow p-6 text-sm text-gray-600 dark:text-gray-400 print:hidden">
          Aucun kit. Exemple : « Kit carrelage » = carrelette, malaxeur, niveau laser.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 print:hidden">
        {kits.map(kit => {
          const state = kitState(kit);
          return (
            <article key={kit.id} className="rounded-lg bg-white dark:bg-gray-800 shadow p-4 space-y-3 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Briefcase size={18} aria-hidden="true" className="shrink-0 text-primary-600" />
                    <span className="truncate">{kit.name}</span>
                  </h2>
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-mono">{kit.code}{kit.depot_id ? ` · ${depots.find(d => d.id === kit.depot_id)?.name ?? ''}` : ''}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="outline" icon={<Printer size={14} />} ariaLabel={`Imprimer l'étiquette de ${kit.name}`} onClick={() => setPrinting(kit)} />
                  {canEdit && <Button size="sm" variant="outline" icon={<Pencil size={14} />} ariaLabel={`Modifier ${kit.name}`} onClick={() => openForm(kit)} />}
                  {canEdit && <Button size="sm" variant="danger" icon={<Trash2 size={14} />} ariaLabel={`Supprimer ${kit.name}`} onClick={() => remove(kit)} />}
                </div>
              </div>
              <p className={`text-sm font-semibold ${state.out.length ? 'text-info-700 dark:text-info-100' : state.missing.length ? 'text-warning-700 dark:text-warning-300' : 'text-success-700 dark:text-success-300'}`}>
                {state.out.length ? `Sorti chez ${state.holders.join(', ')}` : state.missing.length ? `Incomplet : ${state.missing.length} outil${state.missing.length > 1 ? 's' : ''} pas disponible${state.missing.length > 1 ? 's' : ''}` : 'Complet, disponible'}
              </p>
              <ul className="text-sm text-gray-800 dark:text-gray-200 space-y-0.5">
                {kit.kit_items.map(line => {
                  const missing = state.missing.includes(line);
                  return (
                    <li key={line.id} className={missing && !state.out.length ? 'text-warning-700 dark:text-warning-300' : ''}>
                      {line.instance_id ? '' : `${line.quantity} × `}{itemName(line.equipment_id)}
                      {line.instance_id && <span className="font-mono text-xs text-gray-500"> · {instanceCode(line.instance_id)}</span>}
                    </li>
                  );
                })}
              </ul>
              {kit.description && <p className="text-xs text-gray-600 dark:text-gray-400">{kit.description}</p>}
            </article>
          );
        })}
      </div>

      {printing && (
        <div className="hidden print:block">
          <div className="w-[90mm] border border-black bg-white p-3 text-black">
            <div className="flex gap-3 items-start">
              <QRCodeSVG value={kitValue(printing.code)} size={110} level="M" />
              <div className="min-w-0">
                <p className="font-bold text-lg leading-tight">{printing.name}</p>
                <p className="font-mono text-xs">KIT {printing.code}</p>
              </div>
            </div>
            <ul className="mt-2 text-xs">
              {printing.kit_items.map(line => (
                <li key={line.id}>☐ {line.instance_id ? '' : `${line.quantity} × `}{itemName(line.equipment_id)}{line.instance_id ? ` (${instanceCode(line.instance_id)})` : ''}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <Modal isOpen={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Nouveau kit' : 'Modifier le kit'} size="lg">
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="kit-name" className={labelClass}>Nom</label>
              <input id="kit-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} required placeholder="ex. Kit carrelage" />
            </div>
            <div>
              <label htmlFor="kit-depot" className={labelClass}>Dépôt</label>
              <select id="kit-depot" value={form.depot_id} onChange={e => setForm({ ...form, depot_id: e.target.value })} className={inputClass}>
                <option value="">—</option>
                {depots.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="kit-desc" className={labelClass}>Remarque</label>
              <input id="kit-desc" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={inputClass} placeholder="ex. Mallette rouge, étagère B3" />
            </div>
          </div>

          <div>
            <p className={labelClass}>Contenu</p>
            {lines.length === 0 && <p className="text-sm text-gray-600 dark:text-gray-400">Aucun outil pour l'instant.</p>}
            <ul className="space-y-2">
              {lines.map((line, index) => {
                const item = equipment.find(e => e.id === line.equipment_id);
                const instances = equipmentInstances.filter(i => i.equipmentId === line.equipment_id);
                const update = (change: Partial<KitItem>) => setLines(ls => ls.map((l, i) => (i === index ? { ...l, ...change } : l)));
                return (
                  <li key={index} className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 dark:border-gray-700 p-2">
                    <span className="flex-1 min-w-[10rem] text-sm text-gray-900 dark:text-gray-100">{item?.name ?? 'Article'}</span>
                    {instances.length > 0 && (
                      <select value={line.instance_id ?? ''} onChange={e => update({ instance_id: e.target.value || null, quantity: 1 })} aria-label="Exemplaire" className={`${inputClass} w-auto`}>
                        <option value="">N'importe lequel</option>
                        {instances.map(i => <option key={i.id} value={i.id}>{i.qrCode}</option>)}
                      </select>
                    )}
                    {!line.instance_id && (
                      <input type="number" min={1} value={line.quantity} onChange={e => update({ quantity: Math.max(1, Number(e.target.value) || 1) })}
                        aria-label="Quantité" className={`${inputClass} w-20 font-mono`} />
                    )}
                    <Button size="sm" variant="outline" icon={<Trash2 size={14} />} ariaLabel="Retirer du kit" onClick={() => setLines(ls => ls.filter((_, i) => i !== index))} />
                  </li>
                );
              })}
            </ul>
            <div className="mt-2">
              <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Ajouter un outil : nom ou numéro…" aria-label="Ajouter un outil" className={inputClass} />
              {candidates.length > 0 && (
                <ul className="mt-1 rounded-md border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
                  {candidates.map(e => (
                    <li key={e.id}>
                      <button type="button" onClick={() => addLine(e.id)} className="w-full text-left px-3 py-2 min-h-[40px] text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100">
                        {e.name}{e.articleNumber ? <span className="font-mono text-xs text-gray-500"> · {e.articleNumber}</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(null)}>Annuler</Button>
            <Button type="submit" loading={saving}>Enregistrer</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Kits;
