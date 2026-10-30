import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import Button from './Button';
import { MxDrawer } from '../mx/MxDrawer';
import { DialogRequest, settleDialog, subscribeDialogs } from '../../lib/confirm';

// Affiche la confirmation ou la saisie demandée (une à la fois), en drawer étroit de la charte
const DialogHost: React.FC = () => {
  const [requests, setRequests] = useState<DialogRequest[]>([]);
  const [value, setValue] = useState('');
  const [shown, setShown] = useState<DialogRequest | null>(null);
  const current = requests[0] ?? null;

  useEffect(() => subscribeDialogs(setRequests), []);

  useEffect(() => {
    if (current) {
      setShown(current);
      setValue(current.defaultValue ?? '');
      return;
    }
    // Fermé : le texte de la dernière question disparaît après l'animation de sortie
    const timer = window.setTimeout(() => setShown(null), 350);
    return () => window.clearTimeout(timer);
  }, [current]);

  const answer = (result: boolean | string | null) => {
    if (current) settleDialog(current.id, result);
  };
  const cancel = () => answer(current?.kind === 'prompt' ? null : false);
  const accept = () => answer(current?.kind === 'prompt' ? value : true);
  const view = current ?? shown;

  return (
    <MxDrawer
      open={!!current}
      onClose={cancel}
      title={view?.kind === 'prompt' ? 'Saisie' : 'Confirmation'}
      titleIcon={view?.danger ? AlertTriangle : undefined}
      size="sm"
      footer={
        <div className="mx-dr-foot flex w-full justify-end gap-2">
          <Button variant="outline" onClick={cancel}>Annuler</Button>
          <Button variant={view?.danger ? 'danger' : 'primary'} onClick={accept}>{view?.kind === 'prompt' ? 'Valider' : 'Confirmer'}</Button>
        </div>
      }
    >
      {view && (
        <form onSubmit={e => { e.preventDefault(); accept(); }} className="space-y-3">
          <div className="text-[14px] leading-relaxed text-gray-800 dark:text-gray-100">
            {/* Une ligne par paragraphe : chaque phrase est traduite séparément */}
            {view.message.split('\n').map((line, index) => <p key={index}>{line}</p>)}
          </div>
          {view.kind === 'prompt' && (
            <input
              value={value}
              onChange={e => setValue(e.target.value)}
              aria-label={view.message}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
            />
          )}
        </form>
      )}
    </MxDrawer>
  );
};

export default DialogHost;
