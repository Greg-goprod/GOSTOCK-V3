import React, { useEffect, useState } from 'react';
import { BookOpen, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import { supabase } from '../../lib/supabase';
import { CatalogRow, importCatalog, parseCatalogJson } from '../../lib/catalog';
import { errorMessage } from '../../lib/requests';
import { Supplier } from '../../types';

interface CatalogImportProps {
  suppliers: Supplier[];
  onSuppliersChanged: () => Promise<void> | void;
}

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';

// Import d'un catalogue fournisseur (JSON) dans catalog_products, par paquets
const CatalogImport: React.FC<CatalogImportProps> = ({ suppliers, onSuppliersChanged }) => {
  const [rows, setRows] = useState<CatalogRow[]>([]);
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

  const readFile = async (file: File) => {
    try {
      const parsed = parseCatalogJson(await file.text());
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
      await importCatalog(rows, targetId, setProgress);
      toast.success(`${rows.length} produits importés dans le catalogue`);
      setRows([]);
      setFileName('');
      await loadCounts();
    } catch (error) {
      toast.error(`Import interrompu : ${errorMessage(error)}`);
    } finally {
      setProgress(null);
    }
  };

  const machines = rows.filter(r => r.family === 'machine').length;
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
            Fichier catalogue (JSON)
          </label>
          <input
            id="catalog-file"
            type="file"
            accept=".json,application/json"
            disabled={running}
            onChange={e => e.target.files?.[0] && readFile(e.target.files[0])}
            className="block w-full text-sm text-gray-700 dark:text-gray-300 file:mr-3 file:rounded-md file:border-0 file:bg-primary-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-primary-700"
          />
          {fileName && (
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              {fileName} : {rows.length.toLocaleString('fr-CH')} produits ({machines} machines, {rows.length - machines} accessoires)
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
        {running ? 'IMPORT EN COURS…' : 'IMPORTER LE CATALOGUE'}
      </Button>
    </div>
  );
};

export default CatalogImport;
