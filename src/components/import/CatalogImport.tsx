import React, { useEffect, useState } from 'react';
import { BookOpen, Download, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import { supabase } from '../../lib/supabase';
import { CatalogRow, importCatalog, parseCatalogJson } from '../../lib/catalog';
import { CatalogDiff, PriceListRow, applyPriceList, diffCatalog, parsePriceListExcel, updateLinkedPurchasePrices } from '../../lib/catalogUpdate';
import { downloadWorkbook } from '../../lib/excel';
import { errorMessage } from '../../lib/requests';
import { Supplier } from '../../types';

interface CatalogImportProps {
  suppliers: Supplier[];
  onSuppliersChanged: () => Promise<void> | void;
}

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';

// Import d'un catalogue fournisseur (JSON) dans catalog_products, par paquets
const CatalogImport: React.FC<CatalogImportProps> = ({ suppliers, onSuppliersChanged }) => {
  const [rows, setRows] = useState<(CatalogRow | PriceListRow)[]>([]);
  // Liste de prix Excel : seuls nom et prix sont mis à jour (le reste de la fiche est gardé)
  const [priceList, setPriceList] = useState(false);
  const [diff, setDiff] = useState<CatalogDiff | null>(null);
  const [diffing, setDiffing] = useState(false);
  const [updateLinked, setUpdateLinked] = useState(true);
  const [fileName, setFileName] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [newSupplierName, setNewSupplierName] = useState('Makita');
  const [progress, setProgress] = useState<number | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const loadCounts = async () => {
    if (!supabase) return;
    const result: Record<string, number> = {};
    for (const supplier of suppliers) {
      const { count } = await supabase
        .from('catalog_products')
        .select('id', { count: 'exact', head: true })
        .eq('supplier_id', supplier.id);
      if (count) result[supplier.id] = count;
    }
    setCounts(result);
  };

  useEffect(() => {
    loadCounts();
    // Proposer le fournisseur dont le nom ressemble au fichier ou au catalogue déjà importé
    if (!supplierId) {
      const makita = suppliers.find(s => s.name.toLowerCase().includes('makita'));
      if (makita) setSupplierId(makita.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suppliers]);

  // Comparaison avec le catalogue déjà importé dès que fichier et fournisseur sont choisis
  useEffect(() => {
    setDiff(null);
    if (!rows.length || !supplierId || !counts[supplierId]) return;
    setDiffing(true);
    diffCatalog(rows, supplierId).then(setDiff).catch(error => toast.error(errorMessage(error))).finally(() => setDiffing(false));
  }, [rows, supplierId, counts]);

  const readFile = async (file: File) => {
    try {
      const excel = /\.xlsx$/i.test(file.name);
      const parsed = excel ? await parsePriceListExcel(file) : parseCatalogJson(await file.text());
      setPriceList(excel);
      setRows(parsed);
      setFileName(file.name);
      if (!parsed.length) toast.error('Aucun produit dans ce fichier');
    } catch (error) {
      setRows([]);
      setFileName('');
      toast.error(errorMessage(error));
    }
  };

  const run = async () => {
    if (!supabase || !rows.length) return;
    try {
      let targetId = supplierId;
      if (!targetId) {
        const name = newSupplierName.trim();
        if (!name) {
          toast.error('Choisissez ou nommez le fournisseur');
          return;
        }
        const { data, error } = await supabase.from('suppliers').insert({ name }).select('id').single();
        if (error) throw error;
        targetId = data.id;
        setSupplierId(targetId);
        await onSuppliersChanged();
      }
      setProgress(0);
      if (priceList) await applyPriceList(rows as PriceListRow[], targetId, setProgress);
      else await importCatalog(rows as CatalogRow[], targetId, setProgress);
      let linked = 0;
      if (updateLinked && diff?.priceChanged.length) linked = await updateLinkedPurchasePrices(diff.priceChanged, targetId);
      toast.success(`${rows.length} produits importés dans le catalogue${linked ? ` · prix d'achat mis à jour sur ${linked} fiche(s)` : ''}`);
      setDiff(null);
      setRows([]);
      setFileName('');
      await loadCounts();
    } catch (error) {
      toast.error(`Import interrompu : ${errorMessage(error)}`);
    } finally {
      setProgress(null);
    }
  };

  const machines = rows.filter(r => 'family' in r && r.family === 'machine').length;

  const exportDiff = () => {
    if (!diff) return;
    const supplier = suppliers.find(s => s.id === supplierId)?.name ?? 'catalogue';
    downloadWorkbook([
      { name: 'Prix modifiés', rows: diff.priceChanged.map(c => ({ Référence: c.reference, Désignation: c.name, 'Ancien prix': c.oldPrice ?? '', 'Nouveau prix': c.newPrice ?? '', 'Écart %': c.oldPrice ? Math.round(((c.newPrice ?? 0) / c.oldPrice - 1) * 1000) / 10 : '' })), widths: [18, 45, 12, 12, 10] },
      { name: 'Nouveaux', rows: diff.added.map(c => ({ Référence: c.reference, Désignation: c.name, Prix: c.newPrice ?? '' })), widths: [18, 45, 12] },
      { name: 'Retirés du fichier', rows: diff.missing.map(c => ({ Référence: c.reference, Désignation: c.name, 'Dernier prix': c.oldPrice ?? '' })), widths: [18, 45, 12] },
      { name: 'Renommés', rows: diff.renamed.map(c => ({ Référence: c.reference, 'Ancien nom': c.oldName ?? '', 'Nouveau nom': c.name })), widths: [18, 45, 45] },
    ], `GO-Mat_changements_${supplier}.xlsx`);
  };
  const running = progress !== null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Le catalogue sert de référence : il ne crée pas de stock. Quand vous ajoutez un outil ou un consommable,
        cherchez-le par référence, nom ou code EAN et la fiche se remplit toute seule. Réimporter un fichier met les fiches à jour.
      </p>

      {Object.keys(counts).length > 0 && (
        <ul className="text-sm text-gray-800 dark:text-gray-200 space-y-1">
          {suppliers.filter(s => counts[s.id]).map(s => (
            <li key={s.id} className="flex items-center gap-2">
              <BookOpen size={14} aria-hidden="true" className="text-primary-600 dark:text-primary-300" />
              {s.name} : <span className="font-mono">{counts[s.id].toLocaleString('fr-CH')}</span> produits
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="catalog-file" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Fichier catalogue (JSON) ou liste de prix (Excel)
          </label>
          <input
            id="catalog-file"
            type="file"
            accept=".json,application/json,.xlsx"
            disabled={running}
            onChange={e => e.target.files?.[0] && readFile(e.target.files[0])}
            className="block w-full text-sm text-gray-700 dark:text-gray-300 file:mr-3 file:rounded-md file:border-0 file:bg-primary-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-primary-700"
          />
          {fileName && (
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              {fileName} : {rows.length.toLocaleString('fr-CH')} produits{priceList ? ' (liste de prix : nom et prix mis à jour)' : ` (${machines} machines, ${rows.length - machines} accessoires)`}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="catalog-supplier" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Fournisseur
          </label>
          <select id="catalog-supplier" value={supplierId} onChange={e => setSupplierId(e.target.value)} disabled={running} className={inputClass}>
            <option value="">Nouveau fournisseur…</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {!supplierId && (
            <input
              aria-label="Nom du nouveau fournisseur"
              value={newSupplierName}
              onChange={e => setNewSupplierName(e.target.value)}
              disabled={running}
              className={`${inputClass} mt-2`}
              placeholder="Nom du fournisseur"
            />
          )}
        </div>
      </div>

      {diffing && <p className="text-sm text-gray-600 dark:text-gray-400">Comparaison avec le catalogue actuel…</p>}
      {diff && (
        <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Changements : {diff.priceChanged.length} prix · {diff.added.length} nouveaux · {diff.renamed.length} renommés · {diff.missing.length} absents du fichier · {diff.unchanged} inchangés
            </p>
            <Button size="sm" variant="outline" icon={<Download size={14} />} onClick={exportDiff}>Liste des changements</Button>
          </div>
          {diff.priceChanged.length > 0 && (
            <ul className="max-h-56 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              {[...diff.priceChanged].sort((a, b) => Math.abs((b.newPrice ?? 0) - (b.oldPrice ?? 0)) - Math.abs((a.newPrice ?? 0) - (a.oldPrice ?? 0))).slice(0, 100).map(c => {
                const up = (c.newPrice ?? 0) > (c.oldPrice ?? 0);
                const pct = c.oldPrice ? ((c.newPrice ?? 0) / c.oldPrice - 1) * 100 : null;
                return (
                  <li key={c.reference} className="py-1 flex justify-between gap-2 text-gray-800 dark:text-gray-200">
                    <span className="truncate"><span className="font-mono text-xs text-gray-500">{c.reference}</span> {c.name}</span>
                    <span className={`font-mono shrink-0 ${up ? 'text-tone-danger' : 'text-tone-success'}`}>
                      {c.oldPrice?.toFixed(2) ?? '—'} → {c.newPrice?.toFixed(2)}{pct !== null ? ` (${up ? '+' : ''}${pct.toFixed(1)} %)` : ''}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {diff.missing.length > 0 && (
            <p className="text-xs text-gray-600 dark:text-gray-400">Les {diff.missing.length} produits absents du fichier restent dans le catalogue (fiches d'outils intactes).</p>
          )}
          {diff.priceChanged.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
              <input type="checkbox" checked={updateLinked} onChange={e => setUpdateLinked(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary-600" />
              Reporter les nouveaux prix sur le prix d'achat des articles créés depuis le catalogue
            </label>
          )}
        </div>
      )}

      {running && (
        <div>
          <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={rows.length} aria-valuenow={progress}>
            <div className="h-full bg-primary-600 transition-all" style={{ width: `${(progress / Math.max(1, rows.length)) * 100}%` }} />
          </div>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
            {progress.toLocaleString('fr-CH')} / {rows.length.toLocaleString('fr-CH')} produits envoyés…
          </p>
        </div>
      )}

      <Button variant="primary" icon={<Upload size={16} />} onClick={run} disabled={!rows.length || running}>
        {running ? 'Import en cours…' : 'Importer le catalogue'}
      </Button>
    </div>
  );
};

export default CatalogImport;
