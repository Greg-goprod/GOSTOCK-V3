# Relais SMTP de GO-Mat (Fly.io)

Les fonctions Edge de Supabase ne peuvent pas ouvrir de connexion SMTP : la fonction
`send-notification-emails` passe par ce petit relais HTTP, qui envoie ensuite par le serveur
d'Infomaniak. Copie isolée du relais de Mannyx (`NEW-GO-PROD/smtp-relay-service`), avec sa
propre clé et des verrous en plus (serveur SMTP et domaine d'expédition autorisés, pas de pièce jointe).

## Mise en service (une fois, depuis le PC)

```
cd smtp-relay
fly auth login
fly launch --no-deploy --copy-config --name gomat-smtp-relay
fly secrets set API_SECRET_KEY="<longue clé aléatoire>" ALLOWED_FROM_DOMAINS="<votre-domaine.ch>"
fly deploy
```

Contrôle : `https://gomat-smtp-relay.fly.dev/health` répond `{"status":"ok"}`.

Puis dans Supabase (GO-MAT → Edge Functions → Secrets) : `SMTP_RELAY_URL` = `https://gomat-smtp-relay.fly.dev`
et `SMTP_RELAY_API_KEY` = la même clé que `API_SECRET_KEY`.

La machine s'arrête quand elle ne sert pas et redémarre à la première requête (quelques secondes).
