import React, { useCallback, useEffect, useState } from 'react';
import { Pause, Timer } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { formatElapsed, formatMinutes, loadRunningTimer, stopTimer, TIMER_EVENT, timeError, type RunningTimer } from '../../lib/timeTracking';

// Rappel du chronomètre en cours, visible dans toutes les vues PILOTE (pour ne pas l'oublier) : tâche, temps écoulé, bouton « Arrêter ».
const RunningTimerBar: React.FC = () => {
  const { profile } = useAuth();
  const me = profile?.id ?? '';
  const [timer, setTimer] = useState<RunningTimer | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => { setTimer(me ? await loadRunningTimer(me) : null); }, [me]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    window.addEventListener(TIMER_EVENT, load);
    return () => window.removeEventListener(TIMER_EVENT, load);
  }, [load]);
  useEffect(() => {
    if (!timer) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [timer]);

  if (!timer || !timer.started_at) return null;
  const elapsed = (now - new Date(timer.started_at).getTime()) / 1000;
  const stop = async () => {
    if (busy) return;
    setBusy(true);
    try { const minutes = await stopTimer(); toast.success(minutes === null ? 'Chronomètre arrêté' : `Chronomètre arrêté : ${formatMinutes(minutes)} enregistrées`); } catch (e) { toast.error(timeError(e)); } finally { setBusy(false); }
  };
  return (
    <div role="status" data-timer-bar className="flex flex-wrap items-center gap-3 rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-900 dark:border-primary-800 dark:bg-primary-900/20 dark:text-primary-100">
      <Timer size={16} aria-hidden />
      <span className="min-w-0 flex-1 truncate">Chronomètre en cours sur <strong>{`« ${timer.item_name} »`}</strong></span>
      <span className="font-mono font-semibold tabular-nums" data-timer-bar-elapsed>{formatElapsed(elapsed)}</span>
      <button type="button" disabled={busy} onClick={() => void stop()} className="inline-flex items-center gap-1.5 rounded-md bg-danger-600 px-2.5 py-1 text-sm font-medium text-white hover:bg-danger-700 disabled:opacity-60"><Pause size={14} aria-hidden />Arrêter</button>
    </div>
  );
};

export default RunningTimerBar;
