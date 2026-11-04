import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { MxMenu, type MxMenuAction, type MxMenuGroup } from '../mx/MxMenu';

interface Props {
  // Identifiant stable du menu et nom lu par les lecteurs d'écran
  id: string;
  menuLabel: string;
  // Texte du bouton : « Échelle : » (discret) puis la valeur choisie
  prefix?: string;
  value?: string;
  icon?: React.ReactNode;
  // Choix (un élément coché = la valeur courante) puis actions séparées
  groups?: MxMenuGroup[];
  actions?: MxMenuAction[];
  header?: React.ReactNode;
  variant?: 'secondary' | 'primary';
  // Bouton rond d'un menu « … » : pas de chevron, nom accessible obligatoire
  iconOnly?: boolean;
  ariaLabel?: string;
  // Identifiant du bouton (pour un <label htmlFor> placé à côté)
  buttonId?: string;
  disabled?: boolean;
  className?: string;
}

// Bouton qui ouvre un menu déroulant (charte Mannyx : MxMenu) : remplace les rangées de boutons et de choix toujours visibles
const MenuButton: React.FC<Props> = ({ id, menuLabel, prefix, value, icon, groups, actions, header, variant = 'secondary', iconOnly = false, ariaLabel, buttonId, disabled = false, className = '' }) => {
  const [open, setOpen] = useState(false);
  // Échap ferme le MENU et rien d'autre : sans ça, dans une fiche (drawer), la même touche fermerait aussi la fiche et ferait perdre la saisie
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);
  return (
    <MxMenu id={id} label={menuLabel} open={open} onOpenChange={setOpen} groups={groups ?? []} actions={actions} header={header}
      renderTrigger={triggerProps => (
        <button type="button" {...triggerProps} id={buttonId} disabled={disabled} aria-label={ariaLabel}
          className={`mx-btn ${variant === 'primary' ? 'mx-btn-primary' : 'mx-btn-secondary'} flex items-center justify-center gap-1.5 whitespace-nowrap text-[length:calc(12.5px*var(--mx-scale,1))] px-2.5 py-1 min-h-[44px] min-w-[44px] lg:min-h-[28px] lg:min-w-0 ${className}`}>
          {icon && <span aria-hidden="true">{icon}</span>}
          {prefix && <span className="opacity-70">{prefix}</span>}
          {value && <span>{value}</span>}
          {!iconOnly && <ChevronDown size={14} aria-hidden="true" />}
        </button>
      )} />
  );
};

export default MenuButton;
