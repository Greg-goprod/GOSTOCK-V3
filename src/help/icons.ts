import { BarChart3, HardHat, Package, Rocket, Settings, Truck, Users, Warehouse, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { HelpCategory } from './types';

export const CATEGORY_ICONS: Record<HelpCategory, LucideIcon> = {
  demarrage: Rocket,
  magasin: Warehouse,
  materiel: Wrench,
  stock: Package,
  vehicules: Truck,
  chantiers: HardHat,
  personnes: Users,
  pilotage: BarChart3,
  reglages: Settings,
};
