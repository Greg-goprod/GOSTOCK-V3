import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode } from 'lucide-react';
import { badgeValue } from '../../lib/badges';

interface BadgeCardProps {
  firstName: string;
  lastName: string;
  roleLabel: string;
  department?: string | null;
  code: string;
  logoUrl?: string;
}

// Carte au format carte bancaire (85,6 × 54 mm), lisible à l'impression comme à l'écran
const BadgeCard: React.FC<BadgeCardProps> = ({ firstName, lastName, roleLabel, department, code, logoUrl }) => (
  <div
    className="badge-card bg-white text-gray-900 rounded-lg border border-gray-300 flex overflow-hidden"
    style={{ width: '85.6mm', height: '54mm' }}
  >
    <div className="flex flex-col justify-between p-[4mm] flex-1 min-w-0">
      <div className="flex items-center gap-1.5 text-primary-700 font-black text-sm">
        {logoUrl ? <img src={logoUrl} alt="" className="max-h-[7mm] max-w-[30mm] object-contain" /> : <><QrCode size={14} aria-hidden="true" /> GO-Mat</>}
      </div>
      <div className="min-w-0">
        <p className="text-base font-bold leading-tight break-words">{firstName}</p>
        <p className="text-base font-bold leading-tight break-words uppercase">{lastName}</p>
        <p className="mt-1 text-[9pt] text-gray-600 leading-tight">{roleLabel}{department ? ` · ${department}` : ''}</p>
      </div>
      <p className="text-[6.5pt] text-gray-500">Badge personnel · à présenter au magasin</p>
    </div>
    <div className="flex items-center justify-center p-[3mm] bg-white">
      <QRCodeSVG value={badgeValue(code)} size={150} level="M" style={{ width: '34mm', height: '34mm' }} />
    </div>
  </div>
);

export default BadgeCard;
