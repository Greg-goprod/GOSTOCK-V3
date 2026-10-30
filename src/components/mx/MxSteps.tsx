import { Check } from 'lucide-react';

import { mxIconBox } from './internal/mxIcon';

/**
 * MxSteps — progression a etapes, telle que le bloc `steps` du handoff
 * (reference/mannyx-drawer.js, `RENDER.steps` / `.mx-dr-step*`).
 *
 * STRUCTURE SEMANTIQUE : `<ol>` dont les SEULS enfants sont des `<li>` — la
 * regle html ("ol n'a que des li pour enfants") est stricte, alors que le
 * prototype alterne `.mx-dr-step` (pastille+libelle) et `.mx-dr-step-line`
 * (connecteur) comme freres au MEME niveau, hors de toute liste. Reproduction
 * choisie : chaque `<li>` porte une etape ET son connecteur SORTANT (sauf la
 * derniere, qui n'en a pas) — le connecteur est un `<div aria-hidden="true">`
 * ENFANT du `<li>`, jamais un frere. `<ol>` reste flex-row ; chaque `<li>`
 * devient a son tour un flex-row a deux enfants (colonne pastille+libelle,
 * puis connecteur qui absorbe l'espace restant via `flex:1`). Le `<li>` lui-
 * meme grandit (`flexGrow:1`) UNIQUEMENT s'il porte un connecteur, pour que
 * l'espacement entre pastilles reste identique a la rangee plate d'origine.
 *
 * `aria-current="step"` sur le `<li>` de l'etape `active` — pas de role ARIA
 * supplementaire, `<ol>` porte deja la semantique de liste ordonnee.
 *
 * Aucune animation (decision Greg 2026-09-24) : ni sur la pastille, ni sur le
 * connecteur, contrairement a d'autres primitives du tronc.
 */

export type MxStepState = 'done' | 'active';

export interface MxStepItem {
  label: string;
  /** Absent = etape a venir, ni faite ni en cours. */
  state?: MxStepState;
}

export interface MxStepsProps {
  items: MxStepItem[];
}

export function MxSteps({ items }: MxStepsProps) {
  return (
    <ol
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 0,
        margin: 0,
        padding: 0,
        listStyle: 'none',
      }}
    >
      {items.map((item, i) => {
        const hasConnector = i < items.length - 1;
        // Le connecteur SORTANT de cette etape est en accent si CETTE etape
        // est faite — `.mx-dr-step-line[data-done]` du prototype, qui suit le
        // segment ecoule, pas l'etape suivante.
        const connectorDone = item.state === 'done';
        const toned = item.state === 'done' || item.state === 'active';

        return (
          <li
            key={i}
            aria-current={item.state === 'active' ? 'step' : undefined}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              flexGrow: hasConnector ? 1 : 0,
              flexShrink: 0,
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                // 6px : gap de `.mx-dr-step` (pastille -> libelle).
                gap: 'calc(6px * var(--mx-scale, 1))',
                flexShrink: 0,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 'var(--mx-step-dot)',
                  height: 'var(--mx-step-dot)',
                  borderRadius: 'var(--mx-radius-pill)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--mx-font-ui)',
                  fontSize: 'var(--mx-fs-step-num)',
                  fontWeight: 700,
                  // 2px FIXE : bordure de `.mx-dr-step-dot`, absente de
                  // l'echelle --mx-border-w-* (1.5px / 1px) — litteral commente,
                  // meme precedent que les ecarts de gap deja assumes dans le
                  // tronc. C'est un TRAIT : ne suit pas --mx-scale (correction
                  // C5, 2026-09-29, qui revient sur l'arbitrage C1 — meme
                  // exception que --mx-border-w/-thin et le contour de focus).
                  border: '2px solid var(--mx-border)',
                  background: 'var(--mx-surface)',
                  color: 'var(--mx-text3)',
                  ...(item.state === 'done'
                    ? {
                        background: 'var(--mx-accent-lt)',
                        borderColor: 'var(--mx-accent)',
                        color: 'var(--mx-accent)',
                      }
                    : null),
                  ...(item.state === 'active'
                    ? {
                        background: 'var(--mx-accent)',
                        borderColor: 'var(--mx-accent)',
                        color: 'var(--mx-tone-on-accent)',
                      }
                    : null),
                }}
              >
                {item.state === 'done' ? (
                  <Check style={mxIconBox('xs')} aria-hidden="true" />
                ) : (
                  i + 1
                )}
              </span>
              <span
                style={{
                  fontFamily: 'var(--mx-font-ui)',
                  fontSize: 'var(--mx-fs-step-label)',
                  fontWeight: 600,
                  color: toned ? 'var(--mx-accent)' : 'var(--mx-text3)',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.label}
              </span>
            </div>

            {hasConnector ? (
              <div
                aria-hidden="true"
                style={{
                  flex: 1,
                  // 2px FIXE : c'est un TRAIT (le connecteur entre pastilles),
                  // ne suit pas --mx-scale — meme exception que la bordure de
                  // la pastille ci-dessus (correction C5, revient sur C1).
                  height: 2,
                  background: connectorDone ? 'var(--mx-accent)' : 'var(--mx-border)',
                  // 12px : decale le connecteur au centre de la pastille
                  // (26px de haut, 6px de gap avant le libelle) — meme valeur
                  // que `.mx-dr-step-line{margin-top:12px}` du prototype.
                  marginTop: 'calc(12px * var(--mx-scale, 1))',
                  minWidth: 'calc(12px * var(--mx-scale, 1))',
                }}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export default MxSteps;
