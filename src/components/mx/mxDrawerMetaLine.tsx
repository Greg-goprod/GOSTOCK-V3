import type { ReactNode } from 'react';

export type MxDrawerMetaSegment = string | number | null | undefined | false;

/** Segments affichés dans `meta`, séparés par « · », sans icône (modèle drawer). */
export function mxDrawerMetaSegments(...parts: MxDrawerMetaSegment[]): string[] {
  return parts
    .filter((p) => p !== null && p !== undefined && p !== false && String(p).trim() !== '')
    .map((p) => String(p).trim());
}

export function mxDrawerMetaLine(...parts: MxDrawerMetaSegment[]): ReactNode {
  const segments = mxDrawerMetaSegments(...parts);
  if (segments.length === 0) return null;
  return <span>{segments.join(' · ')}</span>;
}
