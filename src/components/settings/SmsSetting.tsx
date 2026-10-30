import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/requests';

// Rappels personnels aussi par SMS (compte Twilio saisi dans Supabase) ; il faut un numéro sur la fiche
const SmsSetting: React.FC = () => {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    supabase.from('system_settings').select('value').eq('id', 'sms_enabled').maybeSingle()
      .then(({ data }) => setEnabled(data?.value === 'true'));
  }, []);

  const toggle = async (value: boolean) => {
    setEnabled(value);
    const { error } = await supabase.from('system_settings').upsert({ id: 'sms_enabled', value: String(value), description: 'Rappels personnels envoyés aussi par SMS' });
    if (error) {
      setEnabled(!value);
      return toast.error(errorMessage(error));
    }
    toast.success(value ? 'Rappels par SMS activés' : 'Rappels par SMS désactivés');
  };

  return (
    <div className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
      <h4 className="text-sm font-bold text-gray-900 dark:text-white">SMS</h4>
      <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
        <input type="checkbox" checked={enabled} onChange={e => toggle(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary-600" />
        Envoyer aussi par SMS les rappels personnels : retour demain, retard, demande prête.
      </label>
      <p className="text-xs text-gray-600 dark:text-gray-400">
        Envoyé au numéro de téléphone de la fiche de chaque personne. Il faut un compte d'envoi de SMS (Twilio), saisi dans Supabase.
      </p>
    </div>
  );
};

export default SmsSetting;
