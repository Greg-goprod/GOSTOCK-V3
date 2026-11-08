import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { MessageSquare, Pencil, RefreshCw, Send, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { confirmAction } from '../../lib/confirm';
import { formatDateTime } from '../../lib/platformConsole';
import { insertMention, mentionQuery, splitMentions, suggestPeople, type Person } from '../../lib/mentions';
import { addComment, COMMENT_MAX, deleteComment, editComment, loadComments, piloteError, type CpComment } from '../../lib/pilote';
import Button from '../common/Button';
import { useProjectRights } from './useProjectRights';
import { SectionHeader } from './SectionHeader';
import { useSectionOpen } from './useSectionOpen';
import { usePiloteLive } from './usePiloteLive';

interface Props {
  projectId: string;
  // null : discussion du projet ; sinon celle de l'élément
  itemId: string | null;
  // Arrivée par un avis : la section s'ouvre (sans changer le choix retenu) et vient à l'écran
  autoOpen?: boolean;
}

const areaClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-70';

// Discussion d'une fiche : fil de messages (texte), les plus anciens en haut. Ce que chacun peut faire est décidé par la base ;
// l'écran le demande (fonction cp_can_discuss et droit de suppression) pour ne proposer que ce qui sera accepté.
const DiscussionSection: React.FC<Props> = ({ projectId, itemId, autoOpen = false }) => {
  const { open: isOpen, toggle } = useSectionOpen('discussion', autoOpen);
  const panelId = useId();
  const root = useRef<HTMLElement>(null);
  const { users } = useApp();
  const { profile } = useAuth();
  const [messages, setMessages] = useState<CpComment[] | null>(null);
  const { canWrite, canModerate } = useProjectRights(projectId);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Mention en cours de frappe (« @An… ») : suggestions de personnes, choisies à la souris ou au clavier
  const [caret, setCaret] = useState(0);
  const [pick, setPick] = useState(0);
  const [pickClosed, setPickClosed] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  const names = useMemo(() => new Map(users.map(u => [u.id, `${u.first_name} ${u.last_name}`.trim()])), [users]);
  // Personnes qu'on peut mentionner : les personnes actives, sauf soi-même
  const people = useMemo<Person[]>(() => users.filter(u => u.active !== false && u.id !== profile?.id).map(u => ({ id: u.id, name: `${u.first_name} ${u.last_name}`.trim() })), [users, profile?.id]);
  const query = pickClosed ? null : mentionQuery(draft, caret);
  const suggestions = useMemo(() => (query ? suggestPeople(people, query.query) : []), [people, query]);
  const choose = (p: Person) => {
    if (!query) return;
    const next = insertMention(draft, query.start, caret, p.name);
    setDraft(next.text); setCaret(next.caret); setPick(0);
    setPickClosed(true);   // le choix est fait : la liste reste fermée jusqu'à la prochaine frappe
    requestAnimationFrame(() => { area.current?.focus(); area.current?.setSelectionRange(next.caret, next.caret); });
  };

  const reload = useCallback(async () => {
    try { setMessages(await loadComments(projectId, itemId)); } catch (e) { toast.error(piloteError(e)); setMessages(prev => prev ?? []); }
  }, [projectId, itemId]);
  useEffect(() => { setMessages(null); setDraft(''); setEditing(null); void reload(); }, [reload]);
  usePiloteLive(reload, isOpen === false || busyId !== null);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try { await addComment(projectId, itemId, body); setDraft(''); await reload(); } catch (e) { toast.error(piloteError(e)); } finally { setSending(false); }
  };
  const saveEdit = async () => {
    if (!editing || !editing.text.trim() || busyId) return;
    setBusyId(editing.id);
    try { await editComment(editing.id, editing.text.trim()); setEditing(null); await reload(); } catch (e) { toast.error(piloteError(e)); } finally { setBusyId(null); }
  };
  const remove = async (m: CpComment) => {
    if (busyId || !(await confirmAction('Supprimer ce message ?'))) return;
    setBusyId(m.id);
    try { await deleteComment(m.id); await reload(); } catch (e) { toast.error(piloteError(e)); } finally { setBusyId(null); }
  };

  // Arrivée par un avis : la section vient au centre de la fiche une fois son contenu chargé
  const loaded = messages !== null;
  useEffect(() => { if (autoOpen && loaded) root.current?.scrollIntoView({ block: 'center' }); }, [autoOpen, loaded]);

  return (
    <section ref={root} aria-label="Discussion" className="space-y-3 border-t border-gray-200 pt-4 dark:border-gray-700">
      <SectionHeader title={`Discussion${messages && messages.length ? ` (${messages.length})` : ''}`} icon={<MessageSquare size={15} aria-hidden />} open={isOpen} onToggle={toggle} panelId={panelId}
        actions={(
          <button type="button" aria-label="Actualiser la discussion" title="Actualiser" onClick={() => void reload()} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
            <RefreshCw size={14} aria-hidden />
          </button>
        )} />

      {isOpen && (
        <div id={panelId} className="space-y-3">
        {messages === null ? <p className="text-sm text-gray-600 dark:text-gray-400">Chargement…</p> : messages.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">Aucun message pour l'instant.</p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {messages.map(m => {
              const mine = !!profile && m.author_id === profile.id;
              return (
                <li key={m.id} className="rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-800/60">
                  <div className="flex flex-wrap items-center gap-x-2 text-xs text-gray-600 dark:text-gray-400">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{m.author_id ? names.get(m.author_id) ?? '—' : 'Personne supprimée'}</span>
                    <span>{formatDateTime(m.created_at)}</span>
                    {m.edited_at && <span>· modifié</span>}
                    <span className="ml-auto inline-flex gap-1">
                      {mine && canWrite && editing?.id !== m.id && (
                        <button type="button" aria-label="Modifier ce message" title="Modifier" onClick={() => setEditing({ id: m.id, text: m.body })} className="rounded p-1 hover:bg-gray-200 dark:hover:bg-gray-700"><Pencil size={13} aria-hidden /></button>
                      )}
                      {(mine || canModerate) && (
                        <button type="button" aria-label="Supprimer ce message" title="Supprimer" disabled={busyId === m.id} onClick={() => void remove(m)} className="rounded p-1 hover:bg-gray-200 dark:hover:bg-gray-700"><Trash2 size={13} aria-hidden /></button>
                      )}
                    </span>
                  </div>
                  {editing?.id === m.id ? (
                    <div className="mt-1 space-y-2">
                      <textarea aria-label="Modifier le message" rows={3} maxLength={COMMENT_MAX} className={areaClass} value={editing.text} onChange={e => setEditing({ id: m.id, text: e.target.value })} />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => void saveEdit()} loading={busyId === m.id}>Enregistrer le message</Button>
                        <Button size="sm" variant="secondary" onClick={() => setEditing(null)}>Annuler</Button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-900 dark:text-gray-100">
                      {splitMentions(m.body, users.map(u => ({ id: u.id, name: `${u.first_name} ${u.last_name}`.trim() })), m.mentions ?? []).map((seg, i) => (
                        seg.mention ? <mark key={i} data-mention className="rounded bg-primary-100 px-0.5 font-semibold text-primary-900 dark:bg-primary-900/40 dark:text-primary-100">{seg.text}</mark> : <React.Fragment key={i}>{seg.text}</React.Fragment>
                      ))}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {canWrite ? (
          <div className="space-y-2">
            <label htmlFor="cmt-body" className="sr-only">Écrire un message</label>
            <div className="relative">
              <textarea id="cmt-body" ref={area} rows={3} maxLength={COMMENT_MAX} className={areaClass} value={draft} placeholder="Écrire un message… (@ pour mentionner, Ctrl+Entrée pour envoyer)"
                role="combobox" aria-expanded={suggestions.length > 0} aria-controls="cmt-mentions" aria-autocomplete="list" aria-activedescendant={suggestions.length > 0 ? `cmt-mention-${pick}` : undefined}
                onChange={e => { setDraft(e.target.value); setCaret(e.target.selectionStart ?? e.target.value.length); setPickClosed(false); setPick(0); }}
                onSelect={e => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void send(); return; }
                  if (suggestions.length === 0) return;
                  if (e.key === 'ArrowDown') { e.preventDefault(); setPick(p => (p + 1) % suggestions.length); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setPick(p => (p - 1 + suggestions.length) % suggestions.length); }
                  else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); choose(suggestions[pick]); }
                  else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setPickClosed(true); }
                }} />
              {suggestions.length > 0 && (
                <ul id="cmt-mentions" role="listbox" aria-label="Personnes à mentionner" className="absolute bottom-full left-0 z-20 mb-1 max-h-48 w-64 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800">
                  {suggestions.map((p, i) => (
                    <li key={p.id} id={`cmt-mention-${i}`} role="option" aria-selected={i === pick} data-mention-option
                      onMouseDown={e => { e.preventDefault(); choose(p); }} onMouseEnter={() => setPick(i)}
                      className={`cursor-pointer px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 ${i === pick ? 'bg-primary-50 dark:bg-primary-900/30' : ''}`}>{p.name}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">{`${draft.length} / ${COMMENT_MAX}`}</span>
              <Button size="sm" icon={<Send size={14} />} disabled={!draft.trim()} loading={sending} onClick={() => void send()}>Envoyer</Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-600 dark:text-gray-400">Seuls l'équipe du projet et les responsables écrivent ici. Tu peux lire la discussion.</p>
        )}
        </div>
      )}
    </section>
  );
};

export default DiscussionSection;
