import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Permission, Profile } from '../lib/roles';

interface AuthContextType {
  session: Session | null;
  profile: Profile | null;
  // true tant que la session et le profil ne sont pas connus
  loading: boolean;
  can: (permission: Permission) => boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  // Personne connectée : un SIGNED_IN pour la même personne (retour sur l'onglet) ne recharge pas l'écran
  const userIdRef = useRef<string | null>(null);

  // whoami() lie le compte à la fiche de même e-mail à la première connexion
  const loadProfile = useCallback(async (current: Session | null) => {
    if (!current) {
      setProfile(null);
      return;
    }
    const cacheKey = `gomat-profile-${current.user.id}`;
    const { data, error } = await supabase.rpc('whoami');
    if (error) {
      console.error('whoami:', error);
      // Hors ligne (chantier, sous-sol) : on garde le dernier profil connu pour afficher le badge
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          setProfile(JSON.parse(cached) as Profile);
          return;
        }
      } catch {
        // stockage indisponible : on retombe sur « pas de profil »
      }
    }
    try {
      if (data) localStorage.setItem(cacheKey, JSON.stringify(data));
      else localStorage.removeItem(cacheKey);
    } catch {
      // stockage indisponible
    }
    // Même contenu : on garde l'objet actuel pour ne pas relancer les écrans qui dépendent du profil
    const next = (data as Profile | null) ?? null;
    setProfile(prev => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      userIdRef.current = data.session?.user.id ?? null;
      setSession(data.session);
      await loadProfile(data.session);
      if (active) setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, next) => {
      // Même jeton : on garde l'objet actuel pour ne pas relancer les chargements qui dépendent de la session
      setSession(prev => (prev?.access_token === next?.access_token ? prev : next));

      const nextId = next?.user.id ?? null;
      const userChanged = nextId !== userIdRef.current;
      userIdRef.current = nextId;

      // supabase-js émet SIGNED_IN à chaque retour sur l'onglet, même sans changement de personne.
      // Seul un vrai changement (connexion, déconnexion) affiche l'écran de chargement : sinon toute
      // l'application serait démontée et les saisies en cours (formulaire, panier du comptoir) perdues.
      // Les appels réseau sont faits hors du callback, comme le conseille supabase-js.
      if (event === 'SIGNED_OUT' || (event === 'SIGNED_IN' && userChanged)) {
        setLoading(true);
        setTimeout(async () => {
          await loadProfile(next);
          setLoading(false);
        }, 0);
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        // Même personne : profil rechargé en arrière-plan (droits modifiés entre-temps), rien n'est démonté
        setTimeout(() => { loadProfile(next); }, 0);
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const can = useCallback((permission: Permission) => !!profile?.permissions.includes(permission), [profile]);

  const value: AuthContextType = {
    session,
    profile,
    loading,
    can,
    refreshProfile: () => loadProfile(session),
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
