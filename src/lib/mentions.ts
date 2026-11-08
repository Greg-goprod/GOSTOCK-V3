// Mentions « @Prénom Nom » dans la discussion (sans affichage). C'est la BASE qui décide qui est mentionné, en lisant le texte (migration 73) ;
// ce module aide à les écrire (suggestions) et à les montrer (surlignage). Même règle de bordure que la base : un nom est mentionné s'il suit
// un « @ » qui n'est pas collé à une lettre ou un chiffre, et s'il n'est pas suivi d'une lettre, d'un chiffre, d'un « _ » ou d'un « - ».
export interface Person { id: string; name: string }

const isAlnum = (ch: string | undefined) => !!ch && /[\p{L}\p{N}]/u.test(ch);
const endsWord = (ch: string | undefined) => isAlnum(ch) || ch === '_' || ch === '-';
export const MENTION_QUERY_MAX = 40;

// Mention en cours de frappe : le dernier « @ » avant le curseur, valable s'il n'est pas collé à une lettre et si le texte tapé depuis (nom en cours,
// espaces permis) tient sur une ligne et reste court. Renvoie l'index du « @ » et ce qui a été tapé après.
export function mentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf('@');
  if (at < 0) return null;
  if (isAlnum(before[at - 1])) return null;
  const query = before.slice(at + 1);
  if (query.length > MENTION_QUERY_MAX || /[\n\r]/.test(query)) return null;
  // Plus de deux mots tapés : ce n'est plus un nom
  if (query.trim().split(/\s+/).filter(Boolean).length > 2 || /\s{2,}/.test(query)) return null;
  return { start: at, query };
}

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Personnes qui correspondent à ce qui est tapé (début du prénom, du nom ou du nom complet ; accents et casse indifférents), au plus `max`
export function suggestPeople(people: Person[], query: string, max = 6): Person[] {
  const q = norm(query).trim();
  const list = people.filter(p => p.name.trim() !== '');
  const rank = (p: Person) => {
    const n = norm(p.name);
    if (q === '') return 3;
    if (n.startsWith(q)) return 0;
    if (n.split(' ').some(w => w.startsWith(q))) return 1;
    return n.includes(q) ? 2 : -1;
  };
  return list.map(p => ({ p, r: rank(p) })).filter(x => x.r >= 0).sort((a, b) => a.r - b.r || a.p.name.localeCompare(b.p.name, 'fr')).slice(0, max).map(x => x.p);
}

// Remplace « @début » par « @Prénom Nom » suivi d'une espace ; renvoie le nouveau texte et la place du curseur
export function insertMention(text: string, start: number, caret: number, name: string): { text: string; caret: number } {
  const inserted = `@${name} `;
  return { text: text.slice(0, start) + inserted + text.slice(caret), caret: start + inserted.length };
}

export interface Segment { text: string; mention: boolean }

// Découpe un message pour surligner les mentions (seulement celles des personnes dont l'identifiant est dans `mentioned`, c'est-à-dire celles que la base a retenues)
export function splitMentions(body: string, people: Person[], mentioned: string[]): Segment[] {
  const names = people.filter(p => mentioned.includes(p.id) && p.name.trim() !== '').map(p => p.name.trim()).sort((a, b) => b.length - a.length);
  if (names.length === 0 || !body.includes('@')) return [{ text: body, mention: false }];
  const out: Segment[] = [];
  let plain = '';
  let i = 0;
  while (i < body.length) {
    if (body[i] === '@' && !isAlnum(body[i - 1])) {
      const hit = names.find(n => body.slice(i + 1, i + 1 + n.length).toLowerCase() === n.toLowerCase() && !endsWord(body[i + 1 + n.length]));
      if (hit) {
        if (plain) { out.push({ text: plain, mention: false }); plain = ''; }
        out.push({ text: body.slice(i, i + 1 + hit.length), mention: true });
        i += 1 + hit.length;
        continue;
      }
    }
    plain += body[i];
    i++;
  }
  if (plain) out.push({ text: plain, mention: false });
  return out;
}
