import { supabase } from './supabase';

// Compartiment privé des photos et PV (migration 00011)
const BUCKET = 'fichiers';
const MAX_SIDE = 1600;

// Réduit une photo de téléphone (souvent 4 à 8 Mo) à ~300 Ko avant l'envoi
async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise(resolve => canvas.toBlob(blob => resolve(blob ?? file), 'image/jpeg', 0.8));
}

// Envoie un fichier dans un dossier (« retours », « incidents », « pv »…) et renvoie son chemin
export async function uploadFile(file: File, folder: string): Promise<string> {
  const isPdf = file.type === 'application/pdf';
  const body = isPdf ? file : await compressImage(file);
  const path = `${folder}/${crypto.randomUUID()}.${isPdf ? 'pdf' : 'jpg'}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType: isPdf ? 'application/pdf' : 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;
  return path;
}

// Lien temporaire (1 h) pour afficher ou ouvrir un fichier privé
export async function fileUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
