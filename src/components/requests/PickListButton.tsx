import React, { useState } from 'react';
import { ListOrdered } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/requests';

interface PickLine {
  item_id: string;
  item_kind: 'tool' | 'consumable' | 'vehicle';
  name: string;
  reference: string | null;
  quantity: number;
  unit: string | null;
  bin_code: string | null;
  bin_label: string | null;
  bin_order: number | null;
}

interface PickListButtonProps {
  requestId: string;
  title: string;
  subtitle: string;
}

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// Liste de préparation imprimable : les articles dans l'ordre du parcours du dépôt
const PickListButton: React.FC<PickListButtonProps> = ({ requestId, title, subtitle }) => {
  const [busy, setBusy] = useState(false);

  const print = async () => {
    // La fenêtre s'ouvre tout de suite (sinon le navigateur la bloque), puis se remplit
    const win = window.open('', '_blank');
    if (!win) {
      toast.error('Autorisez les fenêtres pour imprimer la liste');
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.from('request_pick_list').select('*').eq('request_id', requestId);
    setBusy(false);
    if (error) {
      win.close();
      toast.error(errorMessage(error));
      return;
    }
    const lines = ((data || []) as PickLine[]).sort((a, b) =>
      (a.bin_code ? 0 : 1) - (b.bin_code ? 0 : 1)
      || (a.bin_order ?? 0) - (b.bin_order ?? 0)
      || (a.bin_code ?? '').localeCompare(b.bin_code ?? '', 'fr', { numeric: true })
      || a.name.localeCompare(b.name, 'fr'));
    const rows = lines.map(l => `<tr>
        <td class="box">☐</td>
        <td class="bin">${l.bin_code ? escape(l.bin_code) : (l.item_kind === 'vehicle' ? 'Parc' : '—')}${l.bin_label ? `<br><small>${escape(l.bin_label)}</small>` : ''}</td>
        <td>${escape(l.name)}${l.reference ? `<br><small>${escape(l.reference)}</small>` : ''}</td>
        <td class="qty">${Number(l.quantity).toLocaleString('fr-CH')} ${escape(l.unit ?? (l.item_kind === 'consumable' ? '' : '×'))}</td>
      </tr>`).join('');
    win.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escape(title)}</title>
      <style>
        body { font-family: Arial, Helvetica, sans-serif; color: #000; margin: 16mm; }
        h1 { font-size: 20px; margin: 0; } p { margin: 4px 0 12px; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th, td { border-bottom: 1px solid #999; padding: 6px 4px; text-align: left; vertical-align: top; }
        th { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
        .box { width: 24px; font-size: 18px; } .bin { width: 90px; font-weight: bold; font-family: monospace; } .qty { width: 90px; text-align: right; white-space: nowrap; }
        small { color: #444; font-weight: normal; }
      </style></head><body>
      <h1>${escape(title)}</h1><p>${escape(subtitle)}</p>
      <table><thead><tr><th></th><th>Emplacement</th><th>Article</th><th class="qty">Quantité</th></tr></thead><tbody>${rows}</tbody></table>
      <p style="margin-top:16px">Préparé par : ______________________ &nbsp; le ____________</p>
      </body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  return <Button variant="outline" icon={<ListOrdered size={16} />} onClick={print} loading={busy}>Liste de préparation</Button>;
};

export default PickListButton;
