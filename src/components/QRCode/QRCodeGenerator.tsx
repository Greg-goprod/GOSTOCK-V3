import toast from 'react-hot-toast';
import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Button from '../common/Button';
import { Printer } from 'lucide-react';
import { EquipmentInstance } from '../../types';

interface QRCodeGeneratorProps {
  value?: string;
  title?: string;
  subtitle?: string;
  size?: number;
  printable?: boolean;
  // Anciennes props pour compatibilité
  equipmentId?: string;
  instance?: EquipmentInstance | null;
}

const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = ({
  value,
  title,
  subtitle,
  size = 128,
  printable = true,
  equipmentId,
  instance
}) => {
  const qrCodeRef = useRef<HTMLDivElement>(null);

  // Déterminer la valeur à utiliser pour le QR code
  const qrValue = value || equipmentId || '';
  const qrTitle = title || (instance ? `Équipement #${instance.instanceNumber}` : '');
  const qrSubtitle = subtitle || (instance ? `Instance ${instance.instanceNumber}` : '');

  const handlePrint = () => {
    // Créer une image du QR code
    const svgElement = qrCodeRef.current?.querySelector('svg');
    if (!svgElement) {
      console.error('SVG element not found');
      return;
    }

    // Convertir le SVG en chaîne
    const svgData = new XMLSerializer().serializeToString(svgElement);
    
    // Créer un canvas pour convertir le SVG en image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      console.error('Canvas context not available');
      return;
    }
    
    // Définir la taille du canvas
    canvas.width = size * 2;
    canvas.height = size * 2;
    
    // Créer une image à partir du SVG
    const img = new Image();
    const blob = new Blob([svgData], {type: 'image/svg+xml'});
    const url = URL.createObjectURL(blob);
    
    img.onload = () => {
      // Dessiner l'image sur le canvas
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Convertir le canvas en URL de données
      const dataUrl = canvas.toDataURL('image/png');
      
      // Créer le contenu HTML pour l'impression
      const printContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Étiquette QR Code - ${qrTitle}</title>
            <meta charset="UTF-8">
            <style>
              @page {
                size: auto;
                margin: 0mm;
              }
              body {
                margin: 0;
                padding: 0;
                font-family: Arial, sans-serif;
              }
              .print-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 20px;
              }
              .print-options {
                display: flex;
                flex-direction: column;
                gap: 20px;
                margin-bottom: 30px;
                width: 100%;
                max-width: 600px;
              }
              .option-title {
                font-size: 16px;
                font-weight: bold;
                margin-bottom: 10px;
              }
              .option-buttons {
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
              }
              .option-button {
                padding: 10px 15px;
                background-color: #f0f0f0;
                border: 1px solid #ddd;
                border-radius: 5px;
                cursor: pointer;
                font-size: 14px;
              }
              .option-button:hover {
                background-color: #e0e0e0;
              }
              .option-button.active {
                background-color: #4CAF50;
                color: white;
                border-color: #4CAF50;
              }
              .print-actions {
                display: flex;
                gap: 10px;
                margin-top: 20px;
              }
              .print-button {
                padding: 10px 20px;
                background-color: #4CAF50;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 16px;
              }
              .close-button {
                padding: 10px 20px;
                background-color: #f44336;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 16px;
              }
              
              /* Styles pour les différents formats d'étiquettes */
              .label {
                display: none; /* Caché par défaut */
                margin: 0 auto;
                background-color: white;
                box-shadow: 0 0 10px rgba(0,0,0,0.1);
              }
              
              /* Format 40x30mm */
              .label-40x30 {
                width: 40mm;
                height: 30mm;
                display: flex;
                align-items: center;
                padding: 2mm;
              }
              .qr-40x30 {
                width: 26mm;
                height: 26mm;
              }
              .text-40x30 {
                flex: 1;
                padding-left: 2mm;
                overflow: hidden;
              }
              .title-40x30 {
                font-size: 8pt;
                font-weight: bold;
                line-height: 1.2;
                margin-bottom: 1mm;
                overflow: hidden;
                text-overflow: ellipsis;
                max-height: 20mm;
              }
              .subtitle-40x30 {
                font-size: 6pt;
                color: #666;
              }
              
              /* Format 40x40mm */
              .label-40x40 {
                width: 40mm;
                height: 40mm;
                padding: 2mm;
                display: flex;
                flex-direction: column;
                align-items: center;
              }
              .qr-40x40 {
                width: 30mm;
                height: 30mm;
                margin-bottom: 1mm;
              }
              .title-40x40 {
                font-size: 8pt;
                font-weight: bold;
                text-align: center;
                line-height: 1.2;
                width: 100%;
              }
              .subtitle-40x40 {
                font-size: 6pt;
                color: #666;
                text-align: center;
              }
              
              /* Format 30x20mm */
              .label-30x20 {
                width: 30mm;
                height: 20mm;
                display: flex;
                align-items: center;
                padding: 1mm;
              }
              .qr-30x20 {
                width: 18mm;
                height: 18mm;
              }
              .text-30x20 {
                flex: 1;
                padding-left: 1mm;
                overflow: hidden;
              }
              .title-30x20 {
                font-size: 6pt;
                font-weight: bold;
                line-height: 1.1;
                margin-bottom: 0.5mm;
                overflow: hidden;
                text-overflow: ellipsis;
                max-height: 12mm;
              }
              .subtitle-30x20 {
                font-size: 5pt;
                color: #666;
              }
              
              /* Format rond 40mm */
              .label-round-40 {
                width: 40mm;
                height: 40mm;
                border-radius: 50%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 2mm;
              }
              .qr-round-40 {
                width: 25mm;
                height: 25mm;
              }
              .title-round-40 {
                font-size: 6pt;
                font-weight: bold;
                text-align: center;
                margin-top: 1mm;
                width: 90%;
              }
              
              @media print {
                .print-options, .print-actions {
                  display: none;
                }
                body {
                  margin: 0;
                  padding: 0;
                }
                .print-container {
                  padding: 0;
                }
              }
            </style>
          </head>
          <body>
            <div class="print-container">
              <div class="print-options">
                <div>
                  <div class="option-title">Format d'étiquette:</div>
                  <div class="option-buttons" id="format-buttons">
                    <button class="option-button active" data-format="40x30">40x30mm (Standard)</button>
                    <button class="option-button" data-format="40x40">40x40mm (Carré)</button>
                    <button class="option-button" data-format="30x20">30x20mm (Petit)</button>
                    <button class="option-button" data-format="round-40">Rond 40mm</button>
                  </div>
                </div>
                
                <div class="print-actions">
                  <button class="print-button" onclick="window.print()">Imprimer</button>
                  <button class="close-button" onclick="window.close()">Fermer</button>
                </div>
              </div>
              
              <!-- Format 40x30mm -->
              <div class="label label-40x30" id="label-40x30">
                <img src="${dataUrl}" class="qr-40x30" alt="QR Code" />
                <div class="text-40x30">
                  <div class="title-40x30">${qrTitle}</div>
                  ${qrSubtitle ? `<div class="subtitle-40x30">${qrSubtitle}</div>` : ''}
                </div>
              </div>
              
              <!-- Format 40x40mm -->
              <div class="label label-40x40" id="label-40x40" style="display: none;">
                <img src="${dataUrl}" class="qr-40x40" alt="QR Code" />
                <div class="title-40x40">${qrTitle}</div>
                ${qrSubtitle ? `<div class="subtitle-40x40">${qrSubtitle}</div>` : ''}
              </div>
              
              <!-- Format 30x20mm -->
              <div class="label label-30x20" id="label-30x20" style="display: none;">
                <img src="${dataUrl}" class="qr-30x20" alt="QR Code" />
                <div class="text-30x20">
                  <div class="title-30x20">${qrTitle}</div>
                  ${qrSubtitle ? `<div class="subtitle-30x20">${qrSubtitle}</div>` : ''}
                </div>
              </div>
              
              <!-- Format rond 40mm -->
              <div class="label label-round-40" id="label-round-40" style="display: none;">
                <img src="${dataUrl}" class="qr-round-40" alt="QR Code" />
                <div class="title-round-40">${qrTitle}</div>
              </div>
            </div>
            
            <script>
              // Afficher le format 40x30mm par défaut
              document.getElementById('label-40x30').style.display = 'flex';
              
              // Gérer les boutons de format
              const formatButtons = document.querySelectorAll('#format-buttons .option-button');
              formatButtons.forEach(button => {
                button.addEventListener('click', function() {
                  // Masquer tous les formats
                  document.querySelectorAll('.label').forEach(label => {
                    label.style.display = 'none';
                  });
                  
                  // Afficher le format sélectionné
                  const format = this.getAttribute('data-format');
                  document.getElementById('label-' + format).style.display = 
                    format === '40x30' || format === '30x20' ? 'flex' : 
                    format === '40x40' || format === 'round-40' ? 'flex' : 'none';
                  
                  // Mettre à jour la classe active
                  formatButtons.forEach(btn => btn.classList.remove('active'));
                  this.classList.add('active');
                });
              });
            </script>
          </body>
        </html>
      `;
      
      // Ouvrir dans une nouvelle fenêtre
      const printWindow = window.open('', '_blank', 'width=800,height=600');
      if (!printWindow) {
        toast.error('Impossible d\'ouvrir la fenêtre d\'impression. Vérifie que les popups ne sont pas bloquées.');
        return;
      }
      
      printWindow.document.open();
      printWindow.document.write(printContent);
      printWindow.document.close();
      
      // Libérer l'URL
      URL.revokeObjectURL(url);
    };
    
    img.src = url;
  };

  return (
    <div className="flex flex-col items-center p-4 border rounded-lg bg-white dark:bg-gray-800">
      <div className="mb-4" ref={qrCodeRef} data-qr-value={qrValue}>
        <QRCodeSVG 
          value={qrValue} 
          size={size}
          bgColor="#ffffff"
          fgColor="#000000"
          level="M"
          includeMargin={true}
        />
      </div>
      <h3 className="mt-2 font-black text-gray-800 dark:text-gray-100 text-center uppercase tracking-wide text-lg">
        {qrTitle}
      </h3>
      {qrSubtitle && (
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center font-medium">
          {qrSubtitle}
        </p>
      )}
      <div className="text-xs text-gray-500 dark:text-gray-500 mt-2 font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
        {qrValue}
      </div>
      
      {printable && (
        <Button 
          variant="primary" 
          size="sm" 
          icon={<Printer size={16} />}
          onClick={handlePrint}
          className="mt-4 font-bold"
        >
          Imprimer étiquette
        </Button>
      )}
    </div>
  );
};

export default QRCodeGenerator;