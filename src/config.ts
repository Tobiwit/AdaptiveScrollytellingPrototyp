/**
 * Which exhibition to show: the name of a folder in `content/`.
 * Change it here, or override it with VITE_EXHIBITION=<id> or ?exhibition=<id> (dev).
 */
export const DEFAULT_EXHIBITION = 'courbetorial';

export function getExhibitionId(): string {
  const fromUrl = import.meta.env.DEV ? new URLSearchParams(location.search).get('exhibition') : null;
  return fromUrl || import.meta.env.VITE_EXHIBITION || DEFAULT_EXHIBITION;
}
