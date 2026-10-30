// Catégories du permis de conduire suisse (OAC). La base sait ce que chacune autorise aussi
// (ex. B → B1, F, G, M ; CE → C1E, BE) : seule la catégorie la plus haute est à cocher.
export const LICENSE_CATEGORIES: { code: string; label: string }[] = [
  { code: 'A1', label: 'Motocycle léger (125 cm³)' },
  { code: 'A', label: 'Motocycle' },
  { code: 'B1', label: 'Quadricycle à moteur' },
  { code: 'B', label: 'Voiture (3,5 t)' },
  { code: 'BE', label: 'Voiture avec remorque' },
  { code: 'C1', label: 'Camion léger (7,5 t)' },
  { code: 'C1E', label: 'Camion léger avec remorque' },
  { code: 'C', label: 'Camion' },
  { code: 'CE', label: 'Camion avec remorque' },
  { code: 'D1', label: 'Minibus (16 places)' },
  { code: 'D1E', label: 'Minibus avec remorque' },
  { code: 'D', label: 'Car' },
  { code: 'DE', label: 'Car avec remorque' },
  { code: 'F', label: 'Véhicule jusqu\'à 45 km/h' },
  { code: 'G', label: 'Véhicule agricole jusqu\'à 30 km/h' },
  { code: 'M', label: 'Cyclomoteur' },
];

export const licenseLabel = (code: string) => {
  const found = LICENSE_CATEGORIES.find(l => l.code === code);
  return found ? `${found.code} · ${found.label}` : code;
};
