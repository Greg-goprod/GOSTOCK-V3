/*
  # Insérer les statuts par défaut dans status_configs

  1. Statuts par défaut
    - available (Disponible) - Vert
    - checked-out (Emprunté) - Orange
    - maintenance (En maintenance) - Bleu
    - retired (Retiré) - Rouge

  2. Sécurité
    - Utilise la table status_configs existante
*/

-- Insérer les statuts par défaut s'ils n'existent pas
INSERT INTO status_configs (id, name, color) VALUES
  ('available', 'Disponible', '#10b981'),
  ('checked-out', 'Emprunté', '#f59e0b'),
  ('maintenance', 'En maintenance', '#3b82f6'),
  ('retired', 'Retiré', '#ef4444')
ON CONFLICT (id) DO NOTHING;