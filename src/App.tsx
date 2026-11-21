import { useEffect, useMemo } from 'react';
import type { LoadedExhibition } from './schema/validate';
import { StaticPolicy } from './presentation/policy';
import { PresentationProvider } from './presentation/PresentationContext';
import { layouts } from './layouts/registry';
import { ProgressNav } from './components/ProgressNav';
import { SignalsProvider } from './signals/SignalsContext';
import { DebugOverlay } from './debug/DebugOverlay';

export function App({ exhibition, works }: LoadedExhibition) {
  // Adaptation seam: swap StaticPolicy for an AdaptivePolicy here.
  const policy = useMemo(() => new StaticPolicy(works, exhibition.defaults), [works, exhibition]);

  useEffect(() => {
    document.title = exhibition.title;
    document.documentElement.lang = exhibition.locale;
    const root = document.documentElement.style;
    for (const [k, v] of Object.entries(exhibition.theme.colors)) root.setProperty(`--color-${k}`, v);
    for (const [k, v] of Object.entries(exhibition.theme.fonts)) root.setProperty(`--font-${k}`, v);
  }, [exhibition]);

  return (
    <PresentationProvider policy={policy}>
      <SignalsProvider>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <ProgressNav chapters={exhibition.chapters} />
        <main id="main">
          {exhibition.chapters.map((chapter) => (
            <div key={chapter.id} id={chapter.id} className="chapter" data-chapter={chapter.id}>
              {chapter.sections.map((section) => {
                const layout = layouts[section.layout];
                const Component = layout.component;
                return (
                  <section
                    key={section.id}
                    id={section.id}
                    className="section"
                    data-layout={section.layout}
                    aria-label={section.title ?? chapter.title}
                  >
                    <Component
                      exhibition={exhibition}
                      chapter={chapter}
                      section={section}
                      works={section.works.map((id) => works.get(id)!)}
                      options={layout.options.parse(section.options)}
                    />
                  </section>
                );
              })}
            </div>
          ))}
        </main>
        <DebugOverlay />
      </SignalsProvider>
    </PresentationProvider>
  );
}
