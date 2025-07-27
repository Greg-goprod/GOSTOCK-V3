import React, { useState } from "react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import StatusBadge from "../common/StatusBadge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useApp } from "../../contexts/AppContext";
import { CheckoutWithCalculatedStatus } from "../../types";
import toast from "react-hot-toast";

interface ReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliveryNote: {
    id: string;
    userId: string;
    number: string;
    createdAt: string;
    notes?: string;
  };
  checkouts: CheckoutWithCalculatedStatus[];
}

const ReturnModal: React.FC<ReturnModalProps> = ({
  isOpen,
  onClose,
  deliveryNote,
  checkouts,
}) => {
  const { users = [], returnEquipmentWithAPI, refreshAllStatusViews } = useApp();
  const [returningItems, setReturningItems] = useState<Record<string, boolean>>(
    {}
  );
  const [returnNotes, setReturnNotes] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Trouver l'utilisateur associé au bon de livraison
  const user = users && users.find ? users.find((u) => u.id === deliveryNote.userId) : null;

  // Gérer le retour des équipements sélectionnés
  const handleReturn = async () => {
    setIsSubmitting(true);
    
    try {
      const selectedCheckouts = Object.entries(returningItems)
        .filter(([_checkoutId, isSelected]) => isSelected)
        .map(([checkoutId]) => checkoutId);
      
      if (selectedCheckouts.length === 0) {
        toast.error("Veuillez sélectionner au moins un équipement à retourner");
        setIsSubmitting(false);
        return;
      }
      
      // Retourner chaque équipement sélectionné
      for (const checkoutId of selectedCheckouts) {
        const notes = returnNotes[checkoutId] || "";
        await returnEquipmentWithAPI(checkoutId, notes);
      }
      
      // Rafraîchir les vues pour mettre à jour les statuts
      await refreshAllStatusViews();
      
      toast.success("Équipement(s) retourné(s) avec succès");
      onClose();
    } catch (error) {
      console.error("Erreur lors du retour:", error);
      toast.error("Une erreur est survenue lors du retour");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Retour - Bon #${deliveryNote?.number || 'N/A'}`}
      size="lg"
    >
      <div className="space-y-6">
        {/* Informations sur le bon de livraison */}
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Date de sortie
              </p>
              <p className="font-medium">
                {format(new Date(deliveryNote?.createdAt || new Date()), "dd MMMM yyyy", {
                  locale: fr,
                })}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Utilisateur
              </p>
              <p className="font-medium">
                {user
                  ? `${user.first_name} ${user.last_name}`
                  : "Utilisateur inconnu"}
              </p>
            </div>
            {deliveryNote?.notes && (
              <div className="col-span-2">
                <p className="text-sm text-gray-500 dark:text-gray-400">Notes</p>
                <p className="font-medium">{deliveryNote.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Liste des équipements */}
        <div>
          <h3 className="font-bold text-lg mb-3">Équipements</h3>
          <div className="space-y-4">
            {Array.isArray(checkouts) && checkouts.length > 0 ? (
              checkouts.map((checkout) => (
                <div
                  key={checkout.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <h4 className="font-semibold">{checkout.equipment_name}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Date de retour prévue:{" "}
                        {checkout.due_date ? 
                          format(new Date(checkout.due_date), "dd MMMM yyyy", {
                            locale: fr,
                          }) : 
                          "Date inconnue"
                        }
                      </p>
                    </div>
                    <StatusBadge status={checkout.status} />
                  </div>

                  {checkout.status !== "returned" && (
                    <>
                      <div className="mb-3">
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={!!returningItems[checkout.id]}
                            onChange={(e) =>
                              setReturningItems({
                                ...returningItems,
                                [checkout.id]: e.target.checked,
                              })
                            }
                            className="form-checkbox h-5 w-5 text-blue-600"
                          />
                          <span>Retourner cet équipement</span>
                        </label>
                      </div>

                      {returningItems[checkout.id] && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Notes de retour (optionnel)
                          </label>
                          <textarea
                            value={returnNotes[checkout.id] || ""}
                            onChange={(e) =>
                              setReturnNotes({
                                ...returnNotes,
                                [checkout.id]: e.target.value,
                              })
                            }
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-md p-2 text-sm"
                            rows={2}
                          ></textarea>
                        </div>
                      )}
                    </>
                  )}

                  {checkout.notes && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Notes:
                      </p>
                      <p className="text-sm">{checkout.notes}</p>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-gray-500">
                Aucun équipement à afficher
              </div>
            )}
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="flex justify-end space-x-3">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button
            variant="primary"
            onClick={handleReturn}
            disabled={
              isSubmitting ||
              Object.values(returningItems).every((isSelected) => !isSelected)
            }
            loading={isSubmitting}
          >
            Confirmer le retour
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ReturnModal;