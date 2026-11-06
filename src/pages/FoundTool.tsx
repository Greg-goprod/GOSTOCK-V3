import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Phone, Send } from 'lucide-react';
import Button from '../components/common/Button';
import { supabase } from '../lib/supabase';

interface FoundInfo {
  company: string | null;
  phone: string | null;
  message: string | null;
  known: boolean;
}

// Page publique ouverte par le QR d'un outil oublié : seulement le contact de l'entreprise
const FoundTool: React.FC = () => {
  const { code = '' } = useParams();
  const [info, setInfo] = useState<FoundInfo | null>(null);
  const [contact, setContact] = useState('');
  const [place, setPlace] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.rpc('found_tool_info', { p_code: code }).then(({ data }) => setInfo((data as FoundInfo) ?? null));
  }, [code]);

  const report = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    await supabase.rpc('report_found_tool', { p_code: code, p_contact: contact, p_place: place });
    setBusy(false);
    setSent(true);
  };

  const inputClass = 'w-full rounded-md border border-gray-300 bg-white px-3 py-3 text-base text-gray-900';

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-xl shadow border border-gray-200 p-6 space-y-5 text-gray-900">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">Outil trouvé</p>
          <h1 className="text-2xl font-black mt-1">{info?.company ?? '…'}</h1>
        </div>
        <p className="text-base leading-relaxed">{info?.message ?? 'Cet outil appartient à une entreprise. Merci de la contacter.'}</p>
        {info?.phone && (
          <a href={`tel:${info.phone.replace(/\s/g, '')}`}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-4 text-lg font-bold text-white">
            <Phone size={22} aria-hidden="true" /> {info.phone}
          </a>
        )}
        {info?.known && (sent ? (
          <p role="status" className="rounded-md bg-success-50 px-4 py-3 text-success-800">Merci ! L'entreprise est prévenue.</p>
        ) : (
          <form onSubmit={report} className="space-y-3 border-t border-gray-200 pt-4">
            <p className="text-sm text-gray-700">Ou prévenez-la sans appeler :</p>
            <div>
              <label htmlFor="found-place" className="block text-sm font-medium mb-1">Où l'avez-vous trouvé ?</label>
              <input id="found-place" value={place} onChange={e => setPlace(e.target.value)} maxLength={200} className={inputClass} placeholder="ex. parking de la gare" />
            </div>
            <div>
              <label htmlFor="found-contact" className="block text-sm font-medium mb-1">Votre téléphone ou e-mail (facultatif)</label>
              <input id="found-contact" value={contact} onChange={e => setContact(e.target.value)} maxLength={200} className={inputClass} />
            </div>
            <Button type="submit" fullWidth icon={<Send size={16} />} loading={busy}>Prévenir l'entreprise</Button>
          </form>
        ))}
      </div>
    </main>
  );
};

export default FoundTool;
