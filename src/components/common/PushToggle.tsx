import React, { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from './Button';
import { currentSubscription, disablePush, enablePush, pushConfigured, pushSupported, testPush } from '../../lib/push';
import { errorMessage } from '../../lib/requests';

// Activer les avis GO-Mat sur ce téléphone (même application fermée)
const PushToggle: React.FC = () => {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    currentSubscription().then(sub => setEnabled(Boolean(sub))).catch(() => setEnabled(false));
  }, []);

  if (!pushConfigured()) {
    return <p className="text-xs text-gray-600 dark:text-gray-400">Notifications sur le téléphone : pas encore activées par l'administrateur.</p>;
  }
  if (!pushSupported()) {
    return (
      <p className="text-xs text-gray-600 dark:text-gray-400">
        Ce navigateur ne reçoit pas les notifications. Sur iPhone : installe d'abord GO-Mat sur l'écran d'accueil (iOS 16.4 ou plus récent), puis ouvre-le depuis l'icône.
      </p>
    );
  }

  const toggle = async () => {
    setBusy(true);
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
        toast.success('Notifications désactivées sur ce téléphone');
      } else {
        await enablePush();
        setEnabled(true);
        await testPush().catch(() => undefined);
        toast.success('Notifications activées sur ce téléphone');
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant={enabled ? 'outline' : 'primary'} icon={enabled ? <BellOff size={16} /> : <Bell size={16} />} onClick={toggle} loading={busy}>
        {enabled ? 'Couper les notifications sur ce téléphone' : 'Recevoir les avis sur ce téléphone'}
      </Button>
      {enabled && <span className="text-xs text-tone-success">Activées</span>}
    </div>
  );
};

export default PushToggle;
