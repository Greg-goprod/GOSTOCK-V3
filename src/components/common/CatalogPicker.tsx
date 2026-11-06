import React, { useEffect, useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { CatalogProduct, searchCatalog } from '../../lib/catalog';
import { errorMessage } from '../../lib/requests';

interface CatalogPickerProps {
  onSelect: (product: CatalogProduct) => void;
  family?: CatalogProduct['family'];
}

// Recherche dans le catalogue fournisseur pour pré-remplir une fiche
const CatalogPicker: React.FC<CatalogPickerProps> = ({ onSelect, family }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setError('');
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const found = await searchCatalog(query, family);
        if (!cancelled) {
          setResults(found);
          setError('');
        }
      } catch (e) {
        if (!cancelled) setError(errorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, family]);

  const pick = (product: CatalogProduct) => {
    onSelect(product);
    setQuery('');
    setResults([]);
  };

  return (
    <div className="rounded-lg border border-primary-200 dark:border-primary-900 bg-primary-50/60 dark:bg-primary-950/40 p-3 space-y-2">
      <label htmlFor="catalog-search" className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
        <BookOpen size={16} aria-hidden="true" className="text-primary-600 dark:text-primary-300" />
        Remplir depuis le catalogue
      </label>
      <div className="relative">
        <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          id="catalog-search"
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Référence, nom ou code EAN (ex. DHP486, meuleuse 125)"
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-gray-100"
          autoComplete="off"
        />
      </div>

      {loading && <p className="text-xs text-gray-600 dark:text-gray-400">Recherche…</p>}
      {error && <p className="text-xs text-tone-danger">{error}</p>}
      {!loading && !error && query.trim().length >= 2 && results.length === 0 && (
        <p className="text-xs text-gray-600 dark:text-gray-400">Aucun produit trouvé. Le catalogue s'importe dans Paramètres.</p>
      )}

      {results.length > 0 && (
        <ul className="max-h-72 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          {results.map(product => (
            <li key={product.id}>
              <button
                type="button"
                onClick={() => pick(product)}
                className="w-full flex items-center gap-3 px-3 py-2 min-h-[44px] text-left hover:bg-primary-50 dark:hover:bg-primary-950 focus-visible:bg-primary-50 dark:focus-visible:bg-primary-950"
              >
                {product.image_url ? (
                  <img src={product.image_url} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded bg-white object-contain" />
                ) : (
                  <span className="h-10 w-10 shrink-0 rounded bg-gray-100 dark:bg-gray-700" />
                )}
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{product.name}</span>
                  <span className="block font-mono text-xs text-gray-600 dark:text-gray-400 truncate">
                    {product.reference}
                    {product.short_title ? ` · ${product.short_title}` : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CatalogPicker;
