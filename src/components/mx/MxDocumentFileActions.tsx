import { Download, ExternalLink } from 'lucide-react';

/**
 * Boutons Télécharger / Ouvrir dans un nouvel onglet — même rendu que
 * `finance-v2/tabs/TabFichiers.tsx` (réf. InvoiceDrawer). Partagé avec les
 * drawers Mannyx (`MxDocPreview.actions`).
 */
export interface MxDocumentFileActionsProps {
  onDownload?: () => void;
  onOpenExternal?: () => void;
  downloadTitle?: string;
  openExternalTitle?: string;
}

export function MxDocumentFileActions({
  onDownload,
  onOpenExternal,
  downloadTitle = 'Télécharger',
  openExternalTitle = 'Ouvrir dans un nouvel onglet',
}: MxDocumentFileActionsProps) {
  if (!onDownload && !onOpenExternal) return null;

  const buttonClassName = 'p-1.5 rounded transition-colors';
  const buttonStyle = { color: 'var(--muted, var(--color-text-muted))' };

  return (
    <>
      {onDownload ? (
        <button
          type="button"
          onClick={onDownload}
          className={buttonClassName}
          style={buttonStyle}
          title={downloadTitle}
        >
          <Download className="w-4 h-4" />
        </button>
      ) : null}
      {onOpenExternal ? (
        <button
          type="button"
          onClick={onOpenExternal}
          className={buttonClassName}
          style={buttonStyle}
          title={openExternalTitle}
        >
          <ExternalLink className="w-4 h-4" />
        </button>
      ) : null}
    </>
  );
}

export default MxDocumentFileActions;
