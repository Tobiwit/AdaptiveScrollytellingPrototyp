import { useEffect, useMemo } from 'react';
import type { LoadedExhibition } from './schema/validate';
import { StaticPolicy } from './presentation/policy';
import { PresentationProvider } from './presentation/PresentationContext';
import { layouts } from './layouts/registry';
import { ProgressNav } from './components/ProgressNav';
import { SignalsProvider } from './signals/SignalsContext';
import { DebugOverlay } from './debug/DebugOverlay';
import { InsightsProvider } from './insights/InsightsContext';
import { ConclusionsProvider } from './conclusions/ConclusionsContext';
import { AdaptivePolicy } from './policy/AdaptivePolicy';
import { ChapterAdaptation, PolicyDriver, PolicyProvider } from './policy/PolicyContext';

export function App({ exhibition, works }: LoadedExhibition) {
  const adaptive = useMemo(() => new URLSearchParams(location.search).has('adaptive'), []);
  const adaptivePolicy = useMemo(() => (adaptive ? AdaptivePolicy.for(exhibition) : null), [adaptive, exhibition]);
  const policy = useMemo(() => adaptivePolicy ?? new StaticPolicy(works, exhibition.defaults), [adaptivePolicy, works, exhibition]);
  const hasTags = useMemo(() => [...works.values()].some((w) => Object.keys(w.tags).length > 0), [works]);
  const chapterTitles = useMemo(() => Object.fromEntries(exhibition.chapters.map((c) => [c.id, c.title])), [exhibition]);

  useEffect(() => {
    document.title = exhibition.title;
    document.documentElement.lang = exhibition.locale;
    const root = document.documentElement.style;
    for (const [k, v] of Object.entries(exhibition.theme.colors)) root.setProperty(`--color-${k}`, v);
    for (const [k, v] of Object.entries(exhibition.theme.fonts)) root.setProperty(`--font-${k}`, v);
  }, [exhibition]);

  return (
    <PresentationProvider policy={policy}>
      <PolicyProvider policy={adaptivePolicy}>
        <SignalsProvider>
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          <ProgressNav chapters={exhibition.chapters} />
          <main id="main">
            {exhibition.chapters.map((chapter) => (
              <ChapterAdaptation key={chapter.id} chapterId={chapter.id}>
                <div id={chapter.id} className="chapter" data-chapter={chapter.id}>
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
              </ChapterAdaptation>
            ))}
          </main>
          <InsightsProvider chapterTitles={chapterTitles}>
            <ConclusionsProvider hasTags={hasTags}>
              <PolicyDriver />
              <DebugOverlay />
            </ConclusionsProvider>
          </InsightsProvider>
        </SignalsProvider>
      </PolicyProvider>
    </PresentationProvider>
  );
}
