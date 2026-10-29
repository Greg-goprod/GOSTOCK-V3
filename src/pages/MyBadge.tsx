import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import BadgeCard from '../components/badges/BadgeCard';
import { supabase } from '../lib/supabase';
import { badgeValue } from '../lib/badges';
import { errorMessage } from '../lib/requests';
import { useAuth } from '../contexts/AuthContext';
import { ROLE_LABELS } from '../lib/roles';

// Badge personnel à présenter au magasin, depuis le téléphone ou imprimé
const MyBadge: React.FC = () => {
  const { profile } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    supabase.from('user_badges').select('code').eq('user_id', profile.id).maybeSingle()
      .then(({ data, error }) => {
        if (error) toast.error(errorMessage(error));
        setCode(data?.code ?? null);
      });
  }, [profile]);

  const regenerate = async () => {
    if (!profile) return;
    if (!window.confirm('Créer un nouveau badge ? L\'ancien (carte imprimée ou capture d\'écran) ne fonctionnera plus.')) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('regenerate_badge', { p_user_id: profile.id });
    setBusy(false);
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    setCode(data as string);
    toast.success('Nouveau badge créé');
  };

  if (!profile) return null;

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h1 className="text-2xl sm:text-3xl font-black text-gray-800 dark:text-white tracking-tight uppercase">Mon badge</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Présentez ce code au magasin pour sortir ou rendre du matériel.</p>
      </div>

      <div className="print:hidden flex flex-col items-center gap-4">
        {/* Fond blanc même en thème sombre : le contraste est nécessaire à la lecture */}
        <div className="rounded-2xl bg-white p-5 shadow-lg">
          {code ? (
            <QRCodeSVG value={badgeValue(code)} size={280} level="M" className="w-[70vw] max-w-[280px] h-auto" />
          ) : (
            <div className="w-[70vw] max-w-[280px] aspect-square flex items-center justify-center text-gray-500">Chargement…</div>
          )}
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-gray-900 dark:text-white">{profile.first_name} {profile.last_name}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{ROLE_LABELS[profile.role]}</p>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 text-center max-w-xs">
          Astuce : montez la luminosité de l'écran. Sur téléphone, ajoutez GO-Mat à l'écran d'accueil pour ouvrir votre badge d'un geste.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" icon={<Printer size={16} />} onClick={() => window.print()} disabled={!code}>Imprimer ma carte</Button>
          <Button variant="outline" icon={<RefreshCw size={16} />} onClick={regenerate} loading={busy}>Badge perdu : nouveau code</Button>
        </div>
      </div>

      {code && (
        <div className="hidden print:block">
          <BadgeCard firstName={profile.first_name} lastName={profile.last_name} roleLabel={ROLE_LABELS[profile.role]} code={code} />
        </div>
      )}
    </div>
  );
};

export default MyBadge;
