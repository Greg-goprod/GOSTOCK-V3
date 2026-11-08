import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Clock, Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { confirmAction } from '../../lib/confirm';
import { addTimeEntry, canLogTime, deleteTimeEntry, formatElapsed, formatMinutes, loadItemTime, loadRunningTimer, parseDuration, startTimer, stopTimer, sumMinutes, TIMER_EVENT, timeError, updateTimeEntry, type CpTimeEntry, type RunningTimer } from '../../lib/timeTracking';
import { SectionHeader } from './SectionHeader';
import { useSectionOpen } from './useSectionOpen';

interface Props { itemId: string; estimateHours: number | null }

const todayZurich = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(new Date());
const fmt = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const inputClass = 'rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';

// Temps passé sur une tâche : chronomètre ou saisie à la main. Chacun saisit son propre temps ; les responsables voient celui de tout le monde.
const TimeSection: React.FC<Props> = ({ itemId, estimateHours }) => {
  const { open, toggle } = useSectionOpen('time', false, false);
  const panelId = useId();
  const { users } = useApp();
  const { profile } = useAuth();
  const me = profile?.id ?? '';
  const [entries, setEntries] = useState<CpTimeEntry[] | null>(null);
  const [running, setRunning] = useState<RunningTimer | null>(null);
  const [canLog, setCanLog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [date, setDate] = useState(todayZurich());
  const [duration, setDuration] = useState('');
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState<{ id: string; duration: string; note: string; date: string } | null>(null);

  const names = useMemo(() => new Map(users.map(u => [u.id, `${u.first_name} ${u.last_name}`.trim()])), [users]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [list, run, can] = await Promise.all([loadItemTime(itemId), me ? loadRunningTimer(me) : Promise.resolve(null), canLogTime(itemId)]);
      setEntries(list); setRunning(run); setCanLog(can);
    } catch (e) { setError(timeError(e)); setEntries([]); }
  }, [itemId, me]);
  useEffect(() => { if (open) void load(); }, [open, load]);
  // Le chronomètre démarré ou arrêté ailleurs (barre du haut) met cette section à jour
  useEffect(() => {
    if (!open) return;
    const on = () => { void load(); };
    window.addEventListener(TIMER_EVENT, on);
    return () => window.removeEventListener(TIMER_EVENT, on);
  }, [open, load]);
  useEffect(() => {
    if (!open || !running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open, running]);

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await action(); await load(); } catch (e) { toast.error(timeError(e)); } finally { setBusy(false); }
  };

  const mine = (entries ?? []).filter(e => e.user_id === me);
  const total = sumMinutes(entries ?? []);
  const totalMine = sumMinutes(mine);
  const others = (entries ?? []).some(e => e.user_id !== me);
  const onThis = running && running.item_id === itemId;
  const elapsed = running?.started_at ? (now - new Date(running.started_at).getTime()) / 1000 : 0;
  const estimateMin = estimateHours && estimateHours > 0 ? Math.round(estimateHours * 60) : null;

  const add = () => {
    const minutes = parseDuration(duration);
    if (minutes === null) return void toast.error('Durée : par exemple 1 h 30, 1:30, 45 min ou 90 (minutes)');
    void run(async () => { await addTimeEntry(itemId, date, minutes, note); setDuration(''); setNote(''); });
  };
  const saveEdit = () => {
    if (!editing) return;
    const minutes = parseDuration(editing.duration);
    if (minutes === null) return void toast.error('Durée : par exemple 1 h 30, 1:30, 45 min ou 90 (minutes)');
    void run(async () => { await updateTimeEntry(editing.id, { minutes, note: editing.note.trim() || null, work_date: editing.date }); setEditing(null); });
  };
  const remove = async (e: CpTimeEntry) => {
    if (!(await confirmAction(`Supprimer cette saisie (${e.minutes === null ? 'chronomètre en cours' : formatMinutes(e.minutes)}) ?`))) return;
    void run(() => deleteTimeEntry(e.id));
  };

  return (
    <section aria-label="Temps passé" className="space-y-2" data-time>
      <SectionHeader title="Temps passé" icon={<Clock size={14} aria-hidden />} open={open} onToggle={toggle} panelId={panelId} />
      {open && (
        <div id={panelId} className="space-y-3">
          {entries === null ? <p className="text-sm text-gray-500">Chargement…</p> : error ? <p role="alert" className="text-sm text-danger-600">{error}</p> : (
            <>
              <p className="text-sm text-gray-800 dark:text-gray-200" data-time-summary>
                <strong>{formatMinutes(others ? total : totalMine)}</strong>{others ? ' au total' : ' passé par toi'}
                {others && <> · dont <strong>{formatMinutes(totalMine)}</strong> à toi</>}
                {estimateMin !== null && <> · estimé <strong>{formatMinutes(estimateMin)}</strong>{(others ? total : totalMine) > estimateMin && <span className="ml-1 font-semibold text-danger-600 dark:text-danger-400">(dépassé)</span>}</>}
              </p>

              {canLog ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    {onThis ? (
                      <>
                        <span className="font-mono text-base font-semibold tabular-nums text-gray-900 dark:text-white" role="timer" aria-label="Chronomètre en cours" data-timer-elapsed>{formatElapsed(elapsed)}</span>
                        <button type="button" disabled={busy} onClick={() => void run(async () => { await stopTimer(); })} className="inline-flex items-center gap-1.5 rounded-md bg-danger-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-danger-700 disabled:opacity-60"><Pause size={14} aria-hidden />Arrêter</button>
                      </>
                    ) : (
                      <button type="button" disabled={busy} onClick={() => void run(() => startTimer(itemId))} className="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"><Play size={14} aria-hidden />{running ? 'Démarrer ici (arrête l\'autre)' : 'Démarrer le chronomètre'}</button>
                    )}
                    {running && !onThis && <span role="status" className="text-xs text-gray-600 dark:text-gray-400">{`Chronomètre en cours sur « ${running.item_name} »`}</span>}
                  </div>
                  <div className="flex flex-wrap items-end gap-2" data-time-form>
                    <div><label htmlFor="tm-date" className="block text-xs text-gray-600 dark:text-gray-400">Jour</label><input id="tm-date" type="date" max={todayZurich()} value={date} onChange={e => setDate(e.target.value)} className={inputClass} /></div>
                    <div><label htmlFor="tm-dur" className="block text-xs text-gray-600 dark:text-gray-400">Durée</label><input id="tm-dur" value={duration} placeholder="1 h 30" autoComplete="off" onChange={e => setDuration(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} className={`${inputClass} w-24`} /></div>
                    <div className="min-w-0 flex-1"><label htmlFor="tm-note" className="block text-xs text-gray-600 dark:text-gray-400">Note</label><input id="tm-note" value={note} maxLength={300} onChange={e => setNote(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} className={`${inputClass} w-full`} /></div>
                    <button type="button" disabled={busy || !duration.trim() || !date} onClick={add} className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700"><Plus size={14} aria-hidden />Ajouter</button>
                  </div>
                </>
              ) : <p className="text-xs text-gray-600 dark:text-gray-400">Tu saisis ton temps sur les tâches des projets dont tu fais partie.</p>}

              {entries.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-400">Aucun temps saisi.</p> : (
                <ul className="max-h-60 space-y-1 overflow-y-auto" data-time-list>
                  {entries.map(e => {
                    const own = e.user_id === me;
                    return (
                      <li key={e.id} data-time-entry={e.id} className="rounded-md border border-gray-200 px-2 py-1.5 text-sm dark:border-gray-700">
                        {editing?.id === e.id ? (
                          <div className="flex flex-wrap items-end gap-2">
                            <input aria-label="Jour" type="date" max={todayZurich()} value={editing.date} onChange={ev => setEditing({ ...editing, date: ev.target.value })} className={inputClass} />
                            <input aria-label="Durée" value={editing.duration} onChange={ev => setEditing({ ...editing, duration: ev.target.value })} className={`${inputClass} w-24`} />
                            <input aria-label="Note" value={editing.note} maxLength={300} onChange={ev => setEditing({ ...editing, note: ev.target.value })} className={`${inputClass} min-w-0 flex-1`} />
                            <button type="button" disabled={busy} onClick={saveEdit} className="rounded-md bg-primary-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-primary-700">Enregistrer</button>
                            <button type="button" onClick={() => setEditing(null)} className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-800 dark:border-gray-600 dark:text-gray-100">Annuler</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="w-24 shrink-0 text-gray-600 dark:text-gray-400">{fmt(e.work_date)}</span>
                            <span className="w-20 shrink-0 font-semibold tabular-nums text-gray-900 dark:text-white">{e.minutes === null ? 'en cours' : formatMinutes(e.minutes)}</span>
                            <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-300">{!own && <strong className="mr-1.5 text-gray-900 dark:text-gray-100">{names.get(e.user_id) ?? '—'}</strong>}{e.note ?? ''}</span>
                            {own && e.minutes !== null && <button type="button" aria-label={`Modifier la saisie du ${fmt(e.work_date)}`} onClick={() => setEditing({ id: e.id, duration: formatMinutes(e.minutes ?? 0), note: e.note ?? '', date: e.work_date })} className="shrink-0 rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"><Pencil size={13} aria-hidden /></button>}
                            {own && <button type="button" aria-label={`Supprimer la saisie du ${fmt(e.work_date)}`} disabled={busy} onClick={() => void remove(e)} className="shrink-0 rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-danger-600 dark:hover:bg-gray-700"><Trash2 size={13} aria-hidden /></button>}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {others && <p className="text-xs text-gray-600 dark:text-gray-400">Tu vois le temps de toute l'équipe parce que tu peux modifier les projets ; chacun ne modifie que le sien.</p>}
            </>
          )}
        </div>
      )}
    </section>
  );
};

export default TimeSection;
