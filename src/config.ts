// Folder in content/. Override with VITE_EXHIBITION or ?exhibition= (dev).
export const DEFAULT_EXHIBITION = 'courbetorial';

export function getExhibitionId(): string {
  const fromUrl = import.meta.env.DEV ? new URLSearchParams(location.search).get('exhibition') : null;
  return fromUrl || import.meta.env.VITE_EXHIBITION || DEFAULT_EXHIBITION;
}
