import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, Package, Users, CalendarClock, Bell, Settings, ScanLine, Droplets, ClipboardList, Inbox, Truck,
  BarChart3, ScanBarcode, Contact, Tags, Wrench, AlertTriangle, ListChecks, ShoppingCart, Coins, Gauge, History,
  HardHat, Map as MapIcon, Briefcase, GraduationCap, KeyRound, ArrowLeftRight, MapPin, CalendarRange, ShieldCheck,
  Hammer, Calculator, Hand, MonitorPlay, Search, TrendingUp, Stethoscope, Rocket, Home, Warehouse, LifeBuoy, ShoppingBag, Building2,
  Boxes, Compass,
} from 'lucide-react';

export interface NavLinkItem {
  to: string;
  label: string;
  icon: LucideIcon;
  // S'ouvre dans un nouvel onglet (écran TV du dépôt, laissé affiché en continu)
  newTab?: boolean;
}

// Les deux produits de la plateforme : Logistique (GO-Mat, tout ce qui existait) et PILOTE (planification
// et gestion de projets). Les espaces sans produit (Réglages, Aide) sont communs et restent en bas du rail.
export type ProductId = 'logistics' | 'pilote';

export interface NavProduct {
  id: ProductId;
  label: string;
  icon: LucideIcon;
}

export const PRODUCTS: NavProduct[] = [
  { id: 'logistics', label: 'Logistique', icon: Boxes },
  { id: 'pilote', label: 'PILOTE', icon: Compass },
];

export interface NavSpace {
  id: string;
  // Produit auquel appartient l'espace ; absent = commun (Réglages, Aide)
  product?: ProductId;
  label: string;
  // Libellé court sous l'icône du rail
  short: string;
  icon: LucideIcon;
  links: NavLinkItem[];
}

// Navigation par métier : un espace par domaine (rail) et ses pages (liste de l'espace).
// Un espace d'une seule page s'ouvre directement depuis le rail.
export const NAV_SPACES: NavSpace[] = [
  { id: 'home', product: 'logistics', label: 'Accueil', short: 'Accueil', icon: Home, links: [
    { to: '/', label: 'Accueil', icon: LayoutDashboard },
    { to: '/recherche', label: 'Recherche', icon: Search },
    { to: '/notifications', label: 'Notifications', icon: Bell },
    { to: '/badge', label: 'Mon badge', icon: Contact },
  ] },
  { id: 'store', product: 'logistics', label: 'Magasin', short: 'Magasin', icon: Warehouse, links: [
    { to: '/shop', label: 'Shop', icon: ShoppingBag },
    { to: '/comptoir', label: 'Comptoir', icon: ScanBarcode },
    { to: '/scan', label: 'Scanner', icon: ScanLine },
    { to: '/demandes', label: 'Demandes', icon: Inbox },
    { to: '/checkouts', label: 'Sorties', icon: CalendarClock },
    { to: '/libre-service', label: 'Libre-service', icon: Hand },
    { to: '/transferts', label: 'Transferts', icon: ArrowLeftRight },
    { to: '/emplacements', label: 'Emplacements', icon: MapPin },
    { to: '/inventaire', label: 'Inventaire', icon: ListChecks },
    { to: '/ecran', label: 'Écran TV du dépôt', icon: MonitorPlay, newTab: true },
  ] },
  { id: 'tools', product: 'logistics', label: 'Matériel', short: 'Matériel', icon: Package, links: [
    { to: '/equipment', label: 'Outils', icon: Package },
    { to: '/kits', label: 'Kits', icon: Briefcase },
    { to: '/entretien', label: 'Entretien', icon: Wrench },
    { to: '/atelier', label: 'Atelier', icon: Hammer },
    { to: '/incidents', label: 'Pertes et casse', icon: AlertTriangle },
    { to: '/etiquettes', label: 'Étiquettes', icon: Tags },
  ] },
  { id: 'supplies', product: 'logistics', label: 'Consommables', short: 'Consom.', icon: Droplets, links: [
    { to: '/consommables', label: 'Consommables', icon: Droplets },
    { to: '/commande', label: 'À commander', icon: ClipboardList },
    { to: '/commandes', label: 'Commandes', icon: ShoppingCart },
    { to: '/prevision', label: "Prévision d'achat", icon: TrendingUp },
  ] },
  { id: 'fleet', product: 'logistics', label: 'Véhicules', short: 'Véhicules', icon: Truck, links: [
    { to: '/vehicules', label: 'Véhicules', icon: Truck },
  ] },
  { id: 'sites', product: 'logistics', label: 'Chantiers', short: 'Chantiers', icon: HardHat, links: [
    { to: '/chantiers', label: 'Chantiers', icon: HardHat },
    { to: '/carte', label: 'Carte', icon: MapIcon },
    { to: '/planning', label: 'Planning', icon: CalendarRange },
    { to: '/locations', label: 'Locations', icon: KeyRound },
  ] },
  { id: 'people', product: 'logistics', label: 'Personnes', short: 'Personnes', icon: Users, links: [
    { to: '/users', label: 'Personnes', icon: Users },
    { to: '/formations', label: 'Permis et formations', icon: GraduationCap },
    { to: '/epi', label: 'EPI', icon: ShieldCheck },
  ] },
  { id: 'steering', product: 'logistics', label: 'Suivi', short: 'Suivi', icon: Gauge, links: [
    { to: '/pilotage', label: 'Suivi', icon: Gauge },
    { to: '/tableau-de-bord', label: 'Statistiques', icon: BarChart3 },
    { to: '/couts', label: 'Coûts', icon: Coins },
    { to: '/comptabilite', label: 'Comptabilité', icon: Calculator },
    { to: '/journal', label: 'Journal', icon: History },
  ] },
  // PILOTE : planification et gestion de projets (module payant, visible seulement s'il est activé pour l'entreprise)
  { id: 'pilote-planning', product: 'pilote', label: 'Planification', short: 'Planning', icon: CalendarClock, links: [
    { to: '/pilote/planning', label: 'Planning', icon: CalendarClock },
  ] },
  { id: 'settings', label: 'Réglages', short: 'Réglages', icon: Settings, links: [
    { to: '/settings', label: 'Paramètres', icon: Settings },
    { to: '/donnees', label: 'Santé des données', icon: Stethoscope },
    { to: '/demarrage', label: 'Démarrage', icon: Rocket },
    { to: '/entreprises', label: 'Entreprises', icon: Building2 },
  ] },
  { id: 'help', label: 'Aide', short: 'Aide', icon: LifeBuoy, links: [
    { to: '/aide', label: 'Aide et mode d\'emploi', icon: LifeBuoy },
  ] },
];

// Espaces rangés en bas du rail (réglages), communs aux deux produits
export const BOTTOM_SPACES = ['help', 'settings'];

// Pages hors menu, pour le fil d'Ariane
const EXTRA_TITLES: Record<string, string> = {
  '/badges': 'Impression des badges',
};

const matches = (path: string, to: string) => (to === '/' ? path === '/' : path === to || path.startsWith(`${to}/`));

// Espace et page de l'adresse courante (la correspondance la plus longue gagne : /commande ≠ /commandes)
export function locate(path: string): { space?: NavSpace; link?: NavLinkItem; title: string } {
  let best: { space: NavSpace; link: NavLinkItem } | undefined;
  for (const space of NAV_SPACES) {
    for (const link of space.links) {
      if (matches(path, link.to) && (!best || link.to.length > best.link.to.length)) best = { space, link };
    }
  }
  if (best) return { ...best, title: best.link.label };
  const extra = Object.keys(EXTRA_TITLES).find(p => matches(path, p));
  return { title: extra ? EXTRA_TITLES[extra] : 'GO-Mat' };
}

// Raccourcis de la barre du bas sur téléphone, dans l'ordre de préférence (les 4 premiers accessibles)
export const MOBILE_SHORTCUTS = ['/', '/scan', '/comptoir', '/shop', '/demandes', '/badge', '/recherche'];
