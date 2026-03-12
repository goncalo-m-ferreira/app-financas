import type { ReactNode } from 'react';
import { SurfacePanel } from '../design/SurfacePanel';

type PremiumPageHeaderProps = {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  contentClassName?: string;
  actionsClassName?: string;
};

function joinClassNames(...classes: Array<string | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function PremiumPageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
  contentClassName,
  actionsClassName,
}: PremiumPageHeaderProps): JSX.Element {
  return (
    <SurfacePanel
      as="header"
      variant="glass"
      padding="lg"
      reveal
      className={joinClassNames(className)}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className={joinClassNames('min-w-0', contentClassName)}>
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
              {eyebrow}
            </p>
          ) : null}
          <h1
            className={joinClassNames(
              'ds-display text-3xl font-semibold tracking-tight text-[color:var(--text-main)]',
              eyebrow ? 'mt-2' : undefined,
            )}
          >
            {title}
          </h1>
          {description ? <p className="mt-1 text-sm text-[color:var(--text-muted)]">{description}</p> : null}
        </div>

        {actions ? (
          <div className={joinClassNames('flex flex-wrap items-center gap-4 lg:justify-end', actionsClassName)}>
            {actions}
          </div>
        ) : null}
      </div>
    </SurfacePanel>
  );
}
