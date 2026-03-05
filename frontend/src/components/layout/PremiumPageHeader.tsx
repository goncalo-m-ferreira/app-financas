import type { ReactNode } from 'react';

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
    <header
      className={joinClassNames(
        'rounded-2xl border border-slate-200/70 bg-white/75 px-5 py-5 shadow-[0_20px_45px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-950/45 dark:shadow-[0_24px_45px_rgba(2,6,23,0.65)] lg:px-6 lg:py-6',
        className,
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className={joinClassNames('min-w-0', contentClassName)}>
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              {eyebrow}
            </p>
          ) : null}
          <h1
            className={joinClassNames(
              'text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100',
              eyebrow ? 'mt-2' : undefined,
            )}
          >
            {title}
          </h1>
          {description ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
        </div>

        {actions ? (
          <div className={joinClassNames('flex flex-wrap items-center gap-4 lg:justify-end', actionsClassName)}>
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
