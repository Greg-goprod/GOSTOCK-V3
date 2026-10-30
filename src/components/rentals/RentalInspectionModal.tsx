import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../common/Modal';
import Button from '../common/Button';
import PhotoInput from '../common/PhotoInput';
import FuelInput from '../common/FuelInput';
import SignaturePad from '../common/SignaturePad';
import { supabase } from '../../lib/supabase';
import { fileUrl } from '../../lib/files';
import { errorMessage } from '../../lib/requests';
import { translateText } from '../../i18n/translator';
import {
  DAMAGE_ZONES, DEFAULT_ACCESSORIES, InspectedRental, InspectionAccessory, InspectionKind, RentalInspection, VIEWS,
} from '../../lib/rentalInspection';

interface Props {
  rental: InspectedRental;
  kind: InspectionKind;
  reception?: RentalInspection;   // à la restitution : pour comparer et reprendre les accessoires
  onClose: () => void;
  onDone: () => void;
}

interface DamageDraft {
  zone: string;
  description: string;
  photo: string[];
}

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const FOLDER = 'etats-des-lieux';

// État des lieux avec le loueur : vues guidées, relevés, dégâts, accessoires, signatures
const RentalInspectionModal: React.FC<Props> = ({ rental, kind, reception, onClose, onDone }) => {
  const type = rental.kind === 'vehicle' ? 'vehicle' : 'equipment';
  const views = VIEWS[type];
  const [km, setKm] = useState(reception?.km != null ? String(reception.km) : '');
  const [fuel, setFuel] = useState(reception?.fuel_level ?? 8);
  const [hours, setHours] = useState(reception?.hours != null ? String(reception.hours) : '');
  const [photos, setPhotos] = useState<Record<string, string[]>>({});
  const [extra, setExtra] = useState<string[]>([]);
  const [damages, setDamages] = useState<DamageDraft[]>([]);
  const [accessories, setAccessories] = useState<InspectionAccessory[]>(() =>
    reception?.accessories.length
      ? reception.accessories.map(a => ({ label: a.label, present: a.present }))
      : DEFAULT_ACCESSORIES[type].map(label => ({ label, present: false })));
  const [newAccessory, setNewAccessory] = useState('');
  const [notes, setNotes] = useState('');
  const [staffSignature, setStaffSignature] = useState<string | null>(null);
  const [lessorName, setLessorName] = useState('');
  const [lessorSignature, setLessorSignature] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [receptionUrls, setReceptionUrls] = useState<Record<string, string>>({});

  // À la restitution : vignettes de la réception à côté de chaque vue
  useEffect(() => {
    if (!reception) return;
    Object.entries(reception.photos).forEach(async ([view, path]) => {
      const url = await fileUrl(path);
      if (url) setReceptionUrls(prev => ({ ...prev, [view]: url }));
    });
  }, [reception]);

  const missing = useMemo(() => views.filter(v => v.required && !photos[v.id]?.length).map(v => v.label), [views, photos]);

  const addAccessory = () => {
    const label = newAccessory.trim();
    if (!label) return;
    setAccessories(list => [...list, { label, present: true }]);
    setNewAccessory('');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    // Noms des vues traduits un par un : la liste entière ne correspond à aucune phrase du dictionnaire
    if (missing.length) return toast.error(`Photos manquantes : ${missing.map(label => translateText(label)).join(', ')}`);
    if (type === 'vehicle' && km.trim() === '') return toast.error('Relève le kilométrage');
    if (type === 'vehicle' && reception?.km != null && Number(km) < reception.km) {
      return toast.error(`Le kilométrage ne peut pas être inférieur à celui de la réception (${reception.km.toLocaleString('fr-CH')} km)`);
    }
    if (damages.some(d => !d.description.trim())) return toast.error('Décris chaque dégât');
    if (!staffSignature) return toast.error('Signature de notre collaborateur manquante');
    setSaving(true);
    const { error } = await supabase.rpc('record_rental_inspection', {
      p_rental_id: rental.id,
      p_kind: kind,
      p_data: {
        km: type === 'vehicle' ? Number(km) : null,
        fuel_level: type === 'vehicle' ? fuel : null,
        hours: hours.trim() === '' ? null : Number(hours),
        photos: Object.fromEntries(Object.entries(photos).filter(([, v]) => v.length).map(([k, v]) => [k, v[0]])),
        extra_photos: extra,
        damages: damages.map(d => ({ zone: d.zone, description: d.description.trim(), photo: d.photo[0] ?? null })),
        accessories,
        notes: notes.trim() || null,
        staff_signature: staffSignature,
        lessor_name: lessorName.trim() || null,
        lessor_signature: lessorSignature,
      },
    });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(kind === 'reception'
      ? `${rental.description} : réception enregistrée, ${type === 'vehicle' ? 'le véhicule est dans la flotte' : 'l\'outil est dans le stock'}`
      : `${rental.description} : restitution enregistrée, location clôturée`);
    onDone();
  };

  const title = `${kind === 'reception' ? 'Réception' : 'Restitution'} · ${rental.description}`;

  return (
    <Modal isOpen onClose={onClose} title={title} size="xl">
      <form onSubmit={submit} className="space-y-6">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {kind === 'reception'
            ? `État des lieux chez ${rental.rental_company}, avant de prendre ${type === 'vehicle' ? 'le véhicule' : 'le matériel'}. Photographie tout dégât déjà présent : il ne pourra pas nous être facturé.`
            : `État des lieux au moment de rendre ${type === 'vehicle' ? 'le véhicule' : 'le matériel'} à ${rental.rental_company}. Prends les mêmes vues qu'à la réception.`}
        </p>

        <section className="space-y-3">
          <h3 className="mx-section-label">Relevés</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {type === 'vehicle' && (
              <div>
                <label htmlFor="insp-km" className={labelClass}>Kilométrage</label>
                <input id="insp-km" type="number" min={0} inputMode="numeric" value={km} onChange={e => setKm(e.target.value)} className={`${inputClass} font-mono`} aria-required="true" />
              </div>
            )}
            {type === 'vehicle' && <FuelInput value={fuel} onChange={setFuel} />}
            {type === 'equipment' && (
              <div>
                <label htmlFor="insp-hours" className={labelClass}>Compteur d'heures (si l'engin en a un)</label>
                <input id="insp-hours" type="number" min={0} step="0.1" inputMode="decimal" value={hours} onChange={e => setHours(e.target.value)} className={`${inputClass} font-mono`} />
              </div>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="mx-section-label">Photos</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {views.map(view => (
              <div key={view.id} className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
                <PhotoInput folder={FOLDER} max={1} value={photos[view.id] ?? []}
                  onChange={paths => setPhotos(prev => ({ ...prev, [view.id]: paths }))}
                  label={`${view.label}${view.required ? ' *' : ''}`} />
                {receptionUrls[view.id] && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <img src={receptionUrls[view.id]} alt={`${view.label} à la réception`} className="h-14 w-20 rounded object-cover" />
                    <span>À la réception</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <PhotoInput folder={FOLDER} value={extra} onChange={setExtra} label="Autres photos" />
        </section>

        <section className="space-y-3">
          <h3 className="mx-section-label">{kind === 'reception' ? 'Dégâts déjà présents' : 'Nouveaux dégâts'}</h3>
          {kind === 'return' && reception && (
            <div className="rounded-md bg-gray-50 dark:bg-gray-900/40 p-3 text-sm text-gray-700 dark:text-gray-300">
              <p className="font-medium">Notés à la réception :</p>
              {reception.damages.length
                ? <ul className="list-disc pl-5">{reception.damages.map((d, i) => <li key={i}>{d.zone} : {d.description}</li>)}</ul>
                : <p>aucun dégât.</p>}
            </div>
          )}
          {damages.map((damage, index) => (
            <div key={index} className="grid gap-3 rounded-md border border-gray-200 dark:border-gray-700 p-3 sm:grid-cols-[180px_1fr_auto]">
              <div>
                <label htmlFor={`dmg-zone-${index}`} className={labelClass}>Zone</label>
                <select id={`dmg-zone-${index}`} value={damage.zone} className={inputClass}
                  onChange={e => setDamages(list => list.map((d, i) => (i === index ? { ...d, zone: e.target.value } : d)))}>
                  {(type === 'vehicle' ? DAMAGE_ZONES : ['Carrosserie', 'Moteur', 'Outil de travail', 'Câbles', 'Autre']).map(z => <option key={z} value={z}>{z}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor={`dmg-desc-${index}`} className={labelClass}>Description</label>
                <input id={`dmg-desc-${index}`} value={damage.description} className={inputClass} placeholder="ex. rayure de 10 cm sur la portière"
                  onChange={e => setDamages(list => list.map((d, i) => (i === index ? { ...d, description: e.target.value } : d)))} />
                <PhotoInput folder={FOLDER} max={1} value={damage.photo} label="Photo du dégât"
                  onChange={paths => setDamages(list => list.map((d, i) => (i === index ? { ...d, photo: paths } : d)))} />
              </div>
              <div className="flex items-start sm:pt-6">
                <Button size="sm" variant="danger" icon={<Trash2 size={14} />} ariaLabel="Retirer ce dégât"
                  onClick={() => setDamages(list => list.filter((_, i) => i !== index))} />
              </div>
            </div>
          ))}
          <Button size="sm" variant="outline" icon={<Plus size={14} />}
            onClick={() => setDamages(list => [...list, { zone: type === 'vehicle' ? DAMAGE_ZONES[0] : 'Carrosserie', description: '', photo: [] }])}>
            Ajouter un dégât
          </Button>
        </section>

        <section className="space-y-3">
          <h3 className="mx-section-label">Accessoires remis</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {accessories.map((a, index) => (
              <label key={`${a.label}-${index}`} className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                <input type="checkbox" checked={a.present}
                  onChange={e => setAccessories(list => list.map((x, i) => (i === index ? { ...x, present: e.target.checked } : x)))} />
                {a.label}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={newAccessory} onChange={e => setNewAccessory(e.target.value)} aria-label="Autre accessoire" placeholder="Autre accessoire…"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAccessory(); } }} className={inputClass} />
            <Button variant="outline" icon={<Plus size={14} />} onClick={addAccessory}>Ajouter</Button>
          </div>
        </section>

        <section className="space-y-3">
          <label htmlFor="insp-notes" className={labelClass}>Remarques</label>
          <textarea id="insp-notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} className={inputClass} />
        </section>

        <section className="space-y-3">
          <h3 className="mx-section-label">Signatures</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <SignaturePad label="Notre collaborateur *" onChange={setStaffSignature} />
            <div className="space-y-2">
              <div>
                <label htmlFor="insp-lessor" className={labelClass}>Représentant du loueur (facultatif)</label>
                <input id="insp-lessor" value={lessorName} onChange={e => setLessorName(e.target.value)} className={inputClass} placeholder="Nom" />
              </div>
              <SignaturePad label="Signature du loueur" onChange={setLessorSignature} />
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" loading={saving}>{kind === 'reception' ? 'Enregistrer la réception' : 'Enregistrer la restitution'}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default RentalInspectionModal;
