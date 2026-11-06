// Lecture et écriture de classeurs Excel (exceljs, chargé seulement quand on en a besoin)

type Cell = string | number | boolean | null | undefined;

export interface SheetSpec {
  name: string;
  rows: Record<string, Cell>[];
  // Largeur de chaque colonne en caractères, dans l'ordre des clés de la première ligne
  widths?: number[];
}

const loadExcel = async () => (await import('exceljs')).default;

// Valeur lisible d'une cellule (formules, liens et textes enrichis compris)
const cellText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const v = value as { result?: unknown; text?: unknown; richText?: { text: string }[]; hyperlink?: string };
    if (v.result !== undefined) return cellText(v.result);
    // Lien : l'adresse compte (ex. colonne image_url), pas le texte affiché
    if (v.hyperlink) return v.hyperlink;
    if (v.richText) return v.richText.map(part => part.text).join('');
    if (v.text !== undefined) return cellText(v.text);
  }
  return String(value);
};

export async function downloadWorkbook(sheets: SheetSpec[], fileName: string) {
  const ExcelJS = await loadExcel();
  const workbook = new ExcelJS.Workbook();
  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);
    const headers = Object.keys(sheet.rows[0] ?? {});
    worksheet.columns = headers.map((header, i) => ({ header, key: header, width: sheet.widths?.[i] ?? 15 }));
    worksheet.getRow(1).font = { bold: true };
    sheet.rows.forEach(row => worksheet.addRow(row));
  }
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

// Lignes de la première feuille (hors feuilles ignorées), indexées par les en-têtes de la ligne 1
export async function readSheetRows(file: File, skipSheets: string[] = []): Promise<Record<string, string>[]> {
  const ExcelJS = await loadExcel();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheet = workbook.worksheets.find(ws => !skipSheets.includes(ws.name)) ?? workbook.worksheets[0];
  if (!worksheet) return [];

  const headers: string[] = [];
  worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = cellText(cell.value).trim();
  });

  const rows: Record<string, string>[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, string> = {};
    let filled = false;
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const key = headers[col];
      if (!key) return;
      record[key] = cellText(cell.value).trim();
      if (record[key]) filled = true;
    });
    if (filled) rows.push(record);
  });
  return rows;
}
