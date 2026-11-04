import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, File as FileIcon, FileImage, FileSpreadsheet, FileText, Paperclip, RefreshCw, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { confirmAction } from '../../lib/confirm';
import { formatDateTime } from '../../lib/platformConsole';
import { deleteDocument, docProblem, documentUrl, formatSize, loadDocuments, piloteError, uploadDocument, type CpDocument } from '../../lib/pilote';
import Button from '../common/Button';
import { useProjectRights } from './useProjectRights';

interface Props {
  projectId: string;
  // null : documents du projet ; sinon ceux de l'élément
  itemId: string | null;
}

const iconOf = (name: string) => {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'bmp', 'tif', 'tiff'].includes(ext)) return FileImage;
  if (['xls', 'xlsx', 'ods', 'csv'].includes(ext)) return FileSpreadsheet;
  if (['pdf', 'doc', 'docx', 'odt', 'txt', 'rtf', 'md', 'ppt', 'pptx', 'odp'].includes(ext)) return FileText;
  return FileIcon;
};

// Documents d'une fiche (mini-Dropbox) : liste, dépôt (bouton ou glisser-déposer, plusieurs fichiers), téléchargement, suppression.
// Ce que chacun peut faire est décidé par la base ; l'écran le lui demande pour ne proposer que ce qui sera accepté.
const DocumentsSection: React.FC<Props> = ({ projectId, itemId }) => {
  const { users } = useApp();
  const { profile } = useAuth();
  const { canWrite, canModerate } = useProjectRights(projectId);
  const [docs, setDocs] = useState<CpDocument[] | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const names = useMemo(() => new Map(users.map(u => [u.id, `${u.first_name} ${u.last_name}`.trim()])), [users]);
  const reload = useCallback(async () => {
    try { setDocs(await loadDocuments(projectId, itemId)); } catch (e) { toast.error(piloteError(e)); setDocs(prev => prev ?? []); }
  }, [projectId, itemId]);
  useEffect(() => { setDocs(null); void reload(); }, [reload]);

  const send = async (files: File[]) => {
    const orgId = profile?.organization?.id;
    if (!orgId || files.length === 0 || sending) return;
    const ok: File[] = [];
    for (const f of files) { const problem = docProblem(f); if (problem) toast.error(problem); else ok.push(f); }
    let done = 0;
    for (const f of ok) {
      setSending(f.name);
      try { await uploadDocument(orgId, projectId, itemId, f); done++; } catch (e) { toast.error(`${f.name} : ${piloteError(e)}`); }
    }
    setSending(null);
    if (done) { toast.success(done > 1 ? `${done} documents ajoutés` : 'Document ajouté'); await reload(); }
  };
  const open = async (d: CpDocument) => {
    if (busyId) return;
    setBusyId(d.id);
    try { window.location.assign(await documentUrl(d)); } catch (e) { toast.error(piloteError(e)); } finally { setBusyId(null); }
  };
  const remove = async (d: CpDocument) => {
    if (busyId || !(await confirmAction(`Supprimer le document « ${d.file_name} » ?`))) return;
    setBusyId(d.id);
    try { await deleteDocument(d.id); await reload(); } catch (e) { toast.error(piloteError(e)); } finally { setBusyId(null); }
  };

  return (
    <section aria-label="Documents" className="space-y-3 border-t border-gray-200 pt-4 dark:border-gray-700"
      onDragOver={e => { if (canWrite) { e.preventDefault(); setOver(true); } }} onDragLeave={() => setOver(false)}
      onDrop={e => { if (!canWrite) return; e.preventDefault(); setOver(false); void send(Array.from(e.dataTransfer.files)); }}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-900 dark:text-white">
          <Paperclip size={15} aria-hidden /> {`Documents${docs && docs.length ? ` (${docs.length})` : ''}`}
        </h3>
        <button type="button" aria-label="Actualiser les documents" title="Actualiser" onClick={() => void reload()} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
          <RefreshCw size={14} aria-hidden />
        </button>
      </div>

      {docs === null ? <p className="text-sm text-gray-600 dark:text-gray-400">Chargement…</p> : docs.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">Aucun document pour l'instant.</p>
      ) : (
        <ul className="space-y-1.5">
          {docs.map(d => {
            const Icon = iconOf(d.file_name);
            const mine = !!profile && d.uploaded_by === profile.id;
            return (
              <li key={d.id} className="flex items-center gap-3 rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-800/60">
                <Icon size={18} aria-hidden className="shrink-0 text-gray-500" />
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => void open(d)} disabled={busyId === d.id} title="Télécharger" className="block max-w-full truncate text-left text-sm font-medium text-primary-700 hover:underline dark:text-primary-300">{d.file_name}</button>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{`${formatSize(d.size_bytes)} · ${d.uploaded_by ? names.get(d.uploaded_by) ?? '—' : 'Personne supprimée'} · ${formatDateTime(d.created_at)}`}</p>
                </div>
                <button type="button" aria-label={`Télécharger le document « ${d.file_name} »`} title="Télécharger" disabled={busyId === d.id} onClick={() => void open(d)} className="rounded p-1.5 text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700"><Download size={15} aria-hidden /></button>
                {(mine || canModerate) && (
                  <button type="button" aria-label={`Supprimer le document « ${d.file_name} »`} title="Supprimer" disabled={busyId === d.id} onClick={() => void remove(d)} className="rounded p-1.5 text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700"><Trash2 size={15} aria-hidden /></button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canWrite ? (
        <div className={`flex flex-wrap items-center gap-3 rounded-md border-2 border-dashed px-3 py-3 ${over ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/20' : 'border-gray-300 dark:border-gray-600'}`}>
          <input ref={input} id="doc-file" type="file" multiple className="sr-only" aria-label="Choisir des fichiers à ajouter"
            onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ''; void send(files); }} />
          <Button size="sm" variant="outline" icon={<Upload size={14} />} loading={sending !== null} onClick={() => input.current?.click()}>Ajouter des fichiers</Button>
          <span className="text-xs text-gray-600 dark:text-gray-400">{sending ? `Envoi de « ${sending} »…` : 'ou dépose-les ici — 50 Mo au plus par fichier ; pas d\'exécutables ni de pages web.'}</span>
        </div>
      ) : (
        <p className="text-xs text-gray-600 dark:text-gray-400">Seuls l'équipe du projet et les responsables ajoutent des documents. Tu peux télécharger ceux qui existent.</p>
      )}
    </section>
  );
};

export default DocumentsSection;
