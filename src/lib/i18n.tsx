// Textes des composants de la charte Mannyx (dossier components/mx), en français :
// la traduction DE/IT/EN de l'écran est faite par src/i18n/translator.ts comme pour le reste de GO-Mat.
const FR: Record<string, string> = {
  'pickers.clear': 'Effacer',
  'pickers.cancel': 'Annuler',
  'pickers.confirm': 'OK',
  'pickers.selectDate': 'Sélectionner une date',
  'pickers.selectTime': 'Sélectionner une heure',
  'pickers.selectDateTime': 'Sélectionner une date et une heure',
  'pickers.and': 'à',
  'confirm_dialog.title': 'Confirmation',
  'confirm_dialog.confirm': 'Confirmer',
  'confirm_dialog.cancel': 'Annuler',
  'confirm_dialog.irreversible': 'Cette action est irréversible.',
  'confirm_dialog.loading': 'Chargement...',
};

const value = { lang: 'fr' as const, setLang: () => {}, t: (key: string) => FR[key] ?? key };

export function useI18n() {
  return value;
}
