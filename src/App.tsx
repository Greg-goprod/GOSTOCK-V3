import React from 'react';
import { Routes, Route } from 'react-router-dom';
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

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<MainLayout><Dashboard /></MainLayout>} />
        <Route path="/equipment" element={<MainLayout><Equipment /></MainLayout>} />
        <Route path="/users" element={<MainLayout><Users /></MainLayout>} />
        <Route path="/checkouts" element={<MainLayout><Checkouts /></MainLayout>} />
        <Route path="/notifications" element={<MainLayout><Notifications /></MainLayout>} />
        <Route path="/scan" element={<MainLayout><Scan /></MainLayout>} />
        <Route path="/consommables" element={<MainLayout><Consumables /></MainLayout>} />
        <Route path="/commande" element={<MainLayout><OrderSheet /></MainLayout>} />
        <Route path="/demandes" element={<MainLayout><Requests /></MainLayout>} />
        <Route path="/vehicules" element={<MainLayout><Vehicles /></MainLayout>} />
        <Route path="/settings" element={<MainLayout><Settings /></MainLayout>} />
        <Route path="*" element={<MainLayout><Dashboard /></MainLayout>} />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;