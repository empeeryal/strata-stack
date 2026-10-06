import { cn } from '@/lib/utils';

/** Disc sizes shared by `Avatar.astro` and the React `Avatar` so both render identical markup. */
const avatarSizes = {
  sm: 'size-6 text-[10px]',
  md: 'size-9 text-xs',
  lg: 'size-16 text-lg',
} as const;

export type AvatarSize = keyof typeof avatarSizes;

/** Classes of the avatar disc; the image variant adds `object-cover`. */
export function avatarClasses(size: AvatarSize, className?: string | undefined): string {
  return cn(
    'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted font-semibold text-muted-foreground select-none',
    avatarSizes[size],
    className,
  );
}
