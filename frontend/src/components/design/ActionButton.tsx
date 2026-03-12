import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type ActionButtonVariant = 'primary' | 'neutral' | 'danger';
type ActionButtonSize = 'sm' | 'md';

type ActionButtonProps = {
  children: ReactNode;
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
  fullWidth?: boolean;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

function joinClassNames(...classes: Array<string | undefined | false>): string {
  return classes.filter(Boolean).join(' ');
}

function resolveVariantClassName(variant: ActionButtonVariant): string {
  if (variant === 'neutral') {
    return 'border-[color:var(--surface-border)] bg-[color:var(--surface-card)] text-[color:var(--text-main)] hover:bg-[color:var(--surface-muted)]';
  }

  if (variant === 'danger') {
    return 'border-[color:var(--danger)] bg-[color:var(--danger)] text-white hover:bg-[color:var(--danger-strong)]';
  }

  return 'border-transparent bg-[linear-gradient(120deg,var(--accent)_0%,var(--accent-strong)_100%)] text-white shadow-[0_10px_22px_rgba(15,118,110,0.25)] hover:brightness-[1.06]';
}

function resolveSizeClassName(size: ActionButtonSize): string {
  if (size === 'sm') {
    return 'h-9 px-3 text-xs';
  }

  return 'h-10 px-4 text-sm';
}

export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(function ActionButton(
  {
    children,
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    className,
    type = 'button',
    ...rest
  },
  ref,
): JSX.Element {
  return (
    <button
      ref={ref}
      type={type}
      className={joinClassNames(
        'ds-focus-ring inline-flex items-center justify-center gap-2 rounded-xl border font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
        resolveVariantClassName(variant),
        resolveSizeClassName(size),
        fullWidth ? 'w-full' : undefined,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
