import type { HTMLAttributes, ReactNode } from 'react';

type StatusBannerTone = 'info' | 'success' | 'danger';

type StatusBannerProps = {
  children: ReactNode;
  tone?: StatusBannerTone;
  className?: string;
} & HTMLAttributes<HTMLElement>;

function joinClassNames(...classes: Array<string | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

function resolveToneClassName(tone: StatusBannerTone): string {
  if (tone === 'success') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/45 dark:text-emerald-300';
  }

  if (tone === 'danger') {
    return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/45 dark:text-rose-300';
  }

  return 'border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900/50 dark:bg-cyan-950/45 dark:text-cyan-200';
}

export function StatusBanner({
  children,
  tone = 'info',
  className,
  ...rest
}: StatusBannerProps): JSX.Element {
  return (
    <section
      className={joinClassNames(
        'rounded-xl border px-4 py-3 text-sm shadow-[0_8px_18px_rgba(16,34,51,0.06)]',
        resolveToneClassName(tone),
        className,
      )}
      {...rest}
    >
      {children}
    </section>
  );
}
