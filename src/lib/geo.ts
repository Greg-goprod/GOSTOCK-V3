// Position d'un chantier : depuis son adresse (OpenStreetMap) ou depuis le téléphone, sur place

export interface Coordinates {
  latitude: number;
  longitude: number;
}

// Adresse → coordonnées (service public Nominatim d'OpenStreetMap, Suisse et pays voisins)
export async function geocodeAddress(address: string): Promise<Coordinates | null> {
  const query = address.trim();
  if (!query) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ch,fr,de,it,at,li&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Recherche d'adresse indisponible (HTTP ${response.status})`);
  const [first] = (await response.json()) as { lat: string; lon: string }[];
  return first ? { latitude: Number(first.lat), longitude: Number(first.lon) } : null;
}

// Position actuelle du téléphone (l'appareil demande l'autorisation)
export function currentPosition(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Cet appareil ne donne pas sa position"));
    navigator.geolocation.getCurrentPosition(
      p => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      () => reject(new Error('Position refusée ou introuvable')),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  });
}

export const formatCoordinates = (c: Coordinates) => `${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)}`;
