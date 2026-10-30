import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, Package, Users, CalendarClock, Bell, Settings, ScanLine, Droplets, ClipboardList, Inbox, Truck,
  BarChart3, ScanBarcode, Contact, Tags, Wrench, AlertTriangle, ListChecks, ShoppingCart, Coins, Gauge, History,
  HardHat, Map as MapIcon, Briefcase, GraduationCap, KeyRound, ArrowLeftRight, MapPin, CalendarRange, ShieldCheck,
  Hammer, Calculator, Hand, MonitorPlay, Search, TrendingUp, Stethoscope, Rocket, Boxes, Activity, Building2, Sun,
} from 'lucide-react';

export interface NavLinkItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export interface NavSpace {
  id: string;
  label: string;
  // Libellé court sous l'icône du rail
  short: string;
  icon: LucideIcon;
  links: NavLinkItem[];
}

// Navigation en 5 espaces (rail + liste de l'espace) : 42 pages rangées par usage
export const NAV_SPACES: NavSpace[] = [
  { id: 'daily', label: 'Quotidien', short: 'Quotidien', icon: Sun, links: [
    { to: '/', label: "Aujourd'hui", icon: LayoutDashboard },
    { to: '/comptoir', label: 'Comptoir', icon: ScanBarcode },
    { to: '/demandes', label: 'Demandes', icon: Inbox },
    { to: '/checkouts', label: 'Sorties', icon: CalendarClock },
    { to: '/scan', label: 'Scanner', icon: ScanLine },
    { to: '/recherche', label: 'Recherche', icon: Search },
    { to: '/libre-service', label: 'Libre-service', icon: Hand },
    { to: '/badge', label: 'Mon badge', icon: Contact },
  ] },
  { id: 'field', label: 'Chantiers & flotte', short: 'Chantiers', icon: HardHat, links: [
    { to: '/chantiers', label: 'Chantiers', icon: HardHat },
    { to: '/carte', label: 'Carte', icon: MapIcon },
    { to: '/planning', label: 'Planning', icon: CalendarRange },
    { to: '/vehicules', label: 'Véhicules', icon: Truck },
    { to: '/locations', label: 'Locations', icon: KeyRound },
  ] },
  { id: 'stock', label: 'Stock', short: 'Stock', icon: Boxes, links: [
    { to: '/equipment', label: 'Outils', icon: Package },
    { to: '/consommables', label: 'Consommables', icon: Droplets },
    { to: '/kits', label: 'Kits', icon: Briefcase },
    { to: '/inventaire', label: 'Inventaire', icon: ListChecks },
    { to: '/transferts', label: 'Transferts', icon: ArrowLeftRight },
    { to: '/emplacements', label: 'Emplacements', icon: MapPin },
    { to: '/commande', label: 'À commander', icon: ClipboardList },
    { to: '/commandes', label: 'Commandes', icon: ShoppingCart },
    { to: '/prevision', label: "Prévision d'achat", icon: TrendingUp },
    { to: '/etiquettes', label: 'Étiquettes', icon: Tags },
  ] },
  { id: 'follow', label: 'Suivi', short: 'Suivi', icon: Activity, links: [
    { to: '/notifications', label: 'Notifications', icon: Bell },
    { to: '/entretien', label: 'Entretien', icon: Wrench },
    { to: '/atelier', label: 'Atelier', icon: Hammer },
    { to: '/incidents', label: 'Pertes et casse', icon: AlertTriangle },
    { to: '/pilotage', label: 'Pilotage', icon: Gauge },
    { to: '/tableau-de-bord', label: 'Statistiques', icon: BarChart3 },
    { to: '/couts', label: 'Coûts', icon: Coins },
    { to: '/comptabilite', label: 'Comptabilité', icon: Calculator },
    { to: '/ecran', label: 'Écran du magasin', icon: MonitorPlay },
  ] },
  { id: 'admin', label: 'Administration', short: 'Admin', icon: Building2, links: [
    { to: '/users', label: 'Personnes', icon: Users },
    { to: '/formations', label: 'Formations', icon: GraduationCap },
    { to: '/epi', label: 'EPI', icon: ShieldCheck },
    { to: '/journal', label: 'Journal', icon: History },
    { to: '/donnees', label: 'Santé des données', icon: Stethoscope },
    { to: '/demarrage', label: 'Démarrage', icon: Rocket },
    { to: '/settings', label: 'Paramètres', icon: Settings },
  ] },
];

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
export const MOBILE_SHORTCUTS = ['/', '/comptoir', '/demandes', '/scan', '/recherche', '/badge'];
