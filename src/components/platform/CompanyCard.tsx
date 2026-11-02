import { Building2, Power, PowerOff, SlidersHorizontal } from 'lucide-react';
import { formatBytes, formatDateTime, type PlatformCompany, type PlatformModule, type PlatformUsage } from '../../lib/platformConsole';
import { MxBadge } from '../mx/MxBadge';
import Button from '../common/Button';

interface Props {
  company: PlatformCompany;
  usage?: PlatformUsage;
  modules: PlatformModule[];
  onToggleActive: () => void;
  onManageModules: () => void;
}

const Figure = ({ label, value }: { label: string; value: string | number }) => (
  <div style={{ minWidth: 0 }}>
    <dt style={{ fontSize: 'calc(11px * var(--mx-scale, 1))', color: 'var(--mx-text3)' }}>{label}</dt>
    <dd style={{ margin: 0, fontSize: 'calc(14px * var(--mx-scale, 1))', fontWeight: 600, overflowWrap: 'anywhere' }}>{value}</dd>
  </div>
);

/**
 * Carte d'une entreprise cliente pour la console : nom et état, chiffres d'usage lisibles en entier, modules, actions.
 * (La carte d'entité des pages de personnes tronque ses lignes : elle ne convient pas à des chiffres.)
 */
export function CompanyCard({ company, usage, modules, onToggleActive, onManageModules }: Props) {
  const label = (key: string) => modules.find(m => m.key === key)?.label ?? key;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 'var(--mx-space-12)', minWidth: 0, width: '100%', padding: 'var(--mx-space-12)',
      background: 'var(--mx-surface2)', border: 'var(--mx-border-w) solid var(--mx-border)', borderRadius: 'var(--mx-radius-8)',
      opacity: company.active ? 1 : 0.85,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--mx-space-8)' }}>
        <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, flexShrink: 0, borderRadius: '50%', background: 'var(--mx-tone-fill-accent)', color: 'var(--mx-tone-on-accent)' }}>
          <Building2 size={16} />
        </span>
        <h3 style={{ margin: 0, flex: 1, minWidth: 0, fontSize: 'calc(15px * var(--mx-scale, 1))', fontWeight: 700, overflowWrap: 'anywhere' }}>{company.name}</h3>
        {company.active ? <MxBadge tone="success">Active</MxBadge> : <MxBadge tone="danger">Suspendue</MxBadge>}
      </div>
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--mx-space-8)' }}>
        <Figure label="Personnes" value={`${usage?.people_active ?? company.people} (${company.admins} adm.)`} />
        <Figure label="Dernière connexion" value={formatDateTime(usage?.last_sign_in ?? null)} />
        <Figure label="Articles" value={usage?.equipment ?? 0} />
        <Figure label="Sorties (30 j)" value={usage?.checkouts_30d ?? 0} />
        <Figure label="Stockage" value={formatBytes(usage?.storage_bytes ?? 0)} />
      </dl>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--mx-space-4)' }} aria-label="Modules activés">
        {company.modules.length === 0
          ? <span style={{ fontSize: 'calc(12px * var(--mx-scale, 1))', color: 'var(--mx-text3)' }}>Aucun module activé</span>
          : company.modules.map(k => <MxBadge key={k} tone="info">{label(k)}</MxBadge>)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--mx-space-8)', marginTop: 'auto' }}>
        <Button size="sm" variant="outline" icon={<SlidersHorizontal size={14} />} onClick={onManageModules}>Gérer les modules</Button>
        <Button size="sm" variant={company.active ? 'outline' : 'primary'} icon={company.active ? <PowerOff size={14} /> : <Power size={14} />} onClick={onToggleActive}>
          {company.active ? 'Suspendre' : 'Réactiver'}
        </Button>
      </div>
    </div>
  );
}
