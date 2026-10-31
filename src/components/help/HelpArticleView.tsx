import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ChevronRight, Lightbulb, MapPin, Maximize2, Minimize2, User, Wrench, X, ZoomIn } from 'lucide-react';
import type { HelpArticle, HelpTask } from '../../help/content';
import PageTitle from '../common/PageTitle';

// Zoom d'une capture par-dessus la page : se ferme avec la croix, Échap ou un clic sur le fond.
// « Taille réelle » affiche l'image pixel pour pixel (défilement si elle dépasse l'écran).
const ShotZoom: React.FC<{ src: string; alt: string; onClose: () => void }> = ({ src, alt, onClose }) => {
  const [actual, setActual] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Capture agrandie" onClick={onClose}
      className="fixed inset-0 z-[1000] flex flex-col bg-black/85 backdrop-blur-sm">
      <div className="flex shrink-0 items-center justify-end gap-2 p-3" onClick={e => e.stopPropagation()}>
        <button type="button" onClick={() => setActual(a => !a)}
          className="mx-btn mx-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]">
          {actual ? <Minimize2 size={15} aria-hidden="true" /> : <Maximize2 size={15} aria-hidden="true" />}
          {actual ? 'Adapter à l\'écran' : 'Taille réelle'}
        </button>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Fermer"
          className="mx-btn mx-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]">
          <X size={16} aria-hidden="true" /> Fermer
        </button>
      </div>
      <div className={`min-h-0 flex-1 overflow-auto px-3 pb-3 ${actual ? '' : 'flex items-center justify-center'}`}>
        <img src={src} alt={alt} onClick={e => { e.stopPropagation(); setActual(a => !a); }}
          style={actual ? { width: 'auto', maxWidth: 'none', cursor: 'zoom-out' } : { cursor: 'zoom-in' }}
          className={actual ? 'mx-auto block' : 'block max-h-full max-w-full object-contain rounded-md shadow-2xl'} />
      </div>
    </div>,
    document.body,
  );
};

// Capture d'écran de l'aide ; masquée si elle n'a pas encore été générée. Clic : zoom refermable.
export const HelpShot: React.FC<{ name: string; alt: string }> = ({ name, alt }) => {
  const [missing, setMissing] = useState(false);
  const [zoom, setZoom] = useState(false);
  if (missing) return null;
  const src = `/aide/${name}.jpg`;
  return (
    <figure className="mt-3">
      <button type="button" onClick={() => setZoom(true)} title="Agrandir la capture" aria-label={`Agrandir la capture : ${alt}`}
        className="group relative block w-fit max-w-full cursor-zoom-in overflow-hidden rounded-lg border-[1.5px] border-gray-200 dark:border-gray-700 shadow-sm">
        <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setMissing(true)}
          className="block max-h-[560px] w-auto max-w-full" />
        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-gray-900/75 px-2 py-1 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <ZoomIn size={13} aria-hidden="true" /> Agrandir
        </span>
      </button>
      {zoom && <ShotZoom src={src} alt={alt} onClose={() => setZoom(false)} />}
    </figure>
  );
};

export const taskAnchor = (task: HelpTask) => `tache-${task.id}`;

// Une tâche : étapes numérotées reliées par un trait, résultat attendu, et « Ça ne marche pas ? »
export const HelpTaskView: React.FC<{ task: HelpTask; index: number }> = ({ task, index }) => (
  <section id={taskAnchor(task)} className="scroll-mt-24 rounded-xl border-[1.5px] border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
    <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b-[1.5px] border-gray-100 dark:border-gray-700/70 px-4 py-3 sm:px-5">
      <span className="text-xs font-bold uppercase tracking-wide text-primary-700 dark:text-primary-300">Tâche {index + 1}</span>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{task.title}</h2>
      {task.who && (
        <span className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
          <User size={12} aria-hidden="true" /> {task.who}
        </span>
      )}
    </header>

    <div className="space-y-4 px-4 py-4 sm:px-5">
      <ol className="relative">
        {task.steps.map((step, i) => (
          <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
            {/* Trait vertical entre deux étapes */}
            {i < task.steps.length - 1 && <span className="absolute left-[13px] top-8 bottom-1 w-0.5 bg-gray-200 dark:bg-gray-700" aria-hidden="true" />}
            <span className="relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white" aria-hidden="true">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-gray-900 dark:text-gray-100 leading-relaxed">{step.text}</p>
              {step.shot && <HelpShot name={step.shot} alt={step.text} />}
            </div>
          </li>
        ))}
      </ol>

      {task.result && (
        <div className="mx-tint-success flex gap-2 px-3 py-2.5">
          <CheckCircle2 size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-[color:var(--mx-tone-text-success)]" />
          <p className="text-sm text-gray-900 dark:text-gray-100"><strong>Résultat : </strong>{task.result}</p>
        </div>
      )}

      {task.problems?.length ? (
        <details className="group mx-tint-warning">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-semibold text-gray-900 dark:text-white">
            <Wrench size={16} aria-hidden="true" />
            Ça ne marche pas ? ({task.problems.length})
            <ChevronRight size={16} aria-hidden="true" className="ml-auto transition-transform group-open:rotate-90" />
          </summary>
          <dl className="space-y-2.5 px-3 pb-3">
            {task.problems.map(p => (
              <div key={p.if} className="rounded-md bg-white dark:bg-gray-800 px-3 py-2">
                <dt className="text-sm font-semibold text-gray-900 dark:text-white">{p.if}</dt>
                <dd className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">{p.then}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
    </div>
  </section>
);

// Un article : en-tête (où, ouvrir la page), sommaire des tâches, tâches, astuces
const HelpArticleView: React.FC<{ article: HelpArticle; onNavigate?: () => void; compact?: boolean }> = ({ article, onNavigate, compact }) => (
  <article className="space-y-5">
    <div className="space-y-2">
      {!compact && <PageTitle>{article.title}</PageTitle>}
      <p className="text-gray-700 dark:text-gray-300">{article.summary}</p>
      <div className="flex flex-wrap items-center gap-2">
        {article.where && (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 dark:bg-gray-700/60 px-2.5 py-1 text-sm text-gray-800 dark:text-gray-200">
            <MapPin size={14} aria-hidden="true" /> {article.where}
          </span>
        )}
        {article.route && !article.route.startsWith('/ecran') && (
          <Link to={article.route} onClick={onNavigate} className="mx-btn mx-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]">
            Ouvrir la page <ArrowRight size={14} aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>

    {article.tasks.length > 1 && (
      <nav aria-label="Dans cet article" className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3">
        <p className="mx-section-label mb-2">Je veux…</p>
        <ul className="grid gap-1 sm:grid-cols-2">
          {article.tasks.map((task, i) => (
            <li key={task.id}>
              <a href={`#${taskAnchor(task)}`}
                onClick={e => { e.preventDefault(); document.getElementById(taskAnchor(task))?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-900 dark:text-gray-100 hover:bg-white dark:hover:bg-gray-700">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/50 text-[11px] font-bold text-primary-800 dark:text-primary-200">{i + 1}</span>
                {task.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    )}

    <div className="space-y-4">
      {article.tasks.map((task, i) => <HelpTaskView key={task.id} task={task} index={i} />)}
    </div>

    {article.tips?.length ? (
      <div className="mx-muted-box p-3">
        <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white"><Lightbulb size={16} aria-hidden="true" /> Astuces</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-800 dark:text-gray-200">{article.tips.map(t => <li key={t}>{t}</li>)}</ul>
      </div>
    ) : null}
  </article>
);

export default HelpArticleView;
