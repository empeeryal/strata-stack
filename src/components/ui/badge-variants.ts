import { cva, type VariantProps } from 'class-variance-authority';

/** Shared badge styles for `Badge.astro` and the React `Badge` so both render identically. */
export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border text-foreground',
        muted: 'border-transparent bg-muted text-muted-foreground',
        success: 'border-transparent bg-success/15 text-success',
        warning: 'border-transparent bg-warning/20 text-warning-foreground',
        danger: 'border-transparent bg-danger/15 text-danger',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export type BadgeVariantProps = VariantProps<typeof badgeVariants>;
