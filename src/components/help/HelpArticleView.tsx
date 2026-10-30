import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Lightbulb } from 'lucide-react';
import type { HelpArticle } from '../../help/content';

// Capture d'écran de l'aide ; masquée si elle n'a pas encore été générée
export const HelpShot: React.FC<{ name: string; alt: string; caption?: string }> = ({ name, alt, caption }) => {
  const [missing, setMissing] = useState(false);
  if (missing) return null;
  return (
    <figure className="mt-3">
      {/* Clic : la capture en grand dans un nouvel onglet */}
      <a href={`/aide/${name}.jpg`} target="_blank" rel="noopener" title="Agrandir la capture">
        <img src={`/aide/${name}.jpg`} alt={alt} loading="lazy" onError={() => setMissing(true)}
          className="mx-auto max-h-[560px] w-auto max-w-full rounded-md border-[1.5px] border-gray-200 dark:border-gray-700" />
      </a>
      {caption && <figcaption className="mt-1 text-xs text-gray-600 dark:text-gray-400">{caption}</figcaption>}
    </figure>
  );
};

// Un article : résumé, étapes numérotées avec captures, astuces et pièges
const HelpArticleView: React.FC<{ article: HelpArticle; onNavigate?: () => void; compact?: boolean }> = ({ article, onNavigate, compact }) => (
  <article className="space-y-5">
    <div>
      {!compact && <h1 className="mx-page-title">{article.title}</h1>}
      <p className="mt-1 text-gray-700 dark:text-gray-300">{article.summary}</p>
      {article.route && !article.route.startsWith('/ecran') && (
        <Link to={article.route} onClick={onNavigate}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 dark:text-primary-300 hover:underline">
          Ouvrir la page <ArrowRight size={14} aria-hidden="true" />
        </Link>
      )}
    </div>

    <ol className="space-y-5">
      {article.steps.map((step, index) => (
        <li key={index} className="flex gap-3">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white" aria-hidden="true">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-gray-900 dark:text-gray-100">{step.text}</p>
            {step.shot && <HelpShot name={step.shot} alt={step.text} caption={step.caption} />}
          </div>
        </li>
      ))}
    </ol>

    {article.tips?.length ? (
      <div className="rounded-md border-[1.5px] border-info-200 dark:border-info-800 bg-info-50 dark:bg-info-900/30 p-3">
        <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-info-800 dark:text-info-200"><Lightbulb size={16} aria-hidden="true" /> Astuces</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-800 dark:text-gray-200">{article.tips.map(t => <li key={t}>{t}</li>)}</ul>
      </div>
    ) : null}
    {article.warnings?.length ? (
      <div className="rounded-md border-[1.5px] border-warning-200 dark:border-warning-800 bg-warning-50 dark:bg-warning-900/30 p-3">
        <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-warning-800 dark:text-warning-200"><AlertTriangle size={16} aria-hidden="true" /> Attention</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-800 dark:text-gray-200">{article.warnings.map(t => <li key={t}>{t}</li>)}</ul>
      </div>
    ) : null}
  </article>
);

export default HelpArticleView;
