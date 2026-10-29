import { createClient } from '@supabase/supabase-js';

// Récupération des variables d'environnement avec validation
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Fonction de validation des variables d'environnement
const validateEnvironmentVariables = () => {
  console.log('🔧 Validation des variables d\'environnement Supabase:');
  console.log('- VITE_SUPABASE_URL:', supabaseUrl ? '✅ Définie' : '❌ Manquante');
  console.log('- VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ Définie' : '❌ Manquante');
  
  if (!supabaseUrl || !supabaseAnonKey) {
    const missingVars = [];
    if (!supabaseUrl) missingVars.push('VITE_SUPABASE_URL');
    if (!supabaseAnonKey) missingVars.push('VITE_SUPABASE_ANON_KEY');
    
    console.error(`❌ Variables d'environnement Supabase manquantes: ${missingVars.join(', ')}`);
    return false;
  }

  // Vérifier si ce sont les valeurs par défaut
  if (supabaseUrl.includes('votre-projet.supabase.co') || supabaseAnonKey.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...')) {
    console.error('❌ Veuillez remplacer les valeurs par défaut par vos vraies valeurs Supabase');
    return false;
  }

  // Validation du format de l'URL
  try {
    new URL(supabaseUrl);
  } catch {
    console.error(`❌ Format d'URL Supabase invalide: ${supabaseUrl}`);
    return false;
  }

  console.log('✅ Variables d\'environnement Supabase validées avec succès');
  return true;
};

// Validation des variables d'environnement
export const isSupabaseConfigured = validateEnvironmentVariables();

// Client toujours créé : sans configuration valide, main.tsx affiche l'écran
// « Configuration Supabase manquante » et l'application ne démarre pas
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'http://localhost',
  isSupabaseConfigured ? supabaseAnonKey : 'configuration-manquante',
  {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  },
  global: {
    headers: {
      'X-Client-Info': 'go-mat-equipment-management',
    },
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  db: {
    schema: 'public',
  },
});

// Fonction de test de connexion améliorée
export const testSupabaseConnection = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('🔄 Test de connexion Supabase...');
    
    // Vérifier d'abord si la configuration est valide
    if (!isSupabaseConfigured) {
      return {
        success: false,
        error: 'Configuration Supabase invalide. Vérifiez vos variables d\'environnement VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans le fichier .env'
      };
    }

    // Vérifier si les variables contiennent des valeurs par défaut
    if (supabaseUrl.includes('votre-projet.supabase.co') || supabaseAnonKey.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...')) {
      return {
        success: false,
        error: 'Veuillez remplacer les valeurs par défaut dans le fichier .env par vos vraies valeurs Supabase. Consultez https://supabase.com/dashboard pour obtenir vos clés.'
      };
    }

    // Test de connectivité réseau d'abord
    try {
      // La racine /rest/v1/ n'est plus accessible avec la clé anon (HTTP 401) : on teste une table publique
      const healthCheckUrl = `${supabaseUrl}/rest/v1/status_configs?select=id&limit=1`;
      const healthResponse = await fetch(healthCheckUrl, {
        method: 'HEAD',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        signal: AbortSignal.timeout(5000)
      });

      if (!healthResponse.ok) {
        return {
          success: false,
          error: `Serveur Supabase inaccessible (HTTP ${healthResponse.status}). Vérifiez que votre projet Supabase est actif.`
        };
      }
    } catch (networkError: any) {
      if (networkError.name === 'TimeoutError') {
        return {
          success: false,
          error: 'Délai de connexion dépassé. Vérifiez votre connexion internet et l\'URL Supabase.'
        };
      }
      
      if (networkError.message?.includes('Failed to fetch')) {
        return {
          success: false,
          error: 'Impossible de se connecter à Supabase. Vérifiez votre connexion internet et que l\'URL Supabase est correcte.'
        };
      }

      return {
        success: false,
        error: `Erreur de connectivité réseau: ${networkError.message}`
      };
    }
    
    // Test simple de connexion avec une requête basique et timeout
    try {
      const { data, error } = await supabase
        .from('equipment')
        .select('id')
        .limit(1);
      
      if (error) {
        console.error('❌ Erreur de connexion Supabase:', error.message);
        
        // Vérifier si c'est un problème de RLS ou de table inexistante
        if (error.message.includes('relation "equipment" does not exist')) {
          return { 
            success: false, 
            error: 'La table "equipment" n\'existe pas. Veuillez exécuter les migrations Supabase.' 
          };
        }
        
        if (error.message.includes('RLS') || error.message.includes('policy')) {
          return { 
            success: false, 
            error: `Erreur RLS: ${error.message}. Vérifiez que RLS est correctement configuré.` 
          };
        }

        if (error.message.includes('Invalid API key')) {
          return {
            success: false,
            error: 'Clé API Supabase invalide. Vérifiez votre VITE_SUPABASE_ANON_KEY dans le fichier .env'
          };
        }
        
        return { 
          success: false, 
          error: `Erreur de connexion: ${error.message}` 
        };
      }
      
      console.log('✅ Connexion Supabase réussie');
      console.log('📊 Données trouvées:', data?.length || 0, 'enregistrements');
      return { success: true };
      
    } catch (fetchError: any) {
      if (fetchError.name === 'AbortError' || fetchError.name === 'TimeoutError') {
        return {
          success: false,
          error: 'Délai de connexion dépassé. Vérifiez votre connexion internet et l\'URL Supabase.'
        };
      }
      
      throw fetchError;
    }
    
  } catch (error: any) {
    console.error('❌ Erreur lors du test de connexion:', error);
    
    // Gestion spécifique des erreurs de réseau
    if (error.message?.includes('Failed to fetch') || error.name === 'TypeError') {
      return {
        success: false,
        error: 'Impossible de se connecter à Supabase. Vérifiez votre connexion internet et que l\'URL Supabase est correcte.'
      };
    }
    
    if (error.message?.includes('Invalid URL')) {
      return {
        success: false,
        error: 'URL Supabase invalide. Vérifiez la valeur de VITE_SUPABASE_URL dans votre fichier .env'
      };
    }

    if (error.name === 'TimeoutError') {
      return {
        success: false,
        error: 'Délai de connexion dépassé. Le serveur Supabase ne répond pas.'
      };
    }
    
    return { 
      success: false, 
      error: error.message || 'Erreur de connexion inconnue' 
    };
  }
};

// Test de connexion au chargement (uniquement en développement)
if (import.meta.env.DEV && isSupabaseConfigured) {
  testSupabaseConnection().then(result => {
    if (result.success) {
      console.log('🎉 Supabase connecté avec succès en mode développement');
    } else {
      console.warn('⚠️ Problème de connexion Supabase en développement:', result.error);
    }
  });
}