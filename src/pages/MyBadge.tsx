import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Printer, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import BadgeCard from '../components/badges/BadgeCard';
import { supabase } from '../lib/supabase';
import { badgeValue } from '../lib/badges';
import { errorMessage } from '../lib/requests';
import { useAuth } from '../contexts/AuthContext';
import { ROLE_LABELS } from '../lib/roles';
import { useInstallPrompt } from '../lib/install';
import PushToggle from '../components/common/PushToggle';
import PasswordSetting from '../components/common/PasswordSetting';
import { confirmAction } from '../lib/confirm';
import PageTitle from '../components/common/PageTitle';

// Badge personnel à présenter au magasin, depuis le téléphone ou imprimé
const MyBadge: React.FC = () => {
  const { profile } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { canInstall, iosHint, install } = useInstallPrompt();

  useEffect(() => {
    if (!profile) return;
    const cacheKey = `gomat-badge-${profile.id}`;
    supabase.from('user_badges').select('code').eq('user_id', profile.id).maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          // Hors ligne : le badge reste lisible au comptoir
          let cached: string | null = null;
          try { cached = localStorage.getItem(cacheKey); } catch { /* stockage indisponible */ }
          if (cached) return setCode(cached);
          toast.error(errorMessage(error));
        }
        setCode(data?.code ?? null);
        try { if (data?.code) localStorage.setItem(cacheKey, data.code); } catch { /* stockage indisponible */ }
      });
  }, [profile]);

  const regenerate = async () => {
    if (!profile) return;
    if (!await confirmAction('Créer un nouveau badge ? L\'ancien (carte imprimée ou capture d\'écran) ne fonctionnera plus.')) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('regenerate_badge', { p_user_id: profile.id });
    setBusy(false);
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    setCode(data as string);
    try { localStorage.setItem(`gomat-badge-${profile.id}`, data as string); } catch { /* stockage indisponible */ }
    toast.success('Nouveau badge créé');
  };

  if (!profile) return null;

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageTitle>Mon badge</PageTitle>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Présente ce code au magasin pour sortir ou rendre du matériel.</p>
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
          Astuce : monte la luminosité de l'écran. Sur téléphone, ajoute GO-Mat à l'écran d'accueil pour ouvrir ton badge d'un geste.
        </p>
        <PushToggle />
        {canInstall && (
          <Button icon={<Download size={16} />} onClick={install}>Installer GO-Mat sur ce téléphone</Button>
        )}
        {iosHint && (
          <p className="text-xs text-gray-700 dark:text-gray-300 text-center max-w-xs">
            Sur iPhone : touche <strong>Partager</strong> puis <strong>Sur l'écran d'accueil</strong> pour installer GO-Mat.
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" icon={<Printer size={16} />} onClick={() => window.print()} disabled={!code}>Imprimer ma carte</Button>
          <Button variant="outline" icon={<RefreshCw size={16} />} onClick={regenerate} loading={busy}>Badge perdu : nouveau code</Button>
        </div>
        <div className="w-full flex justify-center border-t border-gray-200 dark:border-gray-700 pt-4 print:hidden">
          <PasswordSetting />
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
