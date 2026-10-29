import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { AppProvider } from './contexts/AppContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { Toaster } from 'react-hot-toast';
import { isSupabaseConfigured } from './lib/supabase';

// Vérification critique des variables d'environnement
const checkEnvironmentVariables = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  console.log('🔍 Vérification des variables d\'environnement:');
  console.log('- Mode:', import.meta.env.MODE);
  console.log('- Production:', import.meta.env.PROD);
  console.log('- VITE_SUPABASE_URL:', supabaseUrl ? '✅ Définie' : '❌ Manquante');
  console.log('- VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ Définie' : '❌ Manquante');

  if (!isSupabaseConfigured) {
    console.error('❌ ERREUR CRITIQUE: configuration Supabase manquante ou invalide (.env)');
    console.error('Configuration requise dans Netlify:');
    console.error('1. Dashboard Netlify → Site settings → Environment variables');
    console.error('2. Ajouter VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY');
    console.error('3. Redéployer le site');
    
    // En production, on affiche un message d'erreur mais on ne crash pas
    const errorDiv = document.createElement('div');
    errorDiv.innerHTML = `
      <div style="
        position: fixed; 
        top: 0; 
        left: 0; 
        width: 100%; 
        height: 100%; 
        background: #fee2e2; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        z-index: 9999;
        font-family: system-ui, -apple-system, sans-serif;
      ">
        <div style="
          background: white; 
          padding: 2rem; 
          border-radius: 8px; 
          box-shadow: 0 10px 25px rgba(0,0,0,0.1); 
          max-width: 500px; 
          text-align: center;
        ">
          <h1 style="color: #dc2626; margin-bottom: 1rem;">Configuration Supabase manquante</h1>
          <p style="color: #374151; margin-bottom: 1.5rem;">
            Les variables VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont absentes ou invalides.
          </p>
          <div style="background: #f3f4f6; padding: 1rem; border-radius: 4px; text-align: left; font-size: 0.875rem;">
            <strong>En local :</strong> compléter le fichier .env à la racine du projet, puis relancer npm run dev.<br><br>
            <strong>En ligne (Netlify) :</strong> Site settings → Environment variables, ajouter les deux variables, puis redéployer.
          </div>
          <button onclick="window.location.reload()" style="
            background: #6d3ee0; 
            color: white; 
            border: none; 
            padding: 0.75rem 1.5rem; 
            border-radius: 4px; 
            margin-top: 1rem; 
            cursor: pointer;
          ">
            Recharger après configuration
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(errorDiv);
    return false;
  }
  
  return true;
};

// Vérification avant le rendu
if (!checkEnvironmentVariables()) {
  // Arrêter l'exécution si les variables sont manquantes en production
  console.error('Application arrêtée: variables d\'environnement manquantes');
} else {
  // Continuer le rendu normal
  const rootElement = document.getElementById('root');

  if (!rootElement) {
    throw new Error('Root element not found');
  }

  createRoot(rootElement).render(
    <StrictMode>
      <BrowserRouter>
        <LanguageProvider>
          <ThemeProvider>
            <AppProvider>
              <App />
              <Toaster 
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: '#363636',
                    color: '#fff',
                  },
                }}
              />
            </AppProvider>
          </ThemeProvider>
        </LanguageProvider>
      </BrowserRouter>
    </StrictMode>
  );
}