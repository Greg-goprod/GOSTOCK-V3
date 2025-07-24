import React, { useState, useEffect } from "react";
import { useApp } from "../contexts/AppContext";
import Button from "../components/common/Button";
import CheckoutModal from "../components/checkout/CheckoutModal";
import ReturnModal from "../components/checkout/ReturnModal";
import StatusBadge from "../components/common/StatusBadge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Plus, Search, Eye, Building2, RefreshCw } from "lucide-react";
import { CheckoutWithCalculatedStatus, DeliveryNote } from "../types";
import toast from "react-hot-toast";

// Interface étendue pour les bons de livraison avec statut calculé
interface DeliveryNoteWithStatus extends Omit<DeliveryNote, 'status'> {
  status: string;
  number: string; // Ajout de la propriété number qui existe dans l'objet mais pas dans l'interface
}

export default function Checkouts() {
  const { 
    deliveryNotes, 
    users, 
    refreshAllStatusViews,
    fetchCheckoutsWithStatus 
  } = useApp();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedDeliveryNote, setSelectedDeliveryNote] = useState<DeliveryNoteWithStatus | null>(null);
  const [deliveryCheckouts, setDeliveryCheckouts] = useState<CheckoutWithCalculatedStatus[]>([]);
  const [calculatedCheckouts, setCalculatedCheckouts] = useState<CheckoutWithCalculatedStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Charger les emprunts avec leurs statuts calculés
  const loadCheckoutsWithStatus = async () => {
    setIsLoading(true);
    try {
      const data = await fetchCheckoutsWithStatus();
      setCalculatedCheckouts(data);
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

  // Filtrer les emprunts en fonction du terme de recherche
  const filteredCheckouts = calculatedCheckouts.filter((checkout) => {
    const equipmentName = checkout.equipment_name?.toLowerCase() || "";
    const userName = `${checkout.first_name} ${checkout.last_name}`.toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    
    return equipmentName.includes(searchLower) || userName.includes(searchLower);
  });

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

  // Obtenir les bons de livraison avec leurs statuts
  const deliveryNotesWithStatus = Object.entries(groupedByDeliveryNote).map(([id, checkouts]) => {
    const deliveryNote = deliveryNotes.find(dn => dn.id === id);
    if (!deliveryNote) return null;
    
    // Déterminer le statut du bon de livraison en fonction des emprunts associés
    let status = "active";
    const hasOverdue = checkouts.some(c => c.status === "overdue");
    const allReturned = checkouts.every(c => c.status === "returned");
    const someReturned = checkouts.some(c => c.status === "returned");
    
    if (hasOverdue) {
      status = "overdue";
    } else if (allReturned) {
      status = "returned";
    } else if (someReturned) {
      status = "partial";
    }
    
    return {
      ...deliveryNote,
      status
    };
  }).filter(Boolean) as DeliveryNoteWithStatus[];

  // Gérer l'ouverture du modal de retour
  const handleOpenReturnModal = (deliveryNote: DeliveryNoteWithStatus) => {
    setSelectedDeliveryNote(deliveryNote);
    
    // Récupérer les emprunts associés à ce bon de livraison
    const associatedCheckouts = calculatedCheckouts.filter(
      checkout => checkout.delivery_note_id === deliveryNote.id
    );
    
    setDeliveryCheckouts(associatedCheckouts);
    setShowReturnModal(true);
  };

  // Forcer la mise à jour des statuts
  const handleForceUpdateStatus = async () => {
    try {
      await refreshAllStatusViews();
      await loadCheckoutsWithStatus();
      toast.success("Statuts mis à jour avec succès");
    } catch (error) {
      console.error("Erreur lors de la mise à jour des statuts:", error);
      toast.error("Erreur lors de la mise à jour des statuts");
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Bons de sortie</h1>
        <div className="flex space-x-2">
          <Button
            variant="secondary"
            onClick={handleForceUpdateStatus}
            icon={<RefreshCw size={16} />}
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
        </div>
      </div>

      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Rechercher par équipement ou utilisateur..."
            className="w-full p-2 pl-10 border border-gray-300 rounded-md"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Chargement des données...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deliveryNotesWithStatus.map((deliveryNote) => {
            const checkoutsForNote = groupedByDeliveryNote[deliveryNote.id] || [];
            const user = users.find(u => u.id === deliveryNote.userId);
            
            return (
              <div
                key={deliveryNote.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700"
              >
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-lg">Bon #{deliveryNote.number}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {format(new Date(deliveryNote.createdAt), "dd MMMM yyyy", { locale: fr })}
                    </p>
                  </div>
                  <StatusBadge status={deliveryNote.status} />
                </div>
                
                <div className="p-4">
                  <div className="flex items-center mb-3">
                    <Building2 size={16} className="mr-2 text-gray-500" />
                    <span className="text-sm">
                      {user ? `${user.first_name} ${user.last_name}` : "Utilisateur inconnu"}
                    </span>
                  </div>
                  
                  <div className="mb-3">
                    <h4 className="font-semibold mb-1">Équipements:</h4>
                    <ul className="text-sm">
                      {checkoutsForNote.map((checkout) => (
                        <li key={checkout.id} className="flex justify-between items-center py-1">
                          <span>{checkout.equipment_name}</span>
                          <StatusBadge status={checkout.status} />
                        </li>
                      ))}
                    </ul>
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
          })}
        </div>
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
          deliveryNote={selectedDeliveryNote}
          checkouts={deliveryCheckouts}
        />
      )}
    </div>
  );
}