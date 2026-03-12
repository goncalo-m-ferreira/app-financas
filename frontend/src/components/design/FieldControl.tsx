import type { ReactNode } from 'react';

type FieldControlProps = {
  label: string;
  htmlFor: string;
  children: ReactNode;
  className?: string;
  labelClassName?: string;
};

function joinClassNames(...classes: Array<string | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export const CONTROL_INPUT_CLASS_NAME =
  'ds-focus-ring h-11 w-full rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-card-strong)] px-3 text-sm text-[color:var(--text-main)] outline-none transition placeholder:text-[color:var(--text-muted)]/70 dark:bg-[color:var(--surface-card)]';

export function FieldControl({
  label,
  htmlFor,
  children,
  className,
  labelClassName,
}: FieldControlProps): JSX.Element {
  return (
    <label className={joinClassNames('block space-y-1.5', className)} htmlFor={htmlFor}>
      <span
        className={joinClassNames(
          'text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]',
          labelClassName,
        )}
      >
        {label}
      </span>
      {children}
    </label>
  );
}
