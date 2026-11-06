/*
  # Ajout du paramètre pour le logo de l'entreprise

  1. Nouveau paramètre système
    - `company_logo` : Logo de l'entreprise en base64

  2. Sécurité
    - Utilise la table system_settings existante
*/

-- Insérer le paramètre pour le logo de l'entreprise
INSERT INTO system_settings (id, value, description) 
VALUES ('company_logo', '', 'Logo de l''entreprise (base64)')
ON CONFLICT (id) DO NOTHING;