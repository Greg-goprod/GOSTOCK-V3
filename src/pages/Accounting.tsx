import React, { useEffect, useMemo, useState } from 'react';
import { Download, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { errorMessage } from '../lib/requests';
import { downloadWorkbook } from '../lib/excel';
import { confirmAction } from '../lib/confirm';
import PageTitle from '../components/common/PageTitle';

interface Depreciation {
  equipment_id: string;
  name: string;
  article_number: string | null;
  since: string;
  value: number;
  years: number;
}

interface CostLine {
  source: 'consumable' | 'tool' | 'rental';
  site: string;
  at: string;
  amount: number;
}

interface Loss {
  occurred_at: string;
  decision: string;
  cost: number | null;
  equipment: { name: string; purchase_price: number | null } | null;
}

const ACCOUNT_LABELS = {
  depreciation_debit: 'Amortissements (débit)',
  depreciation_credit: 'Outillage, machines (crédit)',
  consumption_debit: 'Charges de matériel (débit)',
  consumption_credit: 'Stock de consommables (crédit)',
  rental_debit: 'Locations de matériel (débit)',
  rental_credit: 'Fournisseurs (crédit)',
  loss_debit: 'Pertes sur matériel (débit)',
  loss_credit: 'Outillage, machines (crédit)',
};
type Accounts = Record<keyof typeof ACCOUNT_LABELS, string>;
// Plan comptable PME suisse : comptes usuels, à confirmer par la fiduciaire
const DEFAULT_ACCOUNTS: Accounts = {
  depreciation_debit: '6800', depreciation_credit: '1500',
  consumption_debit: '4000', consumption_credit: '1200',
  rental_debit: '6100', rental_credit: '2000',
  loss_debit: '6800', loss_credit: '1500',
};

const DAY = 86400000;
const round = (n: number) => Math.round(n * 100) / 100;
const chf = (n: number) => n.toLocaleString('fr-CH', { style: 'currency', currency: 'CHF' });
const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';

// Part de l'amortissement linéaire tombant dans l'année, et valeur restante au 31.12
const yearShare = (d: Depreciation, year: number) => {
  const since = new Date(d.since).getTime();
  const end = since + d.years * 365.25 * DAY;
  const from = Math.max(since, new Date(year, 0, 1).getTime());
  const to = Math.min(end, new Date(year + 1, 0, 1).getTime());
  const annual = d.value / d.years;
  const amount = to > from ? annual * (to - from) / (365.25 * DAY) : 0;
  const elapsed = Math.max(0, Math.min(end, new Date(year + 1, 0, 1).getTime()) - since) / (365.25 * DAY);
  return { amount: round(amount), bookValue: round(Math.max(0, d.value - annual * elapsed)) };
};

// Amortissement des outils et écritures pour la fiduciaire (Excel générique)
const Accounting: React.FC = () => {
  const { can } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [items, setItems] = useState<Depreciation[]>([]);
  const [costs, setCosts] = useState<CostLine[]>([]);
  const [losses, setLosses] = useState<Loss[]>([]);
  const [accounts, setAccounts] = useState<Accounts>(DEFAULT_ACCOUNTS);

  useEffect(() => {
    supabase.from('equipment_depreciation').select('equipment_id, name, article_number, since, value, years')
      .then(({ data, error }) => {
        if (error) toast.error(errorMessage(error));
        setItems(((data || []) as Depreciation[]).map(d => ({ ...d, value: Number(d.value), years: Number(d.years) })));
      });
    supabase.from('system_settings').select('value').eq('id', 'accounting_accounts').maybeSingle()
      .then(({ data }) => {
        try {
          if (data?.value) setAccounts({ ...DEFAULT_ACCOUNTS, ...JSON.parse(data.value) });
        } catch { /* réglage illisible : comptes par défaut */ }
      });
  }, []);

  useEffect(() => {
    const from = new Date(year, 0, 1).toISOString();
    const to = new Date(year + 1, 0, 1).toISOString();
    Promise.all([
      supabase.from('site_cost_lines').select('source, site, at, amount').in('source', ['consumable', 'rental']).gte('at', from).lt('at', to),
      supabase.from('incidents').select('occurred_at, decision, cost, equipment(name, purchase_price)').gte('occurred_at', from).lt('occurred_at', to),
    ]).then(([c, l]) => {
      setCosts(((c.data || []) as CostLine[]).map(x => ({ ...x, amount: Number(x.amount) })));
      setLosses(((l.data || []) as unknown as Loss[]).filter(x => ['written_off', 'replaced'].includes(x.decision)));
    });
  }, [year]);

  const rows = useMemo(() => items.map(d => ({ ...d, ...yearShare(d, year) }))
    .filter(r => r.amount > 0 || r.bookValue > 0)
    .sort((a, b) => b.amount - a.amount), [items, year]);
  const totalDepreciation = round(rows.reduce((s, r) => s + r.amount, 0));
  const totalBook = round(rows.reduce((s, r) => s + r.bookValue, 0));
  const lossValue = (l: Loss) => Number(l.cost ?? l.equipment?.purchase_price ?? 0);

  const saveAccounts = async () => {
    const { error } = await supabase.from('system_settings').upsert({ id: 'accounting_accounts', value: JSON.stringify(accounts), description: 'Comptes utilisés pour l\'export comptable' });
    if (error) return toast.error(errorMessage(error));
    toast.success('Comptes enregistrés');
  };

  const [sending, setSending] = useState(false);

  // Écritures de l'année : amortissements, consommables et locations par chantier et par mois, pertes
  const buildEntries = () => {
    const entries: { Date: string; Pièce: string; Libellé: string; Débit: string; Crédit: string; 'Montant CHF': number; Chantier: string }[] = [];
    const yearEnd = `31.12.${year}`;
    let n = 1;
    const piece = () => `GOMAT-${year}-${String(n++).padStart(4, '0')}`;
    for (const r of rows.filter(x => x.amount > 0)) {
      entries.push({ Date: yearEnd, Pièce: piece(), Libellé: `Amortissement ${r.name}${r.article_number ? ` (${r.article_number})` : ''}`, Débit: accounts.depreciation_debit, Crédit: accounts.depreciation_credit, 'Montant CHF': r.amount, Chantier: '' });
    }
    // Consommables et locations : une écriture par chantier et par mois
    const grouped = new Map<string, { source: string; site: string; month: string; amount: number }>();
    for (const c of costs) {
      const d = new Date(c.at);
      const month = `${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
      const key = `${c.source}|${c.site.toLowerCase()}|${month}`;
      const g = grouped.get(key) ?? { source: c.source, site: c.site, month, amount: 0 };
      g.amount += c.amount;
      grouped.set(key, g);
    }
    for (const g of [...grouped.values()].sort((a, b) => a.month.localeCompare(b.month))) {
      if (round(g.amount) === 0) continue;
      const [mm, yyyy] = g.month.split('.');
      const last = new Date(Number(yyyy), Number(mm), 0).getDate();
      entries.push({
        Date: `${String(last).padStart(2, '0')}.${mm}.${yyyy}`, Pièce: piece(),
        Libellé: `${g.source === 'rental' ? 'Locations' : 'Consommables'} ${g.month} · ${g.site}`,
        Débit: g.source === 'rental' ? accounts.rental_debit : accounts.consumption_debit,
        Crédit: g.source === 'rental' ? accounts.rental_credit : accounts.consumption_credit,
        'Montant CHF': round(g.amount), Chantier: g.site,
      });
    }
    for (const l of losses) {
      const d = new Date(l.occurred_at);
      const date = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
      entries.push({ Date: date, Pièce: piece(), Libellé: `Perte / casse ${l.equipment?.name ?? ''}`, Débit: accounts.loss_debit, Crédit: accounts.loss_credit, 'Montant CHF': round(lossValue(l)), Chantier: '' });
    }
    return entries.filter(e => e['Montant CHF'] > 0);
  };

  const exportExcel = () => {
    const entries = buildEntries();
    downloadWorkbook([
      { name: 'Écritures', rows: entries, widths: [12, 18, 50, 8, 8, 14, 25] },
      {
        name: 'Amortissements',
        rows: rows.map(r => ({
          Outil: r.name, Article: r.article_number ?? '', 'Mis en service': new Date(r.since).toLocaleDateString('fr-CH'),
          'Valeur d\'achat': r.value, 'Durée (ans)': r.years, [`Amortissement ${year}`]: r.amount, [`Valeur au 31.12.${year}`]: r.bookValue,
        })),
        widths: [35, 16, 14, 14, 10, 18, 18],
      },
    ], `GO-Mat_comptabilite_${year}.xlsx`);
  };

  // Fichier texte pour l'import des écritures d'Abacus (séparateur « ; », une écriture par ligne)
  const exportAbacus = () => {
    const entries = buildEntries();
    if (!entries.length) return toast.error('Aucune écriture pour cette année');
    const clean = (v: string) => v.replace(/[;\r\n]+/g, ' ').trim();
    const lines = [
      'Datum;Beleg;Soll;Haben;Betrag;Text;KST',
      ...entries.map(e => [e.Date, e.Pièce, e.Débit, e.Crédit, e['Montant CHF'].toFixed(2), clean(e.Libellé), clean(e.Chantier)].join(';')),
    ];
    const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GO-Mat_Abacus_${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Écritures envoyées directement dans bexio (jeton bexio saisi dans Supabase)
  const sendBexio = async () => {
    const entries = buildEntries();
    if (!entries.length) return toast.error('Aucune écriture pour cette année');
    if (!await confirmAction(`Envoyer ${entries.length} écriture(s) de ${year} dans bexio ? Ne le faites qu'une fois par année, sinon elles seront en double.`)) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke('bexio-export', {
      body: {
        entries: entries.map(e => {
          const [dd, mm, yyyy] = e.Date.split('.');
          return { date: `${yyyy}-${mm}-${dd}`, reference: e.Pièce, debit: e.Débit, credit: e.Crédit, amount: e['Montant CHF'], description: e.Libellé };
        }),
      },
    });
    setSending(false);
    if (error) {
      // Message d'erreur de la fonction (comptes absents, jeton manquant…) plutôt que le statut HTTP
      const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
      return toast.error(detail?.error ?? errorMessage(error), { duration: 8000 });
    }
    if (data?.failed) toast.error(`${data.sent} écriture(s) envoyée(s), ${data.failed} refusée(s) par bexio : ${data.errors?.[0] ?? ''}`, { duration: 10000 });
    else toast.success(`${data?.sent ?? 0} écriture(s) envoyée(s) dans bexio`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <PageTitle>Comptabilité</PageTitle>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Amortissement linéaire des outils et écritures de l'année, en Excel pour la fiduciaire.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={year} onChange={e => setYear(Number(e.target.value))} aria-label="Année" className={`${inputClass} w-auto`}>
            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <Button icon={<Download size={16} />} onClick={exportExcel}>Export Excel</Button>
          <Button variant="outline" icon={<Download size={16} />} onClick={exportAbacus}>Fichier Abacus</Button>
          {can('settings') && <Button variant="outline" icon={<Send size={16} />} onClick={sendBexio} loading={sending}>Envoyer dans bexio</Button>}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          [`Amortissement ${year}`, chf(totalDepreciation)],
          [`Valeur des outils au 31.12.${year}`, chf(totalBook)],
          [`Consommables ${year}`, chf(costs.filter(c => c.source === 'consumable').reduce((s, c) => s + c.amount, 0))],
          [`Pertes et casse ${year}`, chf(losses.reduce((s, l) => s + lossValue(l), 0))],
        ].map(([label, value]) => (
          <div key={label} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="font-mono text-xl font-semibold text-gray-900 dark:text-white">{value}</p>
            <p className="text-sm text-gray-600 dark:text-gray-300">{label}</p>
          </div>
        ))}
      </div>

      <section className="rounded-lg bg-white dark:bg-gray-800 shadow overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50 text-left text-xs uppercase tracking-wide text-gray-600 dark:text-gray-300">
            <tr>
              <th className="px-4 py-2">Outil</th>
              <th className="px-4 py-2">Mis en service</th>
              <th className="px-4 py-2 text-right">Valeur d'achat</th>
              <th className="px-4 py-2 text-right">Durée</th>
              <th className="px-4 py-2 text-right">Amorti en {year}</th>
              <th className="px-4 py-2 text-right">Valeur au 31.12</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-gray-900 dark:text-gray-100">
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-4 text-gray-600 dark:text-gray-400">Aucun outil avec un prix d'achat. Saisis prix et date d'achat dans les fiches.</td></tr>}
            {rows.slice(0, 300).map(r => (
              <tr key={r.equipment_id}>
                <td className="px-4 py-2">{r.name}{r.article_number ? <span className="font-mono text-xs text-gray-500"> · {r.article_number}</span> : null}</td>
                <td className="px-4 py-2">{new Date(r.since).toLocaleDateString('fr-CH')}</td>
                <td className="px-4 py-2 text-right font-mono">{chf(r.value)}</td>
                <td className="px-4 py-2 text-right font-mono">{r.years} ans</td>
                <td className="px-4 py-2 text-right font-mono">{chf(r.amount)}</td>
                <td className="px-4 py-2 text-right font-mono">{chf(r.bookValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg bg-white dark:bg-gray-800 shadow p-4 space-y-3">
        <h2 className="font-bold text-gray-900 dark:text-white">Comptes de l'export</h2>
        <p className="text-xs text-gray-600 dark:text-gray-400">Comptes usuels du plan comptable PME suisse : fais-les confirmer par ta fiduciaire.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(ACCOUNT_LABELS) as (keyof Accounts)[]).map(key => (
            <div key={key}>
              <label htmlFor={`acc-${key}`} className="block text-xs text-gray-600 dark:text-gray-400 mb-1">{ACCOUNT_LABELS[key]}</label>
              <input id={`acc-${key}`} value={accounts[key]} onChange={e => setAccounts({ ...accounts, [key]: e.target.value })} disabled={!can('settings')} className={`${inputClass} font-mono`} />
            </div>
          ))}
        </div>
        {can('settings') && <Button variant="outline" onClick={saveAccounts}>Enregistrer les comptes</Button>}
      </section>
    </div>
  );
};

export default Accounting;
