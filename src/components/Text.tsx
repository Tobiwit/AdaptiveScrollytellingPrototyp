import type { TextVariant, Work } from '../schema/schema';

export function countWords(...texts: (string[] | string | undefined)[]): number {
  return texts
    .flat()
    .filter((t): t is string => !!t)
    .reduce((n, t) => n + t.split(/\s+/).filter(Boolean).length, 0);
}

/** falls back to the long text */
export function workTextFor(work: Work, variant: TextVariant): string[] {
  return work.text[variant].length ? work.text[variant] : work.text.long;
}

export function Paragraphs({ text, className }: { text?: string[]; className?: string }) {
  if (!text?.length) return null;
  return (
    <div className={className} data-part="text">
      {text.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

export function WorkText({ work, variant, className }: { work: Work; variant: TextVariant; className?: string }) {
  return <Paragraphs text={workTextFor(work, variant)} className={className} />;
}
