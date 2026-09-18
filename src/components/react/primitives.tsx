import { Eye, EyeOff, Loader2 } from 'lucide-react';
import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  useState,
} from 'react';

import { buttonVariants, type ButtonVariantProps } from '@/components/ui/button-variants';
import { cn } from '@/lib/utils';

/** React counterparts of the Astro UI primitives, sharing the same class recipes. */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonVariantProps & { loading?: boolean };

export function Button({
  className,
  variant,
  size,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

const inputClasses =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClasses, className)} {...props} />;
}

/** Password field with a show/hide toggle; the toggle is a real button for keyboard users. */
export function PasswordInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={cn(inputClasses, 'pr-10', className)}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'flex min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger',
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  // `htmlFor` arrives through props; callers always pair the label with a control.
  // eslint-disable-next-line jsx-a11y/label-has-associated-control
  return <label className={cn('text-sm leading-none font-medium', className)} {...props} />;
}

export function Field({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('space-y-2', className)}>{children}</div>;
}

/**
 * Inline feedback. Errors use `role="alert"` (assertive), everything else `role="status"`
 * (polite), so screen readers announce results of form submissions.
 */
export function Alert({
  variant = 'danger',
  children,
  className,
}: {
  variant?: 'danger' | 'success' | 'info';
  children: ReactNode;
  className?: string;
}) {
  const styles = {
    danger: 'border-danger/40 bg-danger/10 text-danger',
    success: 'border-success/40 bg-success/10 text-success',
    info: 'border-primary/30 bg-primary/5 text-foreground',
  }[variant];
  return (
    <div
      role={variant === 'danger' ? 'alert' : 'status'}
      className={cn('rounded-md border p-3 text-sm', styles, className)}
    >
      {children}
    </div>
  );
}

/** Message for failures that are not API results (dropped connection, runtime error). */
export const UNEXPECTED_ERROR = 'Something went wrong. Check your connection and try again.';
