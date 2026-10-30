import React, { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer } from 'lucide-react';
import Button from '../components/common/Button';
import { useApp } from '../contexts/AppContext';

interface LabelFormat {
  id: string;
  name: string;
  page: { width: number; height: number };
  label: { width: number; height: number };
  cols: number;
  rows: number;
  margin: { top: number; left: number };
  gap: { x: number; y: number };
}

// Dimensions en millimètres, d'après les fiches des fabricants
const FORMATS: LabelFormat[] = [
  { id: 'L7651', name: 'Petites · Avery L7651 (65 par A4, 38 × 21 mm)', page: { width: 210, height: 297 }, label: { width: 38.1, height: 21.2 }, cols: 5, rows: 13, margin: { top: 10.7, left: 4.65 }, gap: { x: 2.5, y: 0 } },
  { id: 'L7160', name: 'Moyennes · Avery L7160 (21 par A4, 63,5 × 38 mm)', page: { width: 210, height: 297 }, label: { width: 63.5, height: 38.1 }, cols: 3, rows: 7, margin: { top: 15.15, left: 7.25 }, gap: { x: 2.5, y: 0 } },
  { id: 'BROTHER62', name: 'Rouleau Brother DK-22205 (62 × 29 mm, une par page)', page: { width: 62, height: 29 }, label: { width: 62, height: 29 }, cols: 1, rows: 1, margin: { top: 0, left: 0 }, gap: { x: 0, y: 0 } },
];

interface LabelData {
  key: string;
  value: string;
  title: string;
  code: string;
  extra?: string;
}

const inputClass = 'rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';

// Planches d'étiquettes QR : un QR par exemplaire (QR individuel) ou par article (lot)
const Labels: React.FC = () => {
  const { equipment, equipmentInstances } = useApp();
  const [formatId, setFormatId] = useState('L7160');
  const [search, setSearch] = useState('');
  const [copies, setCopies] = useState<Record<string, number>>({});
  const [startAt, setStartAt] = useState(1);
  // QR avec lien : qui trouve l'outil voit à qui le rendre ; le scanner du magasin lit le même QR
  const [withLink, setWithLink] = useState(false);
  const qrValue = (value: string) => (withLink ? `${window.location.origin}/t/${encodeURIComponent(value)}` : value);
  const format = FORMATS.find(f => f.id === formatId)!;
  const perPage = format.cols * format.rows;

  const items = useMemo(
    () => equipment
      .filter(e => e.status !== 'retired')
      .filter(e => `${e.name} ${e.articleNumber ?? ''} ${e.serialNumber ?? ''}`.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [equipment, search]
  );

  const instancesOf = (id: string) => equipmentInstances.filter(i => i.equipmentId === id).sort((a, b) => a.instanceNumber - b.instanceNumber);

  const labels: LabelData[] = useMemo(() => {
    const out: LabelData[] = [];
    for (const item of equipment) {
      const n = copies[item.id] ?? 0;
      if (n <= 0) continue;
      const instances = item.qrType === 'individual' ? instancesOf(item.id) : [];
      if (instances.length) {
        // Un exemplaire = son propre QR (les n premiers exemplaires)
        instances.slice(0, n).forEach(inst => out.push({
          key: inst.id, value: inst.qrCode, title: item.shortTitle || item.name, code: inst.qrCode, extra: item.serialNumber || undefined,
        }));
      } else {
        const value = item.articleNumber || item.id;
        for (let i = 0; i < n; i++) {
          out.push({ key: `${item.id}-${i}`, value, title: item.shortTitle || item.name, code: item.articleNumber || '', extra: item.serialNumber || undefined });
        }
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copies, equipment, equipmentInstances]);

  // Positions vides en tête (planche déjà entamée), puis les étiquettes
  const slots: (LabelData | null)[] = format.cols * format.rows > 1
    ? [...Array(Math.max(0, Math.min(startAt, perPage) - 1)).fill(null), ...labels]
    : labels;
  const pages: (LabelData | null)[][] = [];
  for (let i = 0; i < slots.length; i += perPage) pages.push(slots.slice(i, i + perPage));

  const setCount = (id: string, value: number) => setCopies(c => ({ ...c, [id]: Math.max(0, value) }));
  const qrSize = Math.min(format.label.height - 4, format.label.width * 0.45);
  const total = labels.length;

  return (
    <div className="space-y-6">
      {/* Format de page de l'imprimante : celui de la planche ou du rouleau */}
      <style>{`@media print { @page { size: ${format.page.width}mm ${format.page.height}mm; margin: 0; } }`}</style>

      <div className="print:hidden space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h1 className="mx-page-title">Étiquettes</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Choisis les articles et le nombre d'étiquettes, puis imprime à 100 % (sans « ajuster à la page »).</p>
          </div>
          <Button icon={<Printer size={16} />} onClick={() => window.print()} disabled={total === 0}>
            Imprimer {total > 0 ? `${total} étiquette${total > 1 ? 's' : ''}` : ''}
          </Button>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label htmlFor="label-format" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Format</label>
            <select id="label-format" value={formatId} onChange={e => setFormatId(e.target.value)} className={inputClass}>
              {FORMATS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          {perPage > 1 && (
            <div>
              <label htmlFor="label-start" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Commencer à la position</label>
              <input id="label-start" type="number" min={1} max={perPage} value={startAt} onChange={e => setStartAt(Math.min(perPage, Math.max(1, Number(e.target.value) || 1)))} className={`${inputClass} w-28 font-mono`} />
            </div>
          )}
          <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un article…" aria-label="Rechercher un article" className={`${inputClass} flex-1 min-w-[220px]`} />
          <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200 min-h-[40px]">
            <input type="checkbox" checked={withLink} onChange={e => setWithLink(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary-600" />
            QR « outil trouvé » (lien vers le contact de l'entreprise)
          </label>
        </div>

        <ul className="divide-y divide-gray-200 dark:divide-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow">
          {items.map(item => {
            const instances = item.qrType === 'individual' ? instancesOf(item.id) : [];
            const max = instances.length || 999;
            const n = copies[item.id] ?? 0;
            return (
              <li key={item.id} className="flex items-center gap-3 px-4 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{item.name}</p>
                  <p className="font-mono text-xs text-gray-600 dark:text-gray-400">
                    {item.articleNumber}{instances.length ? ` · ${instances.length} exemplaire${instances.length > 1 ? 's' : ''} (un QR chacun)` : ''}
                  </p>
                </div>
                {instances.length > 0 && (
                  <Button size="sm" variant="outline" onClick={() => setCount(item.id, n === instances.length ? 0 : instances.length)}>
                    {n === instances.length ? 'Aucun' : 'Tous'}
                  </Button>
                )}
                <input
                  type="number"
                  min={0}
                  max={max}
                  value={n}
                  onChange={e => setCount(item.id, Math.min(max, Number(e.target.value) || 0))}
                  aria-label={`Nombre d'étiquettes pour ${item.name}`}
                  className={`${inputClass} w-20 text-right font-mono`}
                />
              </li>
            );
          })}
          {items.length === 0 && <li className="px-4 py-6 text-sm text-gray-600 dark:text-gray-400">Aucun article.</li>}
        </ul>
      </div>

      {/* Planches à imprimer */}
      <div className="hidden print:block">
        {pages.map((page, p) => (
          <div
            key={p}
            className="relative bg-white text-black overflow-hidden"
            style={{ width: `${format.page.width}mm`, height: `${format.page.height}mm`, breakAfter: p < pages.length - 1 ? 'page' : 'auto' }}
          >
            {page.map((label, i) => {
              if (!label) return null;
              const col = i % format.cols;
              const row = Math.floor(i / format.cols);
              return (
                <div
                  key={label.key}
                  className="absolute flex items-center gap-[1.5mm] overflow-hidden"
                  style={{
                    left: `${format.margin.left + col * (format.label.width + format.gap.x)}mm`,
                    top: `${format.margin.top + row * (format.label.height + format.gap.y)}mm`,
                    width: `${format.label.width}mm`,
                    height: `${format.label.height}mm`,
                    padding: '1.5mm',
                  }}
                >
                  <QRCodeSVG value={qrValue(label.value)} size={128} level="M" style={{ width: `${qrSize}mm`, height: `${qrSize}mm`, flexShrink: 0 }} />
                  <div className="min-w-0 leading-tight">
                    <p className="font-bold" style={{ fontSize: format.label.height < 25 ? '6pt' : '8pt' }}>{label.title}</p>
                    <p className="font-mono" style={{ fontSize: format.label.height < 25 ? '5.5pt' : '7pt' }}>{label.code}</p>
                    {label.extra && format.label.height >= 25 && <p className="font-mono text-gray-700" style={{ fontSize: '6pt' }}>S/N {label.extra}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Labels;
