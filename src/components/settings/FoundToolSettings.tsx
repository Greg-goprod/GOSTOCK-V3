import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/requests';

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';

// Ce que voit quelqu'un d'extérieur qui scanne l'étiquette d'un outil oublié (page publique /t/…)
const FoundToolSettings: React.FC = () => {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    supabase.from('system_settings').select('id, value').in('id', ['found_phone', 'found_message']).then(({ data }) => {
      setPhone(data?.find(r => r.id === 'found_phone')?.value ?? '');
      setMessage(data?.find(r => r.id === 'found_message')?.value ?? '');
    });
  }, []);

  const save = async () => {
    const { error } = await supabase.from('system_settings').upsert([
      { id: 'found_phone', value: phone.trim(), description: 'Téléphone affiché à qui trouve un outil (page publique)' },
      { id: 'found_message', value: message.trim(), description: 'Message affiché à qui trouve un outil' },
    ]);
    if (error) return toast.error(errorMessage(error));
    toast.success('Enregistré');
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-700 dark:text-gray-300">
        Avec l'option « QR outil trouvé » des étiquettes, quelqu'un qui trouve un outil oublié voit seulement le nom de l'entreprise,
        ce téléphone et ce message, et peut prévenir le magasin. Aucune autre donnée n'est visible.
      </p>
      <div>
        <label htmlFor="found-phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Téléphone</label>
        <input id="found-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} placeholder="021 000 00 00" />
      </div>
      <div>
        <label htmlFor="found-message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message</label>
        <textarea id="found-message" rows={2} value={message} onChange={e => setMessage(e.target.value)} className={inputClass} />
      </div>
      <Button variant="outline" onClick={save}>Enregistrer</Button>
    </div>
  );
};

export default FoundToolSettings;
