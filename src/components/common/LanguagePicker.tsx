import React, { useState } from 'react';
import { Languages } from 'lucide-react';
import { LANGUAGES, Language, getLanguage, setLanguage } from '../../i18n/translator';

// Choix de la langue de l'interface (les noms des langues restent dans leur propre langue)
const LanguagePicker: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [language, setCurrent] = useState<Language>(getLanguage());
  return (
    <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300" translate="no">
      <Languages size={16} aria-hidden="true" />
      {!compact && <span className="sr-only">Langue</span>}
      <select
        value={language}
        onChange={e => { const l = e.target.value as Language; setCurrent(l); setLanguage(l); }}
        aria-label="Langue / Sprache / Lingua / Language"
        className="notranslate rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-gray-900 dark:text-gray-100"
      >
        {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
      </select>
    </label>
  );
};

export default LanguagePicker;
