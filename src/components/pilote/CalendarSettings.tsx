import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarOff, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { confirmAction } from '../../lib/confirm';
import { formatDay } from '../../lib/zurichTime';
import { HOLIDAY_PRESETS, presetDays } from '../../lib/holidays';
import { CALENDAR_KIND_LABEL, piloteError, type CpCalendarDay, type PiloteRights } from '../../lib/pilote';
import Button from '../common/Button';
import DateInput from '../common/DateInput';
import { MxBadge } from '../mx/MxBadge';
import { MxEmpty } from '../mx/MxEmpty';

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const weekdayName = (iso: string) => WEEKDAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()];

// PILOTE › Réglages › Calendrier de travail : jours fériés et fermetures de l'entreprise. Les week-ends sont toujours non travaillés.
// Le Gantt les teinte, le compte des jours ouvrés d'une fiche les exclut, et le décalage automatique des dépendances les évite
// (si « Éviter les week-ends et les jours non travaillés » est coché dans le projet).
const CalendarSettings: React.FC<{ rights: PiloteRights; onChanged?: () => void }> = ({ rights, onChanged }) => {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [days, setDays] = useState<CpCalendarDay[] | null>(null);
  const [missing, setMissing] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(HOLIDAY_PRESETS.filter(p => p.common).map(p => p.key)));
  const [newDay, setNewDay] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newKind, setNewKind] = useState<CpCalendarDay['kind']>('closure');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('cp_calendar_days').select('id, day, label, kind').order('day');
    if (error) { setMissing(true); setDays([]); return; }
    setMissing(false);
    setDays((data || []) as CpCalendarDay[]);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const existing = useMemo(() => new Set((days ?? []).map(d => d.day)), [days]);
  const inYear = useMemo(() => (days ?? []).filter(d => d.day.startsWith(`${year}-`)), [days, year]);
  const toAdd = useMemo(() => presetDays(year, picked, existing), [year, picked, existing]);

  const refresh = async () => { await load(); onChanged?.(); };
  const togglePreset = (key: string) => setPicked(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });

  const addPresets = async () => {
    if (!toAdd.length || busy) return;
    setBusy(true);
    const { error } = await supabase.from('cp_calendar_days').insert(toAdd);
    setBusy(false);
    if (error) return void toast.error(piloteError(error));
    toast.success(`${toAdd.length} jour${toAdd.length > 1 ? 's' : ''} ajouté${toAdd.length > 1 ? 's' : ''}`);
    await refresh();
  };

  const addCustom = async () => {
    const label = newLabel.trim();
    if (!newDay || !label || busy) return;
    if (existing.has(newDay)) return void toast.error('Ce jour est déjà dans le calendrier');
    setBusy(true);
    const { error } = await supabase.from('cp_calendar_days').insert({ day: newDay, label, kind: newKind });
    setBusy(false);
    if (error) return void toast.error(piloteError(error));
    setNewDay(''); setNewLabel('');
    toast.success('Jour ajouté');
    await refresh();
  };

  const remove = async (d: CpCalendarDay) => {
    if (!(await confirmAction(`Supprimer « ${d.label} » (${formatDay(d.day)}) du calendrier ?`))) return;
    const { error } = await supabase.from('cp_calendar_days').delete().eq('id', d.id);
    if (error) return void toast.error(piloteError(error));
    toast.success('Jour supprimé');
    await refresh();
  };

  if (days === null) return <p className="text-gray-500 dark:text-gray-400 font-medium">Chargement…</p>;
  if (missing) {
    return <MxEmpty icon={CalendarOff} title="Calendrier de travail indisponible" description="La mise à jour de la base de données qui l'ajoute n'est pas encore appliquée." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Calendrier de travail</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Les jours fériés et les fermetures de l'entreprise. Les samedis et dimanches sont toujours non travaillés. Ces jours sont teintés dans le Gantt, ne comptent pas dans les jours ouvrés d'une fiche
          et sont évités par le décalage automatique des dépendances (quand « Éviter les week-ends et les jours non travaillés » est coché dans le projet).
        </p>
      </div>

      <div className="flex items-end gap-3">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Année
          <select value={year} onChange={e => setYear(Number(e.target.value))} className={`${inputClass} mt-1 min-w-28`}>
            {[thisYear - 1, thisYear, thisYear + 1, thisYear + 2, thisYear + 3].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>

      {rights.create && (
        <fieldset className="rounded-md border border-gray-200 p-3 dark:border-gray-700">
          <legend className="px-1 text-sm font-medium text-gray-700 dark:text-gray-300">Ajouter des jours fériés courants</legend>
          <p className="mb-2 text-xs text-gray-600 dark:text-gray-400">
            Ce sont des propositions : les jours fériés varient selon le canton et l'entreprise. Coche ceux qui s'appliquent chez toi, tu pourras ensuite modifier la liste.
          </p>
          <ul className="grid gap-1 sm:grid-cols-2">
            {HOLIDAY_PRESETS.map(p => {
              const date = p.date(year);
              const already = existing.has(date);
              return (
                <li key={p.key}>
                  <label className={`flex items-center gap-2 text-sm ${already ? 'text-gray-500 dark:text-gray-500' : 'text-gray-800 dark:text-gray-200'}`}>
                    <input type="checkbox" checked={picked.has(p.key) && !already} disabled={already} onChange={() => togglePreset(p.key)} />
                    <span>{p.label}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400"><span>{formatDay(date)}</span>{already && <> · <span>déjà ajouté</span></>}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="mt-3">
            <Button icon={<Plus size={16} />} onClick={() => void addPresets()} disabled={toAdd.length === 0 || busy}>
              {toAdd.length === 0 ? 'Rien à ajouter' : `Ajouter ${toAdd.length} jour${toAdd.length > 1 ? 's' : ''}`}
            </Button>
          </div>
        </fieldset>
      )}

      {rights.create && (
        <fieldset className="rounded-md border border-gray-200 p-3 dark:border-gray-700">
          <legend className="px-1 text-sm font-medium text-gray-700 dark:text-gray-300">Ajouter un jour</legend>
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label htmlFor="cal-day" className={labelClass}>Date</label>
              <DateInput id="cal-day" className={inputClass} value={newDay} onChange={e => setNewDay(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="cal-label" className={labelClass}>Nom</label>
              <input id="cal-label" className={inputClass} maxLength={120} value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Ex. Fermeture annuelle" />
            </div>
            <div>
              <label htmlFor="cal-kind" className={labelClass}>Type</label>
              <select id="cal-kind" className={inputClass} value={newKind} onChange={e => setNewKind(e.target.value as CpCalendarDay['kind'])}>
                {(Object.keys(CALENDAR_KIND_LABEL) as CpCalendarDay['kind'][]).map(k => <option key={k} value={k}>{CALENDAR_KIND_LABEL[k]}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-3">
            <Button variant="outline" icon={<Plus size={16} />} onClick={() => void addCustom()} disabled={!newDay || !newLabel.trim() || busy}>Ajouter ce jour</Button>
          </div>
        </fieldset>
      )}

      <div>
        <h3 className="mb-2 text-sm font-bold text-gray-900 dark:text-white">{`Jours non travaillés en ${year} (${inYear.length})`}</h3>
        {inYear.length === 0 ? (
          <MxEmpty icon={CalendarOff} title="Aucun jour saisi" description={`Seuls les week-ends sont non travaillés en ${year}.`} />
        ) : (
          <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 dark:divide-gray-700 dark:border-gray-700" aria-label={`Jours non travaillés en ${year}`}>
            {inYear.map(d => (
              <li key={d.id} className="flex items-center justify-between gap-3 p-2.5">
                <div className="min-w-0">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{d.label}</span>
                  <span className="ml-2 text-xs text-gray-600 dark:text-gray-400"><span>{weekdayName(d.day)}</span> <span>{formatDay(d.day)}</span></span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <MxBadge tone={d.kind === 'holiday' ? 'info' : 'neutral'}>{CALENDAR_KIND_LABEL[d.kind]}</MxBadge>
                  {rights.delete && (
                    <button type="button" onClick={() => void remove(d)} aria-label={`Supprimer ${d.label}`} className="flex h-8 w-8 items-center justify-center rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
                      <Trash2 size={15} aria-hidden />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default CalendarSettings;
