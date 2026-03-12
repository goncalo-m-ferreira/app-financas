import type { HTMLAttributes, ReactNode } from 'react';

type SurfacePanelElement = 'div' | 'section' | 'article' | 'header';
type SurfacePanelVariant = 'glass' | 'solid' | 'muted';
type SurfacePanelPadding = 'none' | 'sm' | 'md' | 'lg';

type SurfacePanelProps = {
  as?: SurfacePanelElement;
  children: ReactNode;
  className?: string;
  variant?: SurfacePanelVariant;
  padding?: SurfacePanelPadding;
  reveal?: boolean;
} & HTMLAttributes<HTMLElement>;

function joinClassNames(...classes: Array<string | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

function resolveVariantClassName(variant: SurfacePanelVariant): string {
  if (variant === 'solid') {
    return 'border-[color:var(--surface-border)] bg-[color:var(--surface-card-strong)] shadow-[var(--shadow-soft)]';
  }

  if (variant === 'muted') {
    return 'border-[color:var(--surface-border)] bg-[color:var(--surface-muted)] shadow-[0_8px_18px_rgba(16,34,51,0.06)]';
  }

  return 'border-[color:var(--surface-border)] bg-[color:var(--surface-card)] shadow-[var(--shadow-soft)] backdrop-blur-md';
}

function resolvePaddingClassName(padding: SurfacePanelPadding): string {
  if (padding === 'none') {
    return '';
  }

  if (padding === 'sm') {
    return 'p-3';
  }

  if (padding === 'lg') {
    return 'p-6';
  }

  return 'p-5';
}

export function SurfacePanel({
  as = 'section',
  children,
  className,
  variant = 'glass',
  padding = 'md',
  reveal = false,
  ...rest
}: SurfacePanelProps): JSX.Element {
  const Component = as;

  return (
    <Component
      className={joinClassNames(
        'rounded-[20px] border transition-colors',
        resolveVariantClassName(variant),
        resolvePaddingClassName(padding),
        reveal ? 'ds-reveal' : undefined,
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  );
}
