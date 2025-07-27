import React, { useState, useEffect } from "react";
import { useApp } from "../contexts/AppContext";
import Button from "../components/common/Button";
import CheckoutModal from "../components/checkout/CheckoutModal";
import ReturnModal from "../components/checkout/ReturnModal";
import StatusBadge from "../components/common/StatusBadge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Plus, Search, Eye, RefreshCw, Grid3X3, List, ArrowUpDown, CornerDownLeft } from "lucide-react";
import { CheckoutWithCalculatedStatus, DeliveryNote } from "../types";
import toast from "react-hot-toast";

// Interface étendue pour les bons de livraison avec statut calculé
interface DeliveryNoteWithStatus extends Omit<DeliveryNote, 'status'> {
  status: string;
  number: string; // Ajout de la propriété number qui existe dans l'objet mais pas dans l'interface
  userName?: string; // Ajout de la propriété userName pour stocker le nom complet de l'utilisateur
}

// Type pour le tri
type SortField = 'number' | 'createdAt' | 'userName' | 'status';
type SortDirection = 'asc' | 'desc';

export default function Checkouts() {
  const { 
    deliveryNotes = [], 
    refreshAllStatusViews,
    fetchCheckoutsWithStatus,
    refreshData,
    returnEquipmentWithAPI
  } = useApp();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedDeliveryNote, setSelectedDeliveryNote] = useState<DeliveryNoteWithStatus | null>(null);
  const [deliveryCheckouts, setDeliveryCheckouts] = useState<CheckoutWithCalculatedStatus[]>([]);
  const [calculatedCheckouts, setCalculatedCheckouts] = useState<CheckoutWithCalculatedStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'equipment'>('list');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [returningItems, setReturningItems] = useState<Record<string, boolean>>({});
  const [returnNotes, setReturnNotes] = useState<Record<string, string>>({});

  // Charger les emprunts avec leurs statuts calculés
  const loadCheckoutsWithStatus = async () => {
    setIsLoading(true);
    try {
      const data = await fetchCheckoutsWithStatus();
      setCalculatedCheckouts(data);
      
      // Vérifier si les bons de livraison sont chargés
      if (!deliveryNotes || deliveryNotes.length === 0) {
        await refreshData();
      }
    } catch (error) {
      console.error("Erreur lors du chargement des emprunts:", error);
      toast.error("Erreur lors du chargement des emprunts");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCheckoutsWithStatus();
  }, []);
  
  // Effet pour surveiller les changements dans deliveryNotes
  useEffect(() => {
  }, [deliveryNotes]);

  // Filtrer les emprunts en fonction du terme de recherche
  const filteredCheckouts = calculatedCheckouts.filter((checkout) => {
    const equipmentName = checkout.equipment_name?.toLowerCase() || "";
    const userName = `${checkout.first_name} ${checkout.last_name}`.toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    
    return equipmentName.includes(searchLower) || userName.includes(searchLower);
  });

  // Fonction pour gérer le tri
  const handleSort = (field: SortField) => {
    if (field === sortField) {
      // Inverser la direction si on clique sur la même colonne
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Nouvelle colonne, définir la direction par défaut
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Grouper les emprunts par bon de livraison
  const groupedByDeliveryNote = filteredCheckouts.reduce((acc, checkout) => {
    if (checkout.delivery_note_id) {
      if (!acc[checkout.delivery_note_id]) {
        acc[checkout.delivery_note_id] = [];
      }
      acc[checkout.delivery_note_id].push(checkout);
    }
    return acc;
  }, {} as Record<string, CheckoutWithCalculatedStatus[]>);

  // Créer directement les bons de livraison à partir des données des emprunts
  const unsortedDeliveryNotes = Object.entries(groupedByDeliveryNote).map(([id, checkouts]) => {
    // Utiliser le premier checkout pour obtenir les informations du bon de livraison
    const firstCheckout = checkouts[0];
    
    // Déterminer le statut du bon de livraison en fonction des emprunts associés
    let status = 'unknown';
    const hasLost = checkouts.some(c => c.status === 'lost');
    const hasOverdue = checkouts.some(c => c.status === 'overdue');
    const allReturned = checkouts.every(c => c.status === 'returned');
    const someReturned = checkouts.some(c => c.status === 'returned');
    const allActive = checkouts.every(c => c.status === 'active');
    if (hasLost) {
      status = 'lost';
    } else if (hasOverdue) {
      status = 'overdue';
    } else if (allReturned) {
      status = 'returned';
    } else if (someReturned) {
      status = 'partial';
    } else if (allActive) {
      status = 'active';
    } else {
      // fallback explicite
      status = firstCheckout.status || 'unknown';
    }
    
    // Créer un bon de livraison à partir des informations du checkout
    return {
      id: id,
      // Utiliser la propriété delivery_note_number si disponible, sinon générer un numéro
      number: firstCheckout.delivery_note_number || `Bon-${id.substring(0, 6)}`,
      status: status,
      userId: firstCheckout.user_id,
      createdAt: firstCheckout.delivery_note_date || firstCheckout.checkout_date,
      userName: `${firstCheckout.first_name} ${firstCheckout.last_name}`
    } as DeliveryNoteWithStatus;
  });

  // Trier les bons de livraison
  const deliveryNotesWithStatus = [...unsortedDeliveryNotes].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'number':
        comparison = a.number.localeCompare(b.number);
        break;
      case 'createdAt':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case 'userName':
        comparison = (a.userName || '').localeCompare(b.userName || '');
        break;
      case 'status':
        comparison = a.status.localeCompare(b.status);
        break;
      default:
        comparison = 0;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Gérer l'ouverture du modal de retour
  const handleOpenReturnModal = (deliveryNote: DeliveryNoteWithStatus) => {
    if (!deliveryNote || !deliveryNote.id) {
      toast.error("Bon de livraison invalide");
      return;
    }
    
    setSelectedDeliveryNote(deliveryNote);
    
    // Récupérer les emprunts associés à ce bon de livraison
    const associatedCheckouts = calculatedCheckouts.filter(
      checkout => checkout.delivery_note_id === deliveryNote.id
    ) || [];
    
    setDeliveryCheckouts(associatedCheckouts);
    setShowReturnModal(true);
  };

  // Gérer le retour d'équipement individuel
  const handleReturnSingleItem = async (checkoutId: string, notes: string = "") => {
    setIsSubmitting(true);
    try {
      await returnEquipmentWithAPI(checkoutId, notes);
      await refreshAllStatusViews();
      await loadCheckoutsWithStatus();
      toast.success("Équipement retourné avec succès");
      setReturningItems({});
      setReturnNotes({});
    } catch (error) {
      console.error("Erreur lors du retour:", error);
      toast.error("Une erreur est survenue lors du retour");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Gérer la mise à jour forcée des statuts
  const handleForceUpdateStatus = async () => {
    setIsLoading(true);
    try {
      await refreshAllStatusViews();
      await loadCheckoutsWithStatus();
      toast.success("Statuts mis à jour avec succès");
    } catch (error) {
      console.error("Erreur lors de la mise à jour des statuts:", error);
      toast.error("Une erreur est survenue lors de la mise à jour des statuts");
    } finally {
      setIsLoading(false);
    }
  };

  // Rendu de la vue en grille
  const renderGridView = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {deliveryNotesWithStatus.length > 0 ? (
          deliveryNotesWithStatus.map((deliveryNote) => {
            const checkoutsForNote = groupedByDeliveryNote[deliveryNote.id] || [];
            
            return (
              <div
                key={deliveryNote.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700"
              >
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-lg">Bon #{deliveryNote.number}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {deliveryNote.createdAt ? 
                        format(new Date(deliveryNote.createdAt), "dd MMMM yyyy", { locale: fr }) : 
                        "Date inconnue"}
                    </p>
                  </div>
                  <StatusBadge status={deliveryNote.status || 'unknown'} />
                </div>
                <div className="p-4">
                  <p className="text-sm font-medium mb-2">
                    <span className="text-gray-500 dark:text-gray-400">Utilisateur: </span>
                    {deliveryNote.userName || "Utilisateur inconnu"}
                  </p>
                  <p className="text-sm mb-4">
                    <span className="text-gray-500 dark:text-gray-400">Équipements: </span>
                    {checkoutsForNote.length}
                  </p>
                  <div className="space-y-2 mb-4">
                    {checkoutsForNote.slice(0, 3).map((checkout) => {
                      return (
                        <div
                          key={checkout.id}
                          className="flex justify-between items-center text-sm"
                        >
                          <span>{checkout.equipment_name}</span>
                          <StatusBadge status={checkout.status || 'unknown'} />
                        </div>
                      );
                    })}
                    {checkoutsForNote.length > 3 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                        ... et {checkoutsForNote.length - 3} autre(s)
                      </p>
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => handleOpenReturnModal(deliveryNote)}
                    icon={<Eye size={16} />}
                  >
                    DÉTAILS / RETOUR
                  </Button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-3 text-center py-8 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <p className="text-gray-500 dark:text-gray-400">Aucun bon de sortie trouvé.</p>
          </div>
        )}
      </div>
    );
  };

  // Rendu de la vue en liste
  const renderListView = () => {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden w-full z-10 relative">
        <div className="overflow-x-auto w-full">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('number')}
                >
                  <div className="flex items-center">
                    N° Bon
                    <ArrowUpDown size={14} className="ml-1" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('createdAt')}
                >
                  <div className="flex items-center">
                    Date
                    <ArrowUpDown size={14} className="ml-1" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('userName')}
                >
                  <div className="flex items-center">
                    Utilisateur
                    <ArrowUpDown size={14} className="ml-1" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center">
                    Statut
                    <ArrowUpDown size={14} className="ml-1" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Équipements
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {deliveryNotesWithStatus.length > 0 ? (
                deliveryNotesWithStatus.map((deliveryNote) => {
                  const checkoutsForNote = groupedByDeliveryNote[deliveryNote.id] || [];
                  
                  return (
                    <tr key={deliveryNote.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900 dark:text-white">
                          Bon #{deliveryNote.number || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {deliveryNote.createdAt ? 
                            format(new Date(deliveryNote.createdAt), "dd/MM/yyyy", { locale: fr }) : 
                            "Date inconnue"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {deliveryNote.userName || "Utilisateur inconnu"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={deliveryNote.status || 'unknown'} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {checkoutsForNote.length} équipement(s)
                        </div>
                        <ul className="text-xs text-gray-500 dark:text-gray-400 mt-1 list-disc pl-4">
                          {checkoutsForNote.slice(0, 3).map(c => {
                            return (
                              <li key={c.id} className="flex justify-between items-center">
                                <span>{c.equipment_name}</span>
                                <StatusBadge status={c.status || 'unknown'} />
                              </li>
                            );
                          })}
                          {checkoutsForNote.length > 3 && <li>... et {checkoutsForNote.length - 3} autre(s)</li>}
                        </ul>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenReturnModal(deliveryNote)}
                          icon={<Eye size={14} />}
                        >
                          DÉTAILS / RETOUR
                        </Button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    Aucun bon de sortie trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Rendu de la vue équipements (liste de tous les équipements empruntés)
  const renderEquipmentView = () => {
    // Filtrer uniquement les équipements non retournés
    const activeCheckouts = filteredCheckouts.filter(checkout => 
      checkout.status !== "returned"
    );
    
    return (
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Équipement
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Utilisateur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Date de sortie
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Date de retour prévue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {activeCheckouts.length > 0 ? (
                activeCheckouts.map((checkout) => {
                  return (
                    <tr key={checkout.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {checkout.equipment_name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Bon #{checkout.delivery_note_number || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {`${checkout.first_name} ${checkout.last_name}`}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {checkout.checkout_date ? 
                            format(new Date(checkout.checkout_date), "dd/MM/yyyy", { locale: fr }) : 
                            "Date inconnue"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {checkout.due_date ? 
                            format(new Date(checkout.due_date), "dd/MM/yyyy", { locale: fr }) : 
                            "Date inconnue"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={checkout.status || 'unknown'} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {checkout.status !== "returned" && (
                          <div className="flex flex-col space-y-2">
                            {returningItems[checkout.id] ? (
                              <>
                                <textarea
                                  placeholder="Notes de retour (optionnel)"
                                  value={returnNotes[checkout.id] || ""}
                                  onChange={(e) => setReturnNotes({
                                    ...returnNotes,
                                    [checkout.id]: e.target.value,
                                  })}
                                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md p-2 text-sm mb-2"
                                  rows={2}
                                />
                                <div className="flex space-x-2 justify-end">
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setReturningItems({
                                      ...returningItems,
                                      [checkout.id]: false,
                                    })}
                                  >
                                    Annuler
                                  </Button>
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => handleReturnSingleItem(checkout.id, returnNotes[checkout.id])}
                                    loading={isSubmitting}
                                  >
                                    Confirmer
                                  </Button>
                                </div>
                              </>
                            ) : (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setReturningItems({
                                  ...returningItems,
                                  [checkout.id]: true,
                                })}
                                icon={<CornerDownLeft size={14} />}
                              >
                                RETOURNER
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    Aucun équipement emprunté trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between gap-4 mb-6">
        <input
          type="text"
          placeholder="Rechercher par équipement ou utilisateur..."
          className="w-64 max-w-xs p-2 pl-10 border border-gray-300 rounded-md"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="secondary"
            onClick={handleForceUpdateStatus}
            icon={<RefreshCw size={16} />}
            loading={isLoading}
          >
            METTRE À JOUR LES STATUTS
          </Button>
          <Button
            variant="primary"
            onClick={() => setShowCheckoutModal(true)}
            icon={<Plus size={16} />}
          >
            NOUVELLE SORTIE
          </Button>
          <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
            <Button
              variant={viewMode === 'grid' ? 'primary' : 'outline'}
              onClick={() => setViewMode('grid')}
              className="flex items-center gap-2 rounded-none border-0"
            >
              <Grid3X3 className="w-4 h-4" />
              Grille
            </Button>
            <Button
              variant={viewMode === 'list' ? 'primary' : 'outline'}
              onClick={() => setViewMode('list')}
              className="flex items-center gap-2 rounded-none border-0"
            >
              <List className="w-4 h-4" />
              Liste
            </Button>
            <Button
              variant={viewMode === 'equipment' ? 'primary' : 'outline'}
              onClick={() => setViewMode('equipment')}
              className="flex items-center gap-2 rounded-none border-0"
            >
              <CornerDownLeft className="w-4 h-4" />
              Équipements
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Chargement des données...</div>
      ) : (
        viewMode === 'grid' ? renderGridView() : 
        viewMode === 'list' ? renderListView() : 
        renderEquipmentView()
      )}

      {showCheckoutModal && (
        <CheckoutModal
          isOpen={showCheckoutModal}
          onClose={() => {
            setShowCheckoutModal(false);
            loadCheckoutsWithStatus();
          }}
        />
      )}

      {showReturnModal && selectedDeliveryNote && (
        <ReturnModal
          isOpen={showReturnModal}
          onClose={() => {
            setShowReturnModal(false);
            setSelectedDeliveryNote(null);
            loadCheckoutsWithStatus();
          }}
          deliveryNote={{
            id: selectedDeliveryNote.id,
            userId: selectedDeliveryNote.userId,
            number: selectedDeliveryNote.number || 'N/A',
            createdAt: selectedDeliveryNote.createdAt,
            notes: selectedDeliveryNote.notes
          }}
          checkouts={deliveryCheckouts}
        />
      )}
    </div>
  );
}