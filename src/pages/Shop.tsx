import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check, ClipboardList, ImageOff, Minus, PackageSearch, Plus, Search, ShieldCheck, ShoppingCart, Store, Trash2, Truck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import PageTitle from '../components/common/PageTitle';
import SiteNotice from '../components/common/SiteNotice';
import { DateTimeInput } from '../components/common/DateInput';
import { PageCommands } from '../components/Layout/ModuleHeader';
import { MxBadge } from '../components/mx/MxBadge';
import { MxEmpty } from '../components/mx/MxEmpty';
import { MxSegmented } from '../components/mx/MxSegmented';
import { MxSteps, type MxStepItem } from '../components/mx/MxSteps';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useCurrentDepot } from '../lib/useCurrentDepot';
import { useSiteSuggestions } from '../lib/sites';
import { supabase } from '../lib/supabase';
import { REQUEST_STATUS, errorMessage, formatPeriod, toLocalInput } from '../lib/requests';
import type { Equipment, RequestOverview } from '../types';

// Shop matériel : le collaborateur choisit dans un catalogue en images, remplit son panier
// et passe commande. La commande est une demande ordinaire (create_request) : le magasin la
// valide (si un article l'exige) et la prépare dans « Demandes ».

type Kind = 'tool' | 'consumable';
interface CartLine { kind: Kind; id: string; quantity: number }

const CART_KEY = 'gomat-cart';
const readCart = (): CartLine[] => {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]') as CartLine[]; } catch { return []; }
};

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const kindOf = (e: Equipment): Kind => (e.itemType === 'consumable' ? 'consumable' : 'tool');

// Image produit sur fond blanc, comme dans une boutique ; initiales si pas de photo
const ProductImage: React.FC<{ src?: string; name: string; className?: string }> = ({ src, name, className = '' }) => {
  const [broken, setBroken] = useState(false);
  return (
    <div className={`bg-white flex items-center justify-center overflow-hidden ${className}`}>
      {src && !broken
        ? <img src={src} alt="" loading="lazy" className="w-full h-full object-contain p-[8%]" onError={() => setBroken(true)} />
        : (
          <span className="flex flex-col items-center gap-1 text-gray-400">
            <ImageOff size={22} aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wide">{name.split(/\s+/).slice(0, 2).map(w => w[0]).join('')}</span>
          </span>
        )}
    </div>
  );
};

const Qty: React.FC<{ value: number; onChange: (n: number) => void; label: string }> = ({ value, onChange, label }) => (
  <div className="inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600" role="group" aria-label={`Quantité ${label}`}>
    <button type="button" onClick={() => onChange(value - 1)} aria-label="Moins" className="p-1.5 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"><Minus size={14} /></button>
    <span className="min-w-[2rem] text-center font-mono text-sm text-gray-900 dark:text-gray-100">{value}</span>
    <button type="button" onClick={() => onChange(value + 1)} aria-label="Plus" className="p-1.5 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"><Plus size={14} /></button>
  </div>
);

// Étapes de suivi d'une commande, comme un colis
const TRACK = ['Envoyée', 'Validée', 'Prête', 'Retirée', 'Rendue'];
const trackStep: Record<string, number> = { requested: 0, approved: 1, ready: 2, out: 3, closed: 4 };
const trackItems = (status: string): MxStepItem[] => {
  const at = trackStep[status] ?? 0;
  return TRACK.map((label, i) => ({ label, state: i < at || (status === 'closed' && i === at) ? 'done' : i === at ? 'active' : undefined }));
};

interface CatalogInfo { description: string | null; images: string[]; specs: { spec: string; value: string }[]; supplied_accessories: { sku: string; name: string; qty?: number }[] }

const Shop: React.FC = () => {
  const { equipment, equipmentGroups, consumableStock, depots, users } = useApp();
  const { profile, can } = useAuth();
  const { depotId: currentDepot } = useCurrentDepot();
  const staff = can('scan') || can('approve');

  const [view, setView] = useState<'catalogue' | 'orders'>('catalogue');
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<'all' | Kind>('all');
  const [group, setGroup] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [cart, setCart] = useState<CartLine[]>(readCart);
  const [product, setProduct] = useState<Equipment | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* stockage indisponible */ }
  }, [cart]);

  const depotForStock = currentDepot || depots.find(d => d.isDefault)?.id || depots[0]?.id || '';
  const stockOf = useCallback((e: Equipment) => kindOf(e) === 'consumable'
    ? consumableStock.find(s => s.equipmentId === e.id && s.depotId === depotForStock)?.quantity ?? 0
    : e.availableQuantity ?? (e.status === 'available' ? 1 : 0), [consumableStock, depotForStock]);

  const catalogue = useMemo(() => equipment.filter(e => e.status !== 'retired' && (!e.rentalUntil || e.rentalUntil >= new Date().toISOString().slice(0, 10))), [equipment]);
  const groups = useMemo(() => equipmentGroups.filter(g => catalogue.some(e => e.group === g.id)), [equipmentGroups, catalogue]);

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    return catalogue
      .filter(e => kind === 'all' || kindOf(e) === kind)
      .filter(e => !group || e.group === group)
      .filter(e => !availableOnly || stockOf(e) > 0)
      .filter(e => !term || `${e.name} ${e.shortTitle ?? ''} ${e.articleNumber ?? ''} ${e.description ?? ''}`.toLowerCase().includes(term))
      .sort((a, b) => Number(stockOf(b) > 0) - Number(stockOf(a) > 0) || Number(!!b.imageUrl) - Number(!!a.imageUrl) || a.name.localeCompare(b.name, 'fr'));
  }, [catalogue, kind, group, availableOnly, search, stockOf]);

  const inCart = (id: string) => cart.find(l => l.id === id)?.quantity ?? 0;
  const setQty = (e: Equipment, qty: number) => setCart(prev => {
    if (qty <= 0) return prev.filter(l => l.id !== e.id);
    return prev.some(l => l.id === e.id) ? prev.map(l => (l.id === e.id ? { ...l, quantity: qty } : l)) : [...prev, { kind: kindOf(e), id: e.id, quantity: qty }];
  });
  const add = (e: Equipment, qty = 1) => {
    setQty(e, inCart(e.id) + qty);
    toast.success(`${e.name} ajouté au panier`, { id: `cart-${e.id}` });
  };
  const cartCount = cart.reduce((n, l) => n + l.quantity, 0);
  const groupName = (id?: string) => equipmentGroups.find(g => g.id === id)?.name;

  return (
    <div className="space-y-6">
      <div>
        <PageTitle>Shop matériel</PageTitle>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Choisis ton matériel, ajoute-le au panier, puis passe commande : retrait au dépôt ou livraison sur le chantier.</p>
      </div>

      <PageCommands
        search={view === 'catalogue' ? (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" aria-hidden="true" />
            <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Chercher un outil, un consommable, une référence…" aria-label="Chercher dans le shop" className={`${inputClass} pl-10`} />
          </div>
        ) : undefined}
        filters={<MxSegmented aria-label="Vue" value={view} onChange={v => setView(v as typeof view)}
          options={[{ value: 'catalogue', label: 'Catalogue' }, { value: 'orders', label: 'Mes commandes' }]} />}
        primary={<Button icon={<ShoppingCart size={16} />} onClick={() => setCartOpen(true)}>Panier{cartCount ? ` (${cartCount})` : ''}</Button>}
      />

      {view === 'orders' ? <MyOrders /> : (
        <div className="grid gap-6 lg:grid-cols-[calc(220px*var(--mx-scale,1))_minmax(0,1fr)]">
          {/* Rayons à gauche, comme une boutique en ligne */}
          <aside className="space-y-5" aria-label="Filtres du catalogue">
            <div>
              <p className="mx-section-label mb-2">Type</p>
              <MxSegmented aria-label="Type d'article" value={kind} onChange={v => setKind(v as typeof kind)}
                options={[{ value: 'all', label: 'Tout' }, { value: 'tool', label: 'Outils' }, { value: 'consumable', label: 'Consommables' }]} />
            </div>
            {groups.length > 0 && (
              <nav aria-label="Rayons">
                <p className="mx-section-label mb-2">Rayons</p>
                <ul className="flex flex-wrap gap-1.5 lg:flex-col lg:gap-0.5">
                  {[{ id: '', name: 'Tous les rayons' }, ...groups].map(g => (
                    <li key={g.id}>
                      <button type="button" aria-current={group === g.id} onClick={() => setGroup(g.id)}
                        className={`w-full text-left rounded-md px-2.5 py-1.5 text-sm flex justify-between gap-2 ${group === g.id ? 'bg-primary-50 dark:bg-primary-900/40 text-primary-800 dark:text-primary-200 font-semibold' : 'text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                        <span className="truncate">{g.name}</span>
                        <span className="font-mono text-xs text-gray-500">{g.id ? catalogue.filter(e => e.group === g.id).length : catalogue.length}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
            <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
              <input type="checkbox" checked={availableOnly} onChange={e => setAvailableOnly(e.target.checked)} />
              Disponible maintenant
            </label>
          </aside>

          <section aria-label="Articles">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{shown.length} article{shown.length > 1 ? 's' : ''}</p>
            {shown.length === 0 ? (
              <MxEmpty icon={PackageSearch} title="Aucun article" description="Essaie un autre mot ou un autre rayon." />
            ) : (
              <ul className="grid grid-cols-2 gap-[calc(12px*var(--mx-scale,1))] sm:grid-cols-[repeat(auto-fill,minmax(calc(200px*var(--mx-scale,1)),1fr))]">
                {shown.map(e => {
                  const stock = stockOf(e);
                  const qty = inCart(e.id);
                  return (
                    <li key={e.id} className="mx-card flex flex-col overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
                      <button type="button" onClick={() => setProduct(e)} className="text-left flex-1 flex flex-col" aria-label={`Voir ${e.name}`}>
                        <ProductImage src={e.imageUrl} name={e.name} className="aspect-square border-b border-gray-100 dark:border-gray-700" />
                        <div className="p-3 flex-1 flex flex-col gap-1">
                          {groupName(e.group) && <span className="text-[length:calc(11px*var(--mx-scale,1))] uppercase tracking-wide text-gray-500">{groupName(e.group)}</span>}
                          <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 line-clamp-2">{e.name}</span>
                          {e.shortTitle && <span className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">{e.shortTitle}</span>}
                          <span className={`mt-auto pt-1 text-xs font-medium ${stock > 0 ? 'text-tone-success' : 'text-tone-danger'}`}>
                            {stock > 0 ? `${stock} ${kindOf(e) === 'consumable' ? (e.unit ?? 'en stock') : stock > 1 ? 'disponibles' : 'disponible'}` : 'Indisponible pour l\'instant'}
                          </span>
                          {(e.requiresApproval || e.requiredTrainingId) && (
                            <span className="flex flex-wrap gap-1">
                              {e.requiresApproval && <MxBadge tone="warning">Validation</MxBadge>}
                              {e.requiredTrainingId && <MxBadge tone="info">Permis requis</MxBadge>}
                            </span>
                          )}
                        </div>
                      </button>
                      <div className="px-3 pb-3">
                        {qty > 0
                          ? <div className="flex items-center justify-between gap-2"><Qty value={qty} onChange={n => setQty(e, n)} label={e.name} /><span className="text-xs text-tone-success flex items-center gap-1"><Check size={12} /> Au panier</span></div>
                          : <Button size="sm" variant="outline" className="w-full" icon={<Plus size={14} />} onClick={() => add(e)}>Ajouter</Button>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}

      {product && (
        <ProductSheet item={product} stock={stockOf(product)} group={groupName(product.group)} inCart={inCart(product.id)}
          onAdd={qty => add(product, qty)} onClose={() => setProduct(null)} />
      )}

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} cart={cart} setCart={setCart}
        items={equipment} users={users} staff={staff} profileId={profile?.id ?? ''}
        onOrdered={() => { setCart([]); setCartOpen(false); setView('orders'); }} />
    </div>
  );
};

/* ------------------------------------------------------------------------ */

const ProductSheet: React.FC<{ item: Equipment; stock: number; group?: string; inCart: number; onAdd: (qty: number) => void; onClose: () => void }> = ({ item, stock, group, inCart, onAdd, onClose }) => {
  const [info, setInfo] = useState<CatalogInfo | null>(null);
  const [shown, setShown] = useState(item.imageUrl ?? '');
  const [qty, setQty] = useState(1);
  const [training, setTraining] = useState<string | null>(null);

  useEffect(() => {
    if (!item.requiredTrainingId) return;
    supabase.from('trainings').select('name').eq('id', item.requiredTrainingId).maybeSingle()
      .then(({ data }) => setTraining((data as { name?: string } | null)?.name ?? null));
  }, [item.requiredTrainingId]);

  // Fiche du catalogue fournisseur liée (galerie, caractéristiques, accessoires livrés)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('equipment').select('catalog_product_id').eq('id', item.id).maybeSingle();
      const catalogId = (data as { catalog_product_id?: string } | null)?.catalog_product_id;
      if (!catalogId) return;
      const { data: p } = await supabase.from('catalog_products').select('description, images, specs, supplied_accessories').eq('id', catalogId).maybeSingle();
      if (!cancelled && p) setInfo(p as CatalogInfo);
    })();
    return () => { cancelled = true; };
  }, [item.id]);

  const gallery = [...new Set([item.imageUrl, ...(info?.images ?? [])].filter(Boolean) as string[])].slice(0, 8);
  const description = item.description || info?.description;

  return (
    <Modal isOpen onClose={onClose} title={item.name} size="lg">
      <div className="space-y-5">
        <div>
          <ProductImage src={shown || gallery[0]} name={item.name} className="aspect-[4/3] rounded-lg border border-gray-200 dark:border-gray-700" />
          {gallery.length > 1 && (
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {gallery.map(src => (
                <button key={src} type="button" onClick={() => setShown(src)} aria-label="Voir cette photo"
                  className={`shrink-0 w-16 h-16 rounded-md border-2 ${src === (shown || gallery[0]) ? 'border-primary-500' : 'border-gray-200 dark:border-gray-700'}`}>
                  <ProductImage src={src} name={item.name} className="w-full h-full rounded" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1">
          {group && <p className="text-xs uppercase tracking-wide text-gray-500">{group}</p>}
          {item.shortTitle && <p className="text-gray-700 dark:text-gray-300">{item.shortTitle}</p>}
          <p className="font-mono text-xs text-gray-500">{[item.articleNumber, item.supplier].filter(Boolean).join(' · ')}</p>
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3">
          <p className={`text-sm font-semibold ${stock > 0 ? 'text-tone-success' : 'text-tone-danger'}`}>
            {stock > 0 ? `${stock} ${item.itemType === 'consumable' ? (item.unit ?? 'en stock') : 'disponible(s) maintenant'}` : 'Indisponible pour l\'instant : tu peux quand même commander pour une date future.'}
          </p>
          {item.requiresApproval && <p className="text-sm text-tone-warning flex items-center gap-1.5"><ShieldCheck size={14} aria-hidden="true" /> Un responsable valide la commande de cet article.</p>}
          {item.requiredTrainingId && <p className="text-sm text-gray-700 dark:text-gray-300">Permis requis : <strong>{training ?? '…'}</strong></p>}
          <div className="flex items-center gap-3">
            <Qty value={qty} onChange={n => setQty(Math.max(1, n))} label={item.name} />
            <Button icon={<ShoppingCart size={16} />} onClick={() => { onAdd(qty); onClose(); }}>Ajouter au panier</Button>
          </div>
          {inCart > 0 && <p className="text-xs text-gray-600 dark:text-gray-400">Déjà {inCart} dans ton panier.</p>}
        </div>

        {description && (
          <section>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Description</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{description}</p>
          </section>
        )}
        {info?.supplied_accessories?.length ? (
          <section>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Livré avec</h3>
            <ul className="text-sm text-gray-700 dark:text-gray-300 list-disc pl-5">
              {info.supplied_accessories.map(a => <li key={a.sku}>{a.qty && a.qty > 1 ? `${a.qty} × ` : ''}{a.name}</li>)}
            </ul>
          </section>
        ) : null}
        {info?.specs?.length ? (
          <section>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Caractéristiques</h3>
            <table className="w-full text-sm">
              <tbody>
                {info.specs.map(s => (
                  <tr key={s.spec} className="border-b border-gray-100 dark:border-gray-700">
                    <td className="py-1.5 pr-3 text-gray-600 dark:text-gray-400">{s.spec}</td>
                    <td className="py-1.5 text-gray-900 dark:text-gray-100">{s.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}
      </div>
    </Modal>
  );
};

/* ------------------------------------------------------------------------ */

const CartDrawer: React.FC<{
  open: boolean; onClose: () => void; cart: CartLine[]; setCart: React.Dispatch<React.SetStateAction<CartLine[]>>;
  items: Equipment[]; users: { id: string; first_name: string; last_name: string; active?: boolean }[]; staff: boolean; profileId: string; onOrdered: () => void;
}> = ({ open, onClose, cart, setCart, items, users, staff, profileId, onOrdered }) => {
  const { depots } = useApp();
  const { depotId: currentDepot } = useCurrentDepot();
  const sites = useSiteSuggestions();
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(7, 30, 0, 0);
  const tomorrowEnd = new Date(tomorrow); tomorrowEnd.setHours(17, 0, 0, 0);

  const [requesterId, setRequesterId] = useState(profileId);
  const [destination, setDestination] = useState('');
  const [depotId, setDepotId] = useState(currentDepot || depots.find(d => d.isDefault)?.id || depots[0]?.id || '');
  const [start, setStart] = useState(toLocalInput(tomorrow));
  const [end, setEnd] = useState(toLocalInput(tomorrowEnd));
  const [mode, setMode] = useState<'pickup' | 'delivery'>('pickup');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [availability, setAvailability] = useState<Record<string, number>>({});

  const lines = cart.map(l => ({ ...l, item: items.find(e => e.id === l.id) })).filter(l => l.item) as (CartLine & { item: Equipment })[];
  const startIso = start ? new Date(start).toISOString() : '';
  const endIso = end ? new Date(end).toISOString() : '';
  const periodOk = !!startIso && !!endIso && endIso > startIso;
  const needsApproval = lines.filter(l => l.item.requiresApproval);

  // Disponibilité des outils sur la période choisie
  useEffect(() => {
    if (!open || !periodOk) return;
    let cancelled = false;
    (async () => {
      const result: Record<string, number> = {};
      for (const l of lines.filter(x => x.kind === 'tool')) {
        const { data } = await supabase.rpc('tool_availability', { p_equipment_id: l.id, p_start: startIso, p_end: endIso });
        if (typeof data === 'number') result[l.id] = data;
      }
      if (!cancelled) setAvailability(result);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, startIso, endIso, cart.map(l => l.id).join()]);

  const setQty = (id: string, qty: number) => setCart(prev => (qty <= 0 ? prev.filter(l => l.id !== id) : prev.map(l => (l.id === id ? { ...l, quantity: qty } : l))));

  const order = async () => {
    if (!requesterId) return toast.error('Choisis la personne pour qui tu commandes');
    if (!periodOk) return toast.error('Le retour doit être après le retrait');
    if (mode === 'delivery' && !address.trim() && !destination.trim()) return toast.error('Indique le chantier ou l\'adresse de livraison');
    setSaving(true);
    const delivery = mode === 'delivery' ? `Livraison sur chantier : ${address.trim() || destination.trim()}` : 'Retrait au dépôt';
    const { data, error } = await supabase.rpc('create_request', {
      p_requester_id: requesterId,
      p_depot_id: depotId,
      p_start: startIso,
      p_end: endIso,
      p_items: lines.map(l => ({ kind: l.kind, id: l.id, quantity: l.quantity })),
      p_destination: destination || null,
      p_notes: [delivery, notes.trim()].filter(Boolean).join(' · '),
    });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    const created = data as { number: string; status: string };
    toast.success(created.status === 'approved'
      ? `Commande ${created.number} envoyée : le magasin la prépare`
      : `Commande ${created.number} envoyée : en attente de validation`);
    onOrdered();
  };

  return (
    <Modal isOpen={open} onClose={onClose} title={`Panier${lines.length ? ` (${lines.length})` : ''}`} size="lg">
      {lines.length === 0 ? (
        <MxEmpty icon={ShoppingCart} title="Ton panier est vide" description="Ajoute des articles depuis le catalogue." />
      ) : (
        <div className="space-y-5">
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {lines.map(l => {
              const free = availability[l.id];
              return (
                <li key={l.id} className="py-2.5 flex items-center gap-3">
                  <ProductImage src={l.item.imageUrl} name={l.item.name} className="w-14 h-14 shrink-0 rounded-md border border-gray-200 dark:border-gray-700" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{l.item.name}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {l.kind === 'consumable' ? (l.item.unit ?? 'Consommable') : free === undefined ? 'Outil' : free >= l.quantity ? `${free} libre(s) sur la période` : <span className="text-tone-danger">Seulement {free} libre(s) sur la période</span>}
                      {l.item.requiresApproval && <span className="text-tone-warning"> · validation</span>}
                    </p>
                  </div>
                  <Qty value={l.quantity} onChange={n => setQty(l.id, n)} label={l.item.name} />
                  <button type="button" onClick={() => setQty(l.id, 0)} aria-label={`Retirer ${l.item.name}`} className="p-1.5 text-gray-500 hover:text-danger-600"><Trash2 size={16} /></button>
                </li>
              );
            })}
          </ul>

          <section className="space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Ta commande</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {staff && (
                <div className="sm:col-span-2">
                  <label htmlFor="shop-user" className={labelClass}>Pour qui</label>
                  <select id="shop-user" value={requesterId} onChange={e => setRequesterId(e.target.value)} className={inputClass}>
                    {users.filter(u => u.active !== false).map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}{u.id === profileId ? ' (moi)' : ''}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="shop-start" className={labelClass}>Retrait le</label>
                <DateTimeInput id="shop-start" value={start} onChange={e => setStart(e.target.value)} required />
              </div>
              <div>
                <label htmlFor="shop-end" className={labelClass}>Retour le</label>
                <DateTimeInput id="shop-end" value={end} onChange={e => setEnd(e.target.value)} required />
              </div>
              <div>
                <label htmlFor="shop-dest" className={labelClass}>Chantier ou service</label>
                <input id="shop-dest" list="shop-dest-sites" autoComplete="off" value={destination} onChange={e => setDestination(e.target.value)} className={inputClass} placeholder="ex. Chantier Renens" />
                <datalist id="shop-dest-sites">{sites.map(s => <option key={s.name} value={s.name} />)}</datalist>
                <SiteNotice value={destination} />
              </div>
              <div>
                <label htmlFor="shop-depot" className={labelClass}>Dépôt</label>
                <select id="shop-depot" value={depotId} onChange={e => setDepotId(e.target.value)} className={inputClass}>
                  {depots.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>

            <fieldset>
              <legend className={labelClass}>Comment tu le récupères</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {([['pickup', Store, 'Retrait au dépôt', 'Tu passes au magasin quand c\'est prêt.'], ['delivery', Truck, 'Livraison sur chantier', 'Le magasin te l\'apporte.']] as const).map(([value, Icon, title, hint]) => (
                  <label key={value} className={`flex gap-3 rounded-lg border p-3 cursor-pointer ${mode === value ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30' : 'border-gray-200 dark:border-gray-700'}`}>
                    <input type="radio" name="shop-mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="mt-1" />
                    <span>
                      <span className="flex items-center gap-1.5 font-medium text-sm text-gray-900 dark:text-gray-100"><Icon size={14} aria-hidden="true" />{title}</span>
                      <span className="text-xs text-gray-600 dark:text-gray-400">{hint}</span>
                    </span>
                  </label>
                ))}
              </div>
              {mode === 'delivery' && (
                <div className="mt-3">
                  <label htmlFor="shop-address" className={labelClass}>Adresse de livraison (si ce n'est pas celle du chantier)</label>
                  <input id="shop-address" value={address} onChange={e => setAddress(e.target.value)} className={inputClass} placeholder="Rue, NPA, lieu" />
                </div>
              )}
            </fieldset>

            <div>
              <label htmlFor="shop-notes" className={labelClass}>Remarque (facultatif)</label>
              <input id="shop-notes" value={notes} onChange={e => setNotes(e.target.value)} className={inputClass} />
            </div>

            <p className={`rounded-md p-3 text-sm ${needsApproval.length ? 'mx-tint-badge-warning' : 'mx-tint-badge-success'}`}>
              {needsApproval.length
                ? `Un responsable doit valider : ${needsApproval.map(l => l.item.name).join(', ')}.`
                : 'Pas de validation nécessaire : ta commande part directement en préparation.'}
            </p>
          </section>

          <div className="flex justify-end gap-2 mx-dr-foot">
            <Button variant="outline" onClick={onClose}>Continuer mes achats</Button>
            <Button icon={<Check size={16} />} onClick={order} loading={saving}>Commander</Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

/* ------------------------------------------------------------------------ */

// Suivi de mes commandes, étape par étape
const MyOrders: React.FC = () => {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<RequestOverview[] | null>(null);
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    supabase.from('requests_overview').select('*').eq('requester_id', profile.id).order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => setOrders((data || []) as RequestOverview[]));
  }, [profile?.id]);

  if (!orders) return <p className="text-gray-600 dark:text-gray-400">Chargement…</p>;
  const done = (o: RequestOverview) => ['closed', 'rejected', 'cancelled'].includes(o.status);
  const list = orders.filter(o => showDone || !done(o));
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
        <input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} /> Afficher aussi les commandes terminées
      </label>
      {list.length === 0 ? (
        <MxEmpty icon={ClipboardList} title="Aucune commande en cours" description="Tes commandes du shop apparaissent ici avec leur suivi." />
      ) : (
        <ul className="space-y-3">
          {list.map(o => (
            <li key={o.id} className="mx-card bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 space-y-3">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-mono text-sm text-gray-600 dark:text-gray-300">{o.number}</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                    {[o.tool_lines && `${o.tool_lines} outil${o.tool_lines > 1 ? 's' : ''}`, o.consumable_lines && `${o.consumable_lines} consommable${o.consumable_lines > 1 ? 's' : ''}`].filter(Boolean).join(' · ') || 'Commande'}
                    {o.destination && <span className="font-normal text-gray-600 dark:text-gray-400"> · {o.destination}</span>}
                  </p>
                  {o.notes && <p className="text-xs text-gray-600 dark:text-gray-400">{o.notes}</p>}
                </div>
                <div className="text-right text-sm">
                  <p className="font-mono text-gray-900 dark:text-gray-100">{formatPeriod(o.start_at, o.end_at)}</p>
                  <p className="text-gray-600 dark:text-gray-400">{o.depot_name}</p>
                </div>
              </div>
              {['rejected', 'cancelled'].includes(o.status) ? (
                <p className="text-sm text-tone-danger">{REQUEST_STATUS[o.status].label}{o.decision_note ? ` : ${o.decision_note}` : ''}</p>
              ) : <MxSteps items={trackItems(o.status)} />}
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-gray-600 dark:text-gray-400">Le détail de chaque commande est aussi dans <Link to="/demandes" className="text-primary-600 hover:underline">Demandes</Link>.</p>
    </div>
  );
};

export default Shop;
