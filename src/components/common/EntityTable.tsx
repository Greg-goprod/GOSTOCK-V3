import React from 'react';

// Vue « Liste » commune aux pages d'entités (pendant de la vue « Cartes ») : un tableau compact, une ligne par élément.
// Même règle que Mannyx : toute page de liste d'entités propose la bascule Cartes / Liste.
export interface EntityColumn<T> {
  id: string;
  label: string;
  render: (item: T) => React.ReactNode;
  className?: string;
  // Masquée sur petit écran
  hideOnMobile?: boolean;
}

interface EntityTableProps<T> {
  items: T[];
  getKey: (item: T) => string;
  columns: EntityColumn<T>[];
  caption: string;
  onOpen?: (item: T) => void;
  rowClassName?: (item: T) => string;
}

export function EntityTable<T>({ items, getKey, columns, caption, onOpen, rowClassName }: EntityTableProps<T>) {
  return (
    <div className="rounded-lg bg-white dark:bg-gray-800 shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 table-compact">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {columns.map(c => (
                <th key={c.id} scope="col" className={`px-3 py-2 text-left text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider ${c.hideOnMobile ? 'hidden md:table-cell' : ''} ${c.className ?? ''}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {items.map(item => (
              <tr key={getKey(item)}
                className={`${onOpen ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50' : ''} ${rowClassName?.(item) ?? ''}`}
                onClick={onOpen ? () => onOpen(item) : undefined}>
                {columns.map(c => (
                  <td key={c.id} className={`px-3 py-2 text-sm text-gray-900 dark:text-gray-100 align-top ${c.hideOnMobile ? 'hidden md:table-cell' : ''} ${c.className ?? ''}`}>
                    {c.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default EntityTable;
