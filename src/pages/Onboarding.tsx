import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, Download, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../lib/supabase';
import { errorMessage } from '../lib/requests';
import { downloadWorkbook, readSheetRows } from '../lib/excel';
import PageTitle from '../components/common/PageTitle';

interface PersonRow {
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  department: string | null;
  role: 'admin' | 'manager' | 'technician' | 'user';
  license_categories: string[];
}

const ROLE_WORDS: Record<string, PersonRow['role']> = {
  administrateur: 'admin', admin: 'admin', responsable: 'manager', manager: 'manager', chef: 'manager',
  magasinier: 'technician', magasin: 'technician', technicien: 'technician', collaborateur: 'user', ouvrier: 'user', employe: 'user',
};
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const pick = (row: Record<string, string>, ...names: string[]) => {
  const key = Object.keys(row).find(k => names.includes(fold(k)));
  return key ? row[key].trim() : '';
};

// Démarrage : les étapes pour mettre GO-Mat en service, avec l'import des personnes depuis Excel
const Onboarding: React.FC = () => {
  const { depots, users, equipment, refreshData } = useApp();
  const [orgName, setOrgName] = useState('');
  const [orgId, setOrgId] = useState('');
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    supabase.from('organizations').select('id, name').limit(1).maybeSingle().then(({ data }) => { setOrgId(data?.id ?? ''); setOrgName(data?.name ?? ''); });
    supabase.from('system_settings').select('value').eq('id', 'onboarding_done').maybeSingle().then(({ data }) => {
      try { setDone(data?.value ? JSON.parse(data.value) : {}); } catch { setDone({}); }
    });
  }, []);

  const mark = async (step: string, value: boolean) => {
    const next = { ...done, [step]: value };
    setDone(next);
    await supabase.from('system_settings').upsert({ id: 'onboarding_done', value: JSON.stringify(next), description: 'Étapes du démarrage guidé cochées' });
  };

  const saveOrg = async () => {
    const { error } = await supabase.from('organizations').update({ name: orgName.trim() }).eq('id', orgId);
    if (error) return toast.error(errorMessage(error));
    toast.success('Nom de l\'entreprise enregistré');
  };

  const template = () => downloadWorkbook([{
    name: 'Personnes',
    rows: [
      { Prénom: 'Marc', Nom: 'Dubois', 'E-mail': 'marc.dubois@exemple.ch', Téléphone: '079 000 00 00', Service: 'Chantiers', Rôle: 'Collaborateur', Permis: 'B, BE' },
      { Prénom: 'Sarah', Nom: 'Perret', 'E-mail': 'sarah.perret@exemple.ch', Téléphone: '', Service: 'Magasin', Rôle: 'Magasinier', Permis: 'B' },
    ],
    widths: [14, 16, 30, 16, 16, 16, 12],
  }], 'GO-Mat_modele_personnes.xlsx');

  const readPeople = async (file: File) => {
    try {
      const rows = await readSheetRows(file);
      const existing = new Set(users.map(u => u.email.toLowerCase()));
      const parsed = rows.map(r => {
        const email = pick(r, 'e-mail', 'email', 'mail', 'courriel').toLowerCase();
        const role = ROLE_WORDS[fold(pick(r, 'role', 'rôle', 'fonction'))] ?? 'user';
        return {
          first_name: pick(r, 'prenom', 'prénom', 'first name', 'firstname'),
          last_name: pick(r, 'nom', 'nom de famille', 'last name', 'lastname'),
          email,
          phone: pick(r, 'telephone', 'téléphone', 'tel', 'natel', 'mobile') || null,
          department: pick(r, 'service', 'departement', 'département', 'equipe', 'équipe') || null,
          role,
          license_categories: pick(r, 'permis', 'permis de conduire').toUpperCase().split(/[,;\s]+/).filter(Boolean),
        } as PersonRow;
      }).filter(p => p.first_name && p.last_name && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email) && !existing.has(p.email));
      setPeople(parsed);
      if (!parsed.length) toast.error('Aucune nouvelle personne valable (prénom, nom et e-mail requis ; les e-mails déjà présents sont ignorés)');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const importPeople = async () => {
    setImporting(true);
    const { error } = await supabase.from('users').insert(people);
    setImporting(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(`${people.length} personne(s) ajoutée(s), avec leur badge`);
    setPeople([]);
    await refreshData();
  };

  const steps: { id: string; title: string; text: string; auto?: boolean; content?: React.ReactNode; link?: [string, string] }[] = [
    {
      id: 'company', title: 'Ton entreprise', auto: Boolean(orgName && orgName !== 'Ma société'),
      text: 'Le nom apparaît sur les rapports, les bons et la page « outil trouvé ».',
      content: (
        <div className="flex flex-wrap gap-2">
          <input value={orgName} onChange={e => setOrgName(e.target.value)} aria-label="Nom de l'entreprise"
            className="flex-1 min-w-[14rem] rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100" />
          <Button variant="outline" onClick={saveOrg}>Enregistrer</Button>
        </div>
      ),
      link: ['/settings', 'Série des numéros d\'articles, logo'],
    },
    { id: 'depots', title: 'Les dépôts', auto: depots.length > 0, text: `${depots.length} dépôt(s). Ajoute chaque lieu de stockage (magasin principal, conteneur de chantier…).`, link: ['/consommables', 'Gérer les dépôts (bouton « Dépôts »)'] },
    {
      id: 'people', title: 'Les personnes', auto: users.length > 1,
      text: `${users.length} personne(s). Importe la liste depuis Excel : chaque personne reçoit son badge et pourra se connecter avec son e-mail.`,
      content: (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <Button size="sm" variant="outline" icon={<Download size={14} />} onClick={template}>Modèle Excel</Button>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <Upload size={14} aria-hidden="true" />
              <input type="file" accept=".xlsx" onChange={e => e.target.files?.[0] && readPeople(e.target.files[0])}
                className="text-sm file:mr-2 file:rounded-md file:border-0 file:bg-primary-600 file:px-3 file:py-1.5 file:text-white" />
            </label>
          </div>
          {people.length > 0 && (
            <div className="rounded-md border border-gray-200 dark:border-gray-700 p-2 space-y-2">
              <ul className="max-h-48 overflow-y-auto text-sm text-gray-800 dark:text-gray-200">
                {people.map(p => <li key={p.email}>{p.first_name} {p.last_name} · {p.email} · {p.role === 'admin' ? 'Administrateur' : p.role === 'manager' ? 'Responsable' : p.role === 'technician' ? 'Magasinier' : 'Collaborateur'}{p.license_categories.length ? ` · permis ${p.license_categories.join(', ')}` : ''}</li>)}
              </ul>
              <Button size="sm" onClick={importPeople} loading={importing}>Ajouter ces {people.length} personnes</Button>
            </div>
          )}
        </div>
      ),
      link: ['/users', 'Voir les personnes'],
    },
    { id: 'equipment', title: 'Le matériel', auto: equipment.length > 0, text: `${equipment.length} article(s). Importe la liste depuis Excel, ou crée chaque outil depuis le catalogue fournisseur.`, link: ['/equipment', 'Outils : importer ou ajouter'] },
    { id: 'bins', title: 'Les emplacements (facultatif)', text: 'Allées, étagères, bacs : la liste de préparation suit le parcours du dépôt.', link: ['/emplacements', 'Créer les emplacements'] },
    { id: 'labels', title: 'Les étiquettes', text: 'Imprime et colle une étiquette QR sur chaque outil (option « outil trouvé » recommandée).', link: ['/etiquettes', 'Imprimer les étiquettes'] },
    { id: 'badges', title: 'Les badges', text: 'Imprime les cartes, ou demande à chacun d\'ouvrir « Mon badge » sur son téléphone.', link: ['/badges', 'Imprimer les badges'] },
    { id: 'login', title: 'Connexion et e-mails', text: 'Dans Supabase : adresse du site, code dans l\'e-mail de connexion, compte d\'envoi (SMTP). Voir BACKLOG.md.', link: ['/settings', 'Destinataires des alertes'] },
    { id: 'health', title: 'Contrôle final', text: 'Vérifie les prix, seuils, permis et doublons avant d\'ouvrir aux équipes.', link: ['/donnees', 'Santé des données'] },
  ];
  const completed = steps.filter(s => s.auto || done[s.id]).length;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <PageTitle>Démarrage</PageTitle>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Mettre GO-Mat en service, étape par étape · {completed} / {steps.length} faites.</p>
      </div>
      <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={completed}>
        <div className="h-full bg-success-600" style={{ width: `${(completed / steps.length) * 100}%` }} />
      </div>
      <ol className="space-y-3">
        {steps.map((step, index) => {
          const ok = Boolean(step.auto || done[step.id]);
          return (
            <li key={step.id} className="rounded-lg bg-white dark:bg-gray-800 shadow p-4 space-y-2">
              <div className="flex items-start gap-3">
                {ok ? <CheckCircle2 size={22} className="text-tone-success shrink-0" aria-hidden="true" /> : <Circle size={22} className="text-gray-400 shrink-0" aria-hidden="true" />}
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-gray-900 dark:text-white">{index + 1}. {step.title}</h2>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{step.text}</p>
                </div>
                {!step.auto && (
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 shrink-0">
                    <input type="checkbox" checked={Boolean(done[step.id])} onChange={e => mark(step.id, e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary-600" />
                    Fait
                  </label>
                )}
              </div>
              {step.content && <div className="pl-9">{step.content}</div>}
              {step.link && <Link to={step.link[0]} className="ml-9 inline-block text-sm text-primary-700 dark:text-primary-300 underline">{step.link[1]} →</Link>}
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default Onboarding;
