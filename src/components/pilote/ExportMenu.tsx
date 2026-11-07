import React from 'react';
import { CalendarPlus, Download, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { downloadWorkbook } from '../../lib/excel';
import { downloadText } from '../../lib/download';
import { buildExportRows, buildIcs, toCsv } from '../../lib/piloteExports';
import { printArea } from '../../lib/print';
import type { GanttData } from '../../lib/pilote';
import MenuButton from '../common/MenuButton';

interface Props {
  // Données DÉJÀ filtrées par la vue : l'export reprend exactement ce qui est affiché
  data: GanttData;
  userName: (id: string) => string;
  today: string;
  // Impression de la zone de la vue (Gantt, Calendrier) ; absent : pas de ligne « Imprimer »
  printable?: boolean;
}

const stampNow = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');

// Menu « Exporter » : Excel (projets + tâches), CSV, calendrier .ics et impression / PDF. Le fichier .ics est un instantané : il ne se met pas à jour tout seul.
const ExportMenu: React.FC<Props> = ({ data, userName, today, printable = false }) => {
  const empty = data.projects.length === 0;
  const run = (action: () => void | Promise<void>) => () => {
    if (empty) return void toast('Rien à exporter avec ces filtres');
    void Promise.resolve(action()).catch(() => toast.error('Export impossible'));
  };
  const rows = () => buildExportRows(data, userName, today);
  return (
    <MenuButton id="pilote-export" menuLabel="Exporter" icon={<Download size={14} />} value="Exporter"
      header={<p className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400">Reprend ce qui est affiché (filtres compris)</p>}
      actions={[
        { id: 'xlsx', label: 'Excel (projets et tâches)', icon: FileSpreadsheet, onSelect: run(async () => {
          const r = rows();
          await downloadWorkbook([{ name: 'Projets', rows: r.projects, widths: [28, 14, 16, 14, 12, 12, 12, 12, 14, 10, 24, 40, 40] }, { name: 'Tâches et jalons', rows: r.items, widths: [24, 20, 12, 32, 16, 14, 12, 12, 12, 12, 14, 10, 28, 40] }], `pilote-${today}.xlsx`);
        }) },
        { id: 'csv-items', label: 'CSV (tâches et jalons)', icon: FileText, onSelect: run(() => downloadText(toCsv(rows().items), `pilote-taches-${today}.csv`, 'text/csv;charset=utf-8')) },
        { id: 'csv-projects', label: 'CSV (projets)', icon: FileText, onSelect: run(() => downloadText(toCsv(rows().projects), `pilote-projets-${today}.csv`, 'text/csv;charset=utf-8')) },
        { id: 'ics', label: 'Calendrier (.ics)', icon: CalendarPlus, onSelect: run(() => downloadText(buildIcs(data, userName, stampNow()), `pilote-${today}.ics`, 'text/calendar;charset=utf-8')) },
        ...(printable ? [{ id: 'print', label: 'Imprimer / PDF', icon: Printer, onSelect: () => printArea() }] : []),
      ]} />
  );
};

export default ExportMenu;
