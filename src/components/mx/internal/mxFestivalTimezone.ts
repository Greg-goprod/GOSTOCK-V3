/**
 * mxFestivalTimezone — interne au tronc, HORS BARREL (voir index.ts).
 *
 * LOT PICKERS-MX, S2. `MxDateTimePicker` combine une DATE et une HEURE lues
 * sur deux cadrans distincts en un seul instant (`Date`) — consigne de Greg :
 * « fuseau horaire du festival (Europe/Zurich par défaut, ou celui de
 * l'événement), jamais d'heure UTC implicite ». Les fonctions ci-dessous
 * convertissent explicitement entre une heure MURALE (wall-clock, « 19:30 a
 * Montreux ») et l'instant UTC qu'elle represente, QUEL QUE SOIT le fuseau du
 * navigateur qui execute le code — contrairement a `new Date(y,m,d,h,min)`
 * (legacy `DateTimePickerAura`), qui suppose implicitement que le fuseau
 * LOCAL du navigateur est celui du festival (vrai aujourd'hui par coincidence
 * — tout tourne en Suisse — mais faux pour un acces depuis un autre fuseau,
 * exactement l'anti-patron releve au diagnostic S4).
 *
 * Verification en base (LOT PICKERS-MX, S0) : AUCUNE colonne de fuseau
 * horaire par evenement n'existe aujourd'hui (`events` n'a pas de colonne
 * `timezone`) — la constante ci-dessous est donc la SEULE source utilisee
 * tant qu'un tel champ n'est pas ajoute.
 */
export const MX_DEFAULT_FESTIVAL_TIMEZONE = 'Europe/Zurich';

interface MxWallClockParts {
  year: number;
  month: number; // 0-11
  day: number;
  hours: number;
  minutes: number;
}

function partsOf(date: Date, timeZone: string): MxWallClockParts {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const found = dtf.formatToParts(date);
  const get = (type: string) => Number(found.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month') - 1,
    day: get('day'),
    hours: get('hour'),
    minutes: get('minute'),
  };
}

/**
 * Heure murale -> instant UTC. Correction en un passage (ecart de fuseau,
 * recalcule une fois) : suffisant hors de la minute exacte d'un changement
 * heure ete/hiver, cas non pertinent pour une heure de prestation saisie a la
 * minute pres.
 */
export function mxZonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  timeZone: string = MX_DEFAULT_FESTIVAL_TIMEZONE,
): Date {
  const guess = new Date(Date.UTC(year, month, day, hours, minutes, 0, 0));
  const read = partsOf(guess, timeZone);
  const asUtcOfRead = Date.UTC(read.year, read.month, read.day, read.hours, read.minutes, 0, 0);
  const offsetMs = asUtcOfRead - guess.getTime();
  return new Date(guess.getTime() - offsetMs);
}

/** Instant UTC -> heure murale dans le fuseau donné (pour ré-afficher/éditer une valeur existante). */
export function mxZonedWallTimeFromUtc(date: Date, timeZone: string = MX_DEFAULT_FESTIVAL_TIMEZONE): MxWallClockParts {
  return partsOf(date, timeZone);
}
