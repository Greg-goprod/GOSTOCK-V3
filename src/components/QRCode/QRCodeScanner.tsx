import React, { useEffect, useState, useRef } from 'react';
import Button from '../common/Button';
import { QrCode, Camera, Keyboard, AlertCircle, CheckCircle } from 'lucide-react';

interface QRCodeScannerProps {
  onScan: (decodedText: string) => void;
  onError?: (error: string) => void;
}

const QRCodeScanner: React.FC<QRCodeScannerProps> = ({ onScan, onError }) => {
  const [scanMode, setScanMode] = useState<'barcode' | 'camera'>('barcode');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannedValue, setScannedValue] = useState('');
  const [lastScannedValue, setLastScannedValue] = useState('');
  const [scanStatus, setScanStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<any>(null);
  const scannerDivId = 'qr-reader';

  // Auto-focus sur le champ de saisie pour la douchette
  useEffect(() => {
    if (scanMode === 'barcode' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [scanMode]);

  // Gérer la saisie de la douchette
  const handleBarcodeInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const value = scannedValue.trim();
      if (value) {
        console.log('🔍 QR Code scanné par douchette:', value);
        console.log('🔍 Longueur:', value.length);
        console.log('🔍 Caractères spéciaux:', JSON.stringify(value));
        
        setLastScannedValue(value);
        setScanStatus('success');
        
        // Nettoyer la valeur (supprimer espaces, caractères invisibles)
        const cleanValue = value.replace(/[\r\n\t\s]/g, '').trim();
        console.log('🧹 Valeur nettoyée:', cleanValue);
        
        onScan(cleanValue);
        setScannedValue(''); // Reset pour le prochain scan
        
        // Reset du statut après 3 secondes
        setTimeout(() => {
          setScanStatus('idle');
        }, 3000);
        
        // Re-focus pour le prochain scan
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
          }
        }, 100);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setScannedValue(e.target.value);
    setScanStatus('idle');
  };

  // Scanner caméra (code existant)
  const startCameraScanning = async () => {
    setError(null);
    setIsScanning(true);

    try {
      // Import dynamique pour éviter les erreurs si la librairie n'est pas disponible
      const { Html5Qrcode } = await import('html5-qrcode');
      
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(scannerDivId);
      }

      await scannerRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText: string) => {
          console.log('🔍 QR Code scanné par caméra:', decodedText);
          handleScanSuccess(decodedText);
        },
        (errorMessage: string) => {
          // Ne pas afficher les erreurs de scan normales
          console.log('Scanner caméra:', errorMessage);
        }
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue du scanner caméra';
      setError(errorMessage);
      if (onError) onError(errorMessage);
      setIsScanning(false);
    }
  };

  const stopCameraScanning = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.error('Erreur arrêt scanner:', err);
      }
    }
    setIsScanning(false);
  };

  const handleScanSuccess = async (decodedText: string) => {
    const cleanValue = decodedText.replace(/[\r\n\t\s]/g, '').trim();
    console.log('🧹 Valeur caméra nettoyée:', cleanValue);
    onScan(cleanValue);
    await stopCameraScanning();
  };

  // Cleanup à la fermeture
  useEffect(() => {
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch((error: any) => {
          console.error('Erreur arrêt scanner:', error);
        });
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Sélecteur de mode */}
      <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-1">
        <button
          onClick={() => {
            setScanMode('barcode');
            if (isScanning) stopCameraScanning();
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-black transition-all uppercase tracking-wide ${
            scanMode === 'barcode'
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
          }`}
        >
          <Keyboard size={16} />
          DOUCHETTE USB
        </button>
        <button
          onClick={() => {
            setScanMode('camera');
            setScannedValue('');
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-black transition-all uppercase tracking-wide ${
            scanMode === 'camera'
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
          }`}
        >
          <Camera size={16} />
          CAMÉRA WEB
        </button>
      </div>

      {/* Mode Douchette - VERSION ULTRA CLEAN */}
      {scanMode === 'barcode' && (
        <div className="w-full max-w-sm">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Keyboard size={20} className="text-blue-600 dark:text-blue-400" />
              <h3 className="font-black text-blue-800 dark:text-blue-200 uppercase tracking-wide">
                MODE DOUCHETTE ACTIVE
              </h3>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
              ✅ Scannez directement avec votre douchette INATECK
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">
              Le curseur doit être dans le champ ci-dessous
            </p>
          </div>

          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={scannedValue}
              onChange={handleInputChange}
              onKeyDown={handleBarcodeInput}
              placeholder="Scannez un QR code avec votre douchette..."
              className={`w-full px-4 py-3 text-center border-2 border-dashed rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-lg focus:outline-none focus:ring-2 transition-all ${
                scanStatus === 'success' 
                  ? 'border-green-400 dark:border-green-500 focus:border-green-500 focus:ring-green-200 dark:focus:ring-green-800'
                  : scanStatus === 'error'
                  ? 'border-red-400 dark:border-red-500 focus:border-red-500 focus:ring-red-200 dark:focus:ring-red-800'
                  : 'border-primary-300 dark:border-primary-600 focus:border-primary-500 focus:ring-primary-200 dark:focus:ring-primary-800'
              }`}
              autoComplete="off"
              autoFocus
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              {scanStatus === 'success' ? (
                <CheckCircle size={20} className="text-green-500" />
              ) : scanStatus === 'error' ? (
                <AlertCircle size={20} className="text-red-500" />
              ) : (
                <QrCode size={20} className="text-gray-400" />
              )}
            </div>
          </div>

          <div className="mt-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              🎯 Pointez votre douchette vers un QR code et appuyez sur le trigger
            </p>
            {scannedValue && (
              <p className="text-xs text-blue-600 dark:text-blue-400 font-bold mt-1">
                ⚡ Données en cours: {scannedValue.substring(0, 30)}...
              </p>
            )}
            {lastScannedValue && scanStatus === 'success' && (
              <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
                <p className="text-xs text-green-700 dark:text-green-300 font-black uppercase tracking-wide">
                  ✅ DERNIER SCAN RÉUSSI
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 font-mono break-all">
                  {lastScannedValue}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mode Caméra */}
      {scanMode === 'camera' && (
        <div className="w-full max-w-sm">
          <div id={scannerDivId} className="w-full h-64 bg-gray-100 dark:bg-gray-700 rounded-lg mb-4 overflow-hidden">
            {!isScanning && (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                <Camera size={48} strokeWidth={1.5} className="mb-2" />
                <p className="font-black uppercase tracking-wide">Scanner caméra web</p>
                <p className="text-sm font-medium">Cliquez sur "Démarrer" pour activer</p>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 rounded-md text-sm font-medium">
              ⚠️ {error}
            </div>
          )}

          <div className="flex justify-center">
            {isScanning ? (
              <Button 
                variant="danger" 
                onClick={stopCameraScanning}
                className="font-black"
              >
                ARRÊTER CAMÉRA
              </Button>
            ) : (
              <Button 
                variant="primary" 
                icon={<Camera size={18} />}
                onClick={startCameraScanning}
                className="font-black"
              >
                DÉMARRER CAMÉRA
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default QRCodeScanner;