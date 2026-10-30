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
import Counter from './pages/Counter';
import MyBadge from './pages/MyBadge';
import BadgePrint from './pages/BadgePrint';
import Labels from './pages/Labels';
import Maintenance from './pages/Maintenance';
import Incidents from './pages/Incidents';
import Inventory from './pages/Inventory';
import PurchaseOrders from './pages/PurchaseOrders';
import Costs from './pages/Costs';
import Steering from './pages/Steering';
import AuditLog from './pages/AuditLog';
import Sites from './pages/Sites';
import SiteMap from './pages/SiteMap';
import Kits from './pages/Kits';
import Trainings from './pages/Trainings';
import Rentals from './pages/Rentals';
import Transfers from './pages/Transfers';
import Bins from './pages/Bins';
import Planning from './pages/Planning';
import Ppe from './pages/Ppe';
import Workshop from './pages/Workshop';
import Accounting from './pages/Accounting';
import SelfService from './pages/SelfService';
import WallScreen from './pages/WallScreen';
import Search from './pages/Search';
import Forecast from './pages/Forecast';
import DataHealth from './pages/DataHealth';
import Onboarding from './pages/Onboarding';
import { useAuth } from './contexts/AuthContext';
import { canAccess } from './lib/access';

// Page refusée par les droits : retour à l'accueil (la base refuserait de toute façon les données)
const Guard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { can } = useAuth();
  const { pathname } = useLocation();
  return canAccess(pathname, can) ? <MainLayout>{children}</MainLayout> : <Navigate to="/" replace />;
};

// Écran mural : plein écran, sans menu
const BareGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { can } = useAuth();
  const { pathname } = useLocation();
  return canAccess(pathname, can) ? <>{children}</> : <Navigate to="/" replace />;
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
        <Route path="/comptoir" element={<Guard><Counter /></Guard>} />
        <Route path="/badge" element={<Guard><MyBadge /></Guard>} />
        <Route path="/badges" element={<Guard><BadgePrint /></Guard>} />
        <Route path="/etiquettes" element={<Guard><Labels /></Guard>} />
        <Route path="/entretien" element={<Guard><Maintenance /></Guard>} />
        <Route path="/incidents" element={<Guard><Incidents /></Guard>} />
        <Route path="/inventaire" element={<Guard><Inventory /></Guard>} />
        <Route path="/commandes" element={<Guard><PurchaseOrders /></Guard>} />
        <Route path="/couts" element={<Guard><Costs /></Guard>} />
        <Route path="/pilotage" element={<Guard><Steering /></Guard>} />
        <Route path="/journal" element={<Guard><AuditLog /></Guard>} />
        <Route path="/chantiers" element={<Guard><Sites /></Guard>} />
        <Route path="/carte" element={<Guard><SiteMap /></Guard>} />
        <Route path="/kits" element={<Guard><Kits /></Guard>} />
        <Route path="/formations" element={<Guard><Trainings /></Guard>} />
        <Route path="/locations" element={<Guard><Rentals /></Guard>} />
        <Route path="/transferts" element={<Guard><Transfers /></Guard>} />
        <Route path="/emplacements" element={<Guard><Bins /></Guard>} />
        <Route path="/planning" element={<Guard><Planning /></Guard>} />
        <Route path="/epi" element={<Guard><Ppe /></Guard>} />
        <Route path="/atelier" element={<Guard><Workshop /></Guard>} />
        <Route path="/comptabilite" element={<Guard><Accounting /></Guard>} />
        <Route path="/libre-service" element={<Guard><SelfService /></Guard>} />
        <Route path="/recherche" element={<Guard><Search /></Guard>} />
        <Route path="/prevision" element={<Guard><Forecast /></Guard>} />
        <Route path="/donnees" element={<Guard><DataHealth /></Guard>} />
        <Route path="/demarrage" element={<Guard><Onboarding /></Guard>} />
        <Route path="/ecran" element={<BareGuard><WallScreen /></BareGuard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;