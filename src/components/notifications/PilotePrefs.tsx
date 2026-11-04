import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import Card from '../common/Card';

interface Pref { kind: string; in_app: boolean; email: boolean; push: boolean }
type Channel = 'in_app' | 'email' | 'push';

const LABEL: Record<string, { title: string; hint: string }> = {
  cp_assigned: { title: 'On m\'assigne une tâche', hint: 'Phase, tâche, jalon ou sous-tâche qui t\'est assignée.' },
  cp_team_added: { title: 'On m\'ajoute à l\'équipe d\'un projet', hint: 'Comme responsable ou comme membre.' },
  cp_dates_changed: { title: 'Les dates d\'un de mes éléments changent', hint: 'Plusieurs changements rapprochés font un seul avis.' },
  cp_due_soon: { title: 'Échéance proche', hint: 'Un élément à toi se termine aujourd\'hui ou demain (un avis par jour).' },
  cp_comment: { title: 'Un nouveau message dans une discussion', hint: 'Sur un projet de ton équipe, ou sur un élément qui t\'est assigné. Plusieurs messages rapprochés font un seul avis.' },
  cp_overdue: { title: 'Élément en retard', hint: 'Un élément à toi est en retard de 1 à 3 jours (un avis par jour, puis on arrête).' },
};
const CHANNELS: { id: Channel; label: string }[] = [{ id: 'in_app', label: 'Dans l\'application' }, { id: 'email', label: 'E-mail' }, { id: 'push', label: 'Push' }];

// Choix de chaque personne : pour chaque type d'avis PILOTE, dans l'application / par e-mail / en push. Enregistré à chaque case cochée.
const PilotePrefs: React.FC = () => {
  const [prefs, setPrefs] = useState<Pref[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('my_cp_notification_prefs');
    if (error) return void toast.error(error.message);
    setPrefs((data || []) as Pref[]);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const toggle = async (p: Pref, channel: Channel) => {
    if (busy) return;
    const next = { ...p, [channel]: !p[channel] };
    setBusy(true);
    setPrefs(list => (list ? list.map(x => (x.kind === p.kind ? next : x)) : list));
    const { error } = await supabase.from('cp_notification_prefs')
      .upsert({ kind: next.kind, in_app: next.in_app, email: next.email, push: next.push, updated_at: new Date().toISOString() }, { onConflict: 'user_id,kind' });
    setBusy(false);
    if (error) { toast.error(error.message); await load(); }
  };

  if (!prefs) return null;
  return (
    <Card>
      <h2 className="font-bold text-gray-900 dark:text-white">Mes avis PILOTE</h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Choisis, pour chaque événement, où tu veux être prévenu. Sans « Dans l'application », tu ne reçois aucun avis de ce type. Le push demande aussi d'avoir activé les notifications sur cet appareil (bouton plus haut).
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Avis PILOTE par canal</caption>
          <thead>
            <tr className="text-left text-gray-600 dark:text-gray-400">
              <th scope="col" className="py-1 pr-3 font-semibold">Événement</th>
              {CHANNELS.map(c => <th key={c.id} scope="col" className="px-2 py-1 text-center font-semibold">{c.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {prefs.map(p => (
              <tr key={p.kind}>
                <th scope="row" className="py-2 pr-3 text-left font-medium text-gray-900 dark:text-white">
                  {LABEL[p.kind]?.title ?? p.kind}
                  <span className="block text-xs font-normal text-gray-600 dark:text-gray-400">{LABEL[p.kind]?.hint}</span>
                </th>
                {CHANNELS.map(c => (
                  <td key={c.id} className="px-2 py-2 text-center">
                    <input type="checkbox" checked={p[c.id]} disabled={busy} onChange={() => void toggle(p, c.id)} aria-label={`${LABEL[p.kind]?.title ?? p.kind} : ${c.label}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default PilotePrefs;
