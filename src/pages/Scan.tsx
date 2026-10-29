import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCodeScanner from '../components/QRCode/QRCodeScanner';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { ArrowLeft, Search, Package, User, FileText, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { findEquipmentByCode } from '../lib/scan';
import { Equipment, User as UserType, CheckoutRecord } from '../types';
import ReturnModal from '../components/checkout/ReturnModal';

const Scan: React.FC = () => {
  const navigate = useNavigate();
  const [scannedId, setScannedId] = useState<string | null>(null);
  const [itemType, setItemType] = useState<'equipment' | 'user' | 'checkout' | 'delivery_note' | null>(null);
  const [item, setItem] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | undefined>(undefined);

  const handleScan = async (decodedText: string) => {
    console.log("Scan détecté:", decodedText);
    setScannedId(decodedText);
    setLoading(true);
    setError(null);
    setSuccess(false);
    
    try {
      await identifyQRCode(decodedText);
    } catch (error: any) {
      console.error("Erreur lors de l'identification:", error);
      setError(error.message || "Erreur lors de l'identification du QR code");
      setItemType(null);
      setItem(null);
    } finally {
      setLoading(false);
    }
  };

  const identifyQRCode = async (id: string) => {
    console.log("Tentative d'identification du QR code:", id);
    
    // Vérifier si c'est un QR code de bon de sortie (format: DN-DNyymm-xxxx)
    if (id.startsWith('DN-')) {
      try {
        // Rechercher le bon de sortie par QR code
        const { data: deliveryNote, error: noteError } = await supabase
          .from('delivery_notes')
          .select(`
            *,
            users(*),
            checkouts(
              *,
              equipment(*)
            )
          `)
          .eq('qr_code', id)
          .maybeSingle();
        
        if (noteError) throw noteError;
        
        if (deliveryNote) {
          console.log("Bon de sortie trouvé:", deliveryNote);
          setItemType('delivery_note');
          
          // Transformer les données pour correspondre à notre interface
          const transformedNote = {
            id: deliveryNote.id,
            noteNumber: deliveryNote.note_number,
            userId: deliveryNote.user_id,
            issueDate: deliveryNote.issue_date,
            dueDate: deliveryNote.due_date,
            status: deliveryNote.status,
            notes: deliveryNote.notes,
            qrCode: deliveryNote.qr_code,
            user: {
              id: deliveryNote.users.id,
              first_name: deliveryNote.users.first_name,
              last_name: deliveryNote.users.last_name,
              email: deliveryNote.users.email,
              phone: deliveryNote.users.phone,
              department: deliveryNote.users.department,
              role: deliveryNote.users.role
            },
            checkouts: deliveryNote.checkouts.map((checkout: any) => ({
              id: checkout.id,
              equipmentId: checkout.equipment_id,
              userId: checkout.user_id,
              checkoutDate: checkout.checkout_date,
              dueDate: checkout.due_date,
              returnDate: checkout.return_date,
              status: checkout.status,
              notes: checkout.notes,
              equipment: {
                id: checkout.equipment.id,
                name: checkout.equipment.name,
                serialNumber: checkout.equipment.serial_number,
                articleNumber: checkout.equipment.article_number
              }
            })),
            activeCheckouts: deliveryNote.checkouts.filter((c: any) => c.status === 'active' || c.status === 'overdue').length,
            returnedCheckouts: deliveryNote.checkouts.filter((c: any) => c.status === 'returned').length,
            totalCheckouts: deliveryNote.checkouts.length
          };
          
          setItem(transformedNote);
          setSuccess(true);
          toast.success(`Bon de sortie trouvé: ${deliveryNote.note_number}`);
          return;
        }
      } catch (error) {
        console.error("Erreur lors de la recherche du bon par QR code:", error);
      }
    }
    
    // Normaliser le format du code scanné
    // Remplacer les apostrophes par des tirets si présentes
    const normalizedId = id.replace(/'/g, '-');
    
    // Identifiant, numéro d'article ou numéro de série exacts (plus de correspondance approximative
    // qui pouvait retourner un autre article) ; les codes d'exemplaire sont traités plus bas
    const found = await findEquipmentByCode(normalizedId);
    const equipment = found && !found.instance ? found.equipment : null;

    // Si on a trouvé un équipement
    if (equipment) {
      console.log("Équipement trouvé:", equipment);
      setItemType('equipment');
      
      // Récupérer les données de catégorie et fournisseur
      const { data: categoryData } = await supabase
        .from('categories')
        .select('name')
        .eq('id', equipment.category_id)
        .maybeSingle();
        
      const { data: supplierData } = await supabase
        .from('suppliers')
        .select('name')
        .eq('id', equipment.supplier_id)
        .maybeSingle();
      
      // Transformer les données pour correspondre à notre interface
      const transformedEquipment: Equipment = {
        id: equipment.id,
        name: equipment.name,
        description: equipment.description || '',
        category: categoryData?.name || '',
        serialNumber: equipment.serial_number,
        status: equipment.status as Equipment['status'],
        addedDate: equipment.added_date || equipment.created_at,
        lastMaintenance: equipment.last_maintenance,
        imageUrl: equipment.image_url,
        supplier: supplierData?.name || '',
        location: equipment.location || '',
        articleNumber: equipment.article_number,
        qrType: equipment.qr_type || 'individual',
        totalQuantity: equipment.total_quantity || 1,
        availableQuantity: equipment.available_quantity ?? 0,
        shortTitle: equipment.short_title
      };
      
      // Vérifier si l'équipement est actuellement emprunté
      const { data: activeCheckout, error: checkoutError } = await supabase
        .from('checkouts')
        .select(`
          *,
          users(first_name, last_name, email, department),
          delivery_notes(id, note_number, status)
        `)
        .eq('equipment_id', equipment.id)
        .in('status', ['active', 'overdue'])
        .order('checkout_date')
        .limit(1)
        .maybeSingle();
      
      if (activeCheckout) {
        console.log("Emprunt actif trouvé pour cet équipement:", activeCheckout);
        setItemType('checkout');
        
        // Transformer les données pour correspondre à notre interface
        const transformedCheckout = {
          id: activeCheckout.id,
          equipmentId: activeCheckout.equipment_id,
          userId: activeCheckout.user_id,
          checkoutDate: activeCheckout.checkout_date,
          dueDate: activeCheckout.due_date,
          returnDate: activeCheckout.return_date,
          status: activeCheckout.status,
          notes: activeCheckout.notes,
          delivery_note_id: activeCheckout.delivery_note_id,
          equipment: transformedEquipment,
          user: {
            id: activeCheckout.user_id,
            first_name: activeCheckout.users.first_name,
            last_name: activeCheckout.users.last_name,
            email: activeCheckout.users.email,
            department: activeCheckout.users.department
          },
          delivery_note: activeCheckout.delivery_notes ? {
            id: activeCheckout.delivery_notes.id,
            note_number: activeCheckout.delivery_notes.note_number,
            status: activeCheckout.delivery_notes.status
          } : null
        };
        
        setItem(transformedCheckout);
        setSuccess(true);
        toast.success(`Emprunt trouvé pour: ${transformedEquipment.name}`);
        return;
      }
      
      setItem(transformedEquipment);
      setSuccess(true);
      toast.success(`Équipement trouvé: ${equipment.name}`);
      return;
    }

    // Essayer de trouver une instance d'équipement
    const { data: instance, error: instanceError } = await supabase
      .from('equipment_instances')
      .select(`
        *,
        equipment(*)
      `)
      .eq('qr_code', found?.instance?.qr_code ?? normalizedId)
      .maybeSingle();

    console.log("Recherche instance:", instance, instanceError);

    if (instance) {
      console.log("Instance d'équipement trouvée:", instance);
      setItemType('equipment');
      
      // Transformer les données pour correspondre à notre interface
      const transformedEquipment: Equipment = {
        id: instance.equipment.id,
        name: instance.equipment.name,
        description: instance.equipment.description || '',
        category: '',
        serialNumber: instance.equipment.serial_number,
        status: instance.equipment.status as Equipment['status'],
        addedDate: instance.equipment.added_date || instance.equipment.created_at,
        lastMaintenance: instance.equipment.last_maintenance,
        imageUrl: instance.equipment.image_url,
        supplier: '',
        location: instance.equipment.location || '',
        articleNumber: instance.equipment.article_number,
        qrType: instance.equipment.qr_type || 'individual',
        totalQuantity: instance.equipment.total_quantity || 1,
        availableQuantity: instance.equipment.available_quantity ?? 0,
        shortTitle: instance.equipment.short_title
      };
      
      setItem({
        ...transformedEquipment,
        instance: {
          id: instance.id,
          instanceNumber: instance.instance_number,
          qrCode: instance.qr_code,
          status: instance.status
        }
      });
      
      setSuccess(true);
      toast.success(`Instance d'équipement trouvée: ${instance.equipment.name} #${instance.instance_number}`);
      return;
    }

    // Essayer de trouver un utilisateur par ID
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    console.log("Recherche utilisateur:", user, userError);

    if (user) {
      console.log("Utilisateur trouvé:", user);
      setItemType('user');
      
      // Transformer les données pour correspondre à notre interface
      const transformedUser: UserType = {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone: user.phone || '',
        department: user.department,
        role: user.role as UserType['role'],
        dateCreated: user.created_at
      };
      
      setItem(transformedUser);
      setSuccess(true);
      toast.success(`Utilisateur trouvé: ${user.first_name} ${user.last_name}`);
      return;
    }

    // Essayer de trouver un checkout par ID
    const { data: checkout, error: checkoutError } = await supabase
      .from('checkouts')
      .select(`
        *,
        equipment(id, name, serial_number, article_number),
        users(id, first_name, last_name, email, department)
      `)
      .eq('id', id)
      .maybeSingle();

    console.log("Recherche checkout:", checkout, checkoutError);

    if (checkout) {
      console.log("Checkout trouvé:", checkout);
      setItemType('checkout');
      
      // Transformer les données pour correspondre à notre interface
      const transformedCheckout = {
        id: checkout.id,
        equipmentId: checkout.equipment_id,
        userId: checkout.user_id,
        checkoutDate: checkout.checkout_date,
        dueDate: checkout.due_date,
        returnDate: checkout.return_date,
        status: checkout.status,
        notes: checkout.notes,
        equipment: checkout.equipment,
        user: checkout.users
      };
      
      setItem(transformedCheckout);
      setSuccess(true);
      toast.success(`Emprunt trouvé pour: ${checkout.equipment?.name}`);
      return;
    }

    // Si on arrive ici, on n'a pas trouvé d'élément correspondant
    console.log("Aucun élément trouvé pour l'ID:", normalizedId);
    setItemType(null);
    setItem(null);
    throw new Error(`Aucun élément trouvé pour le code scanné: ${normalizedId}`);
  };

  const handleNavigateToItem = () => {
    if (!itemType || !item) return;

    switch (itemType) {
      case 'equipment':
        navigate(`/equipment`);
        break;
      case 'user':
        navigate(`/users`);
        break;
      case 'checkout':
        navigate(`/checkouts`);
        break;
      case 'delivery_note':
        navigate(`/checkouts`);
        break;
    }
  };

  const handleReturnEquipment = async () => {
    if (itemType === 'checkout' && item && (item.status === 'active' || item.status === 'overdue')) {
      try {
        setLoading(true);
        
        // La base remet le stock à jour elle-même
        const { error: returnError } = await supabase.rpc('return_equipment', {
          p_checkout_id: item.id
        });

        if (returnError) throw returnError;

        toast.success('Matériel retourné avec succès');
        
        // Mettre à jour l'état local
        setItem({
          ...item,
          status: 'returned',
          returnDate: new Date().toISOString()
        });
        
      } catch (error: any) {
        console.error('Erreur lors du retour:', error);
        toast.error(error.message || 'Erreur lors du retour du matériel');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleOpenReturnModal = () => {
    if (itemType === 'delivery_note' && item) {
      setSelectedNoteId(item.id);
      setShowReturnModal(true);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">SCANNER QR CODE</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Scannez un QR code pour identifier un matériel, un utilisateur, un emprunt ou un bon de sortie
          </p>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          icon={<ArrowLeft size={16} />}
          onClick={() => navigate(-1)}
        >
          Retour
        </Button>
      </div>

      <Card>
        <QRCodeScanner onScan={handleScan} onError={setError} />

        {error && (
          <div className="mt-4 p-3 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-md">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} className="text-danger-600 dark:text-danger-400" />
              <p className="text-sm font-medium text-danger-700 dark:text-danger-300">
                {error}
              </p>
            </div>
            <p className="text-xs text-danger-600 dark:text-danger-400 mt-2 pl-6">
              Essayez de scanner à nouveau ou saisissez manuellement le code dans le champ ci-dessus.
            </p>
          </div>
        )}

        {loading && !item && (
          <div className="mt-4 p-4 text-center">
            <RefreshCw size={24} className="mx-auto animate-spin text-primary-600 mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Recherche en cours...</p>
          </div>
        )}

        {success && item && (
          <div className="mt-4 p-3 bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-md">
            <div className="flex items-center gap-2">
              <CheckCircle size={18} className="text-success-600 dark:text-success-400" />
              <p className="text-sm font-medium text-success-700 dark:text-success-300">
                {itemType === 'equipment' && `Équipement trouvé: ${item.name}`}
                {itemType === 'user' && `Utilisateur trouvé: ${item.first_name} ${item.last_name}`}
                {itemType === 'checkout' && `Emprunt trouvé pour: ${item.equipment?.name}`}
                {itemType === 'delivery_note' && `Bon de sortie trouvé: ${item.noteNumber}`}
              </p>
            </div>
          </div>
        )}

        {item && (
          <div className="mt-6 p-4 border rounded-lg animate-fade-in">
            <div className="flex items-center mb-4">
              {itemType === 'equipment' && <Package size={24} className="text-primary-600 dark:text-primary-400 mr-2" />}
              {itemType === 'user' && <User size={24} className="text-primary-600 dark:text-primary-400 mr-2" />}
              {itemType === 'checkout' && <FileText size={24} className="text-primary-600 dark:text-primary-400 mr-2" />}
              {itemType === 'delivery_note' && <FileText size={24} className="text-primary-600 dark:text-primary-400 mr-2" />}
              
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {itemType === 'equipment' && 'Matériel identifié'}
                {itemType === 'user' && 'Utilisateur identifié'}
                {itemType === 'checkout' && 'Emprunt identifié'}
                {itemType === 'delivery_note' && 'Bon de sortie identifié'}
              </h3>
            </div>

            {itemType === 'equipment' && (
              <div className="space-y-2 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <p><span className="font-medium">Nom:</span> {item.name}</p>
                <p><span className="font-medium">N° Série:</span> {item.serialNumber}</p>
                <p><span className="font-medium">Statut:</span> {item.status}</p>
                {item.instance && (
                  <p><span className="font-medium">Instance:</span> #{item.instance.instanceNumber} ({item.instance.qrCode})</p>
                )}
                {item.articleNumber && (
                  <p><span className="font-medium">N° Article:</span> {item.articleNumber}</p>
                )}
                {item.category && (
                  <p><span className="font-medium">Catégorie:</span> {item.category}</p>
                )}
                {item.location && (
                  <p><span className="font-medium">Emplacement:</span> {item.location}</p>
                )}
              </div>
            )}

            {itemType === 'user' && (
              <div className="space-y-2 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <p><span className="font-medium">Nom:</span> {item.first_name} {item.last_name}</p>
                <p><span className="font-medium">Département:</span> {item.department}</p>
                <p><span className="font-medium">Email:</span> {item.email}</p>
                {item.phone && <p><span className="font-medium">Téléphone:</span> {item.phone}</p>}
              </div>
            )}

            {itemType === 'checkout' && (
              <div className="space-y-2 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <p><span className="font-medium">Matériel:</span> {item.equipment?.name}</p>
                <p><span className="font-medium">N° Série:</span> {item.equipment?.serial_number}</p>
                <p><span className="font-medium">Utilisateur:</span> {item.user?.first_name} {item.user?.last_name}</p>
                <p><span className="font-medium">Statut:</span> {
                  item.status === 'active' ? 'Actif' :
                  item.status === 'returned' ? 'Retourné' :
                  item.status === 'overdue' ? 'En retard' :
                  item.status === 'lost' ? 'Perdu' : item.status
                }</p>
                <p><span className="font-medium">Date d'emprunt:</span> {new Date(item.checkoutDate).toLocaleDateString('fr-FR')}</p>
                <p><span className="font-medium">Date de retour prévue:</span> {new Date(item.dueDate).toLocaleDateString('fr-FR')}</p>
                {item.returnDate && (
                  <p><span className="font-medium">Date de retour effective:</span> {new Date(item.returnDate).toLocaleDateString('fr-FR')}</p>
                )}
                {item.delivery_note && (
                  <p><span className="font-medium">Bon de sortie:</span> {item.delivery_note.note_number}</p>
                )}
              </div>
            )}

            {itemType === 'delivery_note' && (
              <div className="space-y-2 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <p><span className="font-medium">N° de bon:</span> {item.noteNumber}</p>
                <p><span className="font-medium">Utilisateur:</span> {item.user.first_name} {item.user.last_name}</p>
                <p><span className="font-medium">Département:</span> {item.user.department}</p>
                <p><span className="font-medium">Date d'émission:</span> {new Date(item.issueDate).toLocaleDateString('fr-FR')}</p>
                <p><span className="font-medium">Date de retour prévue:</span> {new Date(item.dueDate).toLocaleDateString('fr-FR')}</p>
                <p><span className="font-medium">Statut:</span> {
                  item.status === 'active' ? 'Actif' :
                  item.status === 'returned' ? 'Retourné' :
                  item.status === 'partial' ? 'Retour partiel' :
                  item.status === 'overdue' ? 'En retard' : item.status
                }</p>
                <p><span className="font-medium">Équipements:</span> {item.totalCheckouts} ({item.returnedCheckouts} retournés, {item.activeCheckouts} actifs)</p>
              </div>
            )}

            <div className="mt-4 flex justify-end space-x-3">
              <Button
                variant="primary"
                icon={<Search size={18} />}
                onClick={handleNavigateToItem}
              >
                Voir les détails
              </Button>

              {itemType === 'checkout' && (item.status === 'active' || item.status === 'overdue') && (
                <Button
                  variant="success"
                  icon={<ArrowLeft size={18} />}
                  onClick={handleReturnEquipment}
                  disabled={loading}
                >
                  {loading ? 'Traitement...' : 'Retourner le matériel'}
                </Button>
              )}

              {itemType === 'delivery_note' && (item.status === 'active' || item.status === 'partial' || item.status === 'overdue') && (
                <Button
                  variant="success"
                  icon={<ArrowLeft size={18} />}
                  onClick={handleOpenReturnModal}
                >
                  Effectuer les retours
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Modal de retour */}
      <ReturnModal
        isOpen={showReturnModal}
        onClose={() => {
          setShowReturnModal(false);
          setSelectedNoteId(undefined);
        }}
        deliveryNoteId={selectedNoteId}
      />
    </div>
  );
};

export default Scan;