import { useEffect, useMemo, useRef, useState } from 'react';
import { layouts } from '../layouts/registry';
import { PresentationProvider } from '../presentation/PresentationContext';
import type { PresentationPolicy, WorkPresentation } from '../presentation/policy';
import { AdaptationProvider, type Step } from '../adaptation/AdaptationContext';
import { SignalsProvider } from '../signals/SignalsContext';
import type { Exhibition, WorkSize } from '../schema/schema';
import { makeLabContent, resolveModules, type Dimension } from './labContent';
import { useScrollAnchor } from './useScrollAnchor';
import styles from './ModuleLab.module.css';

const DIMENSIONS: { id: Dimension; label: string; steps: [string, string, string] }[] = [
  { id: 'length', label: 'Text length', steps: ['short', 'standard', 'long'] },
  { id: 'depth', label: 'Context depth', steps: ['hidden', 'standard', 'deep'] },
  { id: 'size', label: 'Image size', steps: ['S', 'M', 'L'] },
  { id: 'presence', label: 'Image presence', steps: ['supporting', 'standard', 'leading'] },
];

const SIZES: WorkSize[] = ['S', 'M', 'L'];
const BASELINE: Record<Dimension, Step> = { length: 1, depth: 1, size: 1, presence: 1 };

class FixedSizePolicy implements PresentationPolicy {
  constructor(private readonly size: WorkSize) {}
  getWorkPresentation(): WorkPresentation {
    return { size: this.size, textVariant: 'long' };
  }
  subscribe() {
    return () => {};
  }
}

const exhibition = { id: 'lab', title: 'Modules' } as Exhibition;

export function ModuleLab() {
  const [steps, setSteps] = useState(BASELINE);
  const [content, setContent] = useState(makeLabContent);
  const modules = useMemo(() => resolveModules(content, steps.length), [content, steps.length]);
  const policy = useMemo(() => new FixedSizePolicy(SIZES[steps.size]), [steps.size]);
  const adaptation = useMemo(() => ({ length: steps.length, depth: steps.depth, presence: steps.presence }), [steps]);
  const isBaseline = DIMENSIONS.every((d) => steps[d.id] === 1);
  const barRef = useRef<HTMLElement>(null);
  const hold = useScrollAnchor(barRef);
  const setStep = (id: Dimension, v: Step) => {
    hold();
    setSteps((s) => ({ ...s, [id]: v }));
  };

  useEffect(() => {
    document.title = 'Modules';
  }, []);

  return (
    <SignalsProvider>
      <PresentationProvider policy={policy}>
        <AdaptationProvider value={adaptation}>
          <header ref={barRef} className={styles.bar} data-signals-ignore>
            <h1 className={styles.title}>Modules</h1>
            {DIMENSIONS.map((d) => (
              <StepSlider key={d.id} label={d.label} steps={d.steps} value={steps[d.id]} onChange={(v) => setStep(d.id, v)} />
            ))}
            <div className={styles.actions}>
              <button type="button" onClick={() => {
                  hold();
                  setSteps(BASELINE);
                }} disabled={isBaseline}>
                Baseline
              </button>
              <button type="button" onClick={() => {
                  hold();
                  setContent(makeLabContent());
                }}>
                New text
              </button>
            </div>
          </header>
          <main>
            {modules.map((m) => {
              const layout = layouts[m.layout];
              const Component = layout.component;
              return (
                <article key={m.key} className={styles.module}>
                  <header className={styles.moduleHead}>
                    <h2>{m.name}</h2>
                    <ul className={styles.affects} aria-label="Reacts to">
                      {DIMENSIONS.map((d) => (
                        <li key={d.id} data-on={m.affects.includes(d.id) || undefined}>
                          {d.label}
                        </li>
                      ))}
                    </ul>
                    {m.note && <span className={styles.note}>{m.note}</span>}
                  </header>
                  <section id={m.section.id} className="section" data-layout={m.layout}>
                    <Component
                      exhibition={exhibition}
                      chapter={content.chapter}
                      section={m.section}
                      works={m.works}
                      options={layout.options.parse(m.options ?? {})}
                    />
                  </section>
                </article>
              );
            })}
          </main>
        </AdaptationProvider>
      </PresentationProvider>
    </SignalsProvider>
  );
}

interface SliderProps {
  label: string;
  steps: [string, string, string];
  value: Step;
  onChange: (v: Step) => void;
}

function StepSlider({ label, steps, value, onChange }: SliderProps) {
  return (
    <div className={styles.control}>
      <label className={styles.controlLabel}>
        {label}
        <input type="range" min={0} max={2} step={1} value={value} onChange={(e) => onChange(Number(e.target.value) as Step)} />
      </label>
      <div className={styles.ticks}>
        {steps.map((s, i) => (
          <button key={s} type="button" data-on={i === value || undefined} onClick={() => onChange(i as Step)} tabIndex={-1}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
