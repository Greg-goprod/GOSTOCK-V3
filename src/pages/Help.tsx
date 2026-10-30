import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, ChevronRight, FileDown, HelpCircle, Search } from 'lucide-react';
import HelpArticleView from '../components/help/HelpArticleView';
import { ARTICLES, CATEGORIES, FAQ, GLOSSARY, FaqItem, searchHelp } from '../help/content';

const FaqEntry: React.FC<{ item: FaqItem }> = ({ item }) => (
  <details className="group rounded-md border-[1.5px] border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
    <summary className="cursor-pointer list-none font-semibold text-gray-900 dark:text-white flex items-center justify-between gap-3">
      {item.q}
      <ChevronRight size={16} aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-90" />
    </summary>
    <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{item.a}</p>
    {item.article && (
      <Link to={`/aide/${item.article}`} className="mt-2 inline-block text-sm font-semibold text-primary-700 dark:text-primary-300 hover:underline">
        Voir le mode d'emploi
      </Link>
    )}
  </details>
);

// Rubrique d'aide : démarrage rapide, modes d'emploi par métier, FAQ, glossaire, PDF
const Help: React.FC = () => {
  const { id } = useParams();
  const [query, setQuery] = useState('');
  const found = useMemo(() => searchHelp(query), [query]);
  const article = id ? ARTICLES.find(a => a.id === id) : undefined;

  if (id) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link to="/aide" className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:underline">
          <ArrowLeft size={14} aria-hidden="true" /> Aide
        </Link>
        {article ? <HelpArticleView article={article} /> : <p className="text-gray-700 dark:text-gray-300">Cet article n'existe pas.</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mx-page-title">Aide</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">Modes d'emploi, questions fréquentes et glossaire. Le « ? » en haut de chaque page ouvre l'aide de cette page.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/aide/GO-Mat-mode-emploi.pdf" download className="mx-btn mx-btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-sm">
            <FileDown size={16} aria-hidden="true" /> Mode d'emploi (PDF)
          </a>
          <a href="/aide/imprimer" target="_blank" rel="noopener" className="mx-btn mx-btn-ghost inline-flex items-center gap-1.5 px-3 py-2 text-sm">
            Version imprimable
          </a>
        </div>
      </div>

      <div className="relative max-w-xl">
        <Search size={18} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Ex. rendre un kit, code de connexion, plein écran…"
          aria-label="Chercher dans l'aide"
          className="w-full rounded-md border-[1.5px] border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-2.5 pl-10 pr-3 text-gray-900 dark:text-white" />
      </div>

      {query.trim() ? (
        <section className="space-y-3">
          <h2 className="mx-section-label">Résultats</h2>
          {found.articles.length === 0 && found.faq.length === 0 && <p className="text-gray-600 dark:text-gray-400">Rien trouvé. Essaie un autre mot.</p>}
          <ul className="grid gap-2 sm:grid-cols-2">
            {found.articles.map(a => (
              <li key={a.id}><Link to={`/aide/${a.id}`} className="mx-card mx-card-hover block p-4">
                <p className="font-semibold text-gray-900 dark:text-white">{a.title}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{a.summary}</p>
              </Link></li>
            ))}
          </ul>
          <div className="space-y-2">{found.faq.map(item => <FaqEntry key={item.q} item={item} />)}</div>
        </section>
      ) : (
        <>
          {CATEGORIES.map(category => {
            const list = ARTICLES.filter(a => a.category === category.id);
            return (
              <section key={category.id} className="space-y-3">
                <h2 className="mx-section-label flex items-center gap-1.5"><BookOpen size={13} aria-hidden="true" />{category.label}</h2>
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map(a => (
                    <li key={a.id}><Link to={`/aide/${a.id}`} className="mx-card mx-card-hover block h-full p-4">
                      <p className="font-semibold text-gray-900 dark:text-white">{a.title}</p>
                      <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">{a.summary}</p>
                    </Link></li>
                  ))}
                </ul>
              </section>
            );
          })}

          <section className="space-y-4" id="faq">
            <h2 className="mx-section-label flex items-center gap-1.5"><HelpCircle size={13} aria-hidden="true" />Questions fréquentes</h2>
            {FAQ.map(group => (
              <div key={group.group} className="space-y-2">
                <h3 className="font-semibold text-gray-900 dark:text-white">{group.group}</h3>
                {group.items.map(item => <FaqEntry key={item.q} item={item} />)}
              </div>
            ))}
          </section>

          <section className="space-y-3" id="glossaire">
            <h2 className="mx-section-label">Glossaire</h2>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {GLOSSARY.map(g => (
                <div key={g.term}>
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
