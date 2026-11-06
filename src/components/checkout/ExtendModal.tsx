import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { DateTimeInput } from '../common/DateInput';
import { supabase } from '../../lib/supabase';
import { errorMessage, toLocalInput } from '../../lib/requests';
import { useApp } from '../../contexts/AppContext';

export interface ExtendLine { id: string; name: string; due: string }

interface ExtendModalProps {
  onClose: () => void;
  onDone?: () => void | Promise<void>;
  // Magasin : prolonge les sorties choisies (ou toute la demande si requestId) ; collaborateur : envoie une demande
  mode: 'staff' | 'collab';
  lines: ExtendLine[];
  requestId?: string;
  title?: string;
}

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

// Nouvelle date de retour proposée : 7 jours après le retour prévu le plus tardif, à 17 h
const suggest = (lines: ExtendLine[]) => {
  const base = Math.max(Date.now(), ...lines.map(l => new Date(l.due).getTime()));
  const d = new Date(base + 7 * 86400000);
  d.setHours(17, 0, 0, 0);
  return toLocalInput(d);
};

// Prolongation d'un emprunt, applicable à ce qui reste après un retour partiel (outils et véhicule)
const ExtendModal: React.FC<ExtendModalProps> = ({ onClose, onDone, mode, lines, requestId, title }) => {
  const { refreshData } = useApp();
  const [selected, setSelected] = useState<Record<string, boolean>>(() => Object.fromEntries(lines.map(l => [l.id, true])));
  const [until, setUntil] = useState(() => suggest(lines));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const ids = useMemo(() => lines.filter(l => selected[l.id]).map(l => l.id), [lines, selected]);
  const latest = Math.max(...lines.map(l => new Date(l.due).getTime()));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const target = until ? new Date(until) : null;
    if (!target || Number.isNaN(target.getTime())) return toast.error('Choisis la nouvelle date de retour');
    if (target.getTime() <= Date.now()) return toast.error('La nouvelle date de retour doit être à venir');
    if (mode === 'staff' && !requestId && ids.length === 0) return toast.error('Coche au moins un équipement');
    setSaving(true);
    const { error } = mode === 'collab'
      ? await supabase.rpc('request_extension', { p_new_due: target.toISOString(), p_reason: note || null, p_checkout_id: requestId ? null : lines[0].id, p_request_id: requestId ?? null })
      : requestId
        ? await supabase.rpc('extend_request', { p_request_id: requestId, p_new_end: target.toISOString(), p_note: note || null })
        : await supabase.rpc('extend_checkouts', { p_checkout_ids: ids, p_new_due: target.toISOString(), p_note: note || null });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(mode === 'collab' ? 'Demande envoyée au magasin' : `Prolongé jusqu'au ${target.toLocaleDateString('fr-CH')}`);
    await refreshData();
    await onDone?.();
    onClose();
  };

  return (
    <Modal isOpen onClose={onClose} title={title ?? (mode === 'collab' ? 'Demander une prolongation' : 'Prolonger')} size="md">
      <form onSubmit={submit} className="space-y-4">
        {mode === 'staff' && !requestId && lines.length > 1 && (
          <fieldset>
            <legend className={labelClass}>Équipements à prolonger (ce qui reste dehors)</legend>
            <ul className="space-y-1.5">
              {lines.map(l => (
                <li key={l.id}>
                  <label className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-100">
                    <input type="checkbox" checked={!!selected[l.id]} onChange={e => setSelected(s => ({ ...s, [l.id]: e.target.checked }))} />
                    <span className="flex-1 truncate">{l.name}</span>
                    <span className="text-xs text-gray-600 dark:text-gray-400">{`retour prévu le ${new Date(l.due).toLocaleDateString('fr-CH')}`}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}
        {(lines.length === 1 || mode === 'collab') && (
          <p className="text-sm text-gray-800 dark:text-gray-200">
            {lines[0]?.name}{lines.length > 1 ? ` et ${lines.length - 1} autre(s)` : ''} : {`retour prévu le ${new Date(latest).toLocaleDateString('fr-CH')}`}
          </p>
        )}
        {requestId && mode === 'staff' && <p className="text-sm text-gray-700 dark:text-gray-300">Seul ce qui n'est pas encore rendu est prolongé (outils et véhicule).</p>}
        <div>
          <label htmlFor="ext-until" className={labelClass}>Nouveau retour le</label>
          <DateTimeInput id="ext-until" value={until} onChange={e => setUntil(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="ext-note" className={labelClass}>{mode === 'collab' ? 'Pourquoi ? (facultatif)' : 'Motif (facultatif)'}</label>
          <input id="ext-note" value={note} onChange={e => setNote(e.target.value)} className={inputClass} placeholder="ex. le chantier prend du retard" />
        </div>
        {mode === 'collab' && <p className="text-xs text-gray-600 dark:text-gray-400">Le magasin reçoit ta demande et te répond en prolongeant l'emprunt, sauf si le matériel est déjà réservé.</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button type="submit" loading={saving}>{mode === 'collab' ? 'Envoyer la demande' : 'Prolonger'}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default ExtendModal;
