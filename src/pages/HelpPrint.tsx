import React, { useEffect } from 'react';
import { Printer } from 'lucide-react';
import { ARTICLES, CATEGORIES, FAQ, GLOSSARY } from '../help/content';

// Mode d'emploi complet, mis en page pour l'impression ou « Enregistrer en PDF ».
// Le fichier public/aide/GO-Mat-mode-emploi.pdf est produit depuis cette page (scripts/help-screenshots.cjs).
const HelpPrint: React.FC = () => {
  // Toujours en clair, quelle que soit la préférence de l'écran
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains('dark');
    root.classList.remove('dark');
    document.title = 'GO-Mat — Mode d\'emploi';
    return () => { if (wasDark) root.classList.add('dark'); };
  }, []);

  return (
    <div className="help-print mx-auto max-w-[820px] bg-white px-8 py-10 text-gray-900">
      <style>{`
        @page { margin: 14mm; }
        .help-print h2 { break-before: page; }
        .help-print .step, .help-print figure, .help-print .faq { break-inside: avoid; }
        @media print { .no-print { display: none !important; } body { background: #fff; } }
      `}</style>
      <button type="button" onClick={() => window.print()}
        className="no-print mb-6 inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 font-semibold text-white">
        <Printer size={16} aria-hidden="true" /> Imprimer ou enregistrer en PDF
      </button>

      <header className="mb-10 border-b-2 border-gray-900 pb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">GO-Mat · gestion du matériel</p>
        <h1 className="mt-2 text-4xl font-bold">Mode d'emploi</h1>
        <p className="mt-2 text-gray-700">Démarrage rapide, modes d'emploi par métier, questions fréquentes et glossaire.</p>
        <ol className="mt-6 columns-2 text-sm">
          {CATEGORIES.map(c => <li key={c.id}>{c.label}</li>)}
          <li>Questions fréquentes</li>
          <li>Glossaire</li>
        </ol>
      </header>

      {CATEGORIES.map(category => (
        <section key={category.id}>
          <h2 className="mb-6 text-2xl font-bold text-primary-700">{category.label}</h2>
          {ARTICLES.filter(a => a.category === category.id).map(article => (
            <article key={article.id} className="mb-10">
              <h3 className="text-xl font-bold">{article.title}</h3>
              <p className="mb-4 text-gray-700">{article.summary}</p>
              <ol className="space-y-4">
                {article.steps.map((step, index) => (
                  <li key={index} className="step flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">{index + 1}</span>
                    <div className="flex-1">
                      <p>{step.text}</p>
                      {step.shot && (
                        <figure className="mt-2">
                          <img src={`/aide/${step.shot}.jpg`} alt="" className="mx-auto max-h-[420px] w-auto max-w-full rounded border border-gray-300"
                            onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} />
                        </figure>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              {article.tips?.length ? <p className="mt-3 text-sm"><strong>Astuces : </strong>{article.tips.join(' ')}</p> : null}
              {article.warnings?.length ? <p className="mt-2 text-sm"><strong>Attention : </strong>{article.warnings.join(' ')}</p> : null}
            </article>
          ))}
        </section>
      ))}

      <section>
        <h2 className="mb-6 text-2xl font-bold text-primary-700">Questions fréquentes</h2>
        {FAQ.map(group => (
          <div key={group.group} className="mb-6">
            <h3 className="mb-2 text-lg font-bold">{group.group}</h3>
            {group.items.map(item => (
              <div key={item.q} className="faq mb-3">
                <p className="font-semibold">{item.q}</p>
                <p className="text-gray-700">{item.a}</p>
              </div>
            ))}
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-6 text-2xl font-bold text-primary-700">Glossaire</h2>
        <dl className="space-y-2">
          {GLOSSARY.map(g => (
            <div key={g.term} className="faq"><dt className="inline font-semibold">{g.term} : </dt><dd className="inline text-gray-700">{g.def}</dd></div>
          ))}
        </dl>
      </section>
    </div>
  );
};

export default HelpPrint;
