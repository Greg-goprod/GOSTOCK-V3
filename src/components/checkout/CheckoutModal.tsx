import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import QRCodeScanner from '../QRCode/QRCodeScanner';
import { User, Equipment, Category, Supplier } from '../../types';
import { supabase } from '../../lib/supabase';
import { Search, Package, Calendar, Printer, User as UserIcon, Plus, Minus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import UserModal from '../users/UserModal';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CheckoutItem {
  equipment: Equipment;
  quantity: number;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState<'user' | 'equipment' | 'summary'>('user');
  const [users, setUsers] = useState<User[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [checkoutItems, setCheckoutItems] = useState<CheckoutItem[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // État pour stocker le terme de recherche
  const [searchTerm, setSearchTerm] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [isManualSearchActive, setIsManualSearchActive] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchData();
      // Reset state when modal opens
      setStep('user');
      setSelectedUser(null);
      setCheckoutItems([]);
      setDueDate('');
      setNotes('');
      setSearchTerm('');
      setUserSearchTerm('');
      setIsManualSearchActive(false);
      
      // Set default due date to today (same day as scan)
      const today = new Date();
      setDueDate(today.toISOString().split('T')[0]);
    }
  }, [isOpen]);

  // Effet pour rafraîchir les équipements lorsqu'on passe à l'étape 'equipment'
  useEffect(() => {
    if (step === 'equipment') {
      // Rafraîchir la liste des équipements disponibles
      refreshEquipmentList();
      
      // Rechercher spécifiquement des équipements problématiques
      const specificItems = ["niveau bulle 100", "talkie walkie", "masse"];
      specificItems.forEach(item => searchSpecificEquipment(item));
    }
  }, [step]);

  // Effet pour effectuer une recherche en temps réel lorsque le terme de recherche change
  useEffect(() => {
    const debounceTimeout = setTimeout(() => {
      if (searchTerm.trim() === '' && step === 'equipment') {
        refreshEquipmentList();
      } else if (searchTerm.trim().length > 2 && step === 'equipment') {
        searchEquipmentFromServer(searchTerm);
      }
    }, 300);
    return () => clearTimeout(debounceTimeout);
  }, [searchTerm, step]);

  // Fonction pour rafraîchir la liste des équipements
  const refreshEquipmentList = async () => {
    try {
      setIsLoading(true);
      console.log('Rafraîchissement de la liste des équipements...');
      
      // Vérifier que supabase est initialisé
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }
      
      const equipmentResult = await supabase
        .from('equipment')
        .select(`
          *,
          categories(id, name, color),
          suppliers(id, name),
          equipment_groups(id, name, color)
        `)
        .order('name');

      if (equipmentResult.error) {
        console.error('Erreur lors de la récupération des équipements:', equipmentResult.error);
        throw equipmentResult.error;
      }

      // Transform equipment data from snake_case to camelCase
      const transformedEquipment: Equipment[] = (equipmentResult.data || []).map(eq => ({
        id: eq.id,
        name: eq.name,
        description: eq.description || '',
        category: eq.categories?.name || '',
        serialNumber: eq.serial_number,
        status: eq.status as Equipment['status'],
        addedDate: eq.added_date || eq.created_at,
        lastMaintenance: eq.last_maintenance,
        imageUrl: eq.image_url,
        supplier: eq.suppliers?.name || '',
        location: eq.location || '',
        articleNumber: eq.article_number,
        qrType: eq.qr_type || 'individual',
        totalQuantity: eq.total_quantity,
        availableQuantity: eq.available_quantity,
        shortTitle: eq.short_title,
        group: eq.equipment_groups?.name || ''
      }));

      console.log(`${transformedEquipment.length} équipements disponibles chargés`);
      setEquipment(transformedEquipment);
    } catch (error) {
      console.error('Erreur lors du rafraîchissement des équipements:', error);
      toast.error('Erreur lors du chargement des équipements');
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour rechercher des équipements côté serveur
  const searchEquipmentFromServer = async (query: string) => {
    if (!query.trim() || query.length < 3) return;
    
    try {
      setIsSearching(true);
      console.log(`Recherche serveur pour: "${query}"`);
      
      // Vérifier que supabase est initialisé
      if (!supabase) {
        throw new Error('Supabase client not initialized');
        return;
      }
      
      const normalizedQuery = query.toLowerCase().trim();
      
      // Recherche plus permissive avec .ilike.%query% sur tous les champs pertinents
      const { data: equipmentData, error } = await supabase
        .from('equipment')
        .select(`
          *,
          categories(id, name, color),
          suppliers(id, name),
          equipment_groups(id, name, color)
        `)
        .or(`name.ilike.%${normalizedQuery}%,description.ilike.%${normalizedQuery}%,serial_number.ilike.%${normalizedQuery}%,article_number.ilike.%${normalizedQuery}%`)
        .neq('status', 'retired')
        .order('name')
        .limit(50); // Augmenter la limite pour trouver plus de résultats

      if (error) throw error;
      
      // Log détaillé pour le débogage
      console.log(`Résultats de recherche pour "${query}" :`, equipmentData);
      
      if (equipmentData && equipmentData.length > 0) {
        console.log(`Trouvé ${equipmentData.length} équipements correspondant à "${query}":`, 
          equipmentData.map(eq => `${eq.name} (${eq.serial_number || eq.article_number || 'sans réf.'})`));
        
        // Transformer les données et mettre à jour l'état
        const transformedEquipment: Equipment[] = equipmentData.map(eq => ({
          id: eq.id,
          name: eq.name,
          description: eq.description || '',
          category: eq.categories?.name || '',
          serialNumber: eq.serial_number,
          status: eq.status as Equipment['status'],
          addedDate: eq.added_date || eq.created_at,
          lastMaintenance: eq.last_maintenance,
          imageUrl: eq.image_url,
          supplier: eq.suppliers?.name || '',
          location: eq.location || '',
          articleNumber: eq.article_number,
          qrType: eq.qr_type || 'individual',
          totalQuantity: eq.total_quantity,
          availableQuantity: eq.available_quantity,
          shortTitle: eq.short_title,
          group: eq.equipment_groups?.name || ''
        }));
        
        // Remplacer complètement la liste des équipements pour garantir que les nouveaux résultats sont visibles
        setEquipment(transformedEquipment);
      } else {
        console.log(`Aucun équipement trouvé pour "${query}"`);
      }
    } catch (error) {
      console.error('Erreur lors de la recherche d\'équipements:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Fonction pour rechercher spécifiquement certains équipements problématiques
  const searchSpecificEquipment = async (query: string) => {
    if (!supabase) return;
    
    try {
      console.log(`Recherche spécifique pour: "${query}"`);
      
      // Recherche directe par nom pour les équipements problématiques
      const { data: nameData, error: nameError } = await supabase
        .from('equipment')
        .select(`
          *,
          categories(id, name, color),
          suppliers(id, name),
          equipment_groups(id, name, color)
        `)
        .ilike('name', `%${query}%`)
        .neq('status', 'retired')
        .order('name');
        
      if (nameError) {
        console.error("Erreur lors de la recherche spécifique par nom:", nameError);
        return;
      }
      
      // Recherche directe dans la description pour les équipements problématiques
      const { data: descData, error: descError } = await supabase
        .from('equipment')
        .select(`
          *,
          categories(id, name, color),
          suppliers(id, name),
          equipment_groups(id, name, color)
        `)
        .ilike('description', `%${query}%`)
        .neq('status', 'retired')
        .order('name');
        
      if (descError) {
        console.error("Erreur lors de la recherche spécifique par description:", descError);
        return;
      }
      
      // Combiner les résultats sans doublons
      const allData = [...(nameData || [])];
      if (descData) {
        for (const item of descData) {
          if (!allData.some(d => d.id === item.id)) {
            allData.push(item);
          }
        }
      }
      
      if (allData.length > 0) {
        console.log(`Trouvé ${allData.length} équipements spécifiques pour "${query}":`, 
          allData.map(eq => `${eq.name} (${eq.serial_number || eq.article_number || 'sans réf.'})`));
          
        // Transformer les données
        const transformedEquipment: Equipment[] = allData.map(eq => ({
          id: eq.id,
          name: eq.name,
          description: eq.description || '',
          category: eq.categories?.name || '',
          serialNumber: eq.serial_number,
          status: eq.status as Equipment['status'],
          addedDate: eq.added_date || eq.created_at,
          lastMaintenance: eq.last_maintenance,
          imageUrl: eq.image_url,
          supplier: eq.suppliers?.name || '',
          location: eq.location || '',
          articleNumber: eq.article_number,
          qrType: eq.qr_type || 'individual',
          totalQuantity: eq.total_quantity,
          availableQuantity: eq.available_quantity,
          shortTitle: eq.short_title,
          group: eq.equipment_groups?.name || ''
        }));
        
        // Ajouter à la liste des équipements sans doublons
        setEquipment(prev => {
          const existingIds = new Set(prev.map(e => e.id));
          const newEquipment = transformedEquipment.filter(e => !existingIds.has(e.id));
          return [...prev, ...newEquipment];
        });
      }
    } catch (error) {
      console.error("Erreur lors de la recherche spécifique:", error);
    }
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [usersResult, equipmentResult] = await Promise.all([
        // Récupérer tous les utilisateurs sans filtre
        supabase
          .from('users')
          .select('*')
          .order('last_name'),
        supabase
          .from('equipment')
          .select(`
            *,
            categories(id, name, color),
            suppliers(id, name),
            equipment_groups(id, name, color)
          `)
          .order('name')
      ]);

      if (usersResult.error) {
        console.error('Erreur lors de la récupération des utilisateurs:', usersResult.error);
        throw usersResult.error;
      }
      if (equipmentResult.error) {
        console.error('Erreur lors de la récupération des équipements:', equipmentResult.error);
        throw equipmentResult.error;
      }

      console.log('Utilisateurs récupérés:', usersResult.data?.length);
      if (usersResult.data) {
        // Vérifier si Benoit Kaelin est présent dans les résultats
        const benoitKaelin = usersResult.data.find(u => 
          u.first_name?.toLowerCase() === 'benoit' && 
          u.last_name?.toLowerCase() === 'kaelin'
        );
        console.log('Benoit Kaelin trouvé:', benoitKaelin ? 'Oui' : 'Non');
      }

      setUsers(usersResult.data || []);
      
      // Transform equipment data from snake_case to camelCase
      const transformedEquipment: Equipment[] = (equipmentResult.data || []).map(eq => ({
        id: eq.id,
        name: eq.name,
        description: eq.description || '',
        category: eq.categories?.name || '',
        serialNumber: eq.serial_number,
        status: eq.status as Equipment['status'],
        addedDate: eq.added_date || eq.created_at,
        lastMaintenance: eq.last_maintenance,
        imageUrl: eq.image_url,
        supplier: eq.suppliers?.name || '',
        location: eq.location || '',
        articleNumber: eq.article_number,
        qrType: eq.qr_type || 'individual',
        totalQuantity: eq.total_quantity,
        availableQuantity: eq.available_quantity,
        shortTitle: eq.short_title,
        group: eq.equipment_groups?.name || ''
      }));
      
      setEquipment(transformedEquipment);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUser = () => {
    setShowUserModal(true);
  };

  const handleUserModalClose = () => {
    setShowUserModal(false);
    fetchData(); // Refresh users list
  };

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    setStep('equipment');
    // Le scanner sera automatiquement actif grâce à l'autoFocus dans QRCodeScanner
  };

  const handleEquipmentScan = async (scannedId: string) => {
    try {
      if (!scannedId) {
        console.error("ID scanné invalide ou vide");
        return;
      }
      
      setIsLoading(true);
      const normalizedId = scannedId.trim().toLowerCase();
      
      // D'abord chercher dans les équipements déjà chargés
      let foundEquipment = equipment.find(eq => {
        if (!eq || !eq.serialNumber) return false;
        
        const serialMatches = eq.serialNumber.toLowerCase() === normalizedId;
        const articleMatches = eq.articleNumber && eq.articleNumber.toLowerCase() === normalizedId;
        const articleIncludes = eq.articleNumber && normalizedId.includes(eq.articleNumber.toLowerCase());
        
        return serialMatches || articleMatches || articleIncludes;
      });
      
      // Si trouvé dans les équipements déjà chargés
      if (foundEquipment) {
        // Vérifier la disponibilité avec la nouvelle fonction SQL
        const { data: availabilityCheck, error: availabilityError } = await supabase
          .rpc('check_equipment_availability', {
            equipment_id: foundEquipment.id,
            requested_quantity: 1
          });

        if (availabilityError) throw availabilityError;

        const availability = availabilityCheck?.[0];
        if (!availability?.is_available) {
          toast.error(`Équipement non disponible: ${availability?.message || 'Raison inconnue'}`);
          return;
        }

        addEquipmentToCheckout(foundEquipment);
        // setScannedCode(''); // This line was removed from the new_code, so it's removed here.
        return;
      }
      
      // Si non trouvé, chercher dans la base de données avec vérification de disponibilité
      console.log("Équipement non trouvé en mémoire, recherche en base de données...");
      
      const { data: equipmentData, error: equipmentError } = await supabase
        .from('equipment')
        .select(`
          *,
          categories(id, name),
          suppliers(id, name),
          equipment_groups(id, name)
        `)
        .or(`serial_number.eq.${normalizedId},article_number.eq.${normalizedId},article_number.ilike.%${normalizedId}%,name.ilike.%${normalizedId}%`)
        .neq('status', 'maintenance') // Exclure les équipements en maintenance
        .neq('status', 'retired')     // Exclure les équipements retirés
        .order('name')
        .limit(10);
      
      if (equipmentError) throw equipmentError;
      
      if (equipmentData && equipmentData.length > 0) {
        const eq = equipmentData[0];
        
        // Double vérification avec la fonction SQL
        const { data: availabilityCheck, error: availabilityError } = await supabase
          .rpc('check_equipment_availability', {
            equipment_id: eq.id,
            requested_quantity: 1
          });

        if (availabilityError) throw availabilityError;

        const availability = availabilityCheck?.[0];
        if (!availability?.is_available) {
          toast.error(`Équipement non disponible: ${availability?.message || 'Raison inconnue'}`);
          return;
        }

        foundEquipment = {
          id: eq.id,
          name: eq.name,
          description: eq.description || '',
          category: eq.categories?.name || '',
          serialNumber: eq.serial_number,
          status: eq.status as Equipment['status'],
          addedDate: eq.added_date || eq.created_at,
          lastMaintenance: eq.last_maintenance,
          imageUrl: eq.image_url,
          supplier: eq.suppliers?.name || '',
          location: eq.location || '',
          articleNumber: eq.article_number,
          qrType: eq.qr_type || 'individual',
          totalQuantity: eq.total_quantity,
          availableQuantity: eq.available_quantity,
          shortTitle: eq.short_title,
          group: eq.equipment_groups?.name || ''
        };
        
        addEquipmentToCheckout(foundEquipment);
        // setScannedCode(''); // This line was removed from the new_code, so it's removed here.
        return;
      }
      
      toast.error('Équipement non trouvé ou non disponible');
      // setScannedCode(''); // This line was removed from the new_code, so it's removed here.
    } catch (error: any) {
      console.error('Error scanning equipment:', error);
      toast.error(error.message || 'Erreur lors de la recherche');
      // setScannedCode(''); // This line was removed from the new_code, so it's removed here.
    } finally {
      setIsLoading(false);
    }
  };

  const addEquipmentToCheckout = (eq: Equipment) => {
    const existingItem = checkoutItems.find(item => item.equipment.id === eq.id);
    const availableQty = eq.availableQuantity || 1; // Valeur par défaut si undefined
    
    if (existingItem) {
      const currentQty = existingItem.quantity || 0;
      if (currentQty < availableQty) {
        setCheckoutItems(prev =>
          prev.map(item =>
            item.equipment.id === eq.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          )
        );
        toast.success(`Quantité augmentée: ${eq.name}`);
      } else {
        toast.error(`Quantité maximale atteinte pour ${eq.name}`);
      }
    } else {
      setCheckoutItems(prev => [...prev, { equipment: eq, quantity: 1 }]);
      toast.success(`Ajouté: ${eq.name}`);
    }
  };

  const removeEquipmentFromCheckout = (equipmentId: string) => {
    setCheckoutItems(prev => prev.filter(item => item.equipment.id !== equipmentId));
  };

  const updateQuantity = (equipmentId: string, newQuantity: number) => {
    const item = checkoutItems.find(item => item.equipment.id === equipmentId);
    if (!item) return;

    if (newQuantity <= 0) {
      removeEquipmentFromCheckout(equipmentId);
      return;
    }

    const availableQty = item.equipment.availableQuantity || 1; // Valeur par défaut si undefined
    if (newQuantity > availableQty) {
      toast.error(`Quantité maximale disponible: ${availableQty}`);
      return;
    }

    setCheckoutItems(prev =>
      prev.map(item =>
        item.equipment.id === equipmentId
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  };

  const handleCheckout = async () => {
    if (!selectedUser || checkoutItems.length === 0) {
      toast.error('Veuillez sélectionner un utilisateur et au moins un équipement');
      return;
    }

    if (!dueDate) {
      toast.error('Veuillez sélectionner une date de retour');
      return;
    }

    try {
      setIsLoading(true);

      // Create delivery note
      const { data: deliveryNote, error: deliveryNoteError } = await supabase
        .from('delivery_notes')
        .insert([{
          user_id: selectedUser.id,
          due_date: dueDate,
          notes: notes || null
        }])
        .select()
        .single();

      if (deliveryNoteError) throw deliveryNoteError;

      // Create checkouts for each item
      const checkoutPromises = checkoutItems.map(async (item) => {
        const checkouts = [];
        
        for (let i = 0; i < item.quantity; i++) {
          checkouts.push({
            equipment_id: item.equipment.id,
            user_id: selectedUser.id,
            delivery_note_id: deliveryNote.id,
            due_date: dueDate,
            status: 'active',
            notes: notes || null
          });
        }

        // Insert checkouts
        const { error: checkoutError } = await supabase
          .from('checkouts')
          .insert(checkouts);

        if (checkoutError) throw checkoutError;

        // Update equipment availability
        const newAvailableQuantity = item.equipment.availableQuantity - item.quantity;
        const newStatus = newAvailableQuantity === 0 ? 'checked-out' : 'available';

        const { error: equipmentError } = await supabase
          .from('equipment')
          .update({
            available_quantity: newAvailableQuantity,
            status: newStatus
          })
          .eq('id', item.equipment.id);

        if (equipmentError) throw equipmentError;
      });

      await Promise.all(checkoutPromises);

      // Add notification to localStorage
      const notification = {
        id: `checkout-${Date.now()}`,
        type: 'checkout',
        title: 'Nouvelle sortie de matériel',
        message: `Bon N° ${deliveryNote.note_number} créé pour ${selectedUser.first_name} ${selectedUser.last_name} (${checkoutItems.length} équipement${checkoutItems.length > 1 ? 's' : ''})`,
        date: new Date().toISOString(),
        priority: 'medium',
        read: false,
        relatedData: {
          note_number: deliveryNote.note_number,
          userName: `${selectedUser.first_name} ${selectedUser.last_name}`,
          user_department: selectedUser.department,
          equipment_count: checkoutItems.reduce((sum, item) => sum + item.quantity, 0)
        }
      };

      const existingNotifications = JSON.parse(localStorage.getItem('checkout_notifications') || '[]');
      localStorage.setItem('checkout_notifications', JSON.stringify([notification, ...existingNotifications]));

      toast.success(`Sortie créée avec succès! Bon N° ${deliveryNote.note_number}`);
      
      // Generate and open PDF
      await generateDeliveryNotePDF(deliveryNote, selectedUser, checkoutItems);
      
      // Close modal
      onClose();
    } catch (error: any) {
      console.error('Error creating checkout:', error);
      toast.error(error.message || 'Erreur lors de la création de la sortie');
    } finally {
      setIsLoading(false);
    }
  };

  const generateDeliveryNotePDF = async (deliveryNote: any, user: User, items: CheckoutItem[]) => {
    try {
      // Récupérer le logo depuis les paramètres système
      const { data: logoSetting } = await supabase
        .from('system_settings')
        .select('value')
        .eq('id', 'company_logo')
        .maybeSingle();

      const logoUrl = logoSetting?.value || '';
      const today = new Date();
      const formattedDate = today.toLocaleDateString('fr-FR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });

      // Générer le QR code pour le bon de sortie
      const noteQrCode = deliveryNote.qr_code || `DN-${deliveryNote.note_number}`;

      const printContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Bon de Sortie ${deliveryNote.note_number}</title>
            <meta charset="UTF-8">
            <style>
              @page { size: A4; margin: 18mm 12mm 14mm 12mm; }
              body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; color: #222; font-size: 11pt; background: #fafbfc; }
              .header-flex { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
              .logo { max-width: 180px; max-height: 60px; margin: 0; display: block; }
              .info-block { text-align: right; font-size: 0.92rem; color: #444; line-height: 1.4; min-width: 180px; }
              .info-block .info-line { margin-bottom: 2px; }
              .document-title { font-size: 1.25rem; font-weight: bold; margin: 18px 0 10px 0; color: #222; text-align: center; text-transform: uppercase; letter-spacing: 1px; }
              table { width: 100%; border-collapse: collapse; margin: 18px 0 10px 0; background: #fff; }
              th { background-color: #2563eb; color: white; font-weight: 600; text-align: left; padding: 9px; font-size: 1rem; letter-spacing: 0.5px; }
              td { border: 1px solid #e5e7eb; padding: 9px; font-size: 0.98rem; }
              tr:nth-child(even) { background-color: #f3f4f6; }
              .total-row { font-weight: bold; background: #f1f5f9; }
              .important-notice { margin-top: 18px; padding: 12px 14px; background: #fffbe6; border-left: 4px solid #facc15; color: #b45309; font-size: 1rem; border-radius: 6px; display: flex; align-items: center; gap: 8px; }
              .important-notice .icon { font-size: 1.2rem; margin-right: 6px; }
              .notes { margin-top: 16px; border: 1px solid #ddd; padding: 10px; background-color: #f9f9f9; border-radius: 5px; }
              .signatures { display: flex; justify-content: space-between; margin-top: 38px; gap: 20px; }
              .signature-box { width: 48%; }
              .signature-label { font-weight: 600; margin-bottom: 18px; color: #222; }
              .signature-line { border-bottom: 1.5px solid #333; margin-top: 44px; margin-bottom: 7px; height: 0; }
              .footer { margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 10px; font-size: 0.95rem; color: #888; text-align: center; letter-spacing: 0.5px; }
            </style>
            <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js"></script>
          </head>
          <body>
            <div class="header-flex">
              <div>${logoUrl ? `<img src="${logoUrl}" alt="Logo" class="logo" />` : ''}</div>
              <div class="info-block">
                <div class="info-line">Bon N° ${deliveryNote.note_number}</div>
                <div class="info-line">Émis le ${formattedDate}</div>
                <div class="info-line">${user.first_name} ${user.last_name}</div>
                <div class="info-line">${user.department}</div>
                <div class="info-line">${user.email}${user.phone ? ' • ' + user.phone : ''}</div>
              </div>
            </div>
            <div class="document-title">Bon de Sortie de Matériel</div>
            <table>
              <thead>
                <tr>
                  <th style="width: 5%;">N°</th>
                  <th style="width: 45%;">Désignation</th>
                  <th style="width: 20%;">Référence</th>
                  <th style="width: 10%; text-align:right;">Quantité</th>
                  <th style="width: 20%;">Retour prévu</th>
                </tr>
              </thead>
              <tbody>
                ${items.map((item, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${item.equipment.name}</td>
                    <td>${item.equipment.serialNumber}</td>
                    <td style="text-align:right;">${item.quantity}</td>
                    <td>${new Date(deliveryNote.due_date || '').toLocaleDateString('fr-FR')}</td>
                  </tr>
                `).join('')}
                <tr class="total-row">
                  <td colspan="3" style="text-align: right;">Total articles:</td>
                  <td style="text-align:right;">${items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
            ${notes ? `
              <div class="notes">
                <strong>Notes:</strong>
                <p>${notes}</p>
              </div>
            ` : ''}
            <div class="important-notice"><span class="icon">⚠️</span>
              <span>Ce bon de sortie doit être conservé et présenté lors du retour du matériel.<br />En cas de perte ou de dommage du matériel, veuillez contacter immédiatement le service de gestion.</span>
            </div>
            <div class="signatures">
              <div class="signature-box">
                <div class="signature-label">Signature de l'emprunteur:</div>
                <div class="signature-line"></div>
                <div>Date: ___________________</div>
              </div>
              <div class="signature-box">
                <div class="signature-label">Signature du responsable:</div>
                <div class="signature-line"></div>
                <div>Date: ___________________</div>
              </div>
            </div>
            <div class="footer">
              Bon généré par GO-Mat - ${new Date().toLocaleString('fr-FR')}
            </div>
          </body>
        </html>
      `;

      // Créer un Blob avec le contenu HTML
      const blob = new Blob([printContent], { type: 'text/html' });
      const blobUrl = URL.createObjectURL(blob);

      // Ouvrir dans un nouvel onglet et injecter le HTML + print auto
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.onload = function () {
          setTimeout(() => {
            printWindow.focus();
            printWindow.print();
          }, 300);
        };
      } else {
        // Fallback si window.open échoue
        window.open(blobUrl, '_blank');
      }

      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 1000);
      
      toast.success('Bon de sortie ouvert dans un nouvel onglet');
      
    } catch (error) {
      console.error('Error generating delivery note PDF:', error);
      toast.error('Erreur lors de la génération du PDF');
    }
  };

  const filteredUsers = users.filter(user => {
    // Vérifier que l'utilisateur existe
    if (!user) {
      return false;
    }
    
    // Si le terme de recherche est vide, afficher tous les utilisateurs
    if (!userSearchTerm.trim()) {
      return true;
    }
    
    // Vérifier de manière sécurisée les propriétés avant d'appeler toLowerCase()
    const firstName = user.first_name ? user.first_name.toLowerCase() : '';
    const lastName = user.last_name ? user.last_name.toLowerCase() : '';
    const fullName = `${firstName} ${lastName}`;
    const email = user.email ? user.email.toLowerCase() : '';
    const department = user.department ? user.department.toLowerCase() : '';
    const search = userSearchTerm.toLowerCase();
    
    return fullName.includes(search) || email.includes(search) || department.includes(search);
  });

  // Débogage pour vérifier si Benoit Kaelin est dans la liste filtrée
  useEffect(() => {
    if (users.length > 0) {
      console.log('Nombre total d\'utilisateurs:', users.length);
      console.log('Nombre d\'utilisateurs filtrés:', filteredUsers.length);
      
      // Rechercher Benoit Kaelin dans la liste complète
      const benoitInUsers = users.find(u => 
        u.first_name?.toLowerCase()?.includes('benoit') && 
        u.last_name?.toLowerCase()?.includes('kaelin')
      );
      console.log('Benoit Kaelin dans users:', benoitInUsers ? 'Oui' : 'Non');
      
      // Rechercher Benoit Kaelin dans la liste filtrée
      const benoitInFiltered = filteredUsers.find(u => 
        u.first_name?.toLowerCase()?.includes('benoit') && 
        u.last_name?.toLowerCase()?.includes('kaelin')
      );
      console.log('Benoit Kaelin dans filteredUsers:', benoitInFiltered ? 'Oui' : 'Non');
    }
  }, [users, filteredUsers, userSearchTerm]);

  const filteredEquipment = equipment.filter(eq => {
    // Vérifier que les propriétés existent avant d'appeler toLowerCase()
    if (!eq || !eq.name || !eq.serialNumber || !eq.category) {
      return false;
    }
    
    const name = eq.name.toLowerCase();
    const serialNumber = eq.serialNumber.toLowerCase();
    const articleNumber = eq.articleNumber ? eq.articleNumber.toLowerCase() : '';
    const category = eq.category.toLowerCase();
    const group = eq.group ? eq.group.toLowerCase() : '';
    const description = eq.description ? eq.description.toLowerCase() : '';
    const search = searchTerm.toLowerCase();
    
    return name.includes(search) || 
           serialNumber.includes(search) || 
           articleNumber.includes(search) || 
           category.includes(search) ||
           group.includes(search) ||
           description.includes(search);
  });

  const totalItems = checkoutItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="SORTIE DE MATÉRIEL"
      size="xl"
    >
      <div className="space-y-6">
        {/* Progress Steps */}
        <div className="flex items-center justify-center space-x-4">
          <div className={`flex items-center ${step === 'user' ? 'text-primary-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'user' ? 'bg-primary-600 text-white' : 'bg-gray-200'}`}>1</div>
            <span className="ml-2 font-bold">Utilisateur</span>
          </div>
          <div className="w-8 h-px bg-gray-300"></div>
          <div className={`flex items-center ${step === 'equipment' ? 'text-primary-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'equipment' ? 'bg-primary-600 text-white' : 'bg-gray-200'}`}>2</div>
            <span className="ml-2 font-bold">Matériel</span>
          </div>
          <div className="w-8 h-px bg-gray-300"></div>
          <div className={`flex items-center ${step === 'summary' ? 'text-primary-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'summary' ? 'bg-primary-600 text-white' : 'bg-gray-200'}`}>3</div>
            <span className="ml-2 font-bold">Résumé</span>
          </div>
        </div>

        {/* Step 1: User Selection */}
      {/* Modal pour ajouter un utilisateur */}
      <UserModal
        isOpen={showUserModal}
        onClose={handleUserModalClose}
      />

        {step === 'user' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium text-gray-900 dark:text-white">Sélectionner un utilisateur</h3>
              <Button
                variant="success"
                size="sm"
                icon={<Plus size={14} />}
                onClick={handleAddUser}
              >
                AJOUTER CONTACT
              </Button>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Rechercher un utilisateur..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto border rounded-lg">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b last:border-b-0"
                  onClick={() => handleUserSelect(user)}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-300 flex items-center justify-center">
                      <span className="font-bold text-sm">
                        {user.first_name[0]}{user.last_name[0]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* This part of the code was not provided in the new_code, so it's kept as is. */}
                      {/* The original code had a complex image loading fallback, which is removed here. */}
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                          {user.first_name} {user.last_name}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {user.department} • {user.email}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Equipment Selection */}
        {step === 'equipment' && (
          <div className="space-y-4">
            {/* Selected User Info */}
            {selectedUser && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <UserIcon size={20} className="text-blue-600 dark:text-blue-400" />
                  <div>
                    <h3 className="font-bold text-blue-800 dark:text-blue-200">
                      {selectedUser.first_name} {selectedUser.last_name}
                    </h3>
                    <p className="text-blue-700 dark:text-blue-300 text-sm">
                      {selectedUser.department} • {selectedUser.email}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Scanner and Equipment Selection */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Scanner Section */}
              <div className="space-y-4">
                <h3 className="font-bold text-gray-900 dark:text-white">Scanner QR Code</h3>
                <QRCodeScanner 
                  onScan={handleEquipmentScan}
                  disableAutoFocus={isManualSearchActive} 
                />
              </div>

              {/* Manual Selection */}
              <div className="space-y-4">
                <h3 className="font-bold text-gray-900 dark:text-white">Sélection manuelle</h3>
                <div className="relative flex">
                  <input
                    type="text"
                    placeholder="Rechercher du matériel..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={() => setIsManualSearchActive(true)}
                    onBlur={() => setIsManualSearchActive(false)}
                    className="w-64 max-w-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                  />
                  <Button 
                    variant="primary" 
                    className="ml-2" 
                    onClick={() => searchEquipmentFromServer(searchTerm)}
                    loading={isSearching}
                  >
                    <Search size={16} />
                  </Button>
                  {isSearching && (
                    <div className="absolute right-12 top-2">
                      <div className="animate-spin h-4 w-4 border-2 border-primary-600 border-t-transparent rounded-full"></div>
                    </div>
                  )}
                </div>
                
                <div className="max-h-64 overflow-y-auto border rounded-lg">
                  {filteredEquipment.length > 0 ? (
                    filteredEquipment.map((eq) => (
                      <div
                        key={eq.id}
                        className={`flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b last:border-b-0 ${eq.availableQuantity > 0 ? 'bg-green-100 cursor-pointer' : 'bg-red-100 cursor-not-allowed opacity-60'}`}
                        onClick={eq.availableQuantity > 0 ? () => addEquipmentToCheckout(eq) : undefined}
                        title={eq.availableQuantity === 0 ? 'Aucune pièce disponible' : ''}
                      >
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                            {eq.name}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {eq.serialNumber} • <span className="font-bold text-black dark:text-white">Dispo : {eq.availableQuantity ?? 0}/{eq.totalQuantity ?? 0}</span>
                          </p>
                        </div>
                        <Plus size={16} className={eq.availableQuantity > 0 ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'} />
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                      {searchTerm ? (isSearching ? "Recherche en cours..." : "Aucun équipement trouvé") : "Commencez à taper pour rechercher du matériel"}
                    </div>
                  )}
                  {filteredEquipment.length > 0 && (
                    <div className="p-2 text-center text-xs text-gray-500 dark:text-gray-400">
                      {filteredEquipment.length} équipement(s) trouvé(s)
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Selected Items */}
            {checkoutItems.length > 0 && (
              <div className="border rounded-lg p-4">
                <h3 className="font-bold text-gray-900 dark:text-white mb-3">
                  Matériel sélectionné ({totalItems} article{totalItems > 1 ? 's' : ''})
                </h3>
                <div className="space-y-2">
                  {checkoutItems.map((item) => (
                    <div key={item.equipment.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {item.equipment.name}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {item.equipment.serialNumber}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          icon={<Minus size={14} />}
                          onClick={() => updateQuantity(item.equipment.id, item.quantity - 1)}
                        />
                        <span className="w-8 text-center font-bold">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          icon={<Plus size={14} />}
                          onClick={() => updateQuantity(item.equipment.id, item.quantity + 1)}
                          disabled={item.quantity >= item.equipment.availableQuantity}
                        />
                        <Button
                          variant="danger"
                          size="sm"
                          icon={<X size={14} />}
                          onClick={() => removeEquipmentFromCheckout(item.equipment.id)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setStep('user')}
              >
                Retour
              </Button>
              <Button
                variant="primary"
                onClick={() => setStep('summary')}
                disabled={checkoutItems.length === 0}
              >
                Continuer ({totalItems})
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Summary */}
        {step === 'summary' && (
          <div className="space-y-6">
            {/* User Summary */}
            {selectedUser && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h3 className="font-bold text-blue-800 dark:text-blue-200 mb-2">Emprunteur</h3>
                <p className="text-blue-700 dark:text-blue-300">
                  {selectedUser.first_name} {selectedUser.last_name} • {selectedUser.department}
                </p>
              </div>
            )}

            {/* Equipment Summary */}
            <div className="border rounded-lg p-4">
              <h3 className="font-bold text-gray-900 dark:text-white mb-3">
                Matériel à emprunter ({totalItems} article{totalItems > 1 ? 's' : ''})
              </h3>
              <div className="space-y-2">
                {checkoutItems.map((item) => (
                  <div key={item.equipment.id} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <span className="font-medium">{item.equipment.name}</span>
                    <span className="text-sm text-gray-500">Qté: {item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Due Date and Notes */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date de retour prévue *
                </label>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-2">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                    📅 Par défaut : retour le jour même ({new Date().toLocaleDateString('fr-FR')})
                  </p>
                </div>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes (optionnel)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                  placeholder="Notes concernant cet emprunt..."
                />
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setStep('equipment')}
              >
                Retour
              </Button>
              <Button
                variant="primary"
                icon={<Printer size={18} />}
                onClick={handleCheckout}
                disabled={isLoading || !dueDate}
              >
                {isLoading ? 'Création en cours...' : 'Créer et Ouvrir PDF'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default CheckoutModal;