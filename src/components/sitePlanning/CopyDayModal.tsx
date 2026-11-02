import React, { useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { copyDay, daysInRange, planningError, WEEKDAYS, type PlanSite, type SitePlanningData } from '../../lib/sitePlanning';
import { isoToWall, formatDay } from '../../lib/zurichTime';
import Button from '../common/Button';
import Modal from '../common/Modal';
import DateInput from '../common/DateInput';

interface Props {
  site: PlanSite;
  data: SitePlanningData;
  open: boolean;
  defaultDay: string;
  onClose: () => void;
  onDone: () => Promise<void>;
}

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

// Copie d'un jour : toutes les interventions de ce jour (avec leur matériel) sont recopiées aux mêmes heures sur d'autres jours
const CopyDayModal: React.FC<Props> = ({ site, data, open, defaultDay, onClose, onDone }) => {
  const [from, setFrom] = useState(defaultDay);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [weekdays, setWeekdays] = useState([1, 2, 3, 4, 5]);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setFrom(defaultDay); setFirst(''); setLast(''); setWeekdays([1, 2, 3, 4, 5]); } }, [open, defaultDay]);

  const count = data.interventions.filter(i => isoToWall(i.starts_at).day === from).length;
  const targets = first && last && last >= first ? daysInRange(first, last, weekdays).filter(d => d !== from) : [];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || targets.length === 0) return;
    setSaving(true);
    try {
      const result = await copyDay(site.id, from, targets);
      toast.success(result.skipped_blocked > 0 ? `${result.created} interventions copiées (${result.skipped_blocked} jour(s) bloqué(s) sauté(s))` : `${result.created} interventions copiées`);
      onClose();
      await onDone();
    } catch (error) {
      toast.error(planningError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Copier un jour">
      <form onSubmit={submit} className="space-y-3">
        <div className="w-52">
          <label htmlFor="copy-from" className={labelClass}>Jour à copier</label>
          <DateInput id="copy-from" className={inputClass} value={from} onChange={e => setFrom(e.target.value)} required />
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300" role="status">{count === 0 ? 'Aucune intervention ce jour-là.' : `${count} intervention(s) le ${formatDay(from)}.`}</p>
        <div className="flex flex-wrap gap-3">
          <div className="w-52">
            <label htmlFor="copy-first" className={labelClass}>Copier du</label>
            <DateInput id="copy-first" className={inputClass} value={first} onChange={e => setFirst(e.target.value)} required />
          </div>
          <div className="w-52">
            <label htmlFor="copy-last" className={labelClass}>au (inclus)</label>
            <DateInput id="copy-last" className={inputClass} value={last} min={first || undefined} onChange={e => setLast(e.target.value)} required />
          </div>
        </div>
        <div className="flex flex-wrap gap-3" role="group" aria-label="Jours de la semaine">
          {WEEKDAYS.map(d => (
            <label key={d.n} className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={weekdays.includes(d.n)} onChange={e => setWeekdays(e.target.checked ? [...weekdays, d.n] : weekdays.filter(x => x !== d.n))} />
              {d.label}
            </label>
          ))}
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400">{targets.length > 0 ? `${targets.length} jour(s) de destination.` : 'Choisis les jours de destination.'} Les jours bloqués sont sautés. Si un jour est refusé (équipe déjà occupée, hors période…), rien n'est copié et le jour concerné est indiqué.</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" icon={<Copy size={14} />} loading={saving} disabled={count === 0 || targets.length === 0}>Copier</Button>
        </div>
      </form>
    </Modal>
  );
};

export default CopyDayModal;
