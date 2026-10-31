import React, { useId, useRef, useState } from 'react';
import { Camera, ImageOff, Link2, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/requests';

// Compartiment public des photos d'articles (migration 00031)
const BUCKET = 'photos-articles';
const MAX_SIDE = 1200;

// Réduit la photo (téléphone : 4 à 8 Mo) à ~200 Ko, format carré conservé tel quel
async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise(resolve => canvas.toBlob(blob => resolve(blob ?? file), 'image/jpeg', 0.85));
}

// Image d'un article : lien (catalogue fournisseur), photo prise au téléphone ou fichier importé.
// La valeur est toujours une adresse publique : le shop l'affiche telle quelle.
const ImageField: React.FC<{ value: string; onChange: (url: string) => void }> = ({ value, onChange }) => {
  const id = useId();
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [broken, setBroken] = useState(false);

  const send = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Choisis une image (JPG, PNG ou WebP)');
    setBusy(true);
    try {
      const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, await compress(file), { contentType: 'image/jpeg' });
      if (error) throw error;
      setBroken(false);
      onChange(supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
      toast.success('Photo ajoutée');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = '';
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Image (affichée dans le shop)</label>
      <div className="flex gap-3 items-start">
        <div className="shrink-0 w-24 h-24 rounded-lg border border-gray-200 dark:border-gray-700 bg-white flex items-center justify-center overflow-hidden">
          {value && !broken
            ? <img src={value} alt="Aperçu" className="w-full h-full object-contain" onError={() => setBroken(true)} onLoad={() => setBroken(false)} />
            : <ImageOff size={24} aria-hidden="true" className="text-gray-400" />}
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="relative">
            <Link2 size={14} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input id={id} type="url" value={value} onChange={e => { setBroken(false); onChange(e.target.value); }}
              placeholder="Colle le lien de l'image (catalogue fournisseur)"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pl-8 pr-8 py-2 text-sm text-gray-900 dark:text-gray-100" />
            {value && (
              <button type="button" onClick={() => onChange('')} aria-label="Retirer l'image"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"><X size={14} /></button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => cameraRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">
              <Camera size={14} aria-hidden="true" /> Prendre une photo
            </button>
            <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">
              <Upload size={14} aria-hidden="true" /> Importer un fichier
            </button>
            {busy && <span className="text-sm text-gray-600 dark:text-gray-400 self-center">Envoi…</span>}
          </div>
          {broken && value && <p className="text-xs text-tone-danger">Image introuvable à cette adresse : vérifie le lien.</p>}
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => send(e.target.files)} />
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => send(e.target.files)} />
        </div>
      </div>
    </div>
  );
};

export default ImageField;
