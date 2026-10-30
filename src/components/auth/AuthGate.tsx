import React from 'react';
import { LogOut, ShieldAlert } from 'lucide-react';
import Button from '../common/Button';
import Login from '../../pages/Login';
import { useAuth } from '../../contexts/AuthContext';
import { Route, Routes, useLocation } from 'react-router-dom';
import FoundTool from '../../pages/FoundTool';

// L'application (et le chargement de ses données) ne démarre qu'avec une personne reconnue
const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, profile, loading, signOut } = useAuth();
  const { pathname } = useLocation();

  // Seule page sans connexion : le contact à qui trouve un outil oublié
  if (pathname.startsWith('/t/')) {
    return <Routes><Route path="/t/:code" element={<FoundTool />} /></Routes>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400" role="status">Chargement…</p>
      </div>
    );
  }

  if (!session) return <Login />;

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-lg shadow border border-gray-200 dark:border-gray-800 p-6 space-y-4 text-center">
          <ShieldAlert size={36} className="mx-auto text-tone-warning" aria-hidden="true" />
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Accès non autorisé</h1>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            L'adresse <span className="font-medium">{session.user.email}</span> n'est pas enregistrée dans GO-Mat,
            ou son accès est suspendu. Demande à ton responsable de t'ajouter dans « Personnes ».
          </p>
          <Button variant="outline" fullWidth icon={<LogOut size={16} />} onClick={signOut}>
            Se déconnecter
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AuthGate;
