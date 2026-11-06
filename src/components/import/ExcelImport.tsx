import React, { useState, useRef } from 'react';
import Button from '../common/Button';
import Modal from '../common/Modal';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, X, Check as CheckIcon } from 'lucide-react';
import { downloadWorkbook, readSheetRows } from '../../lib/excel';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface ExcelImportProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

interface ImportRow {
  name: string;
  description: string;
  category: string;
  serial_number: string;
  status: string;
  location: string;
  supplier: string;
  image_url: string;
  available_quantity: number;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

const ExcelImport: React.FC<ExcelImportProps> = ({ isOpen, onClose, onImportComplete }) => {
  const [step, setStep] = useState<'upload' | 'validate' | 'import'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<ImportRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [importResults, setImportResults] = useState<{ success: number; errors: number }>({ success: 0, errors: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = async () => {
    try {
      // Données d'exemple pour le modèle
      const templateData = [
        {
          name: 'Laptop Dell XPS 13',
          description: 'Ordinateur portable Dell XPS 13 avec 16GB RAM et 512GB SSD',
          category: 'Électronique',
          serial_number: 'DL-XPS-001',
          status: 'available',
          location: 'Bureau principal',
          supplier: 'TechSource Inc.',
          image_url: 'https://images.pexels.com/photos/7974/pexels-photo.jpg',
          available_quantity: 1
        },
        {
          name: 'Perceuse électrique DeWalt',
          description: 'Perceuse sans fil 20V MAX avec batterie lithium-ion',
          category: 'Outils',
          serial_number: 'DW-20V-002',
          status: 'available',
          location: 'Atelier',
          supplier: 'ToolMaster Supply',
          image_url: 'https://images.pexels.com/photos/162553/keys-workshop-mechanic-tools-162553.jpeg',
          available_quantity: 3
        },
        {
          name: 'Chaise de bureau ergonomique',
          description: 'Chaise de bureau avec support lombaire réglable',
          category: 'Mobilier de bureau',
          serial_number: 'OC-ERG-003',
          status: 'available',
          location: 'Salle de stockage',
          supplier: 'Office Solutions',
          image_url: 'https://images.pexels.com/photos/1957477/pexels-photo-1957477.jpeg',
          available_quantity: 5
        }
      ];

      // Créer la feuille d'instructions
      const instructions = [
        {
          Champ: 'name',
          Description: 'Nom du matériel',
          Obligatoire: 'OUI',
          Exemple: 'Laptop Dell XPS 13',
          Notes: 'Nom descriptif du matériel'
        },
        {
          Champ: 'description',
          Description: 'Description détaillée',
          Obligatoire: 'NON',
          Exemple: 'Ordinateur portable avec 16GB RAM',
          Notes: 'Description complète du matériel'
        },
        {
          Champ: 'category',
          Description: 'Catégorie du matériel',
          Obligatoire: 'NON',
          Exemple: 'Électronique',
          Notes: 'Sera créée automatiquement si inexistante'
        },
        {
          Champ: 'serial_number',
          Description: 'Numéro de série du fabricant',
          Obligatoire: 'NON',
          Exemple: 'DL-XPS-001',
          Notes: 'Unique s\'il est renseigné ; le numéro d\'article est attribué automatiquement'
        },
        {
          Champ: 'status',
          Description: 'Statut du matériel',
          Obligatoire: 'NON',
          Exemple: 'available',
          Notes: 'Valeurs: available, checked-out, maintenance, retired'
        },
        {
          Champ: 'location',
          Description: 'Emplacement du matériel',
          Obligatoire: 'NON',
          Exemple: 'Bureau principal',
          Notes: 'Lieu de stockage ou d\'utilisation'
        },
        {
          Champ: 'supplier',
          Description: 'Nom du fournisseur',
          Obligatoire: 'NON',
          Exemple: 'TechSource Inc.',
          Notes: 'Sera créé automatiquement si inexistant'
        },
        {
          Champ: 'image_url',
          Description: 'URL de l\'image',
          Obligatoire: 'NON',
          Exemple: 'https://example.com/image.jpg',
          Notes: 'Lien vers une image du matériel'
        },
        {
          Champ: 'available_quantity',
          Description: 'Quantité disponible',
          Obligatoire: 'NON',
          Exemple: '5',
          Notes: 'Nombre d\'unités disponibles (défaut: 1)'
        }
      ];

      await downloadWorkbook([
        // name, description, category, serial_number, status, location, supplier, image_url, available_quantity
        { name: 'Matériel', rows: templateData, widths: [25, 40, 15, 15, 12, 20, 20, 50, 15] },
        { name: 'Instructions', rows: instructions, widths: [20, 25, 12, 30, 40] },
      ], 'GO-Mat_Modele_Import.xlsx');
      toast.success('Modèle Excel téléchargé avec succès');
    } catch (error) {
      console.error('Error creating Excel template:', error);
      toast.error('Erreur lors de la création du modèle Excel');
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (!/\.xlsx$/i.test(selectedFile.name)) {
        toast.error('Sélectionne un fichier Excel .xlsx (enregistre les anciens .xls au format .xlsx)');
        return;
      }
      setFile(selectedFile);
      parseExcelFile(selectedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer.files);
    const excelFile = files.find(file => /\.xlsx$/i.test(file.name));
    
    if (excelFile) {
      setFile(excelFile);
      parseExcelFile(excelFile);
    } else {
      toast.error('Dépose un fichier Excel .xlsx');
    }
  };

  const parseExcelFile = async (file: File) => {
    setIsLoading(true);
    try {
      // Première feuille qui n'est pas « Instructions »
      const jsonData = await readSheetRows(file, ['Instructions']);

      if (jsonData.length === 0) {
        toast.error('Le fichier Excel est vide ou ne contient pas de données valides');
        return;
      }

      const parsedData: ImportRow[] = jsonData.map(row => ({
        name: row.name || '',
        description: row.description || '',
        category: row.category || '',
        serial_number: row.serial_number || '',
        status: row.status || 'available',
        location: row.location || '',
        supplier: row.supplier || '',
        image_url: row.image_url || '',
        available_quantity: parseInt(row.available_quantity, 10) || 1
      }));

      setData(parsedData);
      validateData(parsedData);
      setStep('validate');
      toast.success(`${parsedData.length} lignes lues avec succès`);
    } catch (error) {
      console.error('Error parsing Excel file:', error);
      toast.error('Erreur lors de la lecture du fichier. Utilise un fichier .xlsx (Excel 2007 ou plus récent).');
    } finally {
      setIsLoading(false);
    }
  };

  const validateData = async (data: ImportRow[]) => {
    const errors: ValidationError[] = [];
    const serialNumbers = new Set<string>();

    // Vérifier les numéros de série existants dans la base de données
    const { data: existingEquipment } = await supabase
      .from('equipment')
      .select('serial_number');
    
    const existingSerialNumbers = new Set(existingEquipment?.map(eq => eq.serial_number) || []);

    data.forEach((row, index) => {
      const rowNumber = index + 1;

      // Validation des champs obligatoires
      if (!row.name.trim()) {
        errors.push({ row: rowNumber, field: 'name', message: 'Le nom est obligatoire' });
      }

      // Numéro de série du fabricant facultatif ; s'il est donné, il doit être unique
      if (row.serial_number.trim()) {
        // Vérification des doublons dans le fichier
        if (serialNumbers.has(row.serial_number)) {
          errors.push({ row: rowNumber, field: 'serial_number', message: 'Numéro de série en double dans le fichier' });
        } else {
          serialNumbers.add(row.serial_number);
        }

        // Vérification des doublons dans la base de données
        if (existingSerialNumbers.has(row.serial_number)) {
          errors.push({ row: rowNumber, field: 'serial_number', message: 'Numéro de série déjà existant dans la base de données' });
        }
      }

      // Validation du statut
      const validStatuses = ['available', 'checked-out', 'maintenance', 'retired'];
      if (row.status && !validStatuses.includes(row.status)) {
        errors.push({ row: rowNumber, field: 'status', message: 'Statut invalide. Utilise: available, checked-out, maintenance, retired' });
      }

      // Validation de l'URL d'image
      if (row.image_url && !isValidUrl(row.image_url)) {
        errors.push({ row: rowNumber, field: 'image_url', message: 'URL d\'image invalide' });
      }

      // Validation de la quantité disponible
      if (row.available_quantity < 0) {
        errors.push({ row: rowNumber, field: 'available_quantity', message: 'La quantité disponible ne peut pas être négative' });
      }

      if (row.available_quantity > 1000) {
        errors.push({ row: rowNumber, field: 'available_quantity', message: 'La quantité disponible semble trop élevée (max: 1000)' });
      }
    });

    setValidationErrors(errors);
  };

  const isValidUrl = (string: string) => {
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
  };

  const handleImport = async () => {
    if (validationErrors.length > 0) {
      toast.error('Corrige les erreurs avant d\'importer');
      return;
    }

    setIsLoading(true);
    setStep('import');
    let successCount = 0;
    let errorCount = 0;

    try {
      // Récupérer les catégories et fournisseurs existants
      const { data: categories } = await supabase.from('categories').select('id, name');
      const { data: suppliers } = await supabase.from('suppliers').select('id, name');

      const categoryMap = new Map(categories?.map(c => [c.name.toLowerCase(), c.id]) || []);
      const supplierMap = new Map(suppliers?.map(s => [s.name.toLowerCase(), s.id]) || []);

      for (const row of data) {
        try {
          // Préparer les données pour l'insertion
          const equipmentData: any = {
            name: row.name.trim(),
            description: row.description.trim() || null,
            serial_number: row.serial_number.trim() || null,
            status: row.status || 'available',
            location: row.location.trim() || null,
            image_url: row.image_url.trim() || null,
            total_quantity: row.available_quantity,
            available_quantity: row.available_quantity
          };

          // Gérer la catégorie
          if (row.category.trim()) {
            const categoryKey = row.category.trim().toLowerCase();
            let categoryId = categoryMap.get(categoryKey);
            
            if (!categoryId) {
              // Créer une nouvelle catégorie
              const { data: newCategory, error: categoryError } = await supabase
                .from('categories')
                .insert([{ name: row.category.trim() }])
                .select()
                .single();

              if (categoryError) throw categoryError;
              categoryId = newCategory.id;
              categoryMap.set(categoryKey, categoryId);
            }
            equipmentData.category_id = categoryId;
          }

          // Gérer le fournisseur
          if (row.supplier.trim()) {
            const supplierKey = row.supplier.trim().toLowerCase();
            let supplierId = supplierMap.get(supplierKey);
            
            if (!supplierId) {
              // Créer un nouveau fournisseur
              const { data: newSupplier, error: supplierError } = await supabase
                .from('suppliers')
                .insert([{ name: row.supplier.trim() }])
                .select()
                .single();

              if (supplierError) throw supplierError;
              supplierId = newSupplier.id;
              supplierMap.set(supplierKey, supplierId);
            }
            equipmentData.supplier_id = supplierId;
          }

          // Insérer l'équipement
          const { error: equipmentError } = await supabase
            .from('equipment')
            .insert([equipmentData]);

          if (equipmentError) {
            console.error(`Error importing row ${data.indexOf(row) + 1}:`, equipmentError);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (error) {
          console.error(`Error processing row ${data.indexOf(row) + 1}:`, error);
          errorCount++;
        }
      }

      setImportResults({ success: successCount, errors: errorCount });
      
      if (successCount > 0) {
        toast.success(`${successCount} équipements importés avec succès`);
        if (onImportComplete) {
          onImportComplete();
        }
      }
      
      if (errorCount > 0) {
        toast.error(`${errorCount} erreurs lors de l'import`);
      }

    } catch (error) {
      console.error('Import error:', error);
      toast.error('Erreur lors de l\'import');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setStep('upload');
    setFile(null);
    setData([]);
    setValidationErrors([]);
    setImportResults({ success: 0, errors: 0 });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Excel - Matériel"
      size="xl"
    >
      <div className="space-y-6">
        {/* Progress indicator */}
        <div className="flex items-center justify-center space-x-4">
          <div className={`flex items-center ${step === 'upload' ? 'text-primary-600' : 'text-gray-500 dark:text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'upload' ? 'bg-primary-600 text-white' : 'bg-gray-200'}`}>1</div>
            <span className="ml-2">Fichier</span>
          </div>
          <div className="w-8 h-px bg-gray-300"></div>
          <div className={`flex items-center ${step === 'validate' ? 'text-primary-600' : 'text-gray-500 dark:text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'validate' ? 'bg-primary-600 text-white' : 'bg-gray-200'}`}>2</div>
            <span className="ml-2">Validation</span>
          </div>
          <div className="w-8 h-px bg-gray-300"></div>
          <div className={`flex items-center ${step === 'import' ? 'text-primary-600' : 'text-gray-500 dark:text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'import' ? 'bg-primary-600 text-white' : 'bg-gray-200'}`}>3</div>
            <span className="ml-2">Import</span>
          </div>
        </div>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-6">
            <div className="text-center">
              <FileSpreadsheet size={48} className="mx-auto text-gray-500 dark:text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Import de matériel depuis Excel
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Télécharge le modèle Excel, remplis-le avec tes données, puis importe-le.
              </p>
            </div>

            <div className="flex justify-center">
              <Button
                variant="outline"
                icon={<Download size={18} />}
                onClick={downloadTemplate}
              >
                Télécharger le modèle Excel
              </Button>
            </div>

            <div 
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 transition-colors hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <div className="text-center">
                <Upload size={32} className="mx-auto text-gray-500 dark:text-gray-400 mb-4" />
                <div className="space-y-2">
                  <p className="text-gray-600 dark:text-gray-400">
                    Glisse-dépose ton fichier Excel ici ou
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Lecture du fichier...' : 'Sélectionner un fichier'}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Format : .xlsx (max 10 Mo)
                </p>
              </div>
            </div>

            {file && (
              <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <FileSpreadsheet size={20} className="text-primary-600 dark:text-primary-400 mr-2" />
                    <div>
                      <span className="text-primary-800 dark:text-primary-200 font-medium">{file.name}</span>
                      <p className="text-xs text-primary-600 dark:text-primary-400">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<X size={16} />}
                    onClick={() => {
                      setFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                  >
                    Supprimer
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Validation */}
        {step === 'validate' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Validation des données
              </h3>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-500">
                  {data.length} lignes trouvées
                </span>
                {validationErrors.length === 0 ? (
                  <div className="flex items-center text-tone-success">
                    <CheckCircle size={16} className="mr-1" />
                    <span className="text-sm">Validation réussie</span>
                  </div>
                ) : (
                  <div className="flex items-center text-tone-danger">
                    <AlertCircle size={16} className="mr-1" />
                    <span className="text-sm">{validationErrors.length} erreurs</span>
                  </div>
                )}
              </div>
            </div>

            {validationErrors.length > 0 && (
              <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4">
                <h4 className="font-medium text-tone-danger mb-2">
                  Erreurs de validation ({validationErrors.length})
                </h4>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {validationErrors.slice(0, 20).map((error, index) => (
                    <div key={index} className="text-sm text-tone-danger">
                      <span className="font-medium">Ligne {error.row}</span>, champ "{error.field}": {error.message}
                    </div>
                  ))}
                  {validationErrors.length > 20 && (
                    <div className="text-sm text-tone-danger font-medium">
                      ... et {validationErrors.length - 20} autres erreurs
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-80 overflow-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ligne</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nom</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">N° Série</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Catégorie</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Statut</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Quantité</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Emplacement</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {data.slice(0, 50).map((row, index) => {
                      const rowErrors = validationErrors.filter(e => e.row === index + 1);
                      const hasErrors = rowErrors.length > 0;
                      
                      return (
                        <tr key={index} className={hasErrors ? 'bg-danger-50 dark:bg-danger-900/10' : ''}>
                          <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                            {index + 1}
                            {hasErrors && (
                              <AlertCircle size={14} className="inline ml-1 text-danger-500" />
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                            {row.name}
                            {rowErrors.some(e => e.field === 'name') && (
                              <AlertCircle size={14} className="inline ml-1 text-danger-500" />
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                            {row.serial_number}
                            {rowErrors.some(e => e.field === 'serial_number') && (
                              <AlertCircle size={14} className="inline ml-1 text-danger-500" />
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">{row.category}</td>
                          <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                            {row.status}
                            {rowErrors.some(e => e.field === 'status') && (
                              <AlertCircle size={14} className="inline ml-1 text-danger-500" />
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                            <span className="font-medium text-primary-600 dark:text-primary-400">
                              {row.available_quantity}
                            </span>
                            {rowErrors.some(e => e.field === 'available_quantity') && (
                              <AlertCircle size={14} className="inline ml-1 text-danger-500" />
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">{row.location}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {data.length > 50 && (
                <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                  ... et {data.length - 50} autres lignes
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setStep('upload')}
              >
                Retour
              </Button>
              <Button
                variant="primary"
                onClick={handleImport}
                disabled={validationErrors.length > 0 || isLoading}
              >
                Importer {data.length} équipements
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Import Results */}
        {step === 'import' && (
          <div className="space-y-6">
            <div className="text-center">
              {isLoading ? (
                <div>
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Import en cours...
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Patiente pendant l'import des données.
                  </p>
                </div>
              ) : (
                <div>
                  <CheckCircle size={48} className="mx-auto text-success-500 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Import terminé
                  </h3>
                  <div className="space-y-2">
                    <p className="text-tone-success">
                      <CheckIcon className="inline-block w-4 h-4 mr-1 align-text-bottom" aria-hidden="true" />{importResults.success} équipements importés avec succès
                    </p>
                    {importResults.errors > 0 && (
                      <p className="text-tone-danger">
                        <X className="inline-block w-4 h-4 mr-1 align-text-bottom" aria-hidden="true" />{importResults.errors} erreurs lors de l'import
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {!isLoading && (
              <div className="flex justify-center">
                <Button
                  variant="primary"
                  onClick={handleClose}
                >
                  Fermer
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ExcelImport;