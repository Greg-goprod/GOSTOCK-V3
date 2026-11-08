// Contrôles du temps réel PILOTE (sans réseau ni horloge réelle) : regroupement des rafales, pause pendant qu'une fiche est ouverte, rattrapage.
import { createLiveController, LIVE_TABLES } from '../../src/lib/liveReload';

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(ok ? 'OK    ' : 'ÉCHEC ', name, ok ? '' : `\n   obtenu ${JSON.stringify(got)}\n   attendu ${JSON.stringify(want)}`); };

// Horloge simulée
function fake() {
  let now = 0; let seq = 0; const jobs = new Map<number, { at: number; fn: () => void }>();
  return {
    timers: { set: (fn: () => void, ms: number) => { const id = ++seq; jobs.set(id, { at: now + ms, fn }); return id; }, clear: (h: unknown) => { jobs.delete(h as number); } },
    advance(ms: number) { const end = now + ms; for (;;) { const next = [...jobs.entries()].filter(([, j]) => j.at <= end).sort((a, b) => a[1].at - b[1].at)[0]; if (!next) break; now = next[1].at; jobs.delete(next[0]); next[1].fn(); } now = end; },
    count: () => jobs.size,
  };
}

{ const c = fake(); let n = 0; const live = createLiveController(() => { n++; }, 400, c.timers);
  live.notify(); c.advance(399); eq('rien avant le délai', n, 0); c.advance(1); eq('un rechargement au bout du délai', n, 1); }
{ const c = fake(); let n = 0; const live = createLiveController(() => { n++; }, 400, c.timers);
  live.notify(); c.advance(300); live.notify(); c.advance(300); live.notify(); c.advance(399); eq('une rafale d\'événements repousse l\'échéance', n, 0); c.advance(1); eq('et ne donne qu\'UN rechargement', n, 1); c.advance(5000); eq('aucun rechargement en plus', n, 1); }
{ const c = fake(); let n = 0; const live = createLiveController(() => { n++; }, 400, c.timers);
  live.setPaused(true); live.notify(); live.notify(); c.advance(5000); eq('en pause : aucun rechargement (la saisie n\'est pas écrasée)', n, 0);
  live.setPaused(false); c.advance(399); eq('à la reprise : rattrapage après le délai, pas avant', n, 0); c.advance(1); eq('un seul rattrapage pour plusieurs événements pendant la pause', n, 1); }
{ const c = fake(); let n = 0; const live = createLiveController(() => { n++; }, 400, c.timers);
  live.setPaused(true); live.setPaused(false); c.advance(5000); eq('pause sans événement : aucun rattrapage', n, 0); }
{ const c = fake(); let n = 0; const live = createLiveController(() => { n++; }, 400, c.timers);
  live.notify(); c.advance(200); live.setPaused(true); c.advance(5000); eq('pause pendant l\'attente : le rechargement annoncé est retenu', n, 0);
  live.setPaused(false); c.advance(400); eq('puis fait à la reprise', n, 1); }
{ const c = fake(); let n = 0; const live = createLiveController(() => { n++; }, 400, c.timers);
  live.notify(); live.dispose(); c.advance(5000); eq('après dispose : le rechargement en attente est annulé', n, 0); live.notify(); c.advance(5000); eq('et plus rien ne se déclenche', [n, c.count()], [0, 0]); }
{ const c = fake(); let n = 0; const live = createLiveController(() => { n++; }, 400, c.timers);
  live.setPaused(true); live.notify(); live.dispose(); live.setPaused(false); c.advance(5000); eq('dispose pendant une pause : pas de rattrapage fantôme', n, 0); }
{ const c = fake(); let n = 0; const live = createLiveController(() => { n++; }, 400, c.timers);
  live.setPaused(true); live.setPaused(true); live.setPaused(false); live.setPaused(false); c.advance(5000); eq('pauses répétées sans effet de bord', n, 0); }
{ const c = fake(); let n = 0; const live = createLiveController(() => { n++; }, 400, c.timers);
  live.notify(); c.advance(400); live.notify(); c.advance(400); eq('deux événements espacés : deux rechargements', n, 2); }

eq('tables suivies : celles de la publication (migration 73)', [...LIVE_TABLES], ['cp_projects', 'cp_items', 'cp_item_members', 'cp_project_members', 'cp_comments', 'cp_item_resources']);
eq('aucune table sensible suivie', LIVE_TABLES.filter(t => /budget|rates|notifications|users/.test(t)), []);

console.log(fails === 0 ? '\nTOUT VERT' : `\n${fails} ÉCHEC(S)`);
process.exit(fails === 0 ? 0 : 1);
