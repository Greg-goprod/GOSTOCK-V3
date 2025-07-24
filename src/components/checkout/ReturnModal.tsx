import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import QRCodeScanner from '../QRCode/QRCodeScanner';
import { User, CheckoutRecord, Equipment, DeliveryNote } from '../../types';
import { supabase } from '../../lib/supabase';
import { Search, Package, Calendar, Printer, AlertTriangle, List, Filter, FileText, User as UserIcon, RefreshCw, CheckCircle, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useApp } from '../../contexts/AppContext';

interface ReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialNoteId?: string; // Optionnel: ID du bon à rouvrir
}

interface DeliveryNoteWithDetails extends DeliveryNote {
  user: User;
  checkouts: (CheckoutRecord & {
    equipment: Equipment;
  })[];
  equipmentCount: number;
  returnedCount: number;
  lostCount: number;
}

interface ReturnItem {
  checkout: CheckoutRecord & { equipment: Equipment };
  action: 'return' | 'extend' | 'lost' | 'recover';
  newDueDate?: string;
  notes?: string;
}

const ReturnModal: React.FC<ReturnModalProps> = ({ 
  isOpen, 
  onClose,
  initialNoteId
}) => {
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNoteWithDetails[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<DeliveryNoteWithDetails[]>([]);
  const [selectedNote, setSelectedNote] = useState<DeliveryNoteWithDetails | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [returnSuccess, setReturnSuccess] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { refreshEquipmentData } = useApp();

  useEffect(() => {
    if (isOpen) {
      fetchDeliveryNotes();
    }
  }, [isOpen]);

  useEffect(() => {
    // Si un ID de bon est fourni, sélectionner ce bon automatiquement
    if (initialNoteId && deliveryNotes.length > 0) {
      const noteToSelect = deliveryNotes.find(note => note.id === initialNoteId);
      if (noteToSelect) {
        handleSelectNote(noteToSelect);
      }
    }
  }, [initialNoteId, deliveryNotes]);

  useEffect(() => {
    // Filter delivery notes based on search and overdue filter
    let filtered = deliveryNotes;
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(note =>
        note.noteNumber.toLowerCase().includes(search) ||
        `${note.user.first_name} ${note.user.last_name}`.toLowerCase().includes(search) ||
        note.checkouts.some(checkout => 
          checkout.equipment.name.toLowerCase().includes(search)
        )
      );
    }
    
    if (filterOverdue) {
      filtered = filtered.filter(note => note.status === 'overdue');
    }
    
    setFilteredNotes(filtered);
  }, [deliveryNotes, searchTerm, filterOverdue]);

  const fetchDeliveryNotes = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('delivery_notes')
        .select(`
          *,
          users(*),
          checkouts(
            *,
            equipment(*)
          )
        `)
        .in('status', ['active', 'partial', 'overdue'])
        .order('issue_date', { ascending: false });
      
      if (error) throw error;
      
      const notesWithDetails: DeliveryNoteWithDetails[] = data?.map(note => {
        const checkouts = note.checkouts?.map(checkout => {
          // Check if the checkout is overdue
          const dueDate = new Date(checkout.due_date);
          dueDate.setHours(23, 59, 59, 999); // Fin de la journée de la date d'échéance
          
          const today = new Date();
          
          // Logs de débogage pour comprendre le problème
          if (checkout.equipment?.name?.toLowerCase().includes('accu 18v')) {
            console.log('=== DEBUG RETARD ===');
            console.log('Équipement:', checkout.equipment?.name);
            console.log('Date d\'échéance:', dueDate.toISOString());
            console.log('Date actuelle:', today.toISOString());
            console.log('Date d\'échéance < Date actuelle?', dueDate < today);
            console.log('Status actuel:', checkout.status);
          }
          
          // Mark as overdue if the due date is before current time and status is active
          // Un emprunt est en retard dès 00h01 le lendemain de la date d'échéance
          const isOverdue = dueDate < today && checkout.status === 'active';
          
          return {
            ...checkout,
            status: isOverdue ? 'overdue' : checkout.status,
            equipment: {
              id: checkout.equipment.id,
              name: checkout.equipment.name || '',
              description: checkout.equipment.description || '',
              category: '',
              serialNumber: checkout.equipment.serial_number,
              status: checkout.equipment.status as Equipment['status'],
              addedDate: checkout.equipment.created_at,
              lastMaintenance: checkout.equipment.last_maintenance,
              imageUrl: checkout.equipment.image_url,
              supplier: '',
              location: checkout.equipment.location || '',
              articleNumber: checkout.equipment.article_number,
              qrType: checkout.equipment.qr_type || 'individual',
              totalQuantity: checkout.equipment.total_quantity || 1,
              availableQuantity: checkout.equipment.available_quantity || 1
            }
          };
        }) || [];

        const equipmentCount = checkouts.length;
        const returnedCount = checkouts.filter(c => c.status === 'returned').length;
        const lostCount = checkouts.filter(c => c.status === 'lost').length;
        
        // Check if any checkout is overdue
        const hasOverdueCheckouts = checkouts.some(c => c.status === 'overdue');
        
        // Update note status if any checkout is overdue
        let noteStatus = note.status;
        if (hasOverdueCheckouts && noteStatus !== 'returned') {
          noteStatus = 'overdue';
        }

        return {
          id: note.id,
          noteNumber: note.note_number,
          userId: note.user_id,
          issueDate: note.issue_date,
          dueDate: note.due_date,
          status: noteStatus as DeliveryNote['status'],
          notes: note.notes,
          createdAt: note.created_at,
          updatedAt: note.updated_at,
          user: {
            id: note.users.id,
            first_name: note.users.first_name,
            last_name: note.users.last_name,
            email: note.users.email,
            phone: note.users.phone,
            department: note.users.department,
            role: note.users.role,
            dateCreated: note.users.created_at
          },
          checkouts,
          equipmentCount,
          returnedCount,
          lostCount
        };
      }) || [];
      
      setDeliveryNotes(notesWithDetails);
      setFilteredNotes(notesWithDetails);
    } catch (error: any) {
      console.error('Error fetching delivery notes:', error);
      toast.error('Erreur lors du chargement des bons de sortie');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDeliveryNotes().finally(() => {
      setRefreshing(false);
    });
  };

  const handleSelectNote = (note: DeliveryNoteWithDetails) => {
    setSelectedNote(note);
    // Initialize return items with active checkouts
    const activeCheckouts = note.checkouts.filter(c => c.status === 'active' || c.status === 'overdue' || c.status === 'lost');
    setReturnItems(activeCheckouts.map(checkout => ({
      checkout,
      action: checkout.status === 'lost' ? 'recover' : 'return'
    })));
  };

  const handleEquipmentScan = (scannedId: string) => {
    // Find checkout by equipment ID in selected note
    if (!selectedNote) {
      toast.error('Veuillez d\'abord sélectionner un bon de sortie');
      return;
    }

    // Normaliser le format du code scanné
    const normalizedId = scannedId.replace(/'/g, '-');
    
    // Vérifier si c'est un code d'instance (format: ART-20250614-0025-001)
    const isInstanceCode = /^[A-Z]+-\d+-\d+-\d+$/.test(normalizedId);
    
    // Extraire le code article de base si c'est un code d'instance
    let articleCode = normalizedId;
    if (isInstanceCode) {
      // Extraire la partie article sans le numéro d'instance
      const parts = normalizedId.split('-');
      if (parts.length >= 3) {
        articleCode = parts.slice(0, 3).join('-');
      }
    }

    const checkout = selectedNote.checkouts.find(c => 
      c.equipment.id === normalizedId || 
      c.equipment.serialNumber === normalizedId || 
      c.equipment.articleNumber === normalizedId ||
      c.equipment.articleNumber === articleCode
    );
    
    if (checkout) {
      if (checkout.status === 'active' || checkout.status === 'overdue' || checkout.status === 'lost') {
        const existingReturn = returnItems.find(item => item.checkout.id === checkout.id);
        if (existingReturn) {
          toast.info('Cet équipement est déjà sélectionné');
        } else {
          setReturnItems(prev => [...prev, { 
            checkout, 
            action: checkout.status === 'lost' ? 'recover' : 'return' 
          }]);
          toast.success(`${checkout.equipment.name} ajouté aux retours`);
        }
      } else if (checkout.status === 'returned') {
        toast.info(`${checkout.equipment.name} a déjà été retourné`);
      }
    } else {
      toast.error('Équipement non trouvé dans ce bon de sortie');
    }
  };

  const updateReturnAction = (checkoutId: string, action: 'return' | 'extend' | 'lost' | 'recover', newDueDate?: string, notes?: string) => {
    setReturnItems(prev => 
      prev.map(item => 
        item.checkout.id === checkoutId 
          ? { ...item, action, newDueDate, notes }
          : item
      )
    );
  };

  const removeReturnItem = (checkoutId: string) => {
    setReturnItems(prev => prev.filter(item => item.checkout.id !== checkoutId));
  };

  const handleReturn = async () => {
    if (returnItems.length === 0) {
      toast.error('Aucun équipement sélectionné pour le retour');
      return;
    }

    try {
      setIsLoading(true);

      for (const item of returnItems) {
        const updateData: any = {
          notes: item.notes || null
        };

        switch (item.action) {
          case 'return': {
            // Retour complet - marquer comme retourné
            updateData.status = 'returned';
            updateData.return_date = new Date().toISOString();
            
            // Mettre à jour le statut de l'équipement
            const newAvailableQuantity = (item.checkout.equipment.availableQuantity || 0) + 1;
            const newStatus = newAvailableQuantity >= (item.checkout.equipment.totalQuantity || 1) ? 'available' : 'checked-out';
            
            await supabase
              .from('equipment')
              .update({ 
                status: newStatus,
                available_quantity: newAvailableQuantity
              })
              .eq('id', item.checkout.equipment.id);
            break;
          }
          
          case 'extend':
            // Prolongation - mettre à jour la date de retour
            if (!item.newDueDate) {
              toast.error('Date de prolongation requise');
              continue;
            }
            updateData.due_date = item.newDueDate;
            updateData.notes = `${item.checkout.notes || ''}\nProlongation accordée jusqu'au ${new Date(item.newDueDate).toLocaleDateString('fr-FR')}${item.notes ? ` - ${item.notes}` : ''}`.trim();
            
            // Mettre à jour aussi la date du bon de sortie
            await supabase
              .from('delivery_notes')
              .update({ due_date: item.newDueDate })
              .eq('id', selectedNote?.id);
            break;
          
          case 'lost': {
            // Matériel perdu - utiliser la nouvelle fonction RPC
            const { error: lostError } = await supabase.rpc('mark_equipment_lost', {
              checkout_id: item.checkout.id
            });
            
            if (lostError) throw lostError;
            
            // Ajouter des notes supplémentaires si fournies
            if (item.notes) {
              await supabase
                .from('checkouts')
                .update({ 
                  notes: `${item.checkout.notes || ''}\n${item.notes}`.trim()
                })
                .eq('id', item.checkout.id);
            }
            
            // Skip the checkout update since it's handled by the function
            continue;
          }

          case 'recover': {
            // Matériel retrouvé - utiliser la fonction RPC
            const { error: recoverError } = await supabase.rpc('recover_lost_equipment', {
              checkout_id: item.checkout.id
            });
            
            if (recoverError) throw recoverError;
            
            // Skip the checkout update since it's handled by the function
            continue;
          }
        }

        // Mettre à jour l'enregistrement d'emprunt
        await supabase
          .from('checkouts')
          .update(updateData)
          .eq('id', item.checkout.id);
      }

      // Rafraîchir les données d'équipement pour mettre à jour l'interface
      await refreshEquipmentData();
      
      // Rafraîchir les données pour voir si le bon est maintenant complètement retourné
      await fetchDeliveryNotes();
      
      // Vérifier si le bon sélectionné existe toujours (il pourrait avoir été complètement retourné)
      const updatedNote = deliveryNotes.find(note => note.id === selectedNote?.id);
      
      setReturnSuccess(true);
      toast.success('Opérations de retour enregistrées avec succès');
      
      // Imprimer la quittance de retour
      handlePrintReturn();
      
      // Si le bon est toujours actif ou partiel, le garder sélectionné pour d'autres retours potentiels
      if (updatedNote && (updatedNote.status === 'active' || updatedNote.status === 'partial')) {
        setSelectedNote(updatedNote);
        // Réinitialiser les éléments de retour
        setReturnItems([]);
      } else {
        // Si le bon est complètement retourné, revenir à la liste
        setTimeout(() => {
          setSelectedNote(null);
          setReturnItems([]);
          setReturnSuccess(false);
        }, 2000);
      }
    } catch (error: any) {
      console.error('Error during return:', error);
      toast.error(error.message || 'Erreur lors du retour');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrintReturn = async () => {
    if (!selectedNote) return;

    try {
      // Récupérer le logo depuis les paramètres système
      const { data: logoSetting } = await supabase
        .from('system_settings')
        .select('value')
        .eq('id', 'company_logo')
        .single();

      const logoUrl = logoSetting?.value || '';
      const today = new Date();
      const formattedDate = today.toLocaleDateString('fr-FR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });

      const returnedItems = returnItems.filter(item => item.action === 'return' || item.action === 'recover');
      const extendedItems = returnItems.filter(item => item.action === 'extend');
      const lostItems = returnItems.filter(item => item.action === 'lost');

      const printContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Quittance de Retour ${selectedNote.noteNumber} - GO-Mat</title>
            <meta charset="UTF-8">
            <style>
              @page {
                size: A4;
                margin: 10mm;
              }
              body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 0;
                color: #333;
                font-size: 10pt;
              }
              .header {
                display: flex;
                justify-content: space-between;
                margin-bottom: 20px;
                border-bottom: 1px solid #ddd;
                padding-bottom: 10px;
              }
              .logo-container {
                width: 40%;
              }
              .logo {
                max-height: 60px;
                max-width: 200px;
              }
              .company-info {
                text-align: right;
                width: 40%;
              }
              .company-name {
                font-size: 18pt;
                font-weight: bold;
                color: #4CAF50;
                margin-bottom: 5px;
              }
              .document-title {
                font-size: 14pt;
                font-weight: bold;
                margin: 20px 0;
                color: #333;
                text-align: center;
                text-transform: uppercase;
              }
              .document-number {
                font-weight: bold;
                color: #4CAF50;
              }
              .customer-info {
                margin-bottom: 20px;
              }
              .customer-box {
                border: 1px solid #ddd;
                padding: 10px;
                width: 50%;
                margin-left: auto;
              }
              .date-info {
                text-align: right;
                margin-bottom: 10px;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
              }
              th {
                background-color: #4CAF50;
                color: white;
                font-weight: bold;
                text-align: left;
                padding: 8px;
              }
              td {
                border: 1px solid #ddd;
                padding: 8px;
              }
              tr:nth-child(even) {
                background-color: #f2f2f2;
              }
              .returned { background-color: #d4edda; }
              .extended { background-color: #fff3cd; }
              .lost { background-color: #f8d7da; }
              .recovered { background-color: #d1ecf1; }
              .footer {
                margin-top: 30px;
                border-top: 1px solid #ddd;
                padding-top: 10px;
                font-size: 9pt;
              }
              .signatures {
                display: flex;
                justify-content: space-between;
                margin-top: 40px;
              }
              .signature-box {
                width: 45%;
              }
              .signature-line {
                border-bottom: 1px solid #333;
                margin-top: 50px;
                margin-bottom: 5px;
              }
              .page-number {
                text-align: center;
                font-size: 8pt;
                color: #777;
                margin-top: 20px;
              }
              .section-title {
                font-size: 12pt;
                font-weight: bold;
                margin: 15px 0;
                color: #333;
              }
              .contact-info {
                display: flex;
                justify-content: space-between;
                font-size: 8pt;
                color: #777;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="logo-container">
                ${logoUrl ? `<img src="${logoUrl}" alt="Logo" class="logo" />` : `<div class="company-name">GO-Mat</div>`}
              </div>
              <div class="company-info">
                <div class="company-name">GO-Mat</div>
                <div>Gestion de Matériel</div>
                <div>123 Rue de l'Équipement</div>
                <div>75000 Paris</div>
                <div>Tél: 01 23 45 67 89</div>
                <div>Email: contact@go-mat.fr</div>
              </div>
            </div>
            
            <div class="date-info">
              <div>Date de retour: ${formattedDate}</div>
              <div>Référence: ${selectedNote.noteNumber}</div>
            </div>
            
            <div class="customer-info">
              <div class="customer-box">
                <div><strong>Emprunteur:</strong></div>
                <div>${selectedNote.user.first_name} ${selectedNote.user.last_name}</div>
                <div>Département: ${selectedNote.user.department}</div>
                <div>Email: ${selectedNote.user.email}</div>
                ${selectedNote.user.phone ? `<div>Téléphone: ${selectedNote.user.phone}</div>` : ''}
              </div>
            </div>
            
            <div class="document-title">
              Quittance de Retour <span class="document-number">N° ${selectedNote.noteNumber}</span>
            </div>

            ${returnedItems.length > 0 ? `
              <div class="section-title">✓ Matériel Retourné</div>
              <table>
                <thead>
                  <tr>
                    <th style="width: 5%;">N°</th>
                    <th style="width: 40%;">Désignation</th>
                    <th style="width: 20%;">Référence</th>
                    <th style="width: 15%;">Date d'emprunt</th>
                    <th style="width: 20%;">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  ${returnedItems.map((item, index) => `
                    <tr class="${item.action === 'recover' ? 'recovered' : 'returned'}">
                      <td>${index + 1}</td>
                      <td>${item.checkout.equipment.name} ${item.action === 'recover' ? '(Retrouvé)' : ''}</td>
                      <td>${item.checkout.equipment.serialNumber}</td>
                      <td>${new Date(item.checkout.checkoutDate).toLocaleDateString('fr-FR')}</td>
                      <td>${item.notes || '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : ''}

            ${extendedItems.length > 0 ? `
              <div class="section-title">📅 Prolongations Accordées</div>
              <table>
                <thead>
                  <tr>
                    <th style="width: 5%;">N°</th>
                    <th style="width: 40%;">Désignation</th>
                    <th style="width: 20%;">Référence</th>
                    <th style="width: 15%;">Nouvelle date</th>
                    <th style="width: 20%;">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  ${extendedItems.map((item, index) => `
                    <tr class="extended">
                      <td>${index + 1}</td>
                      <td>${item.checkout.equipment.name}</td>
                      <td>${item.checkout.equipment.serialNumber}</td>
                      <td>${item.newDueDate ? new Date(item.newDueDate).toLocaleDateString('fr-FR') : '-'}</td>
                      <td>${item.notes || '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : ''}

            ${lostItems.length > 0 ? `
              <div class="section-title">✗ Matériel Déclaré Perdu</div>
              <table>
                <thead>
                  <tr>
                    <th style="width: 5%;">N°</th>
                    <th style="width: 40%;">Désignation</th>
                    <th style="width: 20%;">Référence</th>
                    <th style="width: 15%;">Date d'emprunt</th>
                    <th style="width: 20%;">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  ${lostItems.map((item, index) => `
                    <tr class="lost">
                      <td>${index + 1}</td>
                      <td>${item.checkout.equipment.name}</td>
                      <td>${item.checkout.equipment.serialNumber}</td>
                      <td>${new Date(item.checkout.checkoutDate).toLocaleDateString('fr-FR')}</td>
                      <td>${item.notes || '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : ''}

            <div class="signatures">
              <div class="signature-box">
                <div><strong>Signature de l'emprunteur:</strong></div>
                <div class="signature-line"></div>
                <div>Date: ___________________</div>
              </div>
              
              <div class="signature-box">
                <div><strong>Signature du responsable:</strong></div>
                <div class="signature-line"></div>
                <div>Date: ___________________</div>
              </div>
            </div>
            
            <div class="footer">
              <div class="contact-info">
                <div>GO-Mat - Système de Gestion de Matériel</div>
                <div>Tél: 01 23 45 67 89</div>
                <div>Email: contact@go-mat.fr</div>
              </div>
              <div class="page-number">Page 1/1</div>
            </div>
          </body>
        </html>
      `;

      // Ouvrir dans une nouvelle fenêtre avec des dimensions spécifiques
      const printWindow = window.open('', '_blank', 'width=800,height=900,scrollbars=yes,resizable=yes');
      
      if (!printWindow) {
        toast.error('Impossible d\'ouvrir la fenêtre d\'impression. Vérifiez que les popups ne sont pas bloquées.');
        return;
      }
      
      printWindow.document.open();
      printWindow.document.write(printContent);
      printWindow.document.close();
      
      // Attendre que le contenu soit chargé avant d'imprimer
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 1000);
      };
      
    } catch (error) {
      console.error('Error printing return:', error);
      toast.error('Erreur lors de l\'impression');
    }
  };

  const handleClose = () => {
    setSelectedNote(null);
    setReturnItems([]);
    setSearchTerm('');
    setFilterOverdue(false);
    setShowScanner(false);
    setReturnSuccess(false);
    onClose();
  };

  const overdueCount = deliveryNotes.filter(note => note.status === 'overdue').length;
  const partialCount = deliveryNotes.filter(note => note.status === 'partial').length;

  if (isLoading && !selectedNote) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="Retour de Matériel" size="xl">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500 dark:text-gray-400">Chargement des bons de sortie...</div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Retour de Matériel"
      size="xl"
    >
      <div className="space-y-6">
        {!selectedNote ? (
          <>
            {/* Header avec statistiques */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-blue-800 dark:text-blue-200">
                    📋 Bons de sortie actifs
                  </h3>
                  <p className="text-blue-700 dark:text-blue-300 text-sm">
                    {deliveryNotes.length} bon(s) de sortie en cours
                    {overdueCount > 0 && (
                      <span className="ml-2 text-red-600 dark:text-red-400 font-medium">
                        • {overdueCount} en retard
                      </span>
                    )}
                    {partialCount > 0 && (
                      <span className="ml-2 text-yellow-600 dark:text-yellow-400 font-medium">
                        • {partialCount} retour partiel
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />}
                    onClick={handleRefresh}
                    disabled={refreshing}
                  >
                    {refreshing ? 'Actualisation...' : 'Actualiser'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Package size={16} />}
                    onClick={() => setShowScanner(!showScanner)}
                  >
                    {showScanner ? 'Masquer Scanner' : 'Scanner QR'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Scanner QR (optionnel) */}
            {showScanner && (
              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-3">Scanner le QR code de l'équipement</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Scannez d'abord un équipement, puis sélectionnez le bon de sortie correspondant.
                </p>
                <QRCodeScanner onScan={handleEquipmentScan} />
              </div>
            )}

            {/* Filtres et recherche */}
            <div className="flex gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Rechercher par numéro de bon, utilisateur ou équipement..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                />
              </div>
              <Button
                variant={filterOverdue ? 'danger' : 'outline'}
                size="sm"
                icon={<AlertTriangle size={16} />}
                onClick={() => setFilterOverdue(!filterOverdue)}
              >
                En retard ({overdueCount})
              </Button>
            </div>

            {/* Liste des bons de sortie */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-800 p-3 border-b font-medium text-sm">
                Bons de sortie disponibles pour retour ({filteredNotes.length})
              </div>
              <div className="max-h-80 overflow-y-auto">
                {filteredNotes.length === 0 ? (
                  <div className="p-8 text-center">
                    <FileText size={48} className="mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      Aucun bon de sortie
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      {searchTerm || filterOverdue 
                        ? 'Aucun bon ne correspond aux critères de recherche.'
                        : 'Aucun bon de sortie actif pour le moment.'
                      }
                    </p>
                  </div>
                ) : (
                  filteredNotes.map(note => {
                    const isOverdue = note.status === 'overdue';
                    const isPartial = note.status === 'partial';
                    const hasLostItems = note.lostCount > 0;
                    
                    return (
                      <div
                        key={note.id}
                        className={`p-4 border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors ${
                          isOverdue ? 'bg-red-50 dark:bg-red-900/20' : 
                          isPartial ? 'bg-yellow-50 dark:bg-yellow-900/20' : 
                          hasLostItems ? 'bg-orange-50 dark:bg-orange-900/20' : ''
                        }`}
                        onClick={() => handleSelectNote(note)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <FileText size={18} className="text-blue-600 dark:text-blue-400" />
                              <h4 className="font-medium text-gray-900 dark:text-gray-100">
                                Bon N° {note.noteNumber}
                              </h4>
                              {isOverdue && (
                                <AlertTriangle size={16} className="text-red-500" />
                              )}
                              {isPartial && (
                                <span className="text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded">
                                  Retour partiel
                                </span>
                              )}
                              {hasLostItems && (
                                <span className="text-xs bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200 px-2 py-1 rounded">
                                  Matériel perdu
                                </span>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-2">
                              <div className="flex items-center gap-1">
                                <UserIcon size={14} />
                                <span>{note.user.first_name} {note.user.last_name}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Package size={14} />
                                <span>{note.equipmentCount} équipement(s)</span>
                              </div>
                              {note.returnedCount > 0 && (
                                <div className="flex items-center gap-1">
                                  <span className="text-green-600 dark:text-green-400">
                                    {note.returnedCount} retourné(s)
                                  </span>
                                </div>
                              )}
                              {note.lostCount > 0 && (
                                <div className="flex items-center gap-1">
                                  <span className="text-orange-600 dark:text-orange-400">
                                    {note.lostCount} perdu(s)
                                  </span>
                                </div>
                              )}
                            </div>
                            
                            <p className="text-sm text-gray-500 dark:text-gray-500">
                              Émis le: {new Date(note.issueDate).toLocaleDateString('fr-FR')} • 
                              Département: {note.user.department}
                            </p>
                          </div>
                          
                          <div className="text-right">
                            <div className={`text-sm font-medium ${
                              isOverdue ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'
                            }`}>
                              Retour prévu: {new Date(note.dueDate).toLocaleDateString('fr-FR')}
                            </div>
                            {isOverdue && (
                              <div className="text-xs text-red-500 font-medium">
                                EN RETARD
                              </div>
                            )}
                            {isPartial && (
                              <div className="text-xs text-yellow-500 font-medium">
                                {note.returnedCount}/{note.equipmentCount} retourné(s)
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Bon sélectionné - Gestion des retours */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-blue-800 dark:text-blue-200">
                    📋 Bon N° {selectedNote.noteNumber}
                  </h3>
                  <p className="text-blue-700 dark:text-blue-300 text-sm">
                    {selectedNote.user.first_name} {selectedNote.user.last_name} • {selectedNote.user.department}
                  </p>
                  <p className="text-blue-700 dark:text-blue-300 text-sm">
                    {selectedNote.returnedCount}/{selectedNote.equipmentCount} équipement(s) retourné(s)
                    {selectedNote.status === 'partial' && (
                      <span className="ml-2 text-yellow-600 dark:text-yellow-400 font-medium">
                        • Retour partiel
                      </span>
                    )}
                    {selectedNote.lostCount > 0 && (
                      <span className="ml-2 text-orange-600 dark:text-orange-400 font-medium">
                        • {selectedNote.lostCount} perdu(s)
                      </span>
                    )}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedNote(null)}
                >
                  Changer de bon
                </Button>
              </div>
            </div>

            {/* Message de succès */}
            {returnSuccess && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 animate-fade-in">
                <div className="flex items-center gap-2">
                  <CheckCircle size={20} className="text-green-600 dark:text-green-400" />
                  <h3 className="font-medium text-green-800 dark:text-green-200">
                    Retour enregistré avec succès
                  </h3>
                </div>
                <p className="text-green-700 dark:text-green-300 text-sm mt-1">
                  {selectedNote.status === 'partial' ? (
                    <>
                      Le bon est maintenant en statut <strong>retour partiel</strong>. 
                      Vous pouvez continuer à traiter d'autres retours pour ce bon.
                    </>
                  ) : (
                    <>
                      Tous les équipements ont été traités. Le bon est maintenant complet.
                    </>
                  )}
                </p>
              </div>
            )}

            {/* Scanner QR pour ce bon */}
            {showScanner && (
              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-3">Scanner le QR code de l'équipement</h4>
                <QRCodeScanner onScan={handleEquipmentScan} />
              </div>
            )}

            {/* Équipements du bon sélectionné */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">
                  Équipements du bon ({selectedNote.checkouts.filter(c => c.status === 'active' || c.status === 'overdue' || c.status === 'lost').length} actifs)
                </h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Package size={16} />}
                    onClick={() => setShowScanner(!showScanner)}
                  >
                    {showScanner ? 'Masquer Scanner' : 'Scanner QR'}
                  </Button>
                </div>
              </div>
              
              <div className="space-y-3">
                {/* Équipements actifs */}
                {selectedNote.checkouts.filter(c => c.status === 'active' || c.status === 'overdue' || c.status === 'lost').length > 0 ? (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Équipements à traiter
                    </h4>
                    {selectedNote.checkouts.filter(c => c.status === 'active' || c.status === 'overdue' || c.status === 'lost').map((checkout) => {
                      const returnItem = returnItems.find(item => item.checkout.id === checkout.id);
                      const isOverdue = checkout.status === 'overdue';
                      const isLost = checkout.status === 'lost';
                      
                      return (
                        <div 
                          key={checkout.id} 
                          className={`border rounded-lg p-3 ${
                            isLost ? 'border-orange-300 bg-orange-50 dark:bg-orange-900/20' : 
                            isOverdue ? 'border-red-300 bg-red-50 dark:bg-red-900/20' : ''
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{checkout.equipment.name}</h4>
                                {isLost && (
                                  <span className="text-xs bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200 px-2 py-0.5 rounded-full">
                                    PERDU
                                  </span>
                                )}
                                {isOverdue && !isLost && (
                                  <span className="text-xs bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 px-2 py-0.5 rounded-full">
                                    EN RETARD
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500">{checkout.equipment.serialNumber}</p>
                              <p className={`text-sm ${isOverdue && !isLost ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-500 dark:text-gray-400'}`}>
                                {isOverdue && !isLost && <AlertTriangle size={14} className="inline mr-1" />}
                                Retour prévu: {new Date(checkout.dueDate).toLocaleDateString('fr-FR')}
                              </p>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {returnItem ? (
                                <>
                                  <select
                                    value={returnItem.action}
                                    onChange={(e) => updateReturnAction(checkout.id, e.target.value as any)}
                                    className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm"
                                  >
                                    {isLost ? (
                                      <>
                                        <option value="recover">Matériel retrouvé</option>
                                        <option value="lost">Garder comme perdu</option>
                                      </>
                                    ) : (
                                      <>
                                        <option value="return">Retour complet</option>
                                        <option value="extend">Prolonger l'emprunt</option>
                                        <option value="lost">Matériel perdu</option>
                                      </>
                                    )}
                                  </select>
                                  
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => removeReturnItem(checkout.id)}
                                  >
                                    ✕
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  variant={isLost ? "warning" : "primary"}
                                  size="sm"
                                  onClick={() => setReturnItems(prev => [...prev, { 
                                    checkout, 
                                    action: isLost ? 'recover' : 'return' 
                                  }])}
                                >
                                  {isLost ? 'Récupérer' : 'Sélectionner'}
                                </Button>
                              )}
                            </div>
                          </div>

                          {returnItem?.action === 'extend' && (
                            <div className="mt-2">
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Nouvelle date de retour
                              </label>
                              <input
                                type="date"
                                value={returnItem.newDueDate || ''}
                                onChange={(e) => updateReturnAction(checkout.id, 'extend', e.target.value, returnItem.notes)}
                                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm"
                                min={new Date().toISOString().split('T')[0]}
                              />
                            </div>
                          )}

                          {returnItem && (
                            <div className="mt-2">
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Notes
                              </label>
                              <textarea
                                value={returnItem.notes || ''}
                                onChange={(e) => updateReturnAction(checkout.id, returnItem.action, returnItem.newDueDate, e.target.value)}
                                placeholder={
                                  returnItem.action === 'return' ? 'Notes sur le retour...' :
                                  returnItem.action === 'extend' ? 'Raison de la prolongation...' :
                                  returnItem.action === 'recover' ? 'Circonstances de la récupération...' :
                                  'Circonstances de la perte...'
                                }
                                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm"
                                rows={2}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <CheckCircle size={32} className="mx-auto text-green-500 mb-2" />
                    <p className="text-green-600 dark:text-green-400 font-medium">
                      Tous les équipements actifs ont été retournés
                    </p>
                  </div>
                )}

                {/* Équipements déjà retournés */}
                {selectedNote.checkouts.filter(c => c.status === 'returned').length > 0 && (
                  <div className="mt-6 space-y-3">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Équipements déjà retournés
                    </h4>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                      <div className="space-y-2">
                        {selectedNote.checkouts.filter(c => c.status === 'returned').map((checkout) => (
                          <div key={checkout.id} className="flex justify-between items-center p-2 border-b last:border-b-0 border-gray-200 dark:border-gray-700">
                            <div>
                              <p className="font-medium text-gray-700 dark:text-gray-300">{checkout.equipment.name}</p>
                              <p className="text-xs text-gray-500">{checkout.equipment.serialNumber}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                                Retourné le {checkout.returnDate ? new Date(checkout.returnDate).toLocaleDateString('fr-FR') : 'N/A'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between">
              <Button
                variant="outline"
                icon={<ArrowLeft size={16} />}
                onClick={() => setSelectedNote(null)}
              >
                Retour à la liste
              </Button>
              
              {returnItems.length > 0 && (
                <Button
                  variant="primary"
                  icon={<Printer size={18} />}
                  onClick={handleReturn}
                  disabled={isLoading}
                >
                  {isLoading ? 'Traitement en cours...' : 'Valider et Imprimer Quittance'}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default ReturnModal;