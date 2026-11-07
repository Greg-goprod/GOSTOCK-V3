import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { History, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { describeEntry, type HistoryEntry } from '../../lib/historyText';
import { formatDateTime } from '../../lib/platformConsole';
import { piloteError, type CpStatus } from '../../lib/pilote';
import { SectionHeader } from './SectionHeader';
import { useSectionOpen } from './useSectionOpen';

interface Props {
  kind: 'item' | 'project';
  id: string;
  statuses: CpStatus[];
  itemName?: (id: string) => string | undefined;
  siteName?: (id: string) => string | undefined;
}

// Historique d'une fiche : qui a changé quoi, quand (100 dernières lignes du journal). Lu par la fonction cp_history, ouverte à qui voit le projet.
const HistorySection: React.FC<Props> = ({ kind, id, statuses, itemName, siteName }) => {
  const { open, toggle } = useSectionOpen('history', false, false);
  const panelId = useId();
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: e } = await supabase.rpc('cp_history', { p_kind: kind, p_id: id });
    if (e) { setError(piloteError(e)); setEntries([]); return; }
    setEntries(((data || []) as { at: string; who: string; action: HistoryEntry['action']; changes: Record<string, unknown> }[]).map(r => ({ at: r.at, who: r.who, action: r.action, changes: r.changes ?? {} })));
  }, [kind, id]);
  // Chargée à l'ouverture de la section seulement (pas de requête pour une fiche dont on ne regarde pas l'historique)
  useEffect(() => { if (open) void load(); }, [open, load]);

  const labels = useMemo(() => ({
    status: (sid: string) => statuses.find(s => s.id === sid)?.name ?? 'un état supprimé',
    item: itemName, site: siteName,
  }), [statuses, itemName, siteName]);

  return (
    <section aria-label="Historique" className="space-y-2">
      <SectionHeader title="Historique" icon={<History size={14} aria-hidden />} open={open} onToggle={toggle} panelId={panelId}
        actions={<button type="button" onClick={() => void load()} aria-label="Actualiser l'historique" className="flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"><RefreshCw size={14} aria-hidden /></button>} />
      {open && (
        <div id={panelId}>
          {entries === null ? <p className="text-sm text-gray-500 dark:text-gray-400">Chargement…</p> : error ? <p role="alert" className="text-sm text-danger-600">{error}</p> : entries.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">Aucun changement enregistré.</p>
          ) : (
            <ul className="space-y-2" data-history>
              {entries.map((e, i) => {
                const lines = describeEntry(e, kind, labels);
                if (lines.length === 0) return null;
                return (
                  <li key={`${e.at}-${i}`} className="rounded-md border border-gray-200 p-2 text-sm dark:border-gray-700">
                    <div className="text-xs text-gray-600 dark:text-gray-400"><span>{formatDateTime(e.at)}</span> · <span className="font-medium text-gray-800 dark:text-gray-200">{e.who}</span></div>
                    {lines.map(l => <div key={l} className="break-words text-gray-900 dark:text-gray-100">{l}</div>)}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
};

export default HistorySection;
