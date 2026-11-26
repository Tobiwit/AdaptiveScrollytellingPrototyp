import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Work } from '../schema/schema';
import { useSignalTracker } from '../signals/SignalsContext';
import styles from './Lightbox.module.css';

type Open = (work: Work, unitId: string | null) => void;
const Ctx = createContext<Open | null>(null);

export function LightboxProvider({ children }: { children: ReactNode }) {
  const tracker = useSignalTracker();
  const [shown, setShown] = useState<Work | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const open = useCallback<Open>(
    (work, unitId) => {
      setShown(work);
      if (unitId) tracker.openImage(unitId);
    },
    [tracker],
  );
  const close = useCallback(() => {
    tracker.closeImage();
    setShown(null);
  }, [tracker]);

  useEffect(() => {
    if (!shown) return;
    const back = document.activeElement as HTMLElement | null;
    const root = document.documentElement;
    root.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    addEventListener('keydown', onKey);
    return () => {
      root.style.overflow = '';
      removeEventListener('keydown', onKey);
      back?.focus({ preventScroll: true });
    };
  }, [shown, close]);

  return (
    <Ctx.Provider value={open}>
      {children}
      {shown &&
        createPortal(
          <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={shown.title} data-signals-ignore onClick={close}>
            <button ref={closeRef} type="button" className={styles.close} onClick={close} aria-label="Close">
              ×
            </button>
            <figure className={styles.figure} onClick={(e) => e.stopPropagation()}>
              <img src={shown.image.src} alt={shown.image.alt} referrerPolicy="no-referrer" />
              <figcaption>
                <em>{shown.title}</em>
                <span>{[shown.artist, shown.year].filter(Boolean).join(', ')}</span>
                {shown.image.credit && <span className={styles.credit}>{shown.image.credit}</span>}
              </figcaption>
            </figure>
          </div>,
          document.body,
        )}
    </Ctx.Provider>
  );
}

/** null outside a LightboxProvider */
export function useLightbox(): Open | null {
  return useContext(Ctx);
}
