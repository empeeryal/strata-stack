import { Eye, EyeOff, Loader2 } from 'lucide-react';
import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  useState,
} from 'react';

import { alertRole, alertVariants, type AlertVariant } from '@/components/ui/alert-variants';
import { buttonVariants, type ButtonVariantProps } from '@/components/ui/button-variants';
import { inputClasses, textareaClasses } from '@/components/ui/field-classes';
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
  return <textarea className={cn(textareaClasses, className)} {...props} />;
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  // `htmlFor` arrives through props; callers always pair the label with a control.
  // eslint-disable-next-line jsx-a11y/label-has-associated-control
  return <label className={cn('text-sm leading-none font-medium', className)} {...props} />;
}

export function Field({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('space-y-2', className)}>{children}</div>;
}

/** Inline feedback; the role makes screen readers announce form results. */
export function Alert({
  variant = 'danger',
  children,
  className,
}: {
  variant?: AlertVariant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div role={alertRole(variant)} className={cn(alertVariants[variant], className)}>
      {children}
    </div>
  );
}

/** Message for failures that are not API results (dropped connection, runtime error). */
export const UNEXPECTED_ERROR = 'Something went wrong. Check your connection and try again.';
