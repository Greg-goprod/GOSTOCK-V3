import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
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
    setProfile((data as Profile | null) ?? null);
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session);
      if (active) setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      // Le rafraîchissement du jeton ne change pas la personne : pas besoin de recharger le profil
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        setLoading(true);
        // Hors du callback : supabase-js déconseille les appels réseau synchrones ici
        setTimeout(async () => {
          await loadProfile(next);
          setLoading(false);
        }, 0);
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
