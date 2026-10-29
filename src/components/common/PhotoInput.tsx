import React, { useEffect, useId, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { fileUrl, uploadFile } from '../../lib/files';
import { errorMessage } from '../../lib/requests';

interface PhotoInputProps {
  folder: string;
  value: string[];
  onChange: (paths: string[]) => void;
  label?: string;
  // Accepte aussi les PDF (procès-verbal de contrôle)
  allowPdf?: boolean;
  max?: number;
}

// Photos prises avec le téléphone (ou fichiers), envoyées tout de suite dans le stockage privé
const PhotoInput: React.FC<PhotoInputProps> = ({ folder, value, onChange, label = 'Photos', allowPdf = false, max = 6 }) => {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    value.filter(p => !previews[p]).forEach(async path => {
      const url = await fileUrl(path);
      if (url) setPreviews(prev => ({ ...prev, [path]: url }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, Math.max(0, max - value.length));
    setUploading(n => n + list.length);
    const added: string[] = [];
    for (const file of list) {
      try {
        added.push(await uploadFile(file, folder));
      } catch (error) {
        toast.error(`Envoi impossible (${file.name}) : ${errorMessage(error)}`);
      } finally {
        setUploading(n => n - 1);
      }
    }
    if (added.length) onChange([...value, ...added]);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</span>
      <div className="flex flex-wrap gap-2 items-center">
        {value.map(path => (
          <div key={path} className="relative h-16 w-16 rounded-md overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700">
            {path.endsWith('.pdf') ? (
              <a href={previews[path]} target="_blank" rel="noreferrer" className="flex h-full items-center justify-center text-xs font-semibold text-gray-700 dark:text-gray-200">PDF</a>
            ) : previews[path] ? (
              <a href={previews[path]} target="_blank" rel="noreferrer"><img src={previews[path]} alt="" className="h-full w-full object-cover" /></a>
            ) : null}
            <button
              type="button"
              onClick={() => onChange(value.filter(p => p !== path))}
              aria-label="Retirer ce fichier"
              className="absolute top-0.5 right-0.5 rounded-full bg-black/60 text-white p-0.5"
            >
              <X size={12} aria-hidden="true" />
            </button>
          </div>
        ))}
        {value.length < max && (
          <label
            htmlFor={inputId}
            className="h-16 min-w-16 px-3 rounded-md border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center gap-1 text-xs text-gray-600 dark:text-gray-300 cursor-pointer hover:border-primary-400"
          >
            <Camera size={16} aria-hidden="true" /> {uploading ? 'Envoi…' : 'Ajouter'}
          </label>
        )}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={allowPdf ? 'image/*,application/pdf' : 'image/*'}
          capture={allowPdf ? undefined : 'environment'}
          multiple
          className="sr-only"
          onChange={e => add(e.target.files)}
        />
      </div>
    </div>
  );
};

export default PhotoInput;
