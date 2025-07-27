import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { StatusConfig } from '../types';

interface UseStatusColorsReturn {
  statusConfigs: StatusConfig[];
  loading: boolean;
  error: string | null;
  getStatusColor: (status: string) => string;
  getStatusBadgeVariant: (status: string) => 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  getStatusName: (status: string) => string;
  refreshStatusConfigs: () => Promise<void>;
}

export const useStatusColors = (): UseStatusColorsReturn => {
  const [statusConfigs, setStatusConfigs] = useState<StatusConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getDefaultStatuses = (): StatusConfig[] => [
    { id: 'available', name: 'Disponible', color: '#4ade80' }, // Vert plus clair
    { id: 'checked-out', name: 'Emprunté', color: '#fbbf24' }, // Jaune plus clair
    { id: 'maintenance', name: 'En maintenance', color: '#60a5fa' }, // Bleu plus clair
    { id: 'retired', name: 'Retiré', color: '#f87171' }, // Rouge plus clair
    { id: 'lost', name: 'Perdu', color: '#9ca3af' }, // Gris plus clair
    { id: 'active', name: 'En cours', color: '#fbbf24' }, // Jaune plus clair
    { id: 'overdue', name: 'En retard', color: '#f87171' }, // Rouge plus clair
    { id: 'returned', name: 'Retourné', color: '#4ade80' }, // Vert plus clair
    { id: 'partial', name: 'Retour partiel', color: '#60a5fa' } // Bleu plus clair
  ];

  const fetchStatusConfigs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Vérifier que supabase est initialisé
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }
      
      const { data, error: fetchError } = await supabase
        .from('status_configs')
        .select('*')
        .order('name');

      if (fetchError) {
        console.error('Supabase error:', fetchError);
        throw new Error(`Database error: ${fetchError.message}`);
      }

      // Si aucun statut configuré, utiliser les valeurs par défaut
      if (!data || data.length === 0) {
        console.log('No status configs found, using defaults');
        setStatusConfigs(getDefaultStatuses());
      } else {
        setStatusConfigs(data);
      }
    } catch (error: unknown) {
      console.error('Error fetching status configs:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch status configurations';
      setError(errorMessage);
      
      // Fallback vers les couleurs par défaut en cas d'erreur
      setStatusConfigs(getDefaultStatuses());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusConfigs();
  }, []);

  // Ajout d'un mapping explicite pour les statuts de checkouts vers les statuts de status_configs
  const statusAliasMap: Record<string, string> = {
    active: 'checked-out', // "active" (checkouts) doit s'afficher comme "Emprunté"
    'checked-out': 'checked-out',
    returned: 'returned',
    lost: 'lost',
    maintenance: 'maintenance',
    retired: 'retired',
    available: 'available',
    overdue: 'overdue',
    partial: 'partial',
  };

  const getStatusColor = (status: string): string => {
    const mappedStatus = statusAliasMap[status] || status;
    const config = statusConfigs.find(s => s.id === mappedStatus);
    if (config) return config.color;

    // Fallback colors - couleurs plus claires
    switch (mappedStatus) {
      case 'available':
        return '#4ade80'; // Vert plus clair
      case 'checked-out':
        return '#fbbf24'; // Jaune plus clair
      case 'maintenance':
        return '#60a5fa'; // Bleu plus clair
      case 'retired':
        return '#f87171'; // Rouge plus clair
      case 'lost':
        return '#9ca3af'; // Gris plus clair
      case 'overdue':
        return '#f87171'; // Rouge plus clair
      case 'returned':
        return '#10b981'; // Vert (harmonisé)
      case 'partial':
        return '#60a5fa'; // Bleu plus clair
      default:
        return '#6b7280'; // Gris neutre pour statut inconnu
    }
  };

  const getStatusName = (status: string): string => {
    const mappedStatus = statusAliasMap[status] || status;
    const config = statusConfigs.find(s => s.id === mappedStatus);
    if (config) return config.name;

    // Traductions françaises par défaut
    switch (mappedStatus) {
      case 'available':
        return 'Disponible';
      case 'checked-out':
        return 'Emprunté';
      case 'maintenance':
        return 'En maintenance';
      case 'retired':
        return 'Retiré';
      case 'lost':
        return 'Perdu';
      case 'overdue':
        return 'En retard';
      case 'returned':
        return 'Retourné';
      case 'partial':
        return 'Retour partiel';
      default:
        return 'Statut inconnu';
    }
  };

  const getStatusBadgeVariant = (status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' => {
    const mappedStatus = statusAliasMap[status] || status;
    switch (mappedStatus) {
      case 'available':
      case 'returned':
        return 'success';
      case 'checked-out':
        return 'warning';
      case 'overdue':
      case 'lost':
      case 'retired':
        return 'danger';
      case 'maintenance':
      case 'partial':
        return 'info';
      default:
        return 'neutral';
    }
  };

  const refreshStatusConfigs = async () => {
    await fetchStatusConfigs();
  };

  return {
    statusConfigs,
    loading,
    error,
    getStatusColor,
    getStatusBadgeVariant,
    getStatusName,
    refreshStatusConfigs
  };
};