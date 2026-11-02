import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarClock, Layers, MapPin, Truck, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { loadOpenSites, loadPlanningRights, loadSitePlanning, planningError, type PlanContractor, type PlanPhase, type PlanTeam, type PlanZone, type PlanSite, type PlanningRights, type SitePlanningData } from '../lib/sitePlanning';
import { formatDay } from '../lib/zurichTime';
import PageTitle from '../components/common/PageTitle';
import { MxBadge } from '../components/mx/MxBadge';
import { MxEmpty } from '../components/mx/MxEmpty';
import { MxSegmented } from '../components/mx/MxSegmented';
import { CrudSection } from '../components/sitePlanning/CrudSection';
import ConfigSection from '../components/sitePlanning/ConfigSection';
import InterventionsSection from '../components/sitePlanning/InterventionsSection';

type Section = 'interventions' | 'zones' | 'teams' | 'contractors' | 'phases' | 'settings';

const NO_RIGHTS: PlanningRights = { create: false, update: false, delete: false };
const Dot = ({ color }: { color: string }) => <span aria-hidden className="inline-block h-3 w-3 rounded-full align-middle" style={{ background: color }} />;

// Planning de chantier (module payant) : réglages, zones, équipes, prestataires, phases et interventions d'un chantier
const SitePlanning: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [sites, setSites] = useState<PlanSite[] | null>(null);
  const [data, setData] = useState<SitePlanningData | null>(null);
  const [rights, setRights] = useState<PlanningRights>(NO_RIGHTS);
  const [section, setSection] = useState<Section>('interventions');

  const siteId = params.get('site') ?? '';
  const site = sites?.find(s => s.id === siteId) ?? null;

  useEffect(() => {
    void loadOpenSites().then(setSites).catch(e => { toast.error(planningError(e)); setSites([]); });
    void loadPlanningRights().then(setRights);
  }, []);

  // Sans chantier choisi : le premier chantier ouvert
  useEffect(() => {
    if (!sites || siteId || sites.length === 0) return;
    const first = sites.find(s => s.status === 'open') ?? sites[0];
    setParams({ site: first.id }, { replace: true });
  }, [sites, siteId, setParams]);

  const reload = useCallback(async () => {
    if (!siteId) return;
    try { setData(await loadSitePlanning(siteId)); } catch (e) { toast.error(planningError(e)); }
  }, [siteId]);
  useEffect(() => { setData(null); void reload(); }, [reload]);

  const contractorOptions = useMemo(() => (data?.contractors || []).filter(c => c.active).map(c => ({ value: c.id, label: c.name })), [data]);
  const locked = site?.status === 'closed';

  if (sites === null) return <p className="text-gray-500 dark:text-gray-400 font-medium">Chargement…</p>;

  return (
    <div className="space-y-6">
      <div>
        <PageTitle>Planning de chantier</PageTitle>
        <p className="text-gray-600 dark:text-gray-400 mt-1 font-medium">
          Qui intervient où et quand sur un chantier : zones, équipes, prestataires, phases et interventions. Les horaires, la période du chantier et les chevauchements d'équipe sont contrôlés pour toi.
        </p>
      </div>

      {sites.length === 0 ? (
        <MxEmpty icon={CalendarClock} title="Aucun chantier" description="Crée d'abord un chantier dans Chantiers : son planning se prépare ici." />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Chantier
              <select value={siteId} onChange={e => setParams({ site: e.target.value })}
                className="mt-1 block min-w-64 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                {sites.map(s => <option key={s.id} value={s.id}>{s.status === 'closed' ? `${s.name} (clôturé)` : s.name}</option>)}
              </select>
            </label>
            {site && <span className="pb-2 text-sm text-gray-600 dark:text-gray-400">{`Période : du ${formatDay(site.start_on)} au ${formatDay(site.end_on)}`}</span>}
            {locked && <MxBadge tone="neutral">Clôturé : lecture seule</MxBadge>}
          </div>

          {!site || !data ? (
            <p className="text-gray-500 dark:text-gray-400 font-medium">Chargement…</p>
          ) : (
            <>
              <MxSegmented aria-label="Sections du planning" value={section} onChange={v => setSection(v as Section)} options={[
                { value: 'interventions', label: `Interventions (${data.interventions.length})` },
                { value: 'zones', label: `Zones (${data.zones.length})` },
                { value: 'teams', label: `Équipes (${data.teams.length})` },
                { value: 'contractors', label: `Prestataires (${data.contractors.length})` },
                { value: 'phases', label: `Phases (${data.phases.length})` },
                { value: 'settings', label: 'Réglages' },
              ]} />

              {section === 'interventions' && <InterventionsSection site={site} data={data} rights={rights} locked={!!locked} onChanged={reload} />}
              {section === 'zones' && (
                <CrudSection<PlanZone>
                  title="Zones" addLabel="Nouvelle zone" table="site_zones" baseValues={{ site_id: site.id }} rights={rights} locked={locked} onChanged={reload}
                  rows={data.zones} emptyIcon={MapPin} emptyTitle="Aucune zone" emptyText="Une zone est un lieu du chantier (scène, parking, accueil…)."
                  deleteMessage={r => `Supprimer la zone « ${r.name} » ?`}
                  fields={[{ key: 'name', label: 'Nom de la zone', type: 'text', required: true }, { key: 'color', label: 'Couleur', type: 'color' }]}
                  columns={[{ id: 'name', label: 'Zone', render: r => <span className="inline-flex items-center gap-2 font-medium"><Dot color={r.color} />{r.name}</span> }]}
                />
              )}
              {section === 'teams' && (
                <CrudSection<PlanTeam>
                  title="Équipes" addLabel="Nouvelle équipe" table="site_teams" baseValues={{ site_id: site.id }} rights={rights} locked={locked} onChanged={reload}
                  rows={data.teams} emptyIcon={Users} emptyTitle="Aucune équipe" emptyText="Une équipe est un groupe qui intervient ensemble, interne ou rattaché à un prestataire."
                  deleteMessage={r => `Supprimer l'équipe « ${r.name} » ?`}
                  fields={[
                    { key: 'name', label: "Nom de l'équipe", type: 'text', required: true },
                    { key: 'contractor_id', label: 'Prestataire (vide = équipe interne)', type: 'select', options: contractorOptions },
                    { key: 'color', label: 'Couleur', type: 'color' },
                  ]}
                  columns={[
                    { id: 'name', label: 'Équipe', render: r => <span className="inline-flex items-center gap-2 font-medium"><Dot color={r.color} />{r.name}</span> },
                    { id: 'contractor', label: 'Prestataire', render: r => data.contractors.find(c => c.id === r.contractor_id)?.name ?? 'Équipe interne' },
                  ]}
                />
              )}
              {section === 'contractors' && (
                <CrudSection<PlanContractor>
                  title="Prestataires" addLabel="Nouveau prestataire" table="contractors" rights={rights} locked={locked} onChanged={reload}
                  rows={data.contractors} emptyIcon={Truck} emptyTitle="Aucun prestataire" emptyText="Les sociétés externes qui interviennent (scène, son, lumière, traiteur…). Ils servent pour tous tes chantiers."
                  deleteMessage={r => `Supprimer le prestataire « ${r.name} » ? Ses équipes deviennent des équipes internes.`}
                  fields={[
                    { key: 'name', label: 'Société', type: 'text', required: true },
                    { key: 'contact_name', label: 'Personne de contact', type: 'text' },
                    { key: 'email', label: 'E-mail', type: 'text' },
                    { key: 'phone', label: 'Téléphone', type: 'text' },
                    { key: 'notes', label: 'Remarques', type: 'textarea' },
                    { key: 'active', label: 'Actif (proposé pour de nouvelles équipes)', type: 'checkbox' },
                  ]}
                  columns={[
                    { id: 'name', label: 'Société', render: r => <span className="font-medium">{r.name}</span> },
                    { id: 'contact', label: 'Contact', hideOnMobile: true, render: r => [r.contact_name, r.phone, r.email].filter(Boolean).join(' · ') || '—' },
                    { id: 'active', label: 'État', render: r => (r.active ? <MxBadge tone="success">Actif</MxBadge> : <MxBadge tone="neutral">Inactif</MxBadge>) },
                  ]}
                />
              )}
              {section === 'phases' && (
                <CrudSection<PlanPhase>
                  title="Phases" addLabel="Nouvelle phase" table="site_phases" baseValues={{ site_id: site.id }} rights={rights} locked={locked} onChanged={reload}
                  rows={data.phases} emptyIcon={Layers} emptyTitle="Aucune phase" emptyText="Les grandes étapes du chantier (montage, exploitation, démontage)."
                  deleteMessage={r => `Supprimer la phase « ${r.name} » ? Ses interventions n'ont plus de phase.`}
                  fields={[
                    { key: 'name', label: 'Nom de la phase', type: 'text', required: true },
                    { key: 'start_on', label: 'Début', type: 'date' },
                    { key: 'end_on', label: 'Fin', type: 'date' },
                    { key: 'color', label: 'Couleur', type: 'color' },
                  ]}
                  columns={[
                    { id: 'name', label: 'Phase', render: r => <span className="inline-flex items-center gap-2 font-medium"><Dot color={r.color} />{r.name}</span> },
                    { id: 'period', label: 'Période', render: r => (r.start_on || r.end_on ? `${formatDay(r.start_on)} → ${formatDay(r.end_on)}` : '—') },
                  ]}
                />
              )}
              {section === 'settings' && <ConfigSection site={site} data={data} rights={rights} locked={!!locked} onChanged={reload} />}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default SitePlanning;
