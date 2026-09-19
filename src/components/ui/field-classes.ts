const field =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger';

/** Class recipes shared by the React form primitives and plain HTML inputs in Astro pages. */
export const inputClasses = `flex h-10 ${field}`;
export const textareaClasses = `flex min-h-32 ${field}`;
