import type { ReactNode } from 'react';
import { SurfacePanel } from './SurfacePanel';

type ModalSurfaceSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';

type ModalSurfaceProps = {
  children: ReactNode;
  size?: ModalSurfaceSize;
  className?: string;
  labelledBy?: string;
  describedBy?: string;
};

function joinClassNames(...classes: Array<string | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

function resolveSizeClassName(size: ModalSurfaceSize): string {
  if (size === 'sm') {
    return 'max-w-md';
  }

  if (size === 'lg') {
    return 'max-w-lg';
  }

  if (size === 'xl') {
    return 'max-w-xl';
  }

  if (size === '2xl') {
    return 'max-w-2xl';
  }

  if (size === '4xl') {
    return 'max-w-4xl';
  }

  return 'max-w-md';
}

export function ModalSurface({
  children,
  size = 'md',
  className,
  labelledBy,
  describedBy,
}: ModalSurfaceProps): JSX.Element {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
    >
      <SurfacePanel
        as="div"
        variant="solid"
        padding="md"
        className={joinClassNames('w-full shadow-xl', resolveSizeClassName(size), className)}
      >
        {children}
      </SurfacePanel>
    </div>
  );
}
