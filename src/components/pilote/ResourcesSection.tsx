import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, Package, Plus, Search, Trash2, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import { addResource, describeIssue, loadItemResources, loadResourceIssues, parseQuantity, removeResource, resourceError, searchEquipment, searchVehicles, setResourceQuantity,
  type CpResource, type EquipmentChoice, type ResourceIssue, type VehicleChoice } from '../../lib/resources';
import { SectionHeader } from './SectionHeader';
import { useSectionOpen } from './useSectionOpen';

interface Props {
  itemId: string;
  canEdit: boolean;
  hasDates: boolean;
  // Nombre de rattachements à vérifier (déjà connu par le Gantt) : signalé dès l'en-tête replié
  issueCount: number;
  onChanged: () => Promise<void>;
}

const inputClass = 'rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 disabled:opacity-70';

// Matériel et véhicules d'une tâche : on les choisit dans Logistique, la base prévient si le stock ou le véhicule manque sur la période de la tâche.
// C'est un AVERTISSEMENT : rien n'est bloqué et rien n'est réservé dans Logistique (il faut toujours faire la demande de matériel).
const ResourcesSection: React.FC<Props> = ({ itemId, canEdit, hasDates, issueCount, onChanged }) => {
  const { open, toggle } = useSectionOpen('resources', false, false);
  const panelId = useId();
  const [rows, setRows] = useState<CpResource[] | null>(null);
  const [issues, setIssues] = useState<ResourceIssue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<'equipment' | 'vehicle'>('equipment');
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<(EquipmentChoice | VehicleChoice)[]>([]);
  const [searching, setSearching] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const searchSeq = useRef(0);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [r, i] = await Promise.all([loadItemResources(itemId), loadResourceIssues(itemId)]);
      setRows(r); setIssues(i);
    } catch (e) { setError(resourceError(e)); setRows([]); }
  }, [itemId]);
  // Chargée à l'ouverture de la section seulement
  useEffect(() => { if (open) void load(); }, [open, load]);

  // Recherche dans Logistique (articles : 2 lettres au moins ; véhicules : liste dès l'ouverture), la dernière frappe l'emporte
  useEffect(() => {
    if (!open || !canEdit) return;
    const seq = ++searchSeq.current;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const list = kind === 'equipment' ? await searchEquipment(query) : await searchVehicles(query);
        if (seq === searchSeq.current) setFound(list);
      } catch { if (seq === searchSeq.current) setFound([]); }
      if (seq === searchSeq.current) setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [open, canEdit, kind, query]);

  const after = async () => { await load(); await onChanged(); };
  const attached = new Set((rows ?? []).map(r => r.equipment_id ?? r.vehicle_id));

  const add = async (id: string) => {
    try { await addResource(itemId, kind, id); setQuery(''); await after(); } catch (e) { toast.error(resourceError(e)); }
  };
  const remove = async (r: CpResource) => {
    try { await removeResource(r.id); await after(); } catch (e) { toast.error(resourceError(e)); }
  };
  const saveQuantity = async (r: CpResource) => {
    const raw = draft[r.id];
    setDraft(d => { const n = { ...d }; delete n[r.id]; return n; });
    if (raw === undefined || raw.trim() === String(r.quantity)) return;
    const q = parseQuantity(raw);
    if (q === null) return void toast.error('Quantité : un nombre entier de 1 à 9 999');
    try { await setResourceQuantity(r.id, q); await after(); } catch (e) { toast.error(resourceError(e)); }
  };

  const issueOf = (r: CpResource) => issues.find(i => i.resource_id === r.id);

  return (
    <section aria-label="Matériel et véhicules" className="space-y-2" data-resources>
      <SectionHeader title={issueCount > 0 ? `Matériel et véhicules (${issueCount} à vérifier)` : 'Matériel et véhicules'} icon={issueCount > 0 ? <AlertTriangle size={14} aria-hidden className="text-amber-600" /> : <Package size={14} aria-hidden />}
        open={open} onToggle={toggle} panelId={panelId} />
      {open && (
        <div id={panelId} className="space-y-3">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Choisis ce dont cette tâche a besoin. GO-Mat te prévient si le stock ou le véhicule manque sur ses dates. Ce n'est qu'un avertissement : rien n'est réservé, fais toujours la demande de matériel dans Logistique.
          </p>
          {!hasDates && <p role="status" className="text-sm text-gray-700 dark:text-gray-300">Cette tâche n'a pas de date : la disponibilité n'est pas vérifiée.</p>}
          {rows === null ? <p className="text-sm text-gray-500 dark:text-gray-400">Chargement…</p> : error ? <p role="alert" className="text-sm text-danger-600">{error}</p> : rows.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">Aucun matériel ni véhicule rattaché.</p>
          ) : (
            <ul className="space-y-2" data-resource-list>
              {rows.map(r => {
                const issue = issueOf(r);
                return (
                  <li key={r.id} data-resource={r.id} data-issue={issue ? 'true' : undefined} className={`rounded-md border p-2 text-sm ${issue ? 'border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                    <div className="flex items-center gap-2">
                      {r.kind === 'vehicle' ? <Truck size={14} aria-hidden className="shrink-0 text-gray-500" /> : <Package size={14} aria-hidden className="shrink-0 text-gray-500" />}
                      <span className="min-w-0 flex-1 truncate font-medium text-gray-900 dark:text-gray-100">{r.name}{r.detail && <span className="ml-1.5 font-normal text-gray-600 dark:text-gray-400">· {r.detail}</span>}</span>
                      {r.kind === 'equipment' && (
                        <input aria-label={`Quantité de ${r.name}`} inputMode="numeric" disabled={!canEdit} className={`${inputClass} w-16 text-right tabular-nums`} value={draft[r.id] ?? String(r.quantity)}
                          onChange={e => setDraft(d => ({ ...d, [r.id]: e.target.value }))} onBlur={() => void saveQuantity(r)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                      )}
                      {canEdit && <button type="button" aria-label={`Retirer ${r.name}`} onClick={() => void remove(r)} className="shrink-0 rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-danger-600 dark:hover:bg-gray-700"><Trash2 size={14} aria-hidden /></button>}
                    </div>
                    {issue && <p role="status" className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-amber-900 dark:text-amber-200" data-issue-text><AlertTriangle size={14} aria-hidden className="mt-0.5 shrink-0" />{describeIssue(issue)}</p>}
                  </li>
                );
              })}
            </ul>
          )}

          {canEdit && (
            <fieldset className="space-y-2 rounded-md border border-dashed border-gray-300 p-2 dark:border-gray-600">
              <legend className="px-1 text-xs font-semibold text-gray-700 dark:text-gray-300">Ajouter</legend>
              <div className="flex flex-wrap items-center gap-2">
                <div role="radiogroup" aria-label="Type de ressource" className="inline-flex overflow-hidden rounded-md border border-gray-300 dark:border-gray-600">
                  {([['equipment', 'Matériel'], ['vehicle', 'Véhicule']] as const).map(([k, label]) => (
                    <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => { setKind(k); setQuery(''); setFound([]); }}
                      className={`px-3 py-1.5 text-sm font-medium ${kind === k ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200'}`}>{label}</button>
                  ))}
                </div>
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">{kind === 'equipment' ? 'Rechercher un article' : 'Rechercher un véhicule'}</span>
                  <Search size={14} aria-hidden className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={kind === 'equipment' ? 'Nom de l\'article (2 lettres au moins)' : 'Nom ou plaque'} className={`${inputClass} w-full pl-7`} />
                </label>
              </div>
              {kind === 'equipment' && query.trim().length < 2 ? null : searching && found.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Recherche…</p>
              ) : found.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">{kind === 'equipment' ? 'Aucun article trouvé.' : 'Aucun véhicule trouvé.'}</p>
              ) : (
                <ul className="space-y-1" data-resource-results>
                  {found.map(f => {
                    const eq = f as EquipmentChoice, ve = f as VehicleChoice;
                    const already = attached.has(f.id);
                    return (
                      <li key={f.id} className="flex items-center gap-2 text-sm">
                        <span className="min-w-0 flex-1 truncate text-gray-900 dark:text-gray-100">{f.name}<span className="ml-1.5 text-gray-600 dark:text-gray-400">· {kind === 'equipment' ? (eq.total_quantity != null ? `${eq.total_quantity} en stock` : '') : `${ve.plate}${ve.status === 'maintenance' ? ' · en maintenance' : ''}`}</span></span>
                        <button type="button" disabled={already} onClick={() => void add(f.id)} aria-label={already ? `${f.name} déjà ajouté` : `Ajouter ${f.name}`}
                          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700"><Plus size={12} aria-hidden />{already ? 'Déjà ajouté' : 'Ajouter'}</button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </fieldset>
          )}
        </div>
      )}
    </section>
  );
};

export default ResourcesSection;
