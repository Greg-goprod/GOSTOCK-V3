import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowLeftRight, ClipboardList, Hand, Minus, Plus, Search, Settings2, Warehouse } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import CatalogPicker from '../components/common/CatalogPicker';
import SelfServiceModal from '../components/settings/SelfServiceModal';
import { CatalogProduct, catalogDescription } from '../lib/catalog';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../lib/supabase';
import { useSiteSuggestions } from '../lib/sites';
import { Equipment } from '../types';
import PageTitle from '../components/common/PageTitle';
import { useCurrentDepot } from '../lib/useCurrentDepot';
import { PageCommands } from '../components/Layout/ModuleHeader';

type StockAction = 'consume' | 'receive' | 'count' | 'transfer' | 'threshold';

const ACTION_TITLES: Record<StockAction, string> = {
  consume: 'Sortie de consommable',
  receive: 'Réception de stock',
  count: 'Inventaire',
  transfer: 'Transfert entre dépôts',
  threshold: 'Seuil minimum',
};

const UNITS = ['pièce', 'boîte', 'paquet', 'rouleau', 'litre', 'kg', 'mètre', 'paire'];

const formatQty = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toLocaleString('fr-CH', { maximumFractionDigits: 2 });

const inputClass =
  'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

// Erreur Supabase/PostgREST → message lisible (les fonctions SQL renvoient déjà un texte en français)
const errorMessage = (error: unknown) =>
  (error as { message?: string })?.message || 'Une erreur est survenue';

const StatePill: React.FC<{ quantity: number; isLow: boolean; lowDepots: string[]; showDepots: boolean }> = ({ quantity, isLow, lowDepots, showDepots }) => {
  if (quantity === 0) {
    return <span className="inline-flex rounded mx-tint-badge-danger px-2 py-0.5 text-[length:calc(11px*var(--mx-scale,1))] font-bold">Épuisé</span>;
  }
  if (isLow) {
    return (
      <span className="inline-flex rounded mx-tint-badge-warning px-2 py-0.5 text-[length:calc(11px*var(--mx-scale,1))] font-bold">
        Stock bas{showDepots && lowDepots.length > 0 ? ` · ${lowDepots.join(', ')}` : ''}
      </span>
    );
  }
  return <span className="inline-flex rounded mx-tint-badge-success px-2 py-0.5 text-[length:calc(11px*var(--mx-scale,1))] font-bold">OK</span>;
};

const Consumables: React.FC = () => {
  const { equipment, depots, consumableStock, suppliers, refreshData } = useApp();
  // Dépôt affiché = dépôt choisi dans la barre du haut ('all' = tous)
  const { depotId: currentDepot } = useCurrentDepot();
  const depotFilter = currentDepot || 'all';
  const [search, setSearch] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const [action, setAction] = useState<{ type: StockAction; item: Equipment } | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showDepots, setShowDepots] = useState(false);
  const [showThresholds, setShowThresholds] = useState(false);
  const [showSelfService, setShowSelfService] = useState(false);

  const consumables = useMemo(
    () => equipment.filter(eq => eq.itemType === 'consumable'),
    [equipment]
  );

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return consumables
      .map(item => {
        const stocks = consumableStock.filter(
          s => s.equipmentId === item.id && (depotFilter === 'all' || s.depotId === depotFilter)
        );
        const quantity = stocks.reduce((sum, s) => sum + s.quantity, 0);
        const minQuantity = stocks.reduce((sum, s) => sum + s.minQuantity, 0);
        // Bas si au moins un dépôt (du filtre) est sous son seuil ; on nomme lesquels
        const lowDepots = stocks
          .filter(s => s.minQuantity > 0 && s.quantity < s.minQuantity)
          .map(s => depots.find(d => d.id === s.depotId)?.name)
          .filter(Boolean) as string[];
        const isLow = lowDepots.length > 0;
        const supplier = suppliers.find(sp => sp.id === item.supplier);
        return { item, quantity, minQuantity, isLow, lowDepots, supplierName: supplier?.name };
      })
      .filter(r => !onlyLow || r.isLow || r.quantity === 0)
      .filter(r =>
        !term ||
        r.item.name.toLowerCase().includes(term) ||
        (r.item.supplierReference || '').toLowerCase().includes(term) ||
        (r.item.articleNumber || '').toLowerCase().includes(term) ||
        (r.supplierName || '').toLowerCase().includes(term)
      )
      .sort((a, b) => Number(b.isLow) - Number(a.isLow) || a.item.name.localeCompare(b.item.name));
  }, [consumables, consumableStock, depotFilter, search, onlyLow, suppliers, depots]);

  const lowCount = rows.filter(r => r.isLow || r.quantity === 0).length;

  if (depots.length === 0) {
    return (
      <div className="space-y-4">
        <PageTitle>Consommables</PageTitle>
        <p className="text-gray-600 dark:text-gray-300">
          Aucun dépôt trouvé. Exécute le script <span className="font-mono">20261029000002_depots_consommables.sql</span> dans Supabase, puis recharge la page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <PageTitle>Consommables</PageTitle>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Stock par dépôt, sorties, réceptions et seuils d'alerte</p>
      </div>
      {/* Le dépôt affiché se choisit dans la barre du haut ; la feuille de commande est l'onglet « À commander » */}
      <PageCommands
        search={
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 w-4 h-4" aria-hidden="true" />
            <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Article, référence, fournisseur…"
              aria-label="Rechercher un consommable" className={`${inputClass} pl-10`} />
          </div>
        }
        filters={
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 min-h-[44px] lg:min-h-0">
            <input type="checkbox" checked={onlyLow} onChange={e => setOnlyLow(e.target.checked)} />
            Stock bas seulement {lowCount > 0 && `(${lowCount})`}
          </label>
        }
        primary={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" icon={<Warehouse size={16} />} onClick={() => setShowDepots(true)}>Dépôts</Button>
            <Button variant="outline" icon={<Hand size={16} />} onClick={() => setShowSelfService(true)}>Libre-service</Button>
            <Button variant="outline" icon={<Settings2 size={16} />} onClick={() => setShowThresholds(true)}>Seuils proposés</Button>
            <Button icon={<Plus size={16} />} onClick={() => setShowNew(true)}>Nouveau consommable</Button>
          </div>
        }
      />

      {rows.length === 0 ? (
        <div className="text-center py-12 text-gray-600 dark:text-gray-400">
          {consumables.length === 0
            ? 'Aucun consommable pour l\'instant. Crée le premier avec « Nouveau consommable ».'
            : 'Aucun consommable ne correspond à la recherche.'}
        </div>
      ) : (
        <>
        <ul className="md:hidden space-y-3">
          {rows.map(({ item, quantity, minQuantity, isLow, lowDepots, supplierName }) => (
            <li key={item.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3">
              <div className="flex justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 dark:text-gray-100">{item.name}</div>
                  <div className="font-mono text-xs text-gray-500 dark:text-gray-400">{[supplierName, item.supplierReference].filter(Boolean).join(' · ') || '—'}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-lg text-gray-900 dark:text-gray-100">{formatQty(quantity)} <span className="text-sm text-gray-500 dark:text-gray-400">{item.unit}</span></div>
                  {minQuantity > 0 && <div className="text-xs text-gray-600 dark:text-gray-400">seuil {formatQty(minQuantity)}</div>}
                </div>
              </div>
              <StatePill quantity={quantity} isLow={isLow} lowDepots={lowDepots} showDepots={depotFilter === 'all'} />
              <div className="grid grid-cols-2 gap-2">
                <Button icon={<Minus size={14} />} onClick={() => setAction({ type: 'consume', item })}>Sortir</Button>
                <Button variant="outline" icon={<ArrowDownToLine size={14} />} onClick={() => setAction({ type: 'receive', item })}>Réception</Button>
                <Button variant="outline" icon={<ClipboardList size={14} />} onClick={() => setAction({ type: 'count', item })}>Inventaire</Button>
                <Button variant="outline" icon={<ArrowLeftRight size={14} />} onClick={() => setAction({ type: 'transfer', item })}>Transfert</Button>
              </div>
              <Button variant="outline" fullWidth icon={<Settings2 size={14} />} onClick={() => setAction({ type: 'threshold', item })}>Seuil minimum</Button>
            </li>
          ))}
        </ul>
        <div className="hidden md:block bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr className="text-left text-xs uppercase tracking-wide text-gray-600 dark:text-gray-300">
                  <th className="px-4 py-3">Article</th>
                  <th className="px-4 py-3">Fournisseur</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3 text-right">Seuil</th>
                  <th className="px-4 py-3">État</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {rows.map(({ item, quantity, minQuantity, isLow, lowDepots, supplierName }) => (
                  <tr key={item.id} className="text-gray-900 dark:text-gray-100">
                    <td className="px-4 py-3">
                      <div className="font-medium">{item.name}</div>
                      <div className="font-mono text-xs text-gray-500 dark:text-gray-400">
                        {[item.supplierReference, item.articleNumber].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{supplierName || '—'}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                      {formatQty(quantity)} <span className="text-gray-500 dark:text-gray-400">{item.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-gray-600 dark:text-gray-300">
                      {minQuantity > 0 ? formatQty(minQuantity) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatePill quantity={quantity} isLow={isLow} lowDepots={lowDepots} showDepots={depotFilter === 'all'} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button size="sm" icon={<Minus size={14} />} onClick={() => setAction({ type: 'consume', item })}>Sortir</Button>
                        <Button size="sm" variant="outline" icon={<ArrowDownToLine size={14} />} onClick={() => setAction({ type: 'receive', item })}>Réception</Button>
                        <Button size="sm" variant="outline" icon={<ClipboardList size={14} />} onClick={() => setAction({ type: 'count', item })} ariaLabel="Inventaire" />
                        <Button size="sm" variant="outline" icon={<ArrowLeftRight size={14} />} onClick={() => setAction({ type: 'transfer', item })} ariaLabel="Transférer entre dépôts" />
                        <Button size="sm" variant="outline" icon={<Settings2 size={14} />} onClick={() => setAction({ type: 'threshold', item })} ariaLabel="Seuil minimum" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      {action && (
        <StockActionModal
          action={action.type}
          item={action.item}
          defaultDepotId={depotFilter !== 'all' ? depotFilter : depots.find(d => d.isDefault)?.id || depots[0]?.id}
          onClose={() => setAction(null)}
          onDone={async () => {
            setAction(null);
            await refreshData();
          }}
        />
      )}

      {showNew && (
        <NewConsumableModal
          suppliers={suppliers}
          depots={depots}
          onClose={() => setShowNew(false)}
          onDone={async () => {
            setShowNew(false);
            await refreshData();
          }}
        />
      )}

      {showDepots && <DepotsModal onClose={() => setShowDepots(false)} />}
      {showThresholds && <ThresholdsModal onClose={() => setShowThresholds(false)} />}
      {showSelfService && <SelfServiceModal onClose={() => setShowSelfService(false)} />}

    </div>
  );
};

/* ------------------------------------------------------------------------ */

interface StockActionModalProps {
  action: StockAction;
  item: Equipment;
  defaultDepotId?: string;
  onClose: () => void;
  onDone: () => Promise<void>;
}

const StockActionModal: React.FC<StockActionModalProps> = ({ action, item, defaultDepotId, onClose, onDone }) => {
  const sites = useSiteSuggestions();
  const { depots, consumableStock, users } = useApp();
  const [depotId, setDepotId] = useState(defaultDepotId || '');
  const [toDepotId, setToDepotId] = useState(depots.find(d => d.id !== defaultDepotId)?.id || '');
  const [quantity, setQuantity] = useState('');
  const [userId, setUserId] = useState('');
  const [destination, setDestination] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const stock = consumableStock.find(s => s.equipmentId === item.id && s.depotId === depotId);
  const current = stock?.quantity ?? 0;
  const [threshold, setThreshold] = useState(String(stock?.minQuantity ?? 0));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    const qty = Number(quantity.replace(',', '.'));
    setSaving(true);
    try {
      let result;
      if (action === 'consume') {
        result = await supabase.rpc('consume_stock', {
          p_equipment_id: item.id, p_depot_id: depotId, p_quantity: qty,
          p_user_id: userId || null, p_destination: destination || null, p_notes: notes || null,
        });
      } else if (action === 'receive') {
        result = await supabase.rpc('receive_stock', { p_equipment_id: item.id, p_depot_id: depotId, p_quantity: qty, p_notes: notes || null });
      } else if (action === 'count') {
        result = await supabase.rpc('count_stock', { p_equipment_id: item.id, p_depot_id: depotId, p_counted: qty, p_notes: notes || null });
      } else if (action === 'transfer') {
        result = await supabase.rpc('transfer_stock', { p_equipment_id: item.id, p_from_depot_id: depotId, p_to_depot_id: toDepotId, p_quantity: qty, p_notes: notes || null });
      } else {
        result = await supabase.rpc('set_min_quantity', { p_equipment_id: item.id, p_depot_id: depotId, p_min_quantity: Number(threshold.replace(',', '.')) });
      }
      if (result.error) throw result.error;
      toast.success(
        action === 'consume' ? `Sortie enregistrée : ${formatQty(qty)} ${item.unit}`
        : action === 'receive' ? `Réception enregistrée : ${formatQty(qty)} ${item.unit}`
        : action === 'count' ? 'Inventaire enregistré'
        : action === 'transfer' ? 'Transfert enregistré'
        : 'Seuil enregistré'
      );
      await onDone();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const depotSelect = (id: string, value: string, onChange: (v: string) => void, label: string, exclude?: string) => (
    <div>
      <label htmlFor={id} className={labelClass}>{label}</label>
      <select id={id} value={value} onChange={e => onChange(e.target.value)} className={inputClass} required>
        {depots.filter(d => d.id !== exclude).map(d => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </select>
    </div>
  );

  return (
    <Modal isOpen onClose={onClose} title={ACTION_TITLES[action]} size="md">
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-md bg-gray-50 dark:bg-gray-700/40 p-3">
          <div className="font-medium text-gray-900 dark:text-gray-100">{item.name}</div>
          <div className="text-sm text-gray-600 dark:text-gray-300">
            En stock dans ce dépôt : <span className="font-mono">{formatQty(current)} {item.unit}</span>
            {stock && stock.minQuantity > 0 && <> · seuil <span className="font-mono">{formatQty(stock.minQuantity)}</span></>}
          </div>
        </div>

        {depotSelect('stock-depot', depotId, setDepotId, action === 'transfer' ? 'Depuis le dépôt' : 'Dépôt')}
        {action === 'transfer' && depotSelect('stock-to-depot', toDepotId, setToDepotId, 'Vers le dépôt', depotId)}

        {action === 'threshold' ? (
          <div>
            <label htmlFor="stock-threshold" className={labelClass}>Seuil minimum ({item.unit})</label>
            <input id="stock-threshold" type="number" min="0" step="any" inputMode="decimal" value={threshold} onChange={e => setThreshold(e.target.value)} className={inputClass} required />
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">Sous ce seuil, une alerte est envoyée et l'article apparaît sur la feuille de commande. 0 = pas d'alerte.</p>
          </div>
        ) : (
          <div>
            <label htmlFor="stock-qty" className={labelClass}>
              {action === 'count' ? `Quantité comptée (${item.unit})` : `Quantité (${item.unit})`}
            </label>
            <input id="stock-qty" type="number" min={action === 'count' ? 0 : 0.01} step="any" inputMode="decimal" value={quantity} onChange={e => setQuantity(e.target.value)} className={inputClass} required autoFocus />
          </div>
        )}

        {action === 'consume' && (
          <>
            <div>
              <label htmlFor="stock-user" className={labelClass}>Pour qui</label>
              <select id="stock-user" value={userId} onChange={e => setUserId(e.target.value)} className={inputClass}>
                <option value="">— Aucune personne —</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="stock-destination" className={labelClass}>Chantier ou service</label>
              <input id="stock-destination" list="stock-destination-sites" autoComplete="off" type="text" value={destination} onChange={e => setDestination(e.target.value)} className={inputClass} placeholder="ex. Chantier Renens, Service technique" />
            <datalist id="stock-destination-sites">{sites.map(site => <option key={site.name} value={site.name} label={site.registered ? 'Chantier' : 'Sans fiche chantier'} />)}</datalist>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">Indique une personne, un chantier ou un service (au moins l'un des deux).</p>
            </div>
          </>
        )}

        {action !== 'threshold' && (
          <div>
            <label htmlFor="stock-notes" className={labelClass}>Note (facultatif)</label>
            <input id="stock-notes" type="text" value={notes} onChange={e => setNotes(e.target.value)} className={inputClass} placeholder={action === 'receive' ? 'ex. bon de livraison 1234' : ''} />
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button type="submit" loading={saving}>Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
};

/* ------------------------------------------------------------------------ */

interface NewConsumableModalProps {
  suppliers: { id: string; name: string }[];
  depots: { id: string; name: string; isDefault: boolean }[];
  onClose: () => void;
  onDone: () => Promise<void>;
}

const NewConsumableModal: React.FC<NewConsumableModalProps> = ({ suppliers, depots, onClose, onDone }) => {
  const [form, setForm] = useState({
    name: '',
    unit: 'pièce',
    supplierId: '',
    supplierReference: '',
    purchasePrice: '',
    depotId: depots.find(d => d.isDefault)?.id || depots[0]?.id || '',
    quantity: '',
    minQuantity: '',
  });
  const [catalogProduct, setCatalogProduct] = useState<CatalogProduct | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('equipment')
        .insert({
          name: form.name.trim(),
          item_type: 'consumable',
          unit: form.unit,
          qr_type: 'batch',
          total_quantity: 1,
          status: 'available',
          supplier_id: form.supplierId || null,
          supplier_reference: form.supplierReference.trim() || null,
          purchase_price: form.purchasePrice ? Number(form.purchasePrice.replace(',', '.')) : null,
          catalog_product_id: catalogProduct?.id ?? null,
          ean: catalogProduct?.ean ?? null,
          image_url: catalogProduct?.image_url ?? null,
          description: catalogProduct ? catalogDescription(catalogProduct) : null,
        })
        .select('id')
        .single();
      if (error) throw error;

      const quantity = Number(form.quantity.replace(',', '.')) || 0;
      const minQuantity = Number(form.minQuantity.replace(',', '.')) || 0;
      // Seuil d'abord : une première réception sous le seuil déclenche bien l'alerte
      const threshold = await supabase.rpc('set_min_quantity', { p_equipment_id: data.id, p_depot_id: form.depotId, p_min_quantity: minQuantity });
      if (threshold.error) throw threshold.error;
      if (quantity > 0) {
        const reception = await supabase.rpc('receive_stock', { p_equipment_id: data.id, p_depot_id: form.depotId, p_quantity: quantity, p_notes: 'Stock initial' });
        if (reception.error) throw reception.error;
      }
      toast.success(`${form.name.trim()} ajouté`);
      await onDone();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Nouveau consommable" size="lg">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <CatalogPicker
            onSelect={product => {
              setCatalogProduct(product);
              setForm(prev => ({ ...prev, name: product.name, supplierId: product.supplier_id, supplierReference: product.reference }));
            }}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="new-name" className={labelClass}>Nom</label>
          <input id="new-name" value={form.name} onChange={set('name')} className={inputClass} required placeholder="ex. Gants nitrile taille L" />
        </div>
        <div>
          <label htmlFor="new-unit" className={labelClass}>Unité</label>
          <select id="new-unit" value={form.unit} onChange={set('unit')} className={inputClass}>
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="new-supplier" className={labelClass}>Fournisseur</label>
          <select id="new-supplier" value={form.supplierId} onChange={set('supplierId')} className={inputClass}>
            <option value="">— Aucun —</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="new-ref" className={labelClass}>Référence fournisseur</label>
          <input id="new-ref" value={form.supplierReference} onChange={set('supplierReference')} className={`${inputClass} font-mono`} />
        </div>
        <div>
          <label htmlFor="new-price" className={labelClass}>Prix d'achat unitaire (CHF)</label>
          <input id="new-price" type="number" min="0" step="0.01" inputMode="decimal" value={form.purchasePrice} onChange={set('purchasePrice')} className={inputClass} />
        </div>
        <div>
          <label htmlFor="new-depot" className={labelClass}>Dépôt</label>
          <select id="new-depot" value={form.depotId} onChange={set('depotId')} className={inputClass} required>
            {depots.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="new-qty" className={labelClass}>Quantité en stock</label>
          <input id="new-qty" type="number" min="0" step="any" inputMode="decimal" value={form.quantity} onChange={set('quantity')} className={inputClass} />
        </div>
        <div>
          <label htmlFor="new-min" className={labelClass}>Seuil minimum</label>
          <input id="new-min" type="number" min="0" step="any" inputMode="decimal" value={form.minQuantity} onChange={set('minQuantity')} className={inputClass} />
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">Alerte et feuille de commande sous ce seuil, dans ce dépôt.</p>
        </div>
        <div className="sm:col-span-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button type="submit" loading={saving}>Créer</Button>
        </div>
      </form>
    </Modal>
  );
};

/* ------------------------------------------------------------------------ */

const DepotsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { depots, refreshData } = useApp();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  const addDepot = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('depots').insert({ name: name.trim(), address: address.trim() || null });
    setSaving(false);
    if (error) {
      toast.error(error.code === '23505' ? 'Un dépôt porte déjà ce nom' : errorMessage(error));
      return;
    }
    toast.success(`Dépôt « ${name.trim()} » ajouté`);
    setName('');
    setAddress('');
    await refreshData();
  };

  const makeDefault = async (id: string) => {
    if (!supabase) return;
    // Un seul dépôt par défaut : on retire l'ancien avant de poser le nouveau
    const current = depots.find(d => d.isDefault);
    if (current) {
      const { error } = await supabase.from('depots').update({ is_default: false }).eq('id', current.id);
      if (error) return toast.error(errorMessage(error));
    }
    const { error } = await supabase.from('depots').update({ is_default: true }).eq('id', id);
    if (error) return toast.error(errorMessage(error));
    await refreshData();
  };

  return (
    <Modal isOpen onClose={onClose} title="Dépôts" size="md">
      <div className="space-y-5">
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {depots.map(d => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2">
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">{d.name}</div>
                {d.address && <div className="text-sm text-gray-600 dark:text-gray-400">{d.address}</div>}
              </div>
              {d.isDefault ? (
                <span className="rounded bg-primary-100 text-primary-800 dark:bg-primary-950 dark:text-primary-200 px-2 py-0.5 text-[length:calc(11px*var(--mx-scale,1))] font-bold">Par défaut</span>
              ) : (
                <Button size="sm" variant="outline" onClick={() => makeDefault(d.id)}>Définir par défaut</Button>
              )}
            </li>
          ))}
        </ul>
        <form onSubmit={addDepot} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
          <div>
            <label htmlFor="depot-name" className={labelClass}>Nouveau dépôt</label>
            <input id="depot-name" value={name} onChange={e => setName(e.target.value)} className={inputClass} placeholder="ex. Dépôt Renens" required />
          </div>
          <div>
            <label htmlFor="depot-address" className={labelClass}>Adresse (facultatif)</label>
            <input id="depot-address" value={address} onChange={e => setAddress(e.target.value)} className={inputClass} />
          </div>
          <Button type="submit" loading={saving} icon={<Plus size={16} />}>Ajouter</Button>
        </form>
      </div>
    </Modal>
  );
};

/* ------------------------------------------------------------------------ */

interface Suggestion {
  stock_id: string;
  equipment_id: string;
  depot_id: string;
  name: string;
  unit: string | null;
  quantity: number;
  min_quantity: number;
  lead_time_days: number;
  daily_use: number;
  suggested_min: number;
}

// Seuils d'après la consommation réelle : 90 derniers jours × (délai fournisseur + 5 jours de marge)
const ThresholdsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { depots, refreshData } = useApp();
  const [rows, setRows] = useState<Suggestion[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.from('suggested_thresholds').select('*').order('name');
    if (error) toast.error(errorMessage(error));
    setRows(((data || []) as Suggestion[])
      .map(r => ({ ...r, quantity: Number(r.quantity), min_quantity: Number(r.min_quantity), daily_use: Number(r.daily_use), suggested_min: Number(r.suggested_min) }))
      .filter(r => r.suggested_min > 0 && r.suggested_min !== r.min_quantity));
  };

  useEffect(() => {
    load();
  }, []);

  const apply = async (list: Suggestion[]) => {
    setBusy(true);
    for (const r of list) {
      const { error } = await supabase.rpc('set_min_quantity', { p_equipment_id: r.equipment_id, p_depot_id: r.depot_id, p_min_quantity: r.suggested_min });
      if (error) {
        toast.error(errorMessage(error));
        break;
      }
    }
    setBusy(false);
    toast.success(`${list.length} seuil${list.length > 1 ? 's' : ''} mis à jour`);
    await refreshData();
    await load();
  };

  return (
    <Modal isOpen onClose={onClose} title="Seuils proposés" size="lg">
      <div className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Calcul : consommation moyenne des 90 derniers jours × (délai de livraison du fournisseur + 5 jours de marge).
          Le délai se règle dans la fiche du fournisseur (7 jours par défaut).
        </p>
        {rows === null ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">Calcul…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-700 dark:text-gray-300">Les seuils actuels correspondent à la consommation (ou il n'y a pas encore assez de sorties).</p>
        ) : (
          <>
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {rows.map(r => (
                <li key={r.stock_id} className="py-2 flex flex-wrap items-center gap-3 text-sm">
                  <div className="flex-1 min-w-[180px]">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{r.name}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {depots.find(d => d.id === r.depot_id)?.name} · {r.daily_use.toLocaleString('fr-CH', { maximumFractionDigits: 2 })} {r.unit}/jour · délai {r.lead_time_days} j
                    </p>
                  </div>
                  <span className="font-mono text-gray-700 dark:text-gray-300">{r.min_quantity} → <strong className="text-gray-900 dark:text-white">{r.suggested_min}</strong></span>
                  <Button size="sm" variant="outline" onClick={() => apply([r])} disabled={busy}>Appliquer</Button>
                </li>
              ))}
            </ul>
            <div className="flex justify-end">
              <Button onClick={() => apply(rows)} loading={busy}>Tout appliquer ({rows.length})</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default Consumables;
