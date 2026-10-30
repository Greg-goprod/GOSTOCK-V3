import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { errorMessage } from '../lib/requests';
import { confirmAction } from '../lib/confirm';

interface Bin {
  id: string;
  depot_id: string;
  code: string;
  label: string | null;
  sort_order: number;
}

interface Placement {
  // Outil : la fiche ; consommable : sa ligne de stock dans ce dépôt
  key: string;
  table: 'equipment' | 'consumable_stock';
  rowId: string;
  name: string;
  reference: string | null;
  kind: 'tool' | 'consumable';
  bin_id: string | null;
}

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const byOrder = (a: Bin, b: Bin) => a.sort_order - b.sort_order || a.code.localeCompare(b.code, 'fr', { numeric: true });

// Emplacements d'un dépôt (allée, étagère, bac) et rangement des articles : la liste de préparation suit cet ordre
const Bins: React.FC = () => {
  const { depots } = useApp();
  const { profile, can } = useAuth();
  const canEdit = can('manage_stock');
  const myDepots = profile?.depot_ids?.length ? depots.filter(d => profile.depot_ids.includes(d.id)) : depots;
  const [depotId, setDepotId] = useState('');
  const [bins, setBins] = useState<Bin[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [search, setSearch] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [single, setSingle] = useState({ code: '', label: '' });
  const [series, setSeries] = useState({ prefix: 'A-', from: '1', to: '10' });

  useEffect(() => {
    if (!depotId && myDepots.length) setDepotId(myDepots.find(d => d.isDefault)?.id || myDepots[0].id);
  }, [depotId, myDepots]);

  const load = async () => {
    if (!depotId) return;
    const [b, tools, stock] = await Promise.all([
      supabase.from('storage_bins').select('*').eq('depot_id', depotId),
      supabase.from('equipment').select('id, name, article_number, depot_id, bin_id, item_type, status').neq('item_type', 'consumable').neq('status', 'retired'),
      supabase.from('consumable_stock').select('id, bin_id, equipment(id, name, article_number)').eq('depot_id', depotId),
    ]);
    if (b.error) toast.error(errorMessage(b.error));
    setBins(((b.data || []) as Bin[]).sort(byOrder));
    const isDefault = depots.find(d => d.id === depotId)?.isDefault;
    const toolRows: Placement[] = (tools.data || [])
      // Outils sans dépôt : comptés au dépôt principal
      .filter(t => t.depot_id === depotId || (!t.depot_id && isDefault))
      .map(t => ({ key: `t:${t.id}`, table: 'equipment', rowId: t.id, name: t.name, reference: t.article_number, kind: 'tool', bin_id: t.bin_id }));
    const stockRows: Placement[] = (stock.data || []).map(s => {
      const item = s.equipment as unknown as { id: string; name: string; article_number: string | null } | null;
      return { key: `c:${s.id}`, table: 'consumable_stock', rowId: s.id, name: item?.name ?? 'Article', reference: item?.article_number ?? null, kind: 'consumable', bin_id: s.bin_id };
    });
    setPlacements([...toolRows, ...stockRows].sort((a, b) => a.name.localeCompare(b.name, 'fr')));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depotId]);

  const nextOrder = () => (bins.length ? Math.max(...bins.map(b => b.sort_order)) + 10 : 10);

  const addBins = async (rows: { code: string; label: string | null }[]) => {
    const start = nextOrder();
    const { error } = await supabase.from('storage_bins').insert(rows.map((r, i) => ({ ...r, depot_id: depotId, sort_order: start + i * 10 })));
    if (error) return toast.error(error.code === '23505' ? 'Un de ces emplacements existe déjà dans ce dépôt' : errorMessage(error));
    toast.success(rows.length > 1 ? `${rows.length} emplacements créés` : 'Emplacement créé');
    await load();
  };

  const addSingle = (event: React.FormEvent) => {
    event.preventDefault();
    addBins([{ code: single.code.trim().toUpperCase(), label: single.label.trim() || null }]);
    setSingle({ code: '', label: '' });
  };

  const addSeries = (event: React.FormEvent) => {
    event.preventDefault();
    const from = Number(series.from);
    const to = Number(series.to);
    if (!Number.isInteger(from) || !Number.isInteger(to) || to < from || to - from > 199) {
      toast.error('Série de 1 à 200 emplacements');
      return;
    }
    const width = String(to).length < 2 ? 2 : String(to).length;
    addBins(Array.from({ length: to - from + 1 }, (_, i) => ({ code: `${series.prefix.trim().toUpperCase()}${String(from + i).padStart(width, '0')}`, label: null })));
  };

  const updateBin = async (bin: Bin, changes: Partial<Bin>) => {
    const { error } = await supabase.from('storage_bins').update(changes).eq('id', bin.id);
    if (error) return toast.error(errorMessage(error));
    await load();
  };

  const removeBin = async (bin: Bin) => {
    const used = placements.filter(p => p.bin_id === bin.id).length;
    if (!await confirmAction(`Supprimer l'emplacement ${bin.code} ?${used ? ` ${used} article(s) n'auront plus d'emplacement.` : ''}`)) return;
    const { error } = await supabase.from('storage_bins').delete().eq('id', bin.id);
    if (error) return toast.error(errorMessage(error));
    await load();
  };

  const place = async (p: Placement, binId: string) => {
    const { error } = await supabase.from(p.table).update({ bin_id: binId || null }).eq('id', p.rowId);
    if (error) return toast.error(errorMessage(error));
    setPlacements(list => list.map(x => (x.key === p.key ? { ...x, bin_id: binId || null } : x)));
  };

  const shown = useMemo(() => placements
    .filter(p => !onlyMissing || !p.bin_id)
    .filter(p => `${p.name} ${p.reference ?? ''}`.toLowerCase().includes(search.toLowerCase())), [placements, onlyMissing, search]);
  const missing = placements.filter(p => !p.bin_id).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="mx-page-title">Emplacements</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Allée, étagère, bac : la liste de préparation des demandes suit l'ordre de passage.</p>
        </div>
        <select value={depotId} onChange={e => setDepotId(e.target.value)} aria-label="Dépôt" className={`${inputClass} w-auto`}>
          {myDepots.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <section className="rounded-lg bg-white dark:bg-gray-800 shadow p-4 space-y-4 self-start">
          <h2 className="font-bold text-gray-900 dark:text-white">Emplacements ({bins.length})</h2>
          {bins.length === 0 && <p className="text-sm text-gray-600 dark:text-gray-400">Aucun emplacement dans ce dépôt.</p>}
          <ul className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
            {bins.map((bin, index) => (
              <li key={bin.id} className="py-1.5 flex items-center gap-2 text-sm">
                <span className="w-6 text-right font-mono text-xs text-gray-500">{index + 1}</span>
                <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">{bin.code}</span>
                {canEdit ? (
                  <input defaultValue={bin.label ?? ''} onBlur={e => e.target.value !== (bin.label ?? '') && updateBin(bin, { label: e.target.value.trim() || null })}
                    placeholder="Description" aria-label={`Description de ${bin.code}`} className={`${inputClass} py-1 flex-1 min-w-0`} />
                ) : <span className="flex-1 text-gray-600 dark:text-gray-400 truncate">{bin.label}</span>}
                <span className="font-mono text-xs text-gray-500">{placements.filter(p => p.bin_id === bin.id).length}</span>
                {canEdit && (
                  <>
                    <Button size="sm" variant="outline" ariaLabel={`Monter ${bin.code}`} disabled={index === 0}
                      onClick={() => { const prev = bins[index - 1]; updateBin(bin, { sort_order: prev.sort_order }); updateBin(prev, { sort_order: bin.sort_order }); }}>↑</Button>
                    <Button size="sm" variant="outline" icon={<Trash2 size={14} />} ariaLabel={`Supprimer ${bin.code}`} onClick={() => removeBin(bin)} />
                  </>
                )}
              </li>
            ))}
          </ul>
          {canEdit && (
            <>
              <form onSubmit={addSingle} className="grid grid-cols-[1fr_1.4fr_auto] gap-2 items-end">
                <div>
                  <label htmlFor="bin-code" className={labelClass}>Code</label>
                  <input id="bin-code" value={single.code} onChange={e => setSingle({ ...single, code: e.target.value })} className={`${inputClass} font-mono`} required placeholder="A-01-2" />
                </div>
                <div>
                  <label htmlFor="bin-label" className={labelClass}>Description</label>
                  <input id="bin-label" value={single.label} onChange={e => setSingle({ ...single, label: e.target.value })} className={inputClass} placeholder="Étagère visserie" />
                </div>
                <Button type="submit" icon={<Plus size={16} />} ariaLabel="Ajouter l'emplacement" />
              </form>
              <form onSubmit={addSeries} className="space-y-2">
                <p className={labelClass}>Créer une série</p>
                <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                  <input value={series.prefix} onChange={e => setSeries({ ...series, prefix: e.target.value })} aria-label="Préfixe" className={`${inputClass} font-mono`} />
                  <input type="number" min={0} value={series.from} onChange={e => setSeries({ ...series, from: e.target.value })} aria-label="De" className={`${inputClass} font-mono`} />
                  <input type="number" min={0} value={series.to} onChange={e => setSeries({ ...series, to: e.target.value })} aria-label="À" className={`${inputClass} font-mono`} />
                  <Button type="submit" variant="outline">Créer</Button>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">ex. « A- », 1 à 10 → A-01 … A-10, dans l'ordre de passage.</p>
              </form>
            </>
          )}
        </section>

        <section className="rounded-lg bg-white dark:bg-gray-800 shadow p-4 space-y-3 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-bold text-gray-900 dark:text-white flex-1">Rangement des articles</h2>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={onlyMissing} onChange={e => setOnlyMissing(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary-600" />
              Sans emplacement ({missing})
            </label>
          </div>
          <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom ou numéro…" aria-label="Rechercher un article" className={inputClass} />
          {shown.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-400">Aucun article.</p> : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {shown.slice(0, 200).map(p => (
                <li key={p.key} className="py-2 flex flex-wrap items-center gap-2 text-sm">
                  <span className="flex-1 min-w-[10rem] text-gray-900 dark:text-gray-100">
                    {p.name}
                    <span className="text-xs text-gray-500"> · {p.kind === 'tool' ? 'outil' : 'consommable'}{p.reference ? ` · ${p.reference}` : ''}</span>
                  </span>
                  <select value={p.bin_id ?? ''} onChange={e => place(p, e.target.value)} disabled={!canEdit} aria-label={`Emplacement de ${p.name}`} className={`${inputClass} w-40 font-mono`}>
                    <option value="">—</option>
                    {bins.map(b => <option key={b.id} value={b.id}>{b.code}</option>)}
                  </select>
                </li>
              ))}
            </ul>
          )}
          {shown.length > 200 && <p className="text-xs text-gray-600 dark:text-gray-400">200 premiers affichés : affine la recherche.</p>}
        </section>
      </div>
    </div>
  );
};

export default Bins;
