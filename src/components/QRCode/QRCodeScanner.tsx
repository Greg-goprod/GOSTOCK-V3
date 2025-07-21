import React, { useState, useRef, useEffect } from 'react';
import { QrCode, Zap } from 'lucide-react';

interface QRCodeScannerProps {
  onScan: (decodedText: string) => void;
  onError?: (error: string) => void;
  disableAutoFocus?: boolean;
}

const QRCodeScanner: React.FC<QRCodeScannerProps> = ({ onScan, onError, disableAutoFocus = false }) => {
  const [scannedValue, setScannedValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastScanStatus, setLastScanStatus] = useState<'success' | 'error' | 'duplicate' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastScanTimeRef = useRef<number>(0);
  const lastScannedValueRef = useRef<string>('');

  // Auto-focus permanent sur le champ
  useEffect(() => {
    const focusInput = () => {
      if (inputRef.current && !isProcessing && !disableAutoFocus) {
        inputRef.current.focus();
      }
    };

    if (!disableAutoFocus) {
      focusInput();
      
      // Re-focus si l'utilisateur clique ailleurs
      const handleFocus = () => {
        if (!disableAutoFocus) {
          setTimeout(focusInput, 100);
        }
      };

      window.addEventListener('focus', handleFocus);
      document.addEventListener('click', handleFocus);

      return () => {
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('click', handleFocus);
      };
    }
  }, [isProcessing, disableAutoFocus]);

  // Protection anti-doublon
  const canProcessScan = (value: string): boolean => {
    const now = Date.now();
    const timeSinceLastScan = now - lastScanTimeRef.current;
    const isSameValue = value === lastScannedValueRef.current;
    
    if (isSameValue && timeSinceLastScan < 2000) {
      setLastScanStatus('duplicate');
      return false;
    }
    
    lastScanTimeRef.current = now;
    lastScannedValueRef.current = value;
    return true;
  };

  // Traitement du scan
  const handleScan = async (value: string) => {
    if (!value.trim() || isProcessing) return;

    const cleanValue = value.trim().replace(/[\r\n\t]/g, '');
    
    if (!canProcessScan(cleanValue)) {
      setScannedValue('');
      setTimeout(() => setLastScanStatus(null), 2000);
      return;
    }

    setIsProcessing(true);
    setLastScanStatus(null);

    try {
      console.log("🎯 Envoi de la valeur scannée:", cleanValue);
      await onScan(cleanValue);
      setLastScanStatus('success');
      setScannedValue('');
    } catch (error: unknown) {
      console.error('❌ Erreur scan:', error);
      setLastScanStatus('error');
      if (onError) {
        const errorMessage = error instanceof Error ? error.message : 'Erreur lors du traitement du scan';
        onError(errorMessage);
      }
    } finally {
      setIsProcessing(false);
      
      // Reset du statut après 3 secondes
      setTimeout(() => {
        setLastScanStatus(null);
      }, 3000);
      
      // Re-focus immédiat
      setTimeout(() => {
        if (inputRef.current && !disableAutoFocus) {
          inputRef.current.focus();
        }
      }, 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleScan(scannedValue);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isProcessing) {
      setScannedValue(e.target.value);
    }
  };

  const getStatusColor = () => {
    if (isProcessing) return 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20';
    if (lastScanStatus === 'success') return 'border-green-400 bg-green-50 dark:bg-green-900/20';
    if (lastScanStatus === 'error') return 'border-red-400 bg-red-50 dark:bg-red-900/20';
    if (lastScanStatus === 'duplicate') return 'border-orange-400 bg-orange-50 dark:bg-orange-900/20';
    return 'border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-800';
  };

  const getStatusMessage = () => {
    if (isProcessing) return '⚡ Traitement en cours...';
    if (lastScanStatus === 'success') return '✅ Scan réussi !';
    if (lastScanStatus === 'error') return '❌ Erreur de scan';
    if (lastScanStatus === 'duplicate') return '⚠️ Doublon ignoré';
    if (scannedValue) return '⚡ Appuyez sur Entrée pour valider';
    return '🎯 Prêt pour le scan...';
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* HEADER SIMPLIFIE POUR DEBUG */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-3">
        <div className="flex items-center gap-2 mb-1">
          <Zap size={16} className="text-blue-600 dark:text-blue-400" />
          <h3 className="font-bold text-blue-800 dark:text-blue-200 text-sm">
            SCANNER QR - {disableAutoFocus ? 'SUSPENDU' : 'ACTIF'}
          </h3>
        </div>
        <p className="text-xs text-blue-700 dark:text-blue-300">
          {disableAutoFocus 
            ? 'Mode manuel actif'
            : 'Scan automatique activé'
          }
        </p>
      </div>

      {/* CHAMP DE SAISIE SIMPLIFIE */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={scannedValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Scannez ou saisissez un code..."
          disabled={isProcessing}
          className={`w-full px-3 py-3 text-center border-2 rounded-md font-mono text-base focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${getStatusColor()}`}
          autoComplete="off"
          autoFocus={!disableAutoFocus}
        />
        
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          {isProcessing ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          ) : (
            <QrCode size={16} className="text-gray-400" />
          )}
        </div>
      </div>

      {/* MESSAGE DE STATUT SIMPLIFIE */}
      <div className="mt-2 text-center">
        <p className={`text-sm font-medium ${
          lastScanStatus === 'success' ? 'text-green-600' :
          lastScanStatus === 'error' ? 'text-red-600' :
          lastScanStatus === 'duplicate' ? 'text-orange-600' :
          isProcessing ? 'text-yellow-600' :
          'text-blue-600'
        }`}>
          {getStatusMessage()}
        </p>
      </div>
    </div>
  );
};

export default QRCodeScanner;