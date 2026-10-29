import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

interface ColorUsage {
  color: string;
  usedBy: {
    type: 'category' | 'group' | 'subgroup' | 'department' | 'status' | 'maintenance';
    name: string;
  }[];
}

// Palette de couleurs étendue avec plus de choix
const colors = [
  // Rouges
  '#ef4444', // danger-500
  '#dc2626', // danger-600
  '#b91c1c', // danger-700
  
  // Oranges
  '#f97316', // warning-500
  '#ea580c', // warning-600
  '#c2410c', // warning-700
  
  // Ambre
  '#f59e0b', // warning-500
  '#d97706', // warning-600
  '#b45309', // warning-700
  
  // Jaunes
  '#eab308', // warning-500
  '#ca8a04', // warning-600
  '#a16207', // warning-700
  
  // Verts
  '#84cc16', // lime-500
  '#65a30d', // lime-600
  '#4d7c0f', // lime-700
  
  // Émeraudes
  '#10b981', // success-500
  '#059669', // success-600
  '#047857', // success-700
  
  // Cyans
  '#06b6d4', // cyan-500
  '#0891b2', // cyan-600
  '#0e7490', // cyan-700
  
  // Bleus
  '#3b82f6', // primary-500
  '#2563eb', // primary-600
  '#1d4ed8', // primary-700
  
  // Indigos
  '#6366f1', // primary-500
  '#4f46e5', // primary-600
  '#4338ca', // primary-700
  
  // Violets
  '#8b5cf6', // primary-500
  '#7c3aed', // primary-600
  '#6d28d9', // primary-700
  
  // Fuchsias
  '#d946ef', // fuchsia-500
  '#c026d3', // fuchsia-600
  '#a21caf', // fuchsia-700
  
  // Roses
  '#ec4899', // pink-500
  '#db2777', // pink-600
  '#be185d', // pink-700
  
  // Gris
  '#6b7280', // gray-500
  '#4b5563', // gray-600
  '#374151', // gray-700
  
  // Ardoises
  '#64748b', // slate-500
  '#475569', // slate-600
  '#334155', // slate-700
  
  // Noir et blanc
  '#000000', // black
  '#ffffff', // white
];

const ColorPicker: React.FC<ColorPickerProps> = ({ color, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [colorUsage, setColorUsage] = useState<ColorUsage[]>([]);
  const [hoveredColor, setHoveredColor] = useState<string | null>(null);
  const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        buttonRef.current && 
        !buttonRef.current.contains(event.target as Node) &&
        pickerRef.current && 
        !pickerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      updatePickerPosition();
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const updatePickerPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPickerPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchColorUsage();
    }
  }, [isOpen]);

  const fetchColorUsage = async () => {
    try {
      // Récupérer les utilisations de couleurs dans différentes tables
      const [categoriesRes, groupsRes, subgroupsRes, departmentsRes, statusRes, maintenanceRes] = await Promise.all([
        supabase.from('categories').select('name, color'),
        supabase.from('equipment_groups').select('name, color'),
        supabase.from('equipment_subgroups').select('name, color'),
        supabase.from('departments').select('name, color'),
        supabase.from('status_configs').select('name, color'),
        supabase.from('maintenance_types').select('name, color')
      ]);

      // Créer un mapping des couleurs et de leurs utilisations
      const usageMap = new Map<string, ColorUsage['usedBy']>();

      // Ajouter les catégories
      if (categoriesRes.data) {
        categoriesRes.data.forEach(cat => {
          if (!cat.color) return;
          const existing = usageMap.get(cat.color) || [];
          usageMap.set(cat.color, [...existing, { type: 'category', name: cat.name }]);
        });
      }

      // Ajouter les groupes
      if (groupsRes.data) {
        groupsRes.data.forEach(group => {
          if (!group.color) return;
          const existing = usageMap.get(group.color) || [];
          usageMap.set(group.color, [...existing, { type: 'group', name: group.name }]);
        });
      }

      // Ajouter les sous-groupes
      if (subgroupsRes.data) {
        subgroupsRes.data.forEach(subgroup => {
          if (!subgroup.color) return;
          const existing = usageMap.get(subgroup.color) || [];
          usageMap.set(subgroup.color, [...existing, { type: 'subgroup', name: subgroup.name }]);
        });
      }

      // Ajouter les départements
      if (departmentsRes.data) {
        departmentsRes.data.forEach(dept => {
          if (!dept.color) return;
          const existing = usageMap.get(dept.color) || [];
          usageMap.set(dept.color, [...existing, { type: 'department', name: dept.name }]);
        });
      }

      // Ajouter les statuts
      if (statusRes.data) {
        statusRes.data.forEach(status => {
          if (!status.color) return;
          const existing = usageMap.get(status.color) || [];
          usageMap.set(status.color, [...existing, { type: 'status', name: status.name }]);
        });
      }

      // Ajouter les types de maintenance
      if (maintenanceRes.data) {
        maintenanceRes.data.forEach(maint => {
          if (!maint.color) return;
          const existing = usageMap.get(maint.color) || [];
          usageMap.set(maint.color, [...existing, { type: 'maintenance', name: maint.name }]);
        });
      }

      // Convertir le Map en tableau pour l'état
      const colorUsageArray: ColorUsage[] = [];
      usageMap.forEach((usedBy, color) => {
        colorUsageArray.push({ color, usedBy });
      });

      setColorUsage(colorUsageArray);
    } catch (error) {
      console.error('Error fetching color usage:', error);
    }
  };

  const getColorUsage = (color: string) => {
    const usage = colorUsage.find(u => u.color.toLowerCase() === color.toLowerCase());
    return usage?.usedBy || [];
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'category': return 'Catégorie';
      case 'group': return 'Groupe';
      case 'subgroup': return 'Sous-groupe';
      case 'department': return 'Département';
      case 'status': return 'Statut';
      case 'maintenance': return 'Type de maintenance';
      default: return type;
    }
  };

  const ColorPickerContent = () => (
    <div 
      ref={pickerRef}
      className="fixed bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-3 flex flex-wrap gap-2 color-picker-portal"
      style={{ 
        top: pickerPosition.top,
        left: pickerPosition.left,
        width: '400px',
        maxWidth: '90vw',
        zIndex: 999999
      }}
    >
      {colors.map((c) => {
        const usage = getColorUsage(c);
        const isUsed = usage.length > 0;
        
        return (
          <div 
            key={c} 
            className="relative"
            onMouseEnter={() => setHoveredColor(c)}
            onMouseLeave={() => setHoveredColor(null)}
          >
            <button
              className={`w-8 h-8 rounded-full flex items-center justify-center hover:scale-110 transition-transform relative ${isUsed ? 'ring-2 ring-offset-2 ring-gray-300 dark:ring-gray-600' : ''}`}
              style={{ backgroundColor: c }}
              onClick={(e) => {
                e.stopPropagation(); // Empêcher la propagation de l'événement
                onChange(c);
                setIsOpen(false);
              }}
              aria-label={`Couleur ${c}`}
            >
              {color === c && <Check className="text-white drop-shadow-md" size={16} />}
            </button>
            
            {/* Tooltip pour les couleurs utilisées */}
            {hoveredColor === c && usage.length > 0 && (
              <div 
                className="absolute left-1/2 transform -translate-x-1/2 bottom-full mb-2 w-48 bg-white dark:bg-gray-900 shadow-lg rounded-lg p-2 text-xs"
                style={{ zIndex: 1000000 }}
              >
                <div className="font-bold text-gray-800 dark:text-white mb-1 flex items-center gap-1">
                  <Info size={12} />
                  Utilisée par:
                </div>
                <ul className="space-y-1">
                  {usage.map((item, index) => (
                    <li key={index} className="text-gray-600 dark:text-gray-300 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c }}></span>
                      <span className="font-medium">{getTypeLabel(item.type)}:</span> {item.name}
                    </li>
                  ))}
                </ul>
                <div className="absolute left-1/2 transform -translate-x-1/2 -bottom-1 w-2 h-2 rotate-45 bg-white dark:bg-gray-900"></div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        className="w-8 h-8 rounded-full border border-gray-300 dark:border-gray-600 shadow-sm"
        style={{ backgroundColor: color }}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        aria-label="Choisir une couleur"
      />

      {isOpen && createPortal(<ColorPickerContent />, document.body)}
    </div>
  );
};

export default ColorPicker;