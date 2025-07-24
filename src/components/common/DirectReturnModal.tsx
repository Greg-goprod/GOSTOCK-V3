import React, { useState } from "react";
import Modal from "./Modal";
import Button from "./Button";
import StatusBadge from "./StatusBadge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useApp } from "../../contexts/AppContext";
import { CheckoutWithCalculatedStatus, User } from "../../types";
import toast from "react-hot-toast";

interface DirectReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  checkout: CheckoutWithCalculatedStatus;
}

const DirectReturnModal: React.FC<DirectReturnModalProps> = ({
  isOpen,
  onClose,
  checkout,
}) => {
  const { users, returnEquipmentWithAPI, markEquipmentLostWithAPI, refreshAllStatusViews } = useApp();
  const [notes, setNotes] = useState("");
  const [isLost, setIsLost] = useState(false);
  const [isRecovered, setIsRecovered] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Trouver l'utilisateur associé à l'emprunt
  const user = users.find((u: User) => u.id === checkout.user_id);

  // Gérer le retour de l'équipement
  const handleReturn = async () => {
    setIsSubmitting(true);
    
    try {
      if (isLost) {
        // Marquer comme perdu
        await markEquipmentLostWithAPI(checkout.id, notes);
        toast.success("Équipement marqué comme perdu");
      } else {
        // Retourner l'équipement
        await returnEquipmentWithAPI(checkout.id, notes);
        toast.success("Équipement retourné avec succès");
      }
      
      // Rafraîchir les vues pour mettre à jour les statuts
      await refreshAllStatusViews();
      
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
      title={`Retour - ${checkout.equipment_name}`}
      size="md"
    >
      <div className="space-y-6">
        {/* Informations sur l'emprunt */}
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Date d'emprunt
              </p>
              <p className="font-medium">
                {format(new Date(checkout.checkout_date), "dd MMMM yyyy", {
                  locale: fr,
                })}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Date de retour prévue
              </p>
              <p className="font-medium">
                {format(new Date(checkout.due_date), "dd MMMM yyyy", {
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
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Statut
              </p>
              <StatusBadge status={checkout.status} />
            </div>
          </div>
        </div>

        {/* Options de retour */}
        {checkout.status !== "returned" && (
          <div>
            <div className="mb-4">
              <label className="flex items-center space-x-2 mb-2">
                <input
                  type="radio"
                  checked={!isLost && !isRecovered}
                  onChange={() => {
                    setIsLost(false);
                    setIsRecovered(false);
                  }}
                  className="form-radio h-5 w-5 text-blue-600"
                />
                <span>Retourner normalement</span>
              </label>
              
              <label className="flex items-center space-x-2 mb-2">
                <input
                  type="radio"
                  checked={isLost}
                  onChange={() => {
                    setIsLost(true);
                    setIsRecovered(false);
                  }}
                  className="form-radio h-5 w-5 text-red-600"
                />
                <span>Marquer comme perdu</span>
              </label>
              
              {checkout.status === "lost" && (
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    checked={isRecovered}
                    onChange={() => {
                      setIsLost(false);
                      setIsRecovered(true);
                    }}
                    className="form-radio h-5 w-5 text-green-600"
                  />
                  <span>Marquer comme retrouvé</span>
                </label>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes (optionnel)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md p-2 text-sm"
                rows={3}
                placeholder={
                  isLost
                    ? "Détails sur la perte de l'équipement..."
                    : isRecovered
                    ? "Détails sur la récupération de l'équipement..."
                    : "Notes sur le retour..."
                }
              ></textarea>
            </div>
          </div>
        )}

        {/* Notes existantes */}
        {checkout.notes && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Notes existantes:
            </p>
            <p className="text-sm">{checkout.notes}</p>
          </div>
        )}

        {/* Boutons d'action */}
        <div className="flex justify-end space-x-3">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          {checkout.status !== "returned" && (
            <Button
              variant={isLost ? "danger" : "primary"}
              onClick={handleReturn}
              disabled={isSubmitting}
            >
              {isLost
                ? "Confirmer la perte"
                : isRecovered
                ? "Confirmer la récupération"
                : "Confirmer le retour"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default DirectReturnModal;