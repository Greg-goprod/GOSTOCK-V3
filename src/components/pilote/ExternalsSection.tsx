import React, { useCallback, useEffect, useId, useState } from 'react';
import { Plus, Trash2, UserPlus, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { assignExternal, createExternal, externalError, externalLabel, loadExternals, loadItemExternalIds, unassignExternal, type CpExternal } from '../../lib/externals';
import { SectionHeader } from './SectionHeader';
import { useSectionOpen } from './useSectionOpen';

interface Props { itemId: string; canEdit: boolean }

const inputClass = 'rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 disabled:opacity-70';

// Intervenants externes d'une tâche : des personnes SANS compte GO-Mat (un électricien, un prestataire…), assignées par leur nom. Elles ne reçoivent aucun avis.
const ExternalsSection: React.FC<Props> = ({ itemId, canEdit }) => {
  const { open, toggle } = useSectionOpen('externals', false, false);
  const panelId = useId();
  const [all, setAll] = useState<CpExternal[] | null>(null);
  const [assigned, setAssigned] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try { const [a, ids] = await Promise.all([loadExternals(), loadItemExternalIds(itemId)]); setAll(a); setAssigned(ids); } catch (e) { setError(externalError(e)); setAll([]); }
  }, [itemId]);
  useEffect(() => { if (open) void load(); }, [open, load]);

  const byId = new Map((all ?? []).map(e => [e.id, e]));
  const available = (all ?? []).filter(e => e.active && !assigned.includes(e.id));

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await action(); await load(); } catch (e) { toast.error(externalError(e)); } finally { setBusy(false); }
  };

  return (
    <section aria-label="Intervenants externes" className="space-y-2" data-externals>
      <SectionHeader title="Intervenants externes" icon={<Users size={14} aria-hidden />} open={open} onToggle={toggle} panelId={panelId} />
      {open && (
        <div id={panelId} className="space-y-3">
          <p className="text-xs text-gray-600 dark:text-gray-400">Des personnes sans compte GO-Mat (prestataire, électricien…) qu'on peut assigner par leur nom. Elles ne reçoivent aucun avis et n'apparaissent pas dans la Charge.</p>
          {all === null ? <p className="text-sm text-gray-500">Chargement…</p> : error ? <p role="alert" className="text-sm text-danger-600">{error}</p> : assigned.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">Aucun intervenant externe sur cette tâche.</p>
          ) : (
            <ul className="space-y-1" data-external-list>
              {assigned.map(id => {
                const e = byId.get(id);
                if (!e) return null;
                return (
                  <li key={id} data-external={id} className="flex items-center gap-2 rounded-md border border-gray-200 px-2 py-1.5 text-sm dark:border-gray-700">
                    <span className="min-w-0 flex-1 truncate font-medium text-gray-900 dark:text-gray-100">{externalLabel(e)}{!e.active && <span className="ml-1.5 font-normal text-gray-500">· inactif</span>}</span>
                    {canEdit && <button type="button" aria-label={`Retirer ${externalLabel(e)}`} disabled={busy} onClick={() => void run(() => unassignExternal(itemId, id))} className="shrink-0 rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-danger-600 dark:hover:bg-gray-700"><Trash2 size={14} aria-hidden /></button>}
                  </li>
                );
              })}
            </ul>
          )}
          {canEdit && all !== null && (
            <div className="space-y-2 rounded-md border border-dashed border-gray-300 p-2 dark:border-gray-600">
              <div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor="ext-pick">Ajouter un intervenant existant</label>
                <select id="ext-pick" className={`${inputClass} min-w-0 flex-1`} value={pick} onChange={e => setPick(e.target.value)} disabled={available.length === 0}>
                  <option value="">{available.length === 0 ? 'Aucun autre intervenant' : 'Choisir un intervenant…'}</option>
                  {available.map(e => <option key={e.id} value={e.id}>{externalLabel(e)}</option>)}
                </select>
                <button type="button" disabled={!pick || busy} onClick={() => void run(async () => { await assignExternal(itemId, pick); setPick(''); })}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700"><Plus size={12} aria-hidden />Ajouter</button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor="ext-name">Nom du nouvel intervenant</label>
                <input id="ext-name" className={`${inputClass} min-w-0 flex-1`} placeholder="Nouveau : nom" maxLength={80} value={name} onChange={e => setName(e.target.value)} />
                <label className="sr-only" htmlFor="ext-company">Société du nouvel intervenant</label>
                <input id="ext-company" className={`${inputClass} min-w-0 flex-1`} placeholder="Société (facultatif)" maxLength={80} value={company} onChange={e => setCompany(e.target.value)} />
                <button type="button" disabled={!name.trim() || busy} onClick={() => void run(async () => { const id = await createExternal(name, company); await assignExternal(itemId, id); setName(''); setCompany(''); })}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700"><UserPlus size={12} aria-hidden />Créer et ajouter</button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default ExternalsSection;
