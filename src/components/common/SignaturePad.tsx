import React, { useEffect, useRef, useState } from 'react';

interface SignaturePadProps {
  label: string;
  onChange: (dataUrl: string | null) => void;
}

// Signature au doigt ou à la souris ; renvoie une image PNG (data URL), ou null si vide
const SignaturePad: React.FC<SignaturePadProps> = ({ label, onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Résolution réelle de l'écran pour un trait net
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#101018';
  }, []);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    const { x, y } = point(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = point(event);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    setEmpty(false);
    onChange(canvasRef.current?.toDataURL('image/png') ?? null);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
    onChange(null);
  };

  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        {!empty && (
          <button type="button" onClick={clear} className="text-sm text-primary-700 dark:text-primary-300 hover:underline min-h-[44px] lg:min-h-0">
            Effacer
          </button>
        )}
      </div>
      {/* Fond blanc dans les deux thèmes : la signature est imprimée sur le bon */}
      <canvas
        ref={canvasRef}
        aria-label={label}
        className="w-full h-32 rounded-md border border-dashed border-gray-400 bg-white touch-none cursor-crosshair"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      {empty && <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">Signe dans le cadre avec le doigt ou la souris.</p>}
    </div>
  );
};

export default SignaturePad;
