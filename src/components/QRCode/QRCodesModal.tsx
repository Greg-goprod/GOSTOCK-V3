import toast from 'react-hot-toast';
import React from 'react';
import Modal from '../common/Modal';
import QRCodeGenerator from './QRCodeGenerator';
import { Equipment, EquipmentInstance } from '../../types';
import { Printer } from 'lucide-react';
import Button from '../common/Button';

interface QRCodesModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipment: Equipment;
  instances: EquipmentInstance[];
}

const QRCodesModal: React.FC<QRCodesModalProps> = ({ 
  isOpen, 
  onClose, 
  equipment, 
  instances 
}) => {
  if (!equipment) return null;

  const handlePrintAll = () => {
    // Create a new window for printing all QR codes
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      toast.error('Impossible d\'ouvrir la fenêtre d\'impression. Vérifie que les popups ne sont pas bloquées.');
      return;
    }
    
    // Generate HTML content for printing
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Codes - ${equipment.name}</title>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
            }
            .print-header {
              text-align: center;
              margin-bottom: 20px;
              padding-bottom: 10px;
              border-bottom: 1px solid #ddd;
            }
            .print-title {
              font-size: 18pt;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .print-subtitle {
              font-size: 12pt;
              color: #666;
            }
            .qr-grid {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
              gap: 20px;
              justify-items: center;
            }
            .qr-item {
              text-align: center;
              page-break-inside: avoid;
              margin-bottom: 20px;
            }
            .qr-title {
              font-weight: bold;
              margin-top: 8px;
              font-size: 14pt;
              line-height: 1.2;
            }
            .qr-subtitle {
              font-size: 8pt;
              color: #666;
            }
            .qr-code {
              margin-bottom: 3px;
              display: block;
            }
            .print-button {
              position: fixed;
              top: 20px;
              right: 20px;
              padding: 10px 20px;
              background-color: #4CAF50;
              color: white;
              border: none;
              border-radius: 5px;
              cursor: pointer;
              font-size: 14px;
              font-weight: bold;
            }
            @media print {
              .print-button {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <button class="print-button" onclick="window.print()">Imprimer</button>
          
          <div class="print-header">
            <div class="print-title">QR Codes - ${equipment.name}</div>
            <div class="print-subtitle">${equipment.qrType === 'individual' ? `${instances.length} QR codes individuels` : 'QR code unique'}</div>
          </div>
          
          <div class="qr-grid">
            ${equipment.qrType === 'individual' && instances.length > 0 
              ? instances.map(instance => `
                <div class="qr-item">
                  <img 
                    src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(instance.qrCode)}" 
                    alt="QR Code ${instance.instanceNumber}"
                    class="qr-code"
                  />
                  <div class="qr-title">${equipment.name} #${instance.instanceNumber}</div>
                  <div class="qr-subtitle">${equipment.articleNumber || equipment.serialNumber}-${String(instance.instanceNumber).padStart(3, '0')}</div>
                </div>
              `).join('')
              : `
                <div class="qr-item">
                  <img 
                    src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(equipment.id)}" 
                    alt="QR Code"
                    class="qr-code"
                  />
                  <div class="qr-title">${equipment.name}</div>
                  <div class="qr-subtitle">${equipment.articleNumber || equipment.serialNumber}</div>
                </div>
              `
            }
          </div>
        </body>
      </html>
    `;
    
    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  const getQRCodeValue = (instance?: EquipmentInstance) => {
    if (instance) {
      return instance.qrCode;
    }
    return equipment.id;
  };

  const getQRCodeTitle = (instance?: EquipmentInstance) => {
    if (instance) {
      return `${equipment.name} #${instance.instanceNumber}`;
    }
    return equipment.name;
  };

  const getQRCodeSubtitle = (instance?: EquipmentInstance) => {
    if (instance) {
      return `${equipment.articleNumber} - Instance ${instance.instanceNumber}`;
    }
    return equipment.articleNumber || equipment.serialNumber;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`QR codes · ${equipment.name}`}
      size="xl"
    >
      <div className="space-y-6">
        {/* Info header */}
        <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-4">
          <h3 className="text-lg font-black text-primary-800 dark:text-primary-200 mb-2 uppercase">
            {equipment.qrType === 'individual' ? 'QR codes individuels' : 'QR code unique'}
          </h3>
          <p className="text-primary-700 dark:text-primary-300 text-sm font-medium">
            {equipment.qrType === 'individual' 
              ? `${instances.length} QR codes individuels pour impression d'étiquettes`
              : 'Un seul QR code pour tout le lot'}
          </p>
          <p className="text-primary-600 dark:text-primary-400 text-xs font-medium mt-1">
            Article: {equipment.articleNumber} • Quantité totale: {equipment.totalQuantity}
          </p>
        </div>

        {/* Print all button */}
        <div className="flex justify-center mb-4">
          <Button
            variant="primary"
            icon={<Printer size={18} />}
            onClick={handlePrintAll}
          >
            Imprimer tous les QR codes
          </Button>
        </div>

        {equipment.qrType === 'individual' && instances.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {instances.map(instance => (
              <div key={instance.id} className="flex justify-center">
                <QRCodeGenerator
                  value={getQRCodeValue(instance)}
                  title={getQRCodeTitle(instance)}
                  subtitle={getQRCodeSubtitle(instance)}
                  size={150}
                  printable={true}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex justify-center">
            <QRCodeGenerator
              value={getQRCodeValue()}
              title={getQRCodeTitle()}
              subtitle={getQRCodeSubtitle()}
              size={200}
              printable={true}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};

export default QRCodesModal;