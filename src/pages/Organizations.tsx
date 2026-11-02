import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { errorMessage } from '../lib/requests';
import { loadPlatformData, type PlatformCompany, type PlatformModule, type PlatformUsage } from '../lib/platformConsole';
import PageTitle from '../components/common/PageTitle';
import { MxSegmented } from '../components/mx/MxSegmented';
import CompaniesSection from '../components/platform/CompaniesSection';
import ModulesSection from '../components/platform/ModulesSection';
import AuditSection from '../components/platform/AuditSection';

type Section = 'companies' | 'modules' | 'audit';

// Console de la plateforme (réservée à l'administrateur de la plateforme) : entreprises, modules payants, journal.
// Elle gère les entreprises, jamais leurs données.
const Organizations: React.FC = () => {
  const [section, setSection] = useState<Section>('companies');
  const [companies, setCompanies] = useState<PlatformCompany[]>([]);
  const [usage, setUsage] = useState<PlatformUsage[]>([]);
  const [modules, setModules] = useState<PlatformModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await loadPlatformData();
      setCompanies(data.companies); setUsage(data.usage); setModules(data.modules);
    } catch (error) {
      toast.error(errorMessage(error));
    }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const usageById = useMemo(() => new Map(usage.map(u => [u.organization_id, u])), [usage]);

  return (
    <div className="space-y-6">
      <div>
        <PageTitle>Entreprises</PageTitle>
        <p className="text-gray-600 dark:text-gray-400 mt-1 font-medium">
          Console de la plateforme : les entreprises clientes, leurs modules et le journal des actions. Chaque entreprise ne voit que ses données, et cette console n'y a pas accès. Réservé à toi (administrateur de la plateforme).
        </p>
      </div>
      <MxSegmented aria-label="Sections de la console" value={section} onChange={v => setSection(v as Section)} options={[
        { value: 'companies', label: `Entreprises (${companies.length})` },
        { value: 'modules', label: 'Modules' },
        { value: 'audit', label: 'Journal' },
      ]} />
      {loading ? (
        <p className="text-gray-500 dark:text-gray-400 font-medium">Chargement…</p>
      ) : section === 'companies' ? (
        <CompaniesSection companies={companies} usage={usageById} modules={modules} onChanged={load} onManageModules={id => { setCompanyId(id); setSection('modules'); }} />
      ) : section === 'modules' ? (
        <ModulesSection companyId={companyId} onCompanyChange={setCompanyId} companies={companies} modules={modules} onChanged={load} />
      ) : (
        <AuditSection modules={modules} />
      )}
    </div>
  );
};

export default Organizations;
