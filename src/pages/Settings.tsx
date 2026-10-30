import React, { useState, useEffect } from 'react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Accordion from '../components/common/Accordion';
import CategoryModal from '../components/categories/CategoryModal';
import SupplierModal from '../components/suppliers/SupplierModal';
import GroupModal from '../components/groups/GroupModal';
import SubgroupModal from '../components/subgroups/SubgroupModal';
import DepartmentModal from '../components/departments/DepartmentModal';
import MaintenanceTypeModal from '../components/settings/MaintenanceTypeModal';
import ExcelImport from '../components/import/ExcelImport';
import CatalogImport from '../components/import/CatalogImport';
import NotificationRecipients from '../components/settings/NotificationRecipients';
import FoundToolSettings from '../components/settings/FoundToolSettings';
import BackupPanel from '../components/settings/BackupPanel';
import SmsSetting from '../components/settings/SmsSetting';
import { SystemResetModal } from '../components/admin/SystemResetModal';
import { useApp } from '../contexts/AppContext';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Settings as SettingsIcon, 
  Tag, 
  Building, 
  Layers,
  Wrench,
  Upload,
  BookOpen,
  Mail,
  Download,
  Globe,
  Moon,
  Sun,
  Truck,
  Building2,
  AlertTriangle as AlertTriangleIcon, PhoneCall, HardDriveDownload } from 'lucide-react';
import LanguagePicker from '../components/common/LanguagePicker';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

// Organisation unique tant que l'app n'a pas de connexion (voir default_organization_id())
const DEFAULT_ORGANIZATION_ID = '00000000-0000-0000-0000-000000000001';
import { 
  Category, 
  Supplier, 
  EquipmentGroup, 
  EquipmentSubgroup, 
  Department, 
  MaintenanceType,
  SystemSetting 
} from '../types';

const Settings: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { refreshData } = useApp();
  
  // Data states
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [groups, setGroups] = useState<EquipmentGroup[]>([]);
  const [subgroups, setSubgroups] = useState<EquipmentSubgroup[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [maintenanceTypes, setMaintenanceTypes] = useState<MaintenanceType[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSetting[]>([]);
  
  // Modal states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showSubgroupModal, setShowSubgroupModal] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [showMaintenanceTypeModal, setShowMaintenanceTypeModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSystemResetModal, setShowSystemResetModal] = useState(false);
  
  // Edit states
  const [editingCategory, setEditingCategory] = useState<Category | undefined>();
  const [editingSupplier, setEditingSupplier] = useState<Supplier | undefined>();
  const [editingGroup, setEditingGroup] = useState<EquipmentGroup | undefined>();
  const [editingSubgroup, setEditingSubgroup] = useState<EquipmentSubgroup | undefined>();
  const [editingDepartment, setEditingDepartment] = useState<Department | undefined>();
  const [editingMaintenanceType, setEditingMaintenanceType] = useState<MaintenanceType | undefined>();
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [articleSeries, setArticleSeries] = useState('');
  const [nextArticleNumber, setNextArticleNumber] = useState('');
  const [approvalMaxQuantity, setApprovalMaxQuantity] = useState('10');
  const [signatureMinValue, setSignatureMinValue] = useState('500');
  const [companyLogo, setCompanyLogo] = useState('');

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchCategories(),
        fetchSuppliers(),
        fetchGroups(),
        fetchSubgroups(),
        fetchDepartments(),
        fetchMaintenanceTypes(),
        fetchSystemSettings()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    
    if (error) throw error;
    setCategories(data || []);
  };

  const fetchSuppliers = async () => {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name');
    
    if (error) throw error;
    // Mêmes champs que dans AppContext : la fenêtre d'édition lit contactPerson, leadTimeDays…
    setSuppliers((data || []).map(item => ({
      id: item.id,
      name: item.name,
      contactPerson: item.contact_person,
      email: item.email,
      phone: item.phone,
      website: item.website,
      leadTimeDays: item.lead_time_days,
    })));
  };

  const fetchGroups = async () => {
    const { data, error } = await supabase
      .from('equipment_groups')
      .select('*')
      .order('name');
    
    if (error) throw error;
    setGroups(data || []);
  };

  const fetchSubgroups = async () => {
    const { data, error } = await supabase
      .from('equipment_subgroups')
      .select('*')
      .order('name');
    
    if (error) throw error;
    
    const transformedSubgroups: EquipmentSubgroup[] = data?.map(sg => ({
      id: sg.id,
      name: sg.name,
      description: sg.description,
      color: sg.color,
      groupId: sg.group_id,
      createdAt: sg.created_at
    })) || [];
    
    setSubgroups(transformedSubgroups);
  };

  const fetchDepartments = async () => {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .order('name');
    
    if (error) throw error;
    setDepartments(data || []);
  };



  const fetchMaintenanceTypes = async () => {
    const { data, error } = await supabase
      .from('maintenance_types')
      .select('*')
      .order('name');
    
    if (error) throw error;
    setMaintenanceTypes(data || []);
  };

  const fetchSystemSettings = async () => {
    const { data, error } = await supabase
      .from('system_settings')
      .select('*');
    
    if (error) throw error;
    setSystemSettings(data || []);
    
    // Set specific settings
    const { data: organization } = await supabase!
      .from('organizations')
      .select('article_series')
      .eq('id', DEFAULT_ORGANIZATION_ID)
      .maybeSingle();
    if (organization) setArticleSeries(organization.article_series);
    const { data: preview } = await supabase!.rpc('preview_article_number');
    setNextArticleNumber(preview || '');
    
    const signatureSetting = data?.find(s => s.id === 'signature_min_value');
    if (signatureSetting) setSignatureMinValue(signatureSetting.value);

    const approvalSetting = data?.find(s => s.id === 'approval_max_quantity');
    if (approvalSetting) {
      setApprovalMaxQuantity(approvalSetting.value);
    }

    const logoSetting = data?.find(s => s.id === 'company_logo');
    if (logoSetting) {
      setCompanyLogo(logoSetting.value);
    }
  };

  const saveArticleSeries = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.rpc('set_article_series', { p_series: articleSeries });
    if (error) {
      toast.error(error.message);
      return;
    }
    setNextArticleNumber(data || '');
    toast.success(`Série enregistrée : prochain numéro ${data}`);
  };

  const updateSystemSetting = async (id: string, value: string, description?: string) => {
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          id,
          value,
          description,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      
      await fetchSystemSettings();
      toast.success('Paramètre mis à jour avec succès');
    } catch (error: any) {
      console.error('Error updating system setting:', error);
      toast.error('Erreur lors de la mise à jour du paramètre');
    }
  };

  const handleDeleteItem = async (type: string, id: string) => {
    try {
      const { error } = await supabase
        .from(type)
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Élément supprimé avec succès');
      fetchAllData();
      // Rafraîchir aussi le contexte global si on supprime un statut
      if (type === 'status_configs') {
        refreshData();
      }
    } catch (error: any) {
      console.error('Error deleting item:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const exportData = async () => {
    try {
      // Export all configuration data
      const exportData = {
        categories,
        suppliers,
        groups,
        subgroups,
        departments,
        maintenanceTypes,
        systemSettings,
        exportDate: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `go-mat-config-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Configuration exportée avec succès');
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Erreur lors de l\'export');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Chargement des paramètres...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="mx-page-title">Paramètres</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 font-medium">
            Configuration du système et gestion des données de référence
          </p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            icon={<Upload size={18} />}
            onClick={() => setShowImportModal(true)}
            className="font-bold"
          >
            Importer Excel
          </Button>
          <Button
            variant="outline"
            icon={<Download size={18} />}
            onClick={exportData}
            className="font-bold"
          >
            Exporter configuration
          </Button>
        </div>
      </div>

      {/* Paramètres système */}
      <Accordion
        title="PARAMÈTRES SYSTÈME"
        icon={<SettingsIcon size={20} className="text-primary-600 dark:text-primary-400" />}
        defaultOpen={true}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Langue et thème */}
          <Card>
            <div className="p-4 space-y-4">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Globe size={18} />
                Interface
              </h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Langue
                </label>
                <LanguagePicker />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Thème
                </label>
                <Button
                  variant="outline"
                  onClick={toggleTheme}
                  icon={theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                  className="w-full justify-center"
                >
                  {theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
                </Button>
              </div>
            </div>
          </Card>

          {/* Paramètres de l'entreprise */}
          <Card>
            <div className="p-4 space-y-4">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Building2 size={18} />
                Entreprise
              </h3>
              
              <div>
                <label htmlFor="article-series" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Série de numérotation des articles
                </label>
                <div className="flex gap-2">
                  <input
                    id="article-series"
                    type="text"
                    value={articleSeries}
                    onChange={(e) => setArticleSeries(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                    maxLength={6}
                    autoCapitalize="characters"
                    spellCheck={false}
                    className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono tracking-widest uppercase"
                    placeholder="Ex: GCENT1"
                  />
                  <Button variant="primary" size="sm" onClick={saveArticleSeries} disabled={articleSeries.length !== 6}>
                    Sauver
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Exactement 6 lettres ou chiffres. Chaque nouvel article reçoit automatiquement le numéro suivant
                  {nextArticleNumber && <> : prochain numéro <span className="font-mono text-gray-800 dark:text-gray-200">{nextArticleNumber}</span></>}.
                  Les articles déjà créés gardent leur numéro.
                </p>
              </div>

              <div>
                <label htmlFor="approval-max-quantity" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Seuil de validation des demandes
                </label>
                <div className="flex gap-2">
                  <input
                    id="approval-max-quantity"
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={approvalMaxQuantity}
                    onChange={(e) => setApprovalMaxQuantity(e.target.value)}
                    className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      const value = Number(approvalMaxQuantity);
                      if (!Number.isInteger(value) || value < 1) {
                        toast.error('Le seuil doit être un nombre entier positif');
                        return;
                      }
                      updateSystemSetting('approval_max_quantity', String(value), 'Au-delà de cette quantité par article, une demande doit être validée par un responsable');
                    }}
                  >
                    Sauver
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Au-delà de cette quantité par article, une demande doit être validée par un responsable. Les véhicules et les articles marqués « validation requise » le sont toujours.
                </p>
              </div>

              <div>
                <label htmlFor="signature-min" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Signature à la remise à partir de (CHF)
                </label>
                <div className="flex gap-2">
                  <input
                    id="signature-min"
                    type="number"
                    min={0}
                    step={50}
                    inputMode="numeric"
                    value={signatureMinValue}
                    onChange={(e) => setSignatureMinValue(e.target.value)}
                    className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      const value = Number(signatureMinValue);
                      if (!(value >= 0)) {
                        toast.error('Montant invalide');
                        return;
                      }
                      updateSystemSetting('signature_min_value', String(value), 'Prix d\'achat (CHF) à partir duquel la signature est demandée à la remise');
                    }}
                  >
                    Sauver
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Un outil dont le prix d'achat atteint ce montant (ou marqué « signature à la remise ») est signé sur l'écran par la personne qui le reçoit. 0 = seulement les outils marqués.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Logo de l'entreprise (URL)
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={companyLogo}
                    onChange={(e) => setCompanyLogo(e.target.value)}
                    className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    placeholder="https://example.com/logo.png"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => updateSystemSetting('company_logo', companyLogo, 'URL du logo de l\'entreprise')}
                  >
                    Sauver
                  </Button>
                </div>
                {companyLogo && (
                  <div className="mt-2">
                    <img
                      src={companyLogo}
                      alt="Logo de l'entreprise"
                      className="max-h-12 max-w-32 object-contain"
                      onError={() => toast.error('Impossible de charger le logo')}
                    />
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </Accordion>

      {/* Notifications par e-mail */}
      <Accordion
        title="NOTIFICATIONS PAR E-MAIL ET SMS"
        icon={<Mail size={20} className="text-primary-600 dark:text-primary-400" />}
        defaultOpen={false}
      >
        <Card>
          <div className="p-4">
            <NotificationRecipients />
            <SmsSetting />
          </div>
        </Card>
      </Accordion>

      {/* Outil trouvé : page publique */}
      <Accordion
        title="OUTIL TROUVÉ (PAGE PUBLIQUE)"
        icon={<PhoneCall size={20} className="text-primary-600 dark:text-primary-400" />}
        defaultOpen={false}
      >
        <Card>
          <div className="p-4">
            <FoundToolSettings />
          </div>
        </Card>
      </Accordion>

      {/* Sauvegarde complète */}
      <Accordion
        title="SAUVEGARDE"
        icon={<HardDriveDownload size={20} className="text-primary-600 dark:text-primary-400" />}
        defaultOpen={false}
      >
        <Card>
          <div className="p-4">
            <BackupPanel />
          </div>
        </Card>
      </Accordion>

      {/* Catalogues fournisseurs */}
      <Accordion
        title="CATALOGUES FOURNISSEURS"
        icon={<BookOpen size={20} className="text-primary-600 dark:text-primary-400" />}
        defaultOpen={false}
      >
        <Card>
          <div className="p-4">
            <CatalogImport suppliers={suppliers} onSuppliersChanged={fetchSuppliers} />
          </div>
        </Card>
      </Accordion>

      {/* Catégories */}
      <Accordion
        title={`CATÉGORIES (${categories.length})`}
        icon={<Tag size={20} className="text-success-600 dark:text-success-400" />}
        defaultOpen={false}
      >
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Gérez les catégories de matériel pour organiser votre inventaire
          </p>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={16} />}
            onClick={() => {
              setEditingCategory(undefined);
              setShowCategoryModal(true);
            }}
          >
            Ajouter
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.map(category => (
            <div key={category.id} className="border rounded-lg p-3 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {category.name}
                  </span>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Edit size={14} />}
                    onClick={() => {
                      setEditingCategory(category);
                      setShowCategoryModal(true);
                    }}
                    ariaLabel="Modifier"
                  />
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<Trash2 size={14} />}
                    onClick={() => handleDeleteItem('categories', category.id)}
                    ariaLabel="Supprimer"
                  />
                </div>
              </div>
              {category.description && (
                <p className="text-xs text-gray-500 mt-1">{category.description}</p>
              )}
            </div>
          ))}
        </div>
      </Accordion>

      {/* Fournisseurs */}
      <Accordion
        title={`FOURNISSEURS (${suppliers.length})`}
        icon={<Truck size={20} className="text-primary-600 dark:text-primary-400" />}
        defaultOpen={false}
      >
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Gérez vos fournisseurs et leurs informations de contact
          </p>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={16} />}
            onClick={() => {
              setEditingSupplier(undefined);
              setShowSupplierModal(true);
            }}
          >
            Ajouter
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {suppliers.map(supplier => (
            <div key={supplier.id} className="border rounded-lg p-3 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900 dark:text-white">
                  {supplier.name}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Edit size={14} />}
                    onClick={() => {
                      setEditingSupplier(supplier);
                      setShowSupplierModal(true);
                    }}
                    ariaLabel="Modifier"
                  />
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<Trash2 size={14} />}
                    onClick={() => handleDeleteItem('suppliers', supplier.id)}
                    ariaLabel="Supprimer"
                  />
                </div>
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                {supplier.contactPerson && <p>Contact: {supplier.contactPerson}</p>}
                {supplier.email && <p>Email: {supplier.email}</p>}
                {supplier.phone && <p>Tél: {supplier.phone}</p>}
              </div>
            </div>
          ))}
        </div>
      </Accordion>

      {/* Groupes et sous-groupes */}
      <Accordion
        title={`GROUPES ET SOUS-GROUPES (${groups.length} groupes, ${subgroups.length} sous-groupes)`}
        icon={<Layers size={20} className="text-primary-600 dark:text-primary-400" />}
        defaultOpen={false}
      >
        <div className="space-y-6">
          {/* Groupes */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-gray-900 dark:text-white">Groupes d'équipements</h4>
              <Button
                variant="primary"
                size="sm"
                icon={<Plus size={16} />}
                onClick={() => {
                  setEditingGroup(undefined);
                  setShowGroupModal(true);
                }}
              >
                Ajouter groupe
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {groups.map(group => (
                <div key={group.id} className="border rounded-lg p-3 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: group.color }}
                      />
                      <span className="font-medium text-gray-900 dark:text-white">
                        {group.name}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<Edit size={14} />}
                        onClick={() => {
                          setEditingGroup(group);
                          setShowGroupModal(true);
                        }}
                        ariaLabel="Modifier"
                      />
                      <Button
                        variant="danger"
                        size="sm"
                        icon={<Trash2 size={14} />}
                        onClick={() => handleDeleteItem('equipment_groups', group.id)}
                        ariaLabel="Supprimer"
                      />
                    </div>
                  </div>
                  {group.description && (
                    <p className="text-xs text-gray-500 mt-1">{group.description}</p>
                  )}
                  <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">
                    {subgroups.filter(sg => sg.groupId === group.id).length} sous-groupe(s)
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Sous-groupes */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-gray-900 dark:text-white">Sous-groupes</h4>
              <Button
                variant="primary"
                size="sm"
                icon={<Plus size={16} />}
                onClick={() => {
                  setEditingSubgroup(undefined);
                  setShowSubgroupModal(true);
                }}
                disabled={groups.length === 0}
              >
                Ajouter sous-groupe
              </Button>
            </div>
            
            {groups.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                Créez d'abord un groupe pour pouvoir ajouter des sous-groupes
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {subgroups.map(subgroup => {
                  const parentGroup = groups.find(g => g.id === subgroup.groupId);
                  return (
                    <div key={subgroup.id} className="border rounded-lg p-3 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: parentGroup?.color || '#64748b' }}
                            />
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: subgroup.color }}
                            />
                          </div>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {subgroup.name}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            icon={<Edit size={14} />}
                            onClick={() => {
                              setEditingSubgroup(subgroup);
                              setShowSubgroupModal(true);
                            }}
                            ariaLabel="Modifier"
                          />
                          <Button
                            variant="danger"
                            size="sm"
                            icon={<Trash2 size={14} />}
                            onClick={() => handleDeleteItem('equipment_subgroups', subgroup.id)}
                            ariaLabel="Supprimer"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Groupe: {parentGroup?.name}
                      </p>
                      {subgroup.description && (
                        <p className="text-xs text-gray-500 mt-1">{subgroup.description}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Accordion>

      {/* Départements */}
      <Accordion
        title={`DÉPARTEMENTS (${departments.length})`}
        icon={<Building size={20} className="text-warning-600 dark:text-warning-400" />}
        defaultOpen={false}
      >
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Gérez les départements de votre organisation
          </p>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={16} />}
            onClick={() => {
              setEditingDepartment(undefined);
              setShowDepartmentModal(true);
            }}
          >
            Ajouter
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {departments.map(department => (
            <div key={department.id} className="border rounded-lg p-3 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: department.color }}
                  />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {department.name}
                  </span>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Edit size={14} />}
                    onClick={() => {
                      setEditingDepartment(department);
                      setShowDepartmentModal(true);
                    }}
                    ariaLabel="Modifier"
                  />
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<Trash2 size={14} />}
                    onClick={() => handleDeleteItem('departments', department.id)}
                    ariaLabel="Supprimer"
                  />
                </div>
              </div>
              {department.description && (
                <p className="text-xs text-gray-500 mt-1">{department.description}</p>
              )}
            </div>
          ))}
        </div>
      </Accordion>



      {/* Types de maintenance */}
      <Accordion
        title={`TYPES DE MAINTENANCE (${maintenanceTypes.length})`}
        icon={<Wrench size={20} className="text-warning-600 dark:text-warning-400" />}
        defaultOpen={false}
      >
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Gérez les types de maintenance et de pannes
          </p>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={16} />}
            onClick={() => {
              setEditingMaintenanceType(undefined);
              setShowMaintenanceTypeModal(true);
            }}
          >
            Ajouter
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {maintenanceTypes.map(type => (
            <div key={type.id} className="border rounded-lg p-3 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: type.color }}
                  />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {type.name}
                  </span>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Edit size={14} />}
                    onClick={() => {
                      setEditingMaintenanceType(type);
                      setShowMaintenanceTypeModal(true);
                    }}
                    ariaLabel="Modifier"
                  />
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<Trash2 size={14} />}
                    onClick={() => handleDeleteItem('maintenance_types', type.id)}
                    ariaLabel="Supprimer"
                  />
                </div>
              </div>
              {type.description && (
                <p className="text-xs text-gray-500 mt-1">{type.description}</p>
              )}
            </div>
          ))}
        </div>
      </Accordion>

      {/* Administration */}
      <Accordion
        title="ADMINISTRATION"
        icon={<SettingsIcon size={20} className="text-danger-600 dark:text-danger-400" />}
        defaultOpen={false}
      >
        <div className="space-y-6">
          <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4">
            <h4 className="font-semibold text-danger-800 dark:text-danger-200 mb-3">
              <AlertTriangleIcon className="inline-block w-4 h-4 mr-1 align-text-bottom" aria-hidden="true" />Zone d'administration - Actions irréversibles
            </h4>
            <div className="space-y-4">
              <div>
                <h5 className="font-medium text-gray-900 dark:text-white mb-2">Remise à zéro du système</h5>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Supprime tous les emprunts, bons de livraison, maintenances et remet tout le matériel en disponible.
                  Les équipements, utilisateurs et paramètres sont conservés.
                </p>
                <Button
                  variant="danger"
                  size="sm"
                  icon={<Trash2 size={16} />}
                  onClick={() => setShowSystemResetModal(true)}
                >
                  Remettre à zéro le système
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Accordion>

      {/* Modals */}
      <CategoryModal
        isOpen={showCategoryModal}
        onClose={() => {
          setShowCategoryModal(false);
          setEditingCategory(undefined);
          fetchCategories();
        }}
        category={editingCategory}
      />

      <SupplierModal
        isOpen={showSupplierModal}
        onClose={() => {
          setShowSupplierModal(false);
          setEditingSupplier(undefined);
          fetchSuppliers();
        }}
        supplier={editingSupplier}
      />

      <GroupModal
        isOpen={showGroupModal}
        onClose={() => {
          setShowGroupModal(false);
          setEditingGroup(undefined);
          fetchGroups();
        }}
        group={editingGroup}
      />

      <SubgroupModal
        isOpen={showSubgroupModal}
        onClose={() => {
          setShowSubgroupModal(false);
          setEditingSubgroup(undefined);
          fetchSubgroups();
        }}
        subgroup={editingSubgroup}
        groups={groups}
      />

      <DepartmentModal
        isOpen={showDepartmentModal}
        onClose={() => {
          setShowDepartmentModal(false);
          setEditingDepartment(undefined);
          fetchDepartments();
        }}
        department={editingDepartment}
      />



      <MaintenanceTypeModal
        isOpen={showMaintenanceTypeModal}
        onClose={() => {
          setShowMaintenanceTypeModal(false);
          setEditingMaintenanceType(undefined);
          fetchMaintenanceTypes();
        }}
        maintenanceType={editingMaintenanceType}
      />

      <ExcelImport
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={() => {
          setShowImportModal(false);
          fetchAllData();
        }}
      />

      <SystemResetModal
        isOpen={showSystemResetModal}
        onClose={() => setShowSystemResetModal(false)}
      />
    </div>
  );
};

export default Settings;