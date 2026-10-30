import React, { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import Modal from '../common/Modal';
import { useApp } from '../../contexts/AppContext';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/requests';
import { User } from '../../types';
import DateInput from '../common/DateInput';
import { confirmAction } from '../../lib/confirm';

interface DepartureModalProps {
  user: User | null;
  onClose: () => void;
}

interface PpeRow {
  id: string;
  size: string | null;
  issued_on: string;
  ppe_types: { name: string; returnable: boolean } | null;
}

interface RentalRow {
  id: string;
  description: string;
  rental_company: string;
  end_on: string;
}

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const today = () => new Date().toISOString().slice(0, 10);

// Solde de départ : tout ce que la personne doit rendre, puis fin de son accès
const DepartureModal: React.FC<DepartureModalProps> = ({ user, onClose }) => {
  const { checkouts, equipment, equipmentInstances, refreshData } = useApp();
  const [ppe, setPpe] = useState<PpeRow[]>([]);
  const [rentals, setRentals] = useState<RentalRow[]>([]);
  const [leftOn, setLeftOn] = useState(today());
  const [busy, setBusy] = useState(false);
  const [depositReturned, setDepositReturned] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    const [p, r] = await Promise.all([
      supabase.from('ppe_issues').select('id, size, issued_on, ppe_types(name, returnable)').eq('user_id', user.id).is('returned_on', null),
      supabase.from('rentals').select('id, description, rental_company, end_on').eq('responsible_id', user.id).is('returned_on', null),
    ]);
    setPpe(((p.data || []) as unknown as PpeRow[]).filter(x => x.ppe_types?.returnable));
    setRentals((r.data || []) as RentalRow[]);
  };

  useEffect(() => {
    setLeftOn(user?.leftOn || today());
    setDepositReturned(user?.depositReturnedOn ?? null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user) return null;

  const held = checkouts.filter(c => c.userId === user.id && (c.status === 'active' || c.status === 'overdue'));
  const label = (equipmentId: string, instanceId?: string) => {
    const name = equipment.find(e => e.id === equipmentId)?.name ?? 'Article';
    const qr = instanceId ? equipmentInstances.find(i => i.id === instanceId)?.qrCode : undefined;
    return qr ? `${name} · ${qr}` : name;
  };
  const remaining = held.length + ppe.length + rentals.length;
  const fullName = `${user.first_name} ${user.last_name}`;
  const chf = (n: number) => n.toLocaleString('fr-CH', { style: 'currency', currency: 'CHF' });
  // Caution versée et pas encore rendue : à rembourser à la personne au départ
  const depositDue = user.depositAmount && user.depositAmount > 0 && !depositReturned ? user.depositAmount : 0;

  const returnDeposit = async () => {
    const { error } = await supabase.from('users').update({ deposit_returned_on: today() }).eq('id', user.id);
    if (error) return toast.error(errorMessage(error));
    setDepositReturned(today());
    toast.success(`Caution de ${chf(depositDue)} rendue à ${fullName}`);
    await refreshData();
  };

  const returnPpe = async (row: PpeRow) => {
    const { error } = await supabase.from('ppe_issues').update({ returned_on: today() }).eq('id', row.id);
    if (error) return toast.error(errorMessage(error));
    await load();
  };

  const print = () => {
    const win = window.open('', '_blank');
    if (!win) return toast.error('Autorisez les fenêtres pour imprimer la liste');
    const items = [
      ...held.map(c => `${label(c.equipmentId, c.instanceId)} (sorti le ${new Date(c.checkoutDate).toLocaleDateString('fr-CH')})`),
      ...ppe.map(p => `EPI : ${p.ppe_types?.name ?? ''}${p.size ? ` taille ${p.size}` : ''}`),
      ...rentals.map(r => `Location : ${r.description} (${r.rental_company}), à rendre au loueur le ${new Date(r.end_on).toLocaleDateString('fr-CH')}`),
    ];
    win.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Solde de départ ${escape(fullName)}</title>
      <style>body{font-family:Arial,Helvetica,sans-serif;margin:16mm;color:#000}h1{font-size:20px;margin:0}li{padding:6px 0;border-bottom:1px solid #999;list-style:none;font-size:14px}ul{padding:0}</style>
      </head><body><h1>Solde de départ : ${escape(fullName)}</h1><p>Départ le ${escape(new Date(leftOn).toLocaleDateString('fr-CH'))}</p>
      ${items.length ? `<ul>${items.map(i => `<li>☐ ${escape(i)}</li>`).join('')}</ul>` : '<p>Rien à rendre.</p>'}
      ${depositDue ? `<p>☐ Caution de ${escape(chf(depositDue))} à rembourser à la personne${user.depositPaidOn ? ` (versée le ${escape(new Date(user.depositPaidOn).toLocaleDateString('fr-CH'))})` : ''}</p>` : ''}
      <p style="margin-top:24px">Signature de la personne : ______________________ &nbsp; Magasin : ______________________</p></body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  const close = async () => {
    if (remaining > 0 && !await confirmAction(`${remaining} élément(s) ne sont pas rendus. Clôturer quand même ? Ils resteront au nom de ${fullName}.`)) return;
    setBusy(true);
    const { error } = await supabase.from('users').update({ active: false, left_on: leftOn }).eq('id', user.id);
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(`${fullName} : départ enregistré, accès et badge désactivés`);
    await refreshData();
    onClose();
  };

  return (
    <Modal isOpen onClose={onClose} title={`Départ de ${fullName}`} size="lg">
      <div className="space-y-4">
        <p className={`text-sm font-semibold ${remaining ? 'text-warning-700 dark:text-warning-300' : 'text-success-700 dark:text-success-300'}`}>
          {remaining ? `${remaining} élément${remaining > 1 ? 's' : ''} à rendre avant le départ` : 'Rien à rendre : le départ peut être clôturé.'}
        </p>

        {held.length > 0 && (
          <section>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Matériel emprunté ({held.length})</h3>
            <ul className="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              {held.map(c => (
                <li key={c.id} className="py-1.5 flex justify-between gap-2 text-gray-800 dark:text-gray-200">
                  <span className="truncate">{label(c.equipmentId, c.instanceId)}</span>
                  <span className={`shrink-0 text-xs ${new Date(c.dueDate).getTime() < Date.now() ? 'text-danger-700 dark:text-danger-300 font-semibold' : 'text-gray-500'}`}>
                    depuis le {new Date(c.checkoutDate).toLocaleDateString('fr-CH')}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Les retours se font au comptoir (scan du badge puis des articles).</p>
          </section>
        )}

        {ppe.length > 0 && (
          <section>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">EPI à rendre ({ppe.length})</h3>
            <ul className="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              {ppe.map(p => (
                <li key={p.id} className="py-1.5 flex items-center justify-between gap-2 text-gray-800 dark:text-gray-200">
                  <span>{p.ppe_types?.name}{p.size ? ` · taille ${p.size}` : ''}</span>
                  <Button size="sm" variant="outline" onClick={() => returnPpe(p)}>Rendu</Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {rentals.length > 0 && (
          <section>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Locations à son nom ({rentals.length})</h3>
            <ul className="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              {rentals.map(r => (
                <li key={r.id} className="py-1.5 text-gray-800 dark:text-gray-200">{r.description} · {r.rental_company} · à rendre le {new Date(r.end_on).toLocaleDateString('fr-CH')}</li>
              ))}
            </ul>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">À rendre au loueur ou à confier à un autre responsable (page Locations).</p>
          </section>
        )}

        {user.depositAmount ? (
          <section className="rounded-md border border-gray-200 dark:border-gray-700 p-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-gray-800 dark:text-gray-200">
              Caution de <strong>{chf(user.depositAmount)}</strong>
              {user.depositPaidOn ? ` versée le ${new Date(user.depositPaidOn).toLocaleDateString('fr-CH')}` : ''}
              {depositReturned ? ` · rendue le ${new Date(depositReturned).toLocaleDateString('fr-CH')}` : ' · à rembourser au départ'}
            </span>
            {!depositReturned && <Button size="sm" variant="outline" onClick={returnDeposit}>Caution rendue</Button>}
          </section>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-[12rem_1fr] items-end">
          <div>
            <label htmlFor="left-on" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date de départ</label>
            <DateInput id="left-on" value={leftOn} onChange={e => setLeftOn(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100" />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" icon={<Printer size={16} />} onClick={print}>Imprimer la liste</Button>
            <Button variant="danger" onClick={close} loading={busy}>Clôturer le départ</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default DepartureModal;
