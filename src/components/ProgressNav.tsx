import { useEffect, useRef, useState } from 'react';
import type { Chapter } from '../schema/schema';
import styles from './ProgressNav.module.css';

/** Scroll progress bar plus a chapter rail that marks the current chapter. */
export function ProgressNav({ chapters }: { chapters: Chapter[] }) {
  const barRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(chapters[0]?.id);

  // Progress bar: written straight to the DOM, no re-render per scroll frame.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - innerHeight;
      const p = max > 0 ? scrollY / max : 0;
      barRef.current?.style.setProperty('--progress', String(p));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    return () => {
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  // Current chapter: the one crossing the middle of the viewport.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setCurrent(e.target.id);
      },
      { rootMargin: '-50% 0px -50% 0px' },
    );
    for (const c of chapters) {
      const el = document.getElementById(c.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [chapters]);

  return (
    <>
      <div ref={barRef} className={styles.bar} aria-hidden="true" />
      <nav className={styles.rail} aria-label="Chapters">
        <ol>
          {chapters.map((c) => (
            <li key={c.id}>
              <a href={`#${c.id}`} aria-current={c.id === current ? 'true' : undefined} className={styles.link}>
                <span className={styles.label}>{c.label ?? '•'}</span>
                <span className={styles.title}>{c.title}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
