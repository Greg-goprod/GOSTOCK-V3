import { setLanguage as setInterfaceLanguage } from '../i18n/translator';
import React, { createContext, useContext } from 'react';

type Language = 'fr' | 'en' | 'de';

interface Translations {
  [key: string]: {
    [key: string]: string;
  };
}

const translations: Translations = {
  fr: {
    // Navigation
    dashboard: 'Tableau de bord',
    equipment: 'Équipement',
    users: 'Utilisateurs',
    checkouts: 'Emprunts',
    notifications: 'Notifications',
    categories: 'Catégories',
    suppliers: 'Fournisseurs',
    settings: 'Paramètres',
    scan: 'Scanner',
    
    // Views
    grid: 'Grille',
    list: 'Liste',
    filters: 'Filtres',
    
    // Actions
    add: 'Ajouter',
    edit: 'Modifier',
    delete: 'Supprimer',
    save: 'Enregistrer',
    cancel: 'Annuler',
    confirm: 'Confirmer',
    close: 'Fermer',
    back: 'Retour',
    next: 'Suivant',
    previous: 'Précédent',
    apply: 'Appliquer',
    reset: 'Réinitialiser',
    search: 'Rechercher',
    print: 'Imprimer',
    export: 'Exporter',
    import: 'Importer',
    
    // Equipment
    addEquipment: 'Ajouter un équipement',
    editEquipment: 'Modifier l\'équipement',
    equipmentName: 'Nom de l\'équipement',
    serialNumber: 'Numéro de série',
    articleNumber: 'Numéro d\'article',
    description: 'Description',
    category: 'Catégorie',
    group: 'Groupe',
    supplier: 'Fournisseur',
    location: 'Emplacement',
    status: 'Statut',
    quantity: 'Quantité',
    totalQuantity: 'Quantité totale',
    availableQuantity: 'Quantité disponible',
    stock: 'Stock',
    qrCode: 'QR Code',
    qrType: 'Type de QR',
    individual: 'Individuel',
    batch: 'Lot',
    
    // Status
    available: 'Disponible',
    checkedOut: 'Emprunté',
    maintenance: 'En maintenance',
    retired: 'Retiré',
    
    // Users
    addUser: 'Ajouter un utilisateur',
    editUser: 'Modifier l\'utilisateur',
    firstName: 'Prénom',
    lastName: 'Nom',
    name: 'Nom',
    email: 'Email',
    phone: 'Téléphone',
    department: 'Département',
    role: 'Rôle',
    admin: 'Administrateur',
    user: 'Utilisateur',
    
    // Categories & Groups
    addCategory: 'Ajouter une catégorie',
    editCategory: 'Modifier la catégorie',
    addGroup: 'Ajouter un groupe',
    editGroup: 'Modifier le groupe',
    groups: 'Groupes',
    
    // Suppliers
    addSupplier: 'Ajouter un fournisseur',
    editSupplier: 'Modifier le fournisseur',
    contactPerson: 'Personne de contact',
    website: 'Site web',
    
    // Settings
    language: 'Langue',
    theme: 'Thème',
    dark: 'Sombre',
    light: 'Clair',
    systemSettings: 'Paramètres système',
    articlePrefix: 'Préfixe des articles',
    prefixDescription: 'Préfixe utilisé pour générer les numéros d\'articles (5 caractères max)',
    
    // Messages
    loading: 'Chargement...',
    saving: 'Enregistrement...',
    saved: 'Enregistré',
    error: 'Erreur',
    success: 'Succès',
    noData: 'Aucune donnée',
    noResults: 'Aucun résultat',
    confirmDelete: 'Confirmer la suppression',
    deleteConfirmMessage: 'Êtes-vous sûr de vouloir supprimer cet élément ?',
    
    // Dashboard
    recentCheckouts: 'Emprunts récents',
    recentNotifications: 'Notifications récentes',
    viewAll: 'Voir tout',
    overdue: 'En retard',
    
    // Dates
    checkoutDate: 'Date d\'emprunt',
    dueDate: 'Date de retour',
    returnDate: 'Date de retour effective',
    addedDate: 'Date d\'ajout',
    lastMaintenance: 'Dernière maintenance',
    
    // Modal titles
    qrCodeEquipment: 'QR Code Équipement',
    qrCodeUser: 'QR Code Utilisateur',
    
    // Validation
    required: 'Obligatoire',
    invalidEmail: 'Email invalide',
    invalidUrl: 'URL invalide',
    
    // Import/Export
    importExcel: 'Importer Excel',
    downloadTemplate: 'Télécharger le modèle',
    uploadFile: 'Télécharger un fichier',
    
    // Checkout/Return
    checkoutEquipment: 'Sortie de matériel',
    returnEquipment: 'Retour de matériel',
    notes: 'Notes',
    
    // Floating modal
    floatingModal: 'Modal flottant'
  },
  en: {
    // Navigation
    dashboard: 'Dashboard',
    equipment: 'Equipment',
    users: 'Users',
    checkouts: 'Checkouts',
    notifications: 'Notifications',
    categories: 'Categories',
    suppliers: 'Suppliers',
    settings: 'Settings',
    scan: 'Scan',
    
    // Views
    grid: 'Grid',
    list: 'List',
    filters: 'Filters',
    
    // Actions
    add: 'Add',
    edit: 'Edit',
    delete: 'Delete',
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    close: 'Close',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    apply: 'Apply',
    reset: 'Reset',
    search: 'Search',
    print: 'Print',
    export: 'Export',
    import: 'Import',
    
    // Equipment
    addEquipment: 'Add Equipment',
    editEquipment: 'Edit Equipment',
    equipmentName: 'Equipment Name',
    serialNumber: 'Serial Number',
    articleNumber: 'Article Number',
    description: 'Description',
    category: 'Category',
    group: 'Group',
    supplier: 'Supplier',
    location: 'Location',
    status: 'Status',
    quantity: 'Quantity',
    totalQuantity: 'Total Quantity',
    availableQuantity: 'Available Quantity',
    stock: 'Stock',
    qrCode: 'QR Code',
    qrType: 'QR Type',
    individual: 'Individual',
    batch: 'Batch',
    
    // Status
    available: 'Available',
    checkedOut: 'Checked Out',
    maintenance: 'Maintenance',
    retired: 'Retired',
    
    // Users
    addUser: 'Add User',
    editUser: 'Edit User',
    firstName: 'First Name',
    lastName: 'Last Name',
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    department: 'Department',
    role: 'Role',
    admin: 'Administrator',
    user: 'User',
    
    // Categories & Groups
    addCategory: 'Add Category',
    editCategory: 'Edit Category',
    addGroup: 'Add Group',
    editGroup: 'Edit Group',
    groups: 'Groups',
    
    // Suppliers
    addSupplier: 'Add Supplier',
    editSupplier: 'Edit Supplier',
    contactPerson: 'Contact Person',
    website: 'Website',
    
    // Settings
    language: 'Language',
    theme: 'Theme',
    dark: 'Dark',
    light: 'Light',
    systemSettings: 'System Settings',
    articlePrefix: 'Article Prefix',
    prefixDescription: 'Prefix used to generate article numbers (5 characters max)',
    
    // Messages
    loading: 'Loading...',
    saving: 'Saving...',
    saved: 'Saved',
    error: 'Error',
    success: 'Success',
    noData: 'No data',
    noResults: 'No results',
    confirmDelete: 'Confirm Delete',
    deleteConfirmMessage: 'Are you sure you want to delete this item?',
    
    // Dashboard
    recentCheckouts: 'Recent Checkouts',
    recentNotifications: 'Recent Notifications',
    viewAll: 'View All',
    overdue: 'Overdue',
    
    // Dates
    checkoutDate: 'Checkout Date',
    dueDate: 'Due Date',
    returnDate: 'Return Date',
    addedDate: 'Added Date',
    lastMaintenance: 'Last Maintenance',
    
    // Modal titles
    qrCodeEquipment: 'Equipment QR Code',
    qrCodeUser: 'User QR Code',
    
    // Validation
    required: 'Required',
    invalidEmail: 'Invalid email',
    invalidUrl: 'Invalid URL',
    
    // Import/Export
    importExcel: 'Import Excel',
    downloadTemplate: 'Download Template',
    uploadFile: 'Upload File',
    
    // Checkout/Return
    checkoutEquipment: 'Equipment Checkout',
    returnEquipment: 'Equipment Return',
    notes: 'Notes',
    
    // Floating modal
    floatingModal: 'Floating Modal'
  },
  de: {
    // Navigation
    dashboard: 'Dashboard',
    equipment: 'Ausrüstung',
    users: 'Benutzer',
    checkouts: 'Ausleihen',
    notifications: 'Benachrichtigungen',
    categories: 'Kategorien',
    suppliers: 'Lieferanten',
    settings: 'Einstellungen',
    scan: 'Scannen',
    
    // Views
    grid: 'Raster',
    list: 'Liste',
    filters: 'Filter',
    
    // Actions
    add: 'Hinzufügen',
    edit: 'Bearbeiten',
    delete: 'Löschen',
    save: 'Speichern',
    cancel: 'Abbrechen',
    confirm: 'Bestätigen',
    close: 'Schließen',
    back: 'Zurück',
    next: 'Weiter',
    previous: 'Vorherige',
    apply: 'Anwenden',
    reset: 'Zurücksetzen',
    search: 'Suchen',
    print: 'Drucken',
    export: 'Exportieren',
    import: 'Importieren',
    
    // Equipment
    addEquipment: 'Ausrüstung hinzufügen',
    editEquipment: 'Ausrüstung bearbeiten',
    equipmentName: 'Ausrüstungsname',
    serialNumber: 'Seriennummer',
    articleNumber: 'Artikelnummer',
    description: 'Beschreibung',
    category: 'Kategorie',
    group: 'Gruppe',
    supplier: 'Lieferant',
    location: 'Standort',
    status: 'Status',
    quantity: 'Menge',
    totalQuantity: 'Gesamtmenge',
    availableQuantity: 'Verfügbare Menge',
    stock: 'Bestand',
    qrCode: 'QR-Code',
    qrType: 'QR-Typ',
    individual: 'Individuell',
    batch: 'Charge',
    
    // Status
    available: 'Verfügbar',
    checkedOut: 'Ausgeliehen',
    maintenance: 'Wartung',
    retired: 'Ausgemustert',
    
    // Users
    addUser: 'Benutzer hinzufügen',
    editUser: 'Benutzer bearbeiten',
    firstName: 'Vorname',
    lastName: 'Nachname',
    name: 'Name',
    email: 'E-Mail',
    phone: 'Telefon',
    department: 'Abteilung',
    role: 'Rolle',
    admin: 'Administrator',
    user: 'Benutzer',
    
    // Categories & Groups
    addCategory: 'Kategorie hinzufügen',
    editCategory: 'Kategorie bearbeiten',
    addGroup: 'Gruppe hinzufügen',
    editGroup: 'Gruppe bearbeiten',
    groups: 'Gruppen',
    
    // Suppliers
    addSupplier: 'Lieferant hinzufügen',
    editSupplier: 'Lieferant bearbeiten',
    contactPerson: 'Ansprechpartner',
    website: 'Website',
    
    // Settings
    language: 'Sprache',
    theme: 'Design',
    dark: 'Dunkel',
    light: 'Hell',
    systemSettings: 'Systemeinstellungen',
    articlePrefix: 'Artikel-Präfix',
    prefixDescription: 'Präfix für die Generierung von Artikelnummern (max. 5 Zeichen)',
    
    // Messages
    loading: 'Laden...',
    saving: 'Speichern...',
    saved: 'Gespeichert',
    error: 'Fehler',
    success: 'Erfolg',
    noData: 'Keine Daten',
    noResults: 'Keine Ergebnisse',
    confirmDelete: 'Löschen bestätigen',
    deleteConfirmMessage: 'Sind Sie sicher, dass Sie dieses Element löschen möchten?',
    
    // Dashboard
    recentCheckouts: 'Aktuelle Ausleihen',
    recentNotifications: 'Aktuelle Benachrichtigungen',
    viewAll: 'Alle anzeigen',
    overdue: 'Überfällig',
    
    // Dates
    checkoutDate: 'Ausleihdatum',
    dueDate: 'Rückgabedatum',
    returnDate: 'Tatsächliches Rückgabedatum',
    addedDate: 'Hinzugefügt am',
    lastMaintenance: 'Letzte Wartung',
    
    // Modal titles
    qrCodeEquipment: 'Ausrüstungs-QR-Code',
    qrCodeUser: 'Benutzer-QR-Code',
    
    // Validation
    required: 'Erforderlich',
    invalidEmail: 'Ungültige E-Mail',
    invalidUrl: 'Ungültige URL',
    
    // Import/Export
    importExcel: 'Excel importieren',
    downloadTemplate: 'Vorlage herunterladen',
    uploadFile: 'Datei hochladen',
    
    // Checkout/Return
    checkoutEquipment: 'Ausrüstung ausleihen',
    returnEquipment: 'Ausrüstung zurückgeben',
    notes: 'Notizen',
    
    // Floating modal
    floatingModal: 'Schwebendes Modal'
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

// Les textes restent en français ici : la traduction de toute l'interface (DE/IT/EN) est faite par src/i18n/translator.ts
export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const language: Language = 'fr';
  const setLanguage = (lang: Language) => { void setInterfaceLanguage(lang); };
  const t = (key: string): string => translations[language][key] || key;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
