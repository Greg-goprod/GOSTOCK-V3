import React, { useId, useMemo, useState } from 'react';
import { Repeat, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { confirmAction } from '../../lib/confirm';
import { cannotRepeat, FREQ_LABEL, FREQS, MAX_REPEAT, maxRepeatFor, previewOccurrences, recurrenceError, seriesInfo, type Freq } from '../../lib/recurrence';
import type { CpItem } from '../../lib/pilote';
import Button from '../common/Button';
import Modal from '../common/Modal';
import { SectionHeader } from './SectionHeader';
import { useSectionOpen } from './useSectionOpen';

interface Props {
  item: CpItem;
  items: CpItem[];
  canCreate: boolean;
  canDelete: boolean;
  // Recharge les données après un changement (la fiche repart alors de la version rechargée)
  onChanged: () => Promise<void>;
}

const fmt = (iso: string | null) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '—');
const period = (s: string | null, e: string | null) => (s && e && s !== e ? `${fmt(s)} → ${fmt(e)}` : fmt(s ?? e));
const inputClass = 'rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';

// Répétition d'une tâche : « chaque semaine / mois / année, n fois » ; les occurrences sont reliées en série. La base fait le calcul (cp_repeat_item).
const RepeatSection: React.FC<Props> = ({ item, items, canCreate, canDelete, onChanged }) => {
  const { open, toggle } = useSectionOpen('repeat', false, false);
  const panelId = useId();
  const info = useMemo(() => seriesInfo(items, item), [items, item]);
  const hasChildren = useMemo(() => items.some(i => i.parent_id === item.id), [items, item.id]);
  const blocked = cannotRepeat(item, hasChildren);
  const room = maxRepeatFor(info);
  const [dialog, setDialog] = useState(false);
  const [freq, setFreq] = useState<Freq>('weekly');
  const [count, setCount] = useState('4');
  const [busy, setBusy] = useState(false);

  const n = /^\d{1,2}$/.test(count.trim()) ? Number(count.trim()) : NaN;
  const valid = Number.isInteger(n) && n >= 1 && n <= Math.min(MAX_REPEAT, room);
  const preview = valid ? previewOccurrences(item.starts_on, item.ends_on, freq, n) : [];
  const canExtend = !info || info.isLast;

  const run = async () => {
    if (!valid || busy) return;
    setBusy(true);
    const { error } = await supabase.rpc('cp_repeat_item', { p_item: item.id, p_freq: freq, p_count: n });
    setBusy(false);
    if (error) return void toast.error(recurrenceError(error));
    toast.success(`${n} occurrence${n > 1 ? 's' : ''} créée${n > 1 ? 's' : ''}`);
    setDialog(false);
    await onChanged();
  };
  const removeLater = async () => {
    if (!info || busy || !(await confirmAction(`Supprimer les ${info.laterCount} occurrence(s) suivante(s) ? Celles qui sont commencées ou qui ont du temps saisi, des messages ou des documents sont gardées.`))) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('cp_delete_series_after', { p_item: item.id });
    setBusy(false);
    if (error) return void toast.error(recurrenceError(error));
    const r = (Array.isArray(data) ? data[0] : data) as { deleted: number; kept: number } | null;
    toast.success(`${r?.deleted ?? 0} supprimée(s)${r && r.kept > 0 ? `, ${r.kept} gardée(s) car déjà travaillée(s)` : ''}`);
    await onChanged();
  };

  return (
    <section aria-label="Répétition" className="space-y-2" data-repeat>
      <SectionHeader title={info ? `Répétition (${info.index} sur ${info.total})` : 'Répétition'} icon={<Repeat size={14} aria-hidden />} open={open} onToggle={toggle} panelId={panelId} />
      {open && (
        <div id={panelId} className="space-y-2 text-sm">
          {info ? (
            <p data-series-info>{`Cette tâche est l'occurrence ${info.index} sur ${info.total} d'une série.`}{!info.isLast && ' Pour prolonger la série, ouvre sa dernière occurrence.'}</p>
          ) : (
            <p className="text-gray-600 dark:text-gray-400">Cette tâche ne se répète pas. Tu peux la répéter chaque semaine, chaque mois ou chaque année : les occurrences sont créées d'un coup, avec les mêmes personnes, le même matériel et la même durée.</p>
          )}
          {blocked && <p role="status" className="text-gray-700 dark:text-gray-300" data-repeat-blocked>{blocked}</p>}
          <div className="flex flex-wrap gap-2">
            {canCreate && !blocked && canExtend && room > 0 && <Button size="sm" variant="outline" icon={<Repeat size={14} />} onClick={() => { setCount(String(Math.min(4, room))); setDialog(true); }}>{info ? 'Prolonger la série…' : 'Répéter…'}</Button>}
            {canDelete && info && info.laterCount > 0 && <Button size="sm" variant="outline" icon={<Trash2 size={14} />} loading={busy} onClick={() => void removeLater()}>{`Supprimer les ${info.laterCount} suivante${info.laterCount > 1 ? 's' : ''}`}</Button>}
          </div>
          {info && info.isLast && room === 0 && <p className="text-xs text-gray-600 dark:text-gray-400">Une série compte 200 occurrences au plus.</p>}
        </div>
      )}

      <Modal isOpen={dialog} onClose={() => setDialog(false)} title={info ? 'Prolonger la série' : 'Répéter cette tâche'} size="sm">
        <div className="space-y-3">
          <fieldset>
            <legend className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Fréquence</legend>
            <div role="radiogroup" aria-label="Fréquence" className="flex flex-wrap gap-2">
              {FREQS.map(f => (
                <button key={f} type="button" role="radio" aria-checked={freq === f} onClick={() => setFreq(f)}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium ${freq === f ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'}`}>{FREQ_LABEL[f]}</button>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="rep-count" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{`Nombre de répétitions (1 à ${Math.min(MAX_REPEAT, room)})`}</label>
            <input id="rep-count" inputMode="numeric" className={`${inputClass} w-24 text-right tabular-nums`} value={count} onChange={e => setCount(e.target.value)} />
            {!valid && <p role="alert" className="mt-1 text-xs text-danger-600">{`Entre un nombre entier de 1 à ${Math.min(MAX_REPEAT, room)}.`}</p>}
          </div>
          {valid && (
            <div className="rounded-md bg-gray-50 p-2 text-sm dark:bg-gray-800/60" data-repeat-preview>
              <p className="font-medium text-gray-900 dark:text-white">{`${n} nouvelle${n > 1 ? 's' : ''} occurrence${n > 1 ? 's' : ''} :`}</p>
              <ul className="mt-1 space-y-0.5 text-gray-800 dark:text-gray-200">
                {preview.slice(0, 3).map((o, i) => <li key={i}>{period(o.start, o.end)}</li>)}
                {preview.length > 4 && <li className="text-gray-500">…</li>}
                {preview.length > 3 && <li>{period(preview[preview.length - 1].start, preview[preview.length - 1].end)}</li>}
              </ul>
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">Chaque occurrence garde la même durée et copie le nom, la description, l'estimation, la liste à cocher, les personnes assignées, le matériel et les intervenants externes. Elle repart à « pas commencé ». Les dépendances ne sont pas copiées. Les personnes assignées ne reçoivent pas d'avis.</p>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDialog(false)}>Annuler</Button>
            <Button disabled={!valid} loading={busy} onClick={() => void run()}>{valid ? `Créer ${n} occurrence${n > 1 ? 's' : ''}` : 'Créer'}</Button>
          </div>
        </div>
      </Modal>
    </section>
  );
};

export default RepeatSection;
