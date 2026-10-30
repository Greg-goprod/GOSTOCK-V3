import React, { useState } from 'react';
import { KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from './Button';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/requests';

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';

// Mot de passe facultatif : permet de se connecter sans attendre un code par e-mail
const PasswordSetting: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) return toast.error('Au moins 8 caractères');
    if (password !== confirm) return toast.error('Les deux mots de passe ne sont pas identiques');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    setPassword('');
    setConfirm('');
    toast.success('Mot de passe enregistré : « J\'ai un mot de passe » sur la page de connexion');
  };

  return (
    <form onSubmit={save} className="w-full max-w-sm space-y-2 text-left">
      <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2"><KeyRound size={16} aria-hidden="true" />Mon mot de passe (facultatif)</h2>
      <p className="text-xs text-gray-600 dark:text-gray-400">Pour se connecter sans attendre de code par e-mail. Le code reste toujours possible.</p>
      <input type="password" autoComplete="new-password" aria-label="Nouveau mot de passe" placeholder="Nouveau mot de passe (8 caractères ou plus)"
        value={password} onChange={e => setPassword(e.target.value)} className={inputClass} />
      <input type="password" autoComplete="new-password" aria-label="Répéter le mot de passe" placeholder="Répéter le mot de passe"
        value={confirm} onChange={e => setConfirm(e.target.value)} className={inputClass} />
      <Button type="submit" variant="outline" loading={busy} disabled={!password || !confirm}>Enregistrer le mot de passe</Button>
    </form>
  );
};

export default PasswordSetting;
