// Impression d'une zone de page (le Gantt, le calendrier) : tout le reste est masqué pendant l'impression, en paysage A4.
// Les réglages ne vivent que le temps de l'impression : les autres pages (feuille de commande, badges…) gardent les leurs.
export function printArea(): void {
  const style = document.createElement('style');
  style.dataset.printStyle = 'pilote';
  style.textContent = `
    @page { size: A4 landscape; margin: 8mm; }
    @media print {
      body.pilote-printing * { visibility: hidden !important; }
      body.pilote-printing [data-print-area], body.pilote-printing [data-print-area] * { visibility: visible !important; }
      body.pilote-printing [data-print-area] { position: absolute !important; left: 0; top: 0; width: 100% !important; }
      body.pilote-printing [data-print-area] [data-print-expand] { max-height: none !important; overflow: visible !important; }
      body.pilote-printing [data-print-area] .print-only { display: block !important; }
      body.pilote-printing { background: #fff !important; }
    }`;
  document.head.appendChild(style);
  document.body.classList.add('pilote-printing');
  const done = () => { document.body.classList.remove('pilote-printing'); style.remove(); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
}
