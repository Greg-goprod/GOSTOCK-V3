// Achat, garantie, amortissement et batterie d'un outil : formulaire ⇄ base
export interface LifecycleValue {
  purchase_date: string;
  warranty_until: string;
  depreciation_years: string;
  is_battery: boolean;
  battery_life_months: string;
  battery_max_uses: string;
}

export const EMPTY_LIFECYCLE: LifecycleValue = {
  purchase_date: '', warranty_until: '', depreciation_years: '', is_battery: false, battery_life_months: '', battery_max_uses: '',
};

// Valeurs de la base (snake_case) vers le formulaire
export const lifecycleFrom = (e: { purchaseDate?: string | null; warrantyUntil?: string | null; depreciationYears?: number | null; isBattery?: boolean; batteryLifeMonths?: number | null; batteryMaxUses?: number | null }): LifecycleValue => ({
  purchase_date: e.purchaseDate ?? '',
  warranty_until: e.warrantyUntil ?? '',
  depreciation_years: e.depreciationYears ? String(e.depreciationYears) : '',
  is_battery: Boolean(e.isBattery),
  battery_life_months: e.batteryLifeMonths ? String(e.batteryLifeMonths) : '',
  battery_max_uses: e.batteryMaxUses ? String(e.batteryMaxUses) : '',
});

export const lifecyclePayload = (v: LifecycleValue) => ({
  purchase_date: v.purchase_date || null,
  warranty_until: v.warranty_until || null,
  depreciation_years: v.depreciation_years ? Number(v.depreciation_years) : null,
  is_battery: v.is_battery,
  battery_life_months: v.is_battery && v.battery_life_months ? Number(v.battery_life_months) : null,
  battery_max_uses: v.is_battery && v.battery_max_uses ? Number(v.battery_max_uses) : null,
});
