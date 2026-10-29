import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import MainLayout from './components/Layout/MainLayout';
import ErrorBoundary from './components/common/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import Equipment from './pages/Equipment';
import Users from './pages/Users';
import Checkouts from './pages/Checkouts';
import Notifications from './pages/Notifications';
import Scan from './pages/Scan';
import Settings from './pages/Settings';
import Consumables from './pages/Consumables';
import OrderSheet from './pages/OrderSheet';
import Requests from './pages/Requests';
import Vehicles from './pages/Vehicles';
import Today from './pages/Today';
import { useAuth } from './contexts/AuthContext';
import { canAccess } from './lib/access';

// Page refusée par les droits : retour à l'accueil (la base refuserait de toute façon les données)
const Guard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { can } = useAuth();
  const { pathname } = useLocation();
  return canAccess(pathname, can) ? <MainLayout>{children}</MainLayout> : <Navigate to="/" replace />;
};

// L'accueil « Aujourd'hui » sert le magasin ; un collaborateur arrive sur ses demandes
const Home: React.FC = () => {
  const { can } = useAuth();
  return canAccess('/', can) ? <MainLayout><Today /></MainLayout> : <Navigate to="/demandes" replace />;
};

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tableau-de-bord" element={<Guard><Dashboard /></Guard>} />
        <Route path="/equipment" element={<Guard><Equipment /></Guard>} />
        <Route path="/users" element={<Guard><Users /></Guard>} />
        <Route path="/checkouts" element={<Guard><Checkouts /></Guard>} />
        <Route path="/notifications" element={<Guard><Notifications /></Guard>} />
        <Route path="/scan" element={<Guard><Scan /></Guard>} />
        <Route path="/consommables" element={<Guard><Consumables /></Guard>} />
        <Route path="/commande" element={<Guard><OrderSheet /></Guard>} />
        <Route path="/demandes" element={<Guard><Requests /></Guard>} />
        <Route path="/vehicules" element={<Guard><Vehicles /></Guard>} />
        <Route path="/settings" element={<Guard><Settings /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;