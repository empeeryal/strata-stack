import { ArrowRight, Check } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { type KeyboardEvent, useId, useState } from 'react';

interface Target {
  id: 'vercel' | 'cloudflare' | 'netlify' | 'node';
  label: string;
  command: string;
  output: string;
  runtime: string;
  notes: string[];
  href: string;
}

const TARGETS: Target[] = [
  {
    id: 'vercel',
    label: 'Vercel',
    command: 'DEPLOY_TARGET=vercel pnpm build',
    output: '.vercel/output/',
    runtime: 'Vercel Functions · Node 24',
    notes: [
      'Auto-detected from VERCEL=1, nothing to configure',
      'CSP and security headers emitted as static headers',
      'Vercel Image Optimization for <Image>',
    ],
    href: '/docs/deploy/vercel',
  },
  {
    id: 'cloudflare',
    label: 'Cloudflare',
    command: 'DEPLOY_TARGET=cloudflare pnpm build',
    output: 'dist/ (Worker + static assets)',
    runtime: 'workerd with nodejs_compat',
    notes: [
      'Auto-detected from WORKERS_CI=1',
      'Prerendering runs in Node, requests run at the edge',
      'wrangler.jsonc and _headers included',
    ],
    href: '/docs/deploy/cloudflare',
  },
  {
    id: 'netlify',
    label: 'Netlify',
    command: 'DEPLOY_TARGET=netlify pnpm build',
    output: 'dist/ + .netlify/',
    runtime: 'Netlify Functions · Node 24',
    notes: [
      'Auto-detected from NETLIFY=true',
      'Netlify Image CDN and Blobs available',
      'netlify.toml and _headers included',
    ],
    href: '/docs/deploy/netlify',
  },
  {
    id: 'node',
    label: 'Node',
    command: 'DEPLOY_TARGET=node pnpm build',
    output: 'dist/server/entry.mjs',
    runtime: 'Node 24 standalone server',
    notes: [
      'The default target, also used by the e2e tests',
      'Multi-stage Dockerfile included',
      'Runs anywhere Node runs: Fly, Railway, a VPS',
    ],
    href: '/docs/deploy/node',
  },
];

/**
 * Interactive "pick a deploy target" widget for the home page.
 * A React island animated with Motion; hydrated with `client:visible`.
 */
export default function DeployTargets() {
  const [active, setActive] = useState<Target['id']>('vercel');
  const reduceMotion = useReducedMotion();
  const id = useId();
  const current = TARGETS.find((target) => target.id === active) ?? TARGETS[0]!;

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const count = TARGETS.length;
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = (index + 1) % count;
    if (event.key === 'ArrowLeft') next = (index - 1 + count) % count;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = count - 1;
    if (next === null) return;
    event.preventDefault();
    const target = TARGETS[next]!;
    setActive(target.id);
    document.getElementById(`${id}-tab-${target.id}`)?.focus();
  }

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-soft">
      <div role="tablist" aria-label="Deploy targets" className="flex gap-1 border-b p-1.5">
        {TARGETS.map((target, index) => {
          const selected = target.id === active;
          return (
            <button
              key={target.id}
              type="button"
              role="tab"
              id={`${id}-tab-${target.id}`}
              aria-selected={selected}
              aria-controls={`${id}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(target.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className="relative flex-1 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-selected:text-foreground"
            >
              {selected && (
                <motion.span
                  layoutId={`${id}-indicator`}
                  className="absolute inset-0 -z-10 rounded-md bg-muted"
                  transition={
                    reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 32 }
                  }
                />
              )}
              {target.label}
            </button>
          );
        })}
      </div>

      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${active}`}
        className="overflow-hidden p-6"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current.id}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            {...(reduceMotion ? {} : { exit: { opacity: 0, y: -8 } })}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <pre className="overflow-x-auto rounded-md border bg-code px-4 py-3 font-mono text-sm text-code-foreground">
              <code>{current.command}</code>
            </pre>
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Build output</dt>
                <dd className="mt-1 font-mono text-xs">{current.output}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Runtime</dt>
                <dd className="mt-1 font-medium">{current.runtime}</dd>
              </div>
            </dl>
            <ul className="mt-5 space-y-2 text-sm">
              {current.notes.map((note) => (
                <li key={note} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
            <a
              href={current.href}
              className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {current.label} deployment guide
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
