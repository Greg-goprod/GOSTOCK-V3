import { supabase } from './supabase';
import { fileUrl } from './files';
import { getLanguage, translateDocument } from '../i18n/translator';

// État des lieux d'une location (réception chez le loueur, restitution) : document interne qui prouve
// l'état du véhicule ou de l'outil, avec l'heure du serveur

export type RentalKind = 'vehicle' | 'equipment' | 'other';
export type InspectionKind = 'reception' | 'return';

export interface InspectionDamage {
  zone: string;
  description: string;
  photo: string | null;
}

export interface InspectionAccessory {
  label: string;
  present: boolean;
}

export interface RentalInspection {
  id: string;
  rental_id: string;
  kind: InspectionKind;
  done_at: string;
  km: number | null;
  fuel_level: number | null;
  hours: number | null;
  photos: Record<string, string>;
  extra_photos: string[];
  damages: InspectionDamage[];
  accessories: InspectionAccessory[];
  notes: string | null;
  staff_name: string;
  staff_signature: string;
  lessor_name: string | null;
  lessor_signature: string | null;
}

export interface InspectedRental {
  id: string;
  kind: RentalKind;
  description: string;
  rental_company: string;
  contract_ref: string | null;
  plate: string | null;
  quantity: number;
  start_on: string;
  end_on: string;
}

// Vues guidées : les mêmes à la réception et à la restitution, pour comparer
export const VIEWS: Record<'vehicle' | 'equipment', { id: string; label: string; required: boolean }[]> = {
  vehicle: [
    { id: 'front', label: 'Avant', required: true },
    { id: 'back', label: 'Arrière', required: true },
    { id: 'left', label: 'Côté gauche', required: true },
    { id: 'right', label: 'Côté droit', required: true },
    { id: 'dashboard', label: 'Compteur (km et carburant)', required: true },
    { id: 'interior', label: 'Intérieur', required: false },
  ],
  equipment: [
    { id: 'overview', label: 'Vue d\'ensemble', required: true },
    { id: 'plate', label: 'Plaque signalétique', required: true },
  ],
};

export const DEFAULT_ACCESSORIES: Record<'vehicle' | 'equipment', string[]> = {
  vehicle: ['Clés', 'Permis de circulation', 'Carte carburant', 'Triangle de panne', 'Gilet de sécurité', 'Roue de secours ou kit de réparation'],
  equipment: ['Clés ou badge', 'Chargeur ou câbles', 'Notice d\'utilisation'],
};

export const DAMAGE_ZONES = ['Avant', 'Arrière', 'Côté gauche', 'Côté droit', 'Toit', 'Vitres', 'Jantes et pneus', 'Intérieur', 'Autre'];

const FUEL = ['Vide', '1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8', 'Plein'];

export async function loadInspections(rentalIds: string[]): Promise<RentalInspection[]> {
  if (!rentalIds.length) return [];
  const { data, error } = await supabase.from('rental_inspections').select('*').in('rental_id', rentalIds);
  if (error) throw error;
  return (data || []) as RentalInspection[];
}

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const LOCALES = { fr: 'fr-CH', de: 'de-CH', it: 'it-CH', en: 'en-GB' } as const;
const locale = () => LOCALES[getLanguage()] ?? 'fr-CH';
const stamp = (at: string) => new Date(at).toLocaleString(locale(), { dateStyle: 'short', timeStyle: 'short' });
const day = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(locale());

// PV imprimable (« Enregistrer en PDF » dans la fenêtre d'impression). Avec les deux états des lieux,
// les vues sont mises côte à côte : réception à gauche, restitution à droite.
export async function printInspection(rental: InspectedRental, inspections: RentalInspection[]) {
  const win = window.open('', '_blank');
  if (!win) throw new Error('Autorisez les fenêtres pour imprimer le PV');
  const reception = inspections.find(i => i.kind === 'reception');
  const back = inspections.find(i => i.kind === 'return');
  const shown = [reception, back].filter(Boolean) as RentalInspection[];

  // Liens temporaires des photos privées
  const paths = new Set<string>();
  for (const i of shown) {
    Object.values(i.photos).forEach(p => paths.add(p));
    i.extra_photos.forEach(p => paths.add(p));
    i.damages.forEach(d => d.photo && paths.add(d.photo));
  }
  const urls = new Map<string, string>();
  await Promise.all([...paths].map(async p => {
    const url = await fileUrl(p);
    if (url) urls.set(p, url);
  }));
  const [org, logo] = await Promise.all([
    supabase.from('organizations').select('name').limit(1).maybeSingle(),
    supabase.from('system_settings').select('value').eq('id', 'company_logo').maybeSingle(),
  ]);
  const img = (path?: string | null) => (path && urls.get(path) ? `<img src="${urls.get(path)}" alt="">` : '<div class="none">—</div>');
  const views = VIEWS[rental.kind === 'vehicle' ? 'vehicle' : 'equipment'];
  const label = (kind: InspectionKind) => (kind === 'reception' ? 'Réception' : 'Restitution');

  const readings = (i: RentalInspection) => [
    i.km !== null ? `<span>Kilométrage :</span> <b>${i.km.toLocaleString(locale())} km</b>` : '',
    i.fuel_level !== null ? `<span>Carburant :</span> <b>${FUEL[i.fuel_level]}</b>` : '',
    i.hours !== null ? `<span>Compteur d'heures :</span> <b>${Number(i.hours).toLocaleString(locale())} h</b>` : '',
  ].filter(Boolean).join(' · ');

  const damages = (i: RentalInspection) => (i.damages.length
    ? `<table><thead><tr><th>Zone</th><th>Description</th><th>Photo</th></tr></thead><tbody>${i.damages.map(d =>
        `<tr><td>${escape(d.zone)}</td><td>${escape(d.description)}</td><td class="ph">${d.photo ? img(d.photo) : ''}</td></tr>`).join('')}</tbody></table>`
    : '<p>Aucun dégât constaté.</p>');

  const accessories = (i: RentalInspection) => (i.accessories.length
    ? `<ul class="acc">${i.accessories.map(a => `<li>${a.present ? '☑' : '☐'} <span>${escape(a.label)}</span></li>`).join('')}</ul>`
    : '<p>—</p>');

  const signatures = (i: RentalInspection) => `<div class="sig">
      <div><img src="${i.staff_signature}" alt=""><p>${escape(i.staff_name)}<br><small>pour ${escape(org.data?.name ?? 'GO-Mat')}</small></p></div>
      <div>${i.lessor_signature ? `<img src="${i.lessor_signature}" alt="">` : '<div class="blank"></div>'}<p>${i.lessor_name ? escape(i.lessor_name) : 'Loueur absent'}<br><small>pour ${escape(rental.rental_company)}</small></p></div>
    </div>`;

  const column = (i: RentalInspection) => `<section>
      <h2>${label(i.kind)} · ${stamp(i.done_at)}</h2>
      <p>${readings(i) || '&nbsp;'}</p>
      <h3>${i.kind === 'reception' ? 'Dégâts déjà présents à la réception' : 'Dégâts constatés à la restitution'}</h3>
      ${damages(i)}
      <h3>Accessoires</h3>${accessories(i)}
      ${i.notes ? `<h3>Remarques</h3><p>${escape(i.notes)}</p>` : ''}
      <h3>Signatures</h3>${signatures(i)}
    </section>`;

  const photoGrid = `<h2>Photos</h2><table class="views"><thead><tr><th>Vue</th>${shown.map(i => `<th>${label(i.kind)}</th>`).join('')}</tr></thead><tbody>
    ${views.map(v => `<tr><td>${escape(v.label)}</td>${shown.map(i => `<td class="ph">${img(i.photos[v.id])}</td>`).join('')}</tr>`).join('')}
    </tbody></table>
    ${shown.map(i => (i.extra_photos.length ? `<h3>Autres photos (${label(i.kind).toLowerCase()})</h3><div class="extra">${i.extra_photos.map(p => img(p)).join('')}</div>` : '')).join('')}`;

  const title = back ? 'PV de réception et de restitution' : 'PV de réception';
  win.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${title} · ${escape(rental.description)}</title>
    <style>
      @page { margin: 14mm; }
      body { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 11.5px; }
      header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 10px; }
      header img { max-height: 44px; max-width: 160px; }
      h1 { font-size: 18px; margin: 0; } h2 { font-size: 13.5px; margin: 14px 0 6px; } h3 { font-size: 12px; margin: 10px 0 4px; }
      .cols { display: grid; grid-template-columns: repeat(${shown.length}, 1fr); gap: 16px; }
      table { width: 100%; border-collapse: collapse; } th, td { border-bottom: 1px solid #bbb; padding: 4px; text-align: left; vertical-align: top; }
      th { font-size: 10px; text-transform: uppercase; }
      .ph img { width: 100%; max-width: 260px; max-height: 180px; object-fit: contain; }
      .views td:first-child { width: 120px; font-weight: bold; }
      .extra { display: flex; flex-wrap: wrap; gap: 6px; } .extra img { width: 150px; height: 110px; object-fit: cover; }
      .none { color: #888; }
      .acc { list-style: none; padding: 0; margin: 0; columns: 2; }
      .sig { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; } .sig img, .sig .blank { height: 60px; max-width: 100%; border-bottom: 1px solid #000; }
      .sig p { margin: 2px 0 0; } .note { margin-top: 14px; font-size: 10px; color: #444; }
      tr, section, .sig { break-inside: avoid; }
    </style></head><body>
    <header>
      <div><h1>${title}</h1>
        <p><b>${escape(rental.description)}</b>${rental.plate ? ` · <span>${escape(rental.plate)}</span>` : ''}${rental.quantity > 1 ? ` · <span>${rental.quantity} unités</span>` : ''}<br>
        <span>Loueur :</span> <span>${escape(rental.rental_company)}</span>${rental.contract_ref ? ` · <span>contrat ${escape(rental.contract_ref)}</span>` : ''}<br>
        <span>Location du ${day(rental.start_on)} au ${day(rental.end_on)}</span></p></div>
      ${logo.data?.value ? `<img src="${logo.data.value}" alt="">` : `<b>${escape(org.data?.name ?? '')}</b>`}
    </header>
    <div class="cols">${shown.map(column).join('')}</div>
    ${photoGrid}
    <p class="note">Document interne établi avec GO-Mat. Date et heure enregistrées par le serveur au moment de l'état des lieux.</p>
    </body></html>`);
  win.document.close();
  // Le PV suit la langue de l'interface (les données saisies restent telles quelles)
  translateDocument(win.document);
  // Impression une fois les photos chargées
  const print = () => setTimeout(() => win.print(), 400);
  if (win.document.readyState === 'complete') print();
  else win.addEventListener('load', print, { once: true });
}
