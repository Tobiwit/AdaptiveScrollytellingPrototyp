import type { TextVariant, Work } from '../schema/schema';

export function Paragraphs({ text, className }: { text?: string[]; className?: string }) {
  if (!text?.length) return null;
  return (
    <div className={className}>
      {text.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

/** A work's text in the variant the presentation policy chose. */
export function WorkText({ work, variant, className }: { work: Work; variant: TextVariant; className?: string }) {
  const text = work.text[variant].length ? work.text[variant] : work.text.long;
  return <Paragraphs text={text} className={className} />;
}
