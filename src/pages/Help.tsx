import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, ChevronRight, ExternalLink, FileDown, HelpCircle, Printer, Search, X } from 'lucide-react';
import HelpArticleView, { taskAnchor } from '../components/help/HelpArticleView';
import { ARTICLES, CATEGORIES, FAQ, GLOSSARY, QUICK, articleById, searchHelp } from '../help/content';
import type { FaqItem, HelpArticle } from '../help/content';
import { CATEGORY_ICONS } from '../help/icons';
import PageTitle from '../components/common/PageTitle';

const FaqEntry: React.FC<{ item: FaqItem }> = ({ item }) => (
  <details className="group rounded-lg border-[1.5px] border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-gray-900 dark:text-white">
      {item.q}
      <ChevronRight size={16} aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-90" />
    </summary>
    <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{item.a}</p>
    {item.article && (
      <Link to={`/aide/${item.article}`} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary-700 dark:text-primary-300 hover:underline">
        Voir le pas à pas <ArrowRight size={13} aria-hidden="true" />
      </Link>
    )}
  </details>
);

// Colonne de gauche (ordinateur) : catégories et articles, l'article ouvert en surbrillance
const HelpSidebar: React.FC<{ current?: string }> = ({ current }) => {
  const currentCategory = current ? articleById(current)?.category : undefined;
  return (
    <nav aria-label="Rubriques de l'aide" className="hidden lg:block">
      <div className="sticky top-4 max-h-[calc(100vh-2rem)] space-y-1 overflow-y-auto pr-2">
        <Link to="/aide" className="mb-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800">
          <BookOpen size={16} aria-hidden="true" /> Accueil de l'aide
        </Link>
        {CATEGORIES.map(category => {
          const Icon = CATEGORY_ICONS[category.id];
          return (
            <details key={category.id} open={category.id === currentCategory} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">
                <Icon size={15} aria-hidden="true" className="text-primary-600 dark:text-primary-400" />
                {category.label}
                <ChevronRight size={14} aria-hidden="true" className="ml-auto transition-transform group-open:rotate-90" />
              </summary>
              <ul className="mb-1 ml-[19px] border-l-[1.5px] border-gray-200 dark:border-gray-700 pl-2">
                {ARTICLES.filter(a => a.category === category.id).map(a => (
                  <li key={a.id}>
                    <Link to={`/aide/${a.id}`} aria-current={a.id === current ? 'page' : undefined}
                      className={`block rounded-md px-2 py-1 text-sm ${a.id === current
                        ? 'bg-primary-50 dark:bg-primary-900/40 font-semibold text-primary-800 dark:text-primary-200'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                      {a.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
        <Link to="/aide#faq" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">
          <HelpCircle size={15} aria-hidden="true" className="text-primary-600 dark:text-primary-400" /> Questions fréquentes
        </Link>
      </div>
    </nav>
  );
};

// Article précédent / suivant, dans l'ordre du mode d'emploi
const PrevNext: React.FC<{ article: HelpArticle }> = ({ article }) => {
  const index = ARTICLES.findIndex(a => a.id === article.id);
  const prev = ARTICLES[index - 1];
  const next = ARTICLES[index + 1];
  return (
    <div className="grid gap-3 border-t-[1.5px] border-gray-200 dark:border-gray-700 pt-5 sm:grid-cols-2">
      {prev ? (
        <Link to={`/aide/${prev.id}`} className="mx-card mx-card-hover block p-4">
          <span className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400"><ArrowLeft size={12} aria-hidden="true" /> Précédent</span>
          <span className="mt-1 block font-semibold text-gray-900 dark:text-white">{prev.title}</span>
        </Link>
      ) : <span />}
      {next && (
        <Link to={`/aide/${next.id}`} className="mx-card mx-card-hover block p-4 text-right">
          <span className="flex items-center justify-end gap-1 text-xs text-gray-600 dark:text-gray-400">Suivant <ArrowRight size={12} aria-hidden="true" /></span>
          <span className="mt-1 block font-semibold text-gray-900 dark:text-white">{next.title}</span>
        </Link>
      )}
    </div>
  );
};

const SearchBox: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => (
  <div className="relative">
    <Search size={18} aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
    <input type="text" value={value} onChange={e => onChange(e.target.value)}
      placeholder="Que veux-tu faire ? Ex. rendre un kit, réserver un véhicule, code de connexion…"
      aria-label="Chercher dans l'aide"
      className="w-full rounded-xl border-[1.5px] border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-2 pl-11 pr-10 text-[length:calc(14px*var(--mx-scale,1))] text-gray-900 dark:text-white shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30" />
    {value && (
      <button type="button" onClick={() => onChange('')} aria-label="Effacer la recherche"
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
        <X size={16} aria-hidden="true" />
      </button>
    )}
  </div>
);

// Rubrique d'aide : recherche, raccourcis « Je veux… », pas à pas par métier, FAQ, glossaire, PDF
const Help: React.FC = () => {
  const { id } = useParams();
  const { hash } = useLocation();
  const [query, setQuery] = useState('');
  const found = useMemo(() => searchHelp(query), [query]);
  const article = id ? articleById(id) : undefined;

  // Lien direct vers une tâche (#tache-…) ou une section (#faq) : on y descend une fois la page affichée
  useEffect(() => {
    if (!hash) { window.scrollTo(0, 0); return; }
    const timer = setTimeout(() => document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: 'start' }), 60);
    return () => clearTimeout(timer);
  }, [id, hash]);

  if (id) {
    const category = article && CATEGORIES.find(c => c.id === article.category);
    return (
      <div translate="no" className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[250px_minmax(0,1fr)]">
        <HelpSidebar current={id} />
        <div className="min-w-0 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <nav aria-label="Fil d'Ariane" className="flex flex-wrap items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
              <Link to="/aide" className="hover:underline">Aide</Link>
              {category && <><ChevronRight size={13} aria-hidden="true" /><span>{category.label}</span></>}
            </nav>
            <a href={`/aide/${id}`} target="_blank" rel="noopener" className="mx-btn mx-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[length:calc(12.5px*var(--mx-scale,1))]">
              <ExternalLink size={15} aria-hidden="true" /> Ouvrir dans un nouvel onglet
            </a>
          </div>
          {article ? (
            <>
              <HelpArticleView article={article} />
              <PrevNext article={article} />
            </>
          ) : (
            <p className="text-gray-700 dark:text-gray-300">Cet article n'existe pas. <Link to="/aide" className="font-semibold text-primary-700 dark:text-primary-300 hover:underline">Retour à l'aide</Link></p>
          )}
        </div>
      </div>
    );
  }

  const searching = query.trim().length > 0;
  return (
    <div translate="no" className="mx-auto max-w-6xl space-y-10">
      {/* En-tête : titre, recherche, PDF */}
      <section className="rounded-2xl border-[1.5px] border-gray-200 dark:border-gray-700 bg-gradient-to-br from-primary-50 to-white dark:from-primary-900/30 dark:to-gray-900 px-5 py-7 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <PageTitle>Aide et mode d'emploi</PageTitle>
            <p className="mt-1 text-gray-700 dark:text-gray-300">
              Chaque manipulation expliquée pas à pas, avec les mots exacts des écrans. Sur n'importe quelle page, le « ? » en haut ouvre l'aide de cette page.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* L'aide à côté de l'application : on lit d'un côté, on travaille de l'autre */}
            <a href="/aide" target="_blank" rel="noopener" className="mx-btn mx-btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-[length:calc(12.5px*var(--mx-scale,1))]">
              <ExternalLink size={16} aria-hidden="true" /> Nouvel onglet
            </a>
            <a href="/aide/GO-Mat-mode-emploi.pdf" download className="mx-btn mx-btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-[length:calc(12.5px*var(--mx-scale,1))]">
              <FileDown size={16} aria-hidden="true" /> PDF
            </a>
            <a href="/aide/imprimer" target="_blank" rel="noopener" className="mx-btn mx-btn-ghost inline-flex items-center gap-1.5 px-3 py-2 text-[length:calc(12.5px*var(--mx-scale,1))]">
              <Printer size={16} aria-hidden="true" /> Imprimer
            </a>
          </div>
        </div>
        <div className="mt-5 max-w-3xl"><SearchBox value={query} onChange={setQuery} /></div>
      </section>

      {searching ? (
        <section className="space-y-4" aria-live="polite">
          <h2 className="mx-section-label">{found.tasks.length + found.faq.length} résultat(s)</h2>
          {found.tasks.length === 0 && found.faq.length === 0 && (
            <p className="text-gray-700 dark:text-gray-300">Rien trouvé. Essaie un autre mot (ex. « sortir », « badge », « véhicule »), ou parcours les rubriques.</p>
          )}
          <ul className="grid gap-2 md:grid-cols-2">
            {found.tasks.slice(0, 30).map(({ article: a, task }) => (
              <li key={`${a.id}-${task.id}`}>
                <Link to={`/aide/${a.id}#${taskAnchor(task)}`} className="mx-card mx-card-hover flex h-full items-start gap-3 p-4">
                  <ArrowRight size={16} aria-hidden="true" className="mt-1 shrink-0 text-primary-600 dark:text-primary-400" />
                  <span>
                    <span className="block font-semibold text-gray-900 dark:text-white">{task.title}</span>
                    <span className="block text-sm text-gray-600 dark:text-gray-400">{a.title}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {found.faq.length > 0 && <div className="space-y-2">{found.faq.map(item => <FaqEntry key={item.q} item={item} />)}</div>}
        </section>
      ) : (
        <>
          {/* Raccourcis les plus demandés */}
          <section className="space-y-3">
            <h2 className="mx-section-label">Je veux…</h2>
            <ul className="flex flex-wrap gap-2">
              {QUICK.map(q => (
                <li key={q.label}>
                  <Link to={`/aide/${q.article}#tache-${q.task}`}
                    className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30">
                    {q.label} <ArrowRight size={13} aria-hidden="true" className="text-primary-600 dark:text-primary-400" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* Rubriques : chaque article avec ses tâches */}
          {CATEGORIES.map(category => {
            const Icon = CATEGORY_ICONS[category.id];
            const list = ARTICLES.filter(a => a.category === category.id);
            return (
              <section key={category.id} id={`rubrique-${category.id}`} className="scroll-mt-24 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{category.label}</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{category.summary}</p>
                  </div>
                </div>
                <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {list.map(a => (
                    <li key={a.id} className="mx-card flex flex-col p-4">
                      <Link to={`/aide/${a.id}`} className="font-semibold text-gray-900 dark:text-white hover:text-primary-700 dark:hover:text-primary-300">{a.title}</Link>
                      <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">{a.summary}</p>
                      <ul className="mt-3 space-y-0.5 border-t-[1.5px] border-gray-100 dark:border-gray-700/70 pt-2">
                        {a.tasks.slice(0, 5).map(task => (
                          <li key={task.id}>
                            <Link to={`/aide/${a.id}#${taskAnchor(task)}`} className="flex items-center gap-1.5 rounded px-1 py-0.5 text-sm text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/30">
                              <ChevronRight size={13} aria-hidden="true" className="shrink-0" /> {task.title}
                            </Link>
                          </li>
                        ))}
                        {a.tasks.length > 5 && (
                          <li><Link to={`/aide/${a.id}`} className="px-1 text-sm text-gray-600 dark:text-gray-400 hover:underline">+ {a.tasks.length - 5} autre(s)</Link></li>
                        )}
                      </ul>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          <section className="scroll-mt-24 space-y-4" id="faq">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white"><HelpCircle size={18} aria-hidden="true" /> Questions fréquentes</h2>
            <div className="grid gap-6 lg:grid-cols-2">
              {FAQ.map(group => (
                <div key={group.group} className="space-y-2">
                  <h3 className="mx-section-label">{group.group}</h3>
                  {group.items.map(item => <FaqEntry key={item.q} item={item} />)}
                </div>
              ))}
            </div>
          </section>

          <section className="scroll-mt-24 space-y-3" id="glossaire">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Glossaire</h2>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {GLOSSARY.map(g => (
                <div key={g.term} className="rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2.5">
                  <dt className="font-semibold text-gray-900 dark:text-white">{g.term}</dt>
                  <dd className="text-sm text-gray-700 dark:text-gray-300">{g.def}</dd>
                </div>
              ))}
            </dl>
          </section>
        </>
      )}
    </div>
  );
};

export default Help;
