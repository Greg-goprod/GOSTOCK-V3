import React, { useEffect, useState } from "react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import StatusBadge from "../common/StatusBadge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft, Search } from "lucide-react";
import { useApp } from "../../contexts/AppContext";
import { supabase } from "../../lib/supabase";
import toast from "react-hot-toast";

interface ReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Sans bon fourni, la fenêtre propose la liste des bons en cours
  deliveryNoteId?: string;
}

interface NoteCheckout {
  id: string;
  status: string;
  due_date: string | null;
  notes: string | null;
  equipment: { name: string } | null;
}

interface NoteDetails {
  id: string;
  note_number: string;
  created_at: string;
  notes: string | null;
  users: { first_name: string; last_name: string } | null;
  checkouts: NoteCheckout[];
}

interface OpenNote {
  id: string;
  note_number: string;
  created_at: string;
  status: string;
  users: { first_name: string; last_name: string } | null;
}

const RETURNABLE_STATUSES = ["active", "overdue"];

const formatDate = (date: string | null) =>
  date ? format(new Date(date), "dd MMMM yyyy", { locale: fr }) : "Date inconnue";

const ReturnModal: React.FC<ReturnModalProps> = ({
  isOpen,
  onClose,
  deliveryNoteId,
}) => {
  const { refreshData } = useApp();
  const [noteId, setNoteId] = useState<string | undefined>(deliveryNoteId);
  const [note, setNote] = useState<NoteDetails | null>(null);
  const [openNotes, setOpenNotes] = useState<OpenNote[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [returningItems, setReturningItems] = useState<Record<string, boolean>>({});
  const [returnNotes, setReturnNotes] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Repartir de zéro à chaque ouverture
  useEffect(() => {
    if (!isOpen) return;
    setNoteId(deliveryNoteId);
    setNote(null);
    setSearch("");
  }, [isOpen, deliveryNoteId]);

  useEffect(() => {
    if (!isOpen || !supabase) return;
    setReturningItems({});
    setReturnNotes({});

    const load = async () => {
      setIsLoading(true);
      try {
        if (noteId) {
          const { data, error } = await supabase!
            .from("delivery_notes")
            .select("id, note_number, created_at, notes, users(first_name, last_name), checkouts(id, status, due_date, notes, equipment(name))")
            .eq("id", noteId)
            .single();
          if (error) throw error;
          setNote(data as unknown as NoteDetails);
        } else {
          const { data, error } = await supabase!
            .from("delivery_notes")
            .select("id, note_number, created_at, status, users(first_name, last_name)")
            .in("status", ["active", "partial", "overdue"])
            .order("created_at", { ascending: false });
          if (error) throw error;
          setOpenNotes((data || []) as unknown as OpenNote[]);
        }
      } catch (error) {
        console.error("Erreur lors du chargement du bon:", error);
        toast.error("Impossible de charger le bon de sortie");
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [isOpen, noteId]);

  const returnableCheckouts = (note?.checkouts || []).filter((c) =>
    RETURNABLE_STATUSES.includes(c.status)
  );
  const selectedIds = Object.keys(returningItems).filter((id) => returningItems[id]);

  const toggleAll = () => {
    const allSelected = returnableCheckouts.every((c) => returningItems[c.id]);
    setReturningItems(
      Object.fromEntries(returnableCheckouts.map((c) => [c.id, !allSelected]))
    );
  };

  const handleReturn = async () => {
    if (!supabase || selectedIds.length === 0) return;
    setIsSubmitting(true);

    let failures = 0;
    for (const checkoutId of selectedIds) {
      const { error } = await supabase.rpc("return_equipment", {
        p_checkout_id: checkoutId,
        p_notes: returnNotes[checkoutId] || null,
      });
      if (error) {
        console.error("Erreur lors du retour:", error);
        failures++;
      }
    }

    await refreshData();
    setIsSubmitting(false);

    if (failures > 0) {
      toast.error(`${failures} équipement(s) n'ont pas pu être retournés`);
      return;
    }
    toast.success(
      selectedIds.length > 1
        ? `${selectedIds.length} équipements retournés`
        : "Équipement retourné"
    );
    onClose();
  };

  const filteredOpenNotes = openNotes.filter((n) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    const userName = n.users ? `${n.users.first_name} ${n.users.last_name}` : "";
    return (
      n.note_number?.toLowerCase().includes(term) ||
      userName.toLowerCase().includes(term)
    );
  });

  const title = note ? `Retour - Bon ${note.note_number}` : "Retour de matériel";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      {isLoading ? (
        <div className="py-8 text-center text-gray-500">Chargement…</div>
      ) : !noteId ? (
        // Choix du bon à retourner
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par numéro de bon ou emprunteur"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
            />
          </div>
          {filteredOpenNotes.length === 0 ? (
            <div className="text-center py-4 text-gray-500">Aucun bon en cours</div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredOpenNotes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setNoteId(n.id)}
                  className="w-full flex justify-between items-center text-left border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <div>
                    <p className="font-semibold">{n.note_number}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {n.users ? `${n.users.first_name} ${n.users.last_name}` : "Utilisateur inconnu"}
                      {" · "}
                      {formatDate(n.created_at)}
                    </p>
                  </div>
                  <StatusBadge status={n.status} />
                </button>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              Fermer
            </Button>
          </div>
        </div>
      ) : !note ? (
        <div className="py-8 text-center text-gray-500">Bon de sortie introuvable</div>
      ) : (
        <div className="space-y-6">
          {!deliveryNoteId && (
            <button
              type="button"
              onClick={() => setNoteId(undefined)}
              className="flex items-center gap-1 text-sm text-primary-600 hover:underline"
            >
              <ArrowLeft className="w-4 h-4" /> Choisir un autre bon
            </button>
          )}

          {/* Informations sur le bon de livraison */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Date de sortie</p>
                <p className="font-medium">{formatDate(note.created_at)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Utilisateur</p>
                <p className="font-medium">
                  {note.users
                    ? `${note.users.first_name} ${note.users.last_name}`
                    : "Utilisateur inconnu"}
                </p>
              </div>
              {note.notes && (
                <div className="col-span-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Notes</p>
                  <p className="font-medium">{note.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Liste des équipements */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-lg">Équipements</h3>
              {returnableCheckouts.length > 1 && (
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-sm text-primary-600 hover:underline"
                >
                  {returnableCheckouts.every((c) => returningItems[c.id])
                    ? "Tout désélectionner"
                    : "Tout sélectionner"}
                </button>
              )}
            </div>
            <div className="space-y-4">
              {note.checkouts.length > 0 ? (
                note.checkouts.map((checkout) => (
                  <div
                    key={checkout.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <h4 className="font-semibold">
                          {checkout.equipment?.name || "Équipement supprimé"}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Date de retour prévue: {formatDate(checkout.due_date)}
                        </p>
                      </div>
                      <StatusBadge status={checkout.status} />
                    </div>

                    {RETURNABLE_STATUSES.includes(checkout.status) && (
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
                        <p className="text-sm text-gray-500 dark:text-gray-400">Notes:</p>
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
              disabled={isSubmitting || selectedIds.length === 0}
              loading={isSubmitting}
            >
              Confirmer le retour
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ReturnModal;
