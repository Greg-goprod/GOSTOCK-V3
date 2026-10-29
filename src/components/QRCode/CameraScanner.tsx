import React, { useEffect, useId, useRef, useState } from 'react';

interface CameraScannerProps {
  onDecode: (text: string) => void;
}

// Lecture des QR codes et codes-barres par la caméra (smartphone, tablette) avec html5-qrcode
const CameraScanner: React.FC<CameraScannerProps> = ({ onDecode }) => {
  const regionId = `camera-${useId().replace(/:/g, '')}`;
  const [error, setError] = useState('');
  const onDecodeRef = useRef(onDecode);
  onDecodeRef.current = onDecode;

  useEffect(() => {
    let scanner: import('html5-qrcode').Html5Qrcode | null = null;
    let stopped = false;

    (async () => {
      const { Html5Qrcode } = await import('html5-qrcode');
      if (stopped) return;
      scanner = new Html5Qrcode(regionId, { verbose: false });
      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: (w, h) => ({ width: Math.min(w, h) * 0.7, height: Math.min(w, h) * 0.7 }) },
          text => onDecodeRef.current(text),
          () => undefined
        );
      } catch (e) {
        const message = String((e as Error)?.message ?? e);
        setError(/permission|NotAllowed/i.test(message)
          ? "Accès à la caméra refusé. Autorisez la caméra pour ce site dans les réglages du navigateur."
          : "Caméra indisponible sur cet appareil. Utilisez un lecteur ou saisissez le code.");
      }
    })();

    return () => {
      stopped = true;
      if (scanner?.isScanning) scanner.stop().then(() => scanner?.clear()).catch(() => undefined);
    };
  }, [regionId]);

  return (
    <div className="space-y-2">
      <div id={regionId} className="w-full overflow-hidden rounded-md bg-black aspect-square" />
      {error && <p role="alert" className="text-sm text-danger-700 dark:text-danger-300">{error}</p>}
    </div>
  );
};

export default CameraScanner;
