import React, { useState, useRef, useEffect, useId } from 'react';
import { Camera, QrCode, Zap } from 'lucide-react';
import CameraScanner from './CameraScanner';

interface QRCodeScannerProps {
  onScan: (decodedText: string) => void;
  onError?: (error: string) => void;
  disableAutoFocus?: boolean;
}

const QRCodeScanner: React.FC<QRCodeScannerProps> = ({ onScan, onError, disableAutoFocus = false }) => {
  const [scannedValue, setScannedValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [lastScanStatus, setLastScanStatus] = useState<'success' | 'error' | 'duplicate' | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
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
      // Motif affiché à l'écran (badge inconnu, accès suspendu, article introuvable…)
      setLastError(error instanceof Error ? error.message : null);
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
    if (isProcessing) return 'border-warning-400 bg-warning-50 dark:bg-warning-900/20';
    if (lastScanStatus === 'success') return 'border-success-400 bg-success-50 dark:bg-success-900/20';
    if (lastScanStatus === 'error') return 'border-danger-400 bg-danger-50 dark:bg-danger-900/20';
    if (lastScanStatus === 'duplicate') return 'border-warning-400 bg-warning-50 dark:bg-warning-900/20';
    return 'border-[color:var(--mx-input-border)] bg-[color:var(--mx-surface)]';
  };

  const getStatusMessage = () => {
    if (isProcessing) return 'Traitement en cours...';
    if (lastScanStatus === 'success') return 'Scan réussi !';
    if (lastScanStatus === 'error') return lastError ? `Erreur de scan : ${lastError}` : 'Erreur de scan';
    if (lastScanStatus === 'duplicate') return 'Doublon ignoré';
    if (scannedValue) return 'Appuie sur Entrée pour valider';
    return 'Prêt pour le scan...';
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* État du scanner */}
      <div className="mx-tint-accent p-3 mb-3">
        <div className="flex items-center gap-2 mb-1">
          <Zap size={16} className="text-primary-600 dark:text-primary-400" />
          <h3 className="font-bold text-primary-800 dark:text-primary-200 text-sm">
            Scanner QR : {disableAutoFocus ? 'suspendu' : 'actif'}
          </h3>
        </div>
        <p className="text-xs text-primary-700 dark:text-primary-300">
          {disableAutoFocus 
            ? 'Mode manuel actif'
            : 'Scan automatique activé'
          }
        </p>
      </div>

      {/* Champ de saisie (douchette ou clavier) */}
      <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Code scanné
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={scannedValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Scanne ou saisis un code..."
          disabled={isProcessing}
          className={`w-full px-3 py-2.5 text-center border-[1.5px] rounded-md font-mono text-[14px] text-gray-900 dark:text-white transition-colors ${getStatusColor()}`}
          autoComplete="off"
          autoFocus={!disableAutoFocus}
        />
        
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          {isProcessing ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
          ) : (
            <QrCode size={16} className="text-gray-500 dark:text-gray-400" />
          )}
        </div>
      </div>

      {/* Caméra du téléphone ou de la tablette, quand il n'y a pas de lecteur */}
      <button
        type="button"
        onClick={() => setCameraOn(on => !on)}
        aria-pressed={cameraOn}
        className="mx-btn mx-btn-secondary mt-2 w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 min-h-[44px] lg:min-h-[34px] text-[12.5px]"
      >
        <Camera size={16} aria-hidden="true" /> {cameraOn ? 'Arrêter la caméra' : 'Scanner avec la caméra'}
      </button>
      {cameraOn && (
        <div className="mt-2">
          <CameraScanner onDecode={text => handleScan(text)} />
        </div>
      )}

      {/* Message de statut */}
      <div className="mt-2 text-center">
        <p className={`text-sm font-medium ${
          lastScanStatus === 'success' ? 'text-tone-success' :
          lastScanStatus === 'error' ? 'text-tone-danger' :
          lastScanStatus === 'duplicate' ? 'text-tone-warning' :
          isProcessing ? 'text-tone-warning' :
          'text-primary-600'
        }`}>
          {getStatusMessage()}
        </p>
      </div>
    </div>
  );
};

export default QRCodeScanner;