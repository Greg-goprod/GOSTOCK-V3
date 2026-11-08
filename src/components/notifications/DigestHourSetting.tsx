import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { parseDigestHour } from '../../lib/digestHour';

const HOURS = Array.from({ length: 24 }, (_, h) => h);

// Réglage de l'entreprise (administrateur) : heure d'envoi du récapitulatif quotidien, heure de Zurich, 7 h par défaut
const DigestHourSetting: React.FC = () => {
  const [hour, setHour] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('system_settings').select('value').eq('id', 'pilote_digest_hour').maybeSingle();
    setHour(parseDigestHour((data as { value?: string } | null)?.value));
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async (next: number) => {
    const previous = hour;
    setHour(next); setSaving(true);
    const { error } = await supabase.from('system_settings').upsert({ id: 'pilote_digest_hour', value: String(next), description: 'Heure du récapitulatif quotidien PILOTE (heure de Zurich)', updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) { setHour(previous); return void toast.error("Tu n'as pas le droit de changer ce réglage"); }
    toast.success(`Récapitulatif quotidien à ${next} h 00`);
  };

  if (hour === null) return null;
  return (
    <div className="mt-4 rounded-md border border-gray-200 p-3 dark:border-gray-700" data-digest-setting>
      <label htmlFor="digest-hour" className="block text-sm font-semibold text-gray-900 dark:text-white">Heure du récapitulatif quotidien (administrateur)</label>
      <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
        Un seul avis par personne et par jour ouvré (lundi à vendredi, hors fermetures du calendrier de travail), envoyé dans l'heure qui suit. Heure de Zurich ; 7 h 00 par défaut. Valable pour toute l'entreprise.
      </p>
      <select id="digest-hour" value={hour} disabled={saving} onChange={e => void save(Number(e.target.value))}
        className="mt-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
        {HOURS.map(h => <option key={h} value={h}>{`${h} h 00`}</option>)}
      </select>
    </div>
  );
};

export default DigestHourSetting;
