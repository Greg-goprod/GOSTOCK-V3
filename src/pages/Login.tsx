import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Mail, QrCode } from 'lucide-react';
import Button from '../components/common/Button';
import { supabase } from '../lib/supabase';
import LanguagePicker from '../components/common/LanguagePicker';

const RESEND_DELAY = 60;

const inputClass =
  'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-3 text-base text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500';

// Messages Supabase Auth les plus courants, en clair
const authMessage = (message: string) => {
  // Limite d'envoi d'e-mails du projet (service d'envoi de Supabase sans SMTP propre : quelques e-mails par heure)
  if (/email rate limit/i.test(message)) return "Limite d'envoi d'e-mails atteinte pour le moment (quelques e-mails par heure tant que le compte d'envoi n'est pas configuré). Réessayez dans une heure.";
  if (/rate limit|too many|seconds/i.test(message)) return 'Trop de demandes de code. Patientez une minute avant de réessayer.';
  if (/invalid login credentials/i.test(message)) return 'E-mail ou mot de passe incorrect. Sans mot de passe, connectez-vous avec un code.';
  if (/expired|invalid/i.test(message)) return 'Code incorrect ou expiré. Vérifiez le dernier e-mail reçu, ou demandez un nouveau code.';
  if (/email not confirmed/i.test(message)) return "Adresse pas encore confirmée : connectez-vous une première fois avec un code.";
  if (/signups not allowed/i.test(message)) return "Cette adresse n'a pas d'accès à GO-Mat. Demandez à votre responsable de vous ajouter.";
  return message;
};

// Connexion par code envoyé par e-mail (6 à 10 chiffres selon le réglage Supabase, 8 sur GO-MAT), ou par mot de passe si la personne en a choisi un
const Login: React.FC = () => {
  const [step, setStep] = useState<'email' | 'code' | 'password'>('email');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus();
  }, [step]);

  const sendCode = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setBusy(true);
    setError('');
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (otpError) {
      setError(authMessage(otpError.message));
      return;
    }
    setStep('code');
    setCode('');
    setCooldown(RESEND_DELAY);
  };

  // Mot de passe choisi dans « Mon badge » (ou donné par l'administrateur) : pas besoin d'e-mail
  const passwordLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const { error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setBusy(false);
    if (loginError) setError(authMessage(loginError.message));
  };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: 'email',
    });
    setBusy(false);
    // En cas de succès, AuthContext reçoit la session et affiche l'application
    if (verifyError) setError(authMessage(verifyError.message));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 mb-8">
          <QrCode size={40} className="text-primary-600 dark:text-primary-400" aria-hidden="true" />
          <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">GO-Mat</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Gestion du matériel</p>
          <LanguagePicker />
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-lg shadow border border-gray-200 dark:border-gray-800 p-6">
          {step === 'email' ? (
            <form onSubmit={sendCode} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Adresse e-mail
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  autoFocus
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="prenom.nom@entreprise.ch"
                />
              </div>
              <Button type="submit" variant="primary" fullWidth icon={<Mail size={18} />} disabled={busy || !email.trim()}>
                {busy ? 'Envoi…' : 'Recevoir un code'}
              </Button>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Pas de mot de passe : vous recevez un code à usage unique par e-mail.
              </p>
              <button type="button" onClick={() => { setStep('password'); setError(''); }}
                className="text-sm text-primary-700 dark:text-primary-300 hover:underline min-h-[44px]">
                J'ai un mot de passe
              </button>
            </form>
          ) : step === 'password' ? (
            <form onSubmit={passwordLogin} className="space-y-4">
              <div>
                <label htmlFor="login-email-pw" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Adresse e-mail
                </label>
                <input id="login-email-pw" type="email" autoComplete="username" inputMode="email" required value={email}
                  onChange={e => setEmail(e.target.value)} className={inputClass} placeholder="prenom.nom@entreprise.ch" />
              </div>
              <div>
                <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Mot de passe
                </label>
                <input id="login-password" type="password" autoComplete="current-password" required autoFocus value={password}
                  onChange={e => setPassword(e.target.value)} className={inputClass} />
              </div>
              <Button type="submit" variant="primary" fullWidth disabled={busy || !email.trim() || !password}>
                {busy ? 'Vérification…' : 'Se connecter'}
              </Button>
              <button type="button" onClick={() => { setStep('email'); setError(''); setPassword(''); }}
                className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:underline min-h-[44px]">
                <ArrowLeft size={14} aria-hidden="true" /> Recevoir un code par e-mail
              </button>
            </form>
          ) : (
            <form onSubmit={verify} className="space-y-4">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Code envoyé à <span className="font-medium">{email}</span>. Saisissez-le, ou cliquez sur le lien de l'e-mail.
              </p>
              <div>
                <label htmlFor="login-code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Code reçu
                </label>
                <input
                  id="login-code"
                  ref={codeRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6,10}"
                  maxLength={10}
                  required
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  className={`${inputClass} font-mono text-center text-2xl tracking-[0.4em]`}
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" variant="primary" fullWidth disabled={busy || code.length < 6}>
                {busy ? 'Vérification…' : 'Se connecter'}
              </Button>
              <div className="flex justify-between items-center gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => { setStep('email'); setError(''); }}
                  className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:underline min-h-[44px]"
                >
                  <ArrowLeft size={14} aria-hidden="true" /> Autre adresse
                </button>
                <button
                  type="button"
                  onClick={() => sendCode()}
                  disabled={cooldown > 0 || busy}
                  className="text-primary-700 dark:text-primary-300 hover:underline disabled:text-gray-400 disabled:no-underline min-h-[44px]"
                >
                  {cooldown > 0 ? `Renvoyer (${cooldown} s)` : 'Renvoyer le code'}
                </button>
              </div>
            </form>
          )}

          {error && (
            <p role="alert" className="mt-4 rounded-md bg-danger-50 dark:bg-danger-900/30 text-tone-danger text-sm p-3">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
