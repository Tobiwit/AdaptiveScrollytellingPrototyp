import { useRef, type ReactNode } from 'react';
import { useWorkVisibility } from '../attention/useWorkVisibility';

interface Props {
  workId: string;
  sectionId: string;
  className?: string;
  children: ReactNode;
  [data: `data-${string}`]: string | undefined;
}

/** Wraps whatever represents a work in a layout and reports attention events for it. */
export function ObservedWork({ workId, sectionId, className, children, ...rest }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useWorkVisibility(ref, workId, sectionId);
  return (
    <div ref={ref} className={className} data-work-id={workId} {...rest}>
      {children}
    </div>
  );
}
