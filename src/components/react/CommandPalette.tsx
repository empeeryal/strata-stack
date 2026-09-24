import {
  ArrowRight,
  BookOpen,
  FileText,
  LayoutDashboard,
  Link2,
  LogIn,
  Search,
  Shield,
  SunMoon,
} from 'lucide-react';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import { THEME_STORAGE_KEY } from '@/lib/theme-script';
import { cn } from '@/lib/utils';

/** A page or docs entry the palette lists without a search. */
export interface PaletteLink {
  label: string;
  href: string;
  /** Group heading, e.g. "Pages" or a docs section name. */
  group: string;
  /** Extra words the filter should match, such as a docs description. */
  keywords?: string;
}

/** The subset of Pagefind's JavaScript API the palette needs. */
export interface SearchApi {
  init(): Promise<void>;
  debouncedSearch(
    query: string,
  ): Promise<{ results: Array<{ data(): Promise<SearchHit> }> } | null>;
}

export interface SearchHit {
  url: string;
  excerpt: string;
  meta: { title?: string };
}

export interface CommandPaletteProps {
  /** Navigation entries rendered before any search. */
  links: PaletteLink[];
  /** Loads the search API; defaults to Pagefind's bundle at `/pagefind/pagefind.js`. */
  loadSearch?: () => Promise<SearchApi>;
  /** Resolves the signed-in visitor; defaults to the auth API. */
  loadSession?: () => Promise<Session | null>;
  /** Selector for the elements that open the palette when clicked. */
  triggerSelector?: string;
}

interface Session {
  name: string;
  admin: boolean;
}

interface LinkItem {
  kind: 'link';
  id: string;
  label: string;
  href: string;
  group: string;
}

interface ActionItem {
  kind: 'action';
  id: string;
  label: string;
  group: 'Actions';
  icon: ReactNode;
  run: () => void;
}

interface ResultItem {
  kind: 'result';
  id: string;
  label: string;
  href: string;
  group: 'Search results';
  excerpt: string;
}

type Item = LinkItem | ActionItem | ResultItem;

const MAX_LINKS = 16;
const MAX_RESULTS = 6;
/** With nothing typed, only the first groups of links are listed (pages and the first docs section). */
const DEFAULT_GROUPS = 2;
const MIN_QUERY = 2;

async function loadPagefind(): Promise<SearchApi> {
  const url = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/pagefind/pagefind.js`;
  return (await import(/* @vite-ignore */ url)) as SearchApi;
}

async function loadCurrentSession(): Promise<Session | null> {
  try {
    const response = await fetch('/api/auth/get-session', {
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      user?: { name: string; role?: string | null };
    } | null;
    const user = data?.user;
    if (!user) return null;
    const admin = (user.role ?? '').split(',').some((role) => role.trim() === 'admin');
    return { name: user.name, admin };
  } catch {
    return null;
  }
}

function toggleTheme() {
  const root = document.documentElement;
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  root.dataset.themePreference = next;
  root.style.colorScheme = next;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    /* storage unavailable */
  }
}

function normalise(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Every word of the query must appear somewhere in the item's text. */
function matches(query: string, ...texts: string[]) {
  const haystack = normalise(texts.join(' '));
  return normalise(query)
    .split(' ')
    .every((word) => haystack.includes(word));
}

function action(id: string, label: string, icon: ReactNode, run: () => void): ActionItem {
  return { kind: 'action', id: `action:${id}`, label, group: 'Actions', icon, run };
}

/**
 * Site-wide command palette: navigation, actions and Pagefind results in one list. Opens with
 * Ctrl/⌘+K or from any `[data-palette-trigger]` element and renders into a native `<dialog>`,
 * which gives focus containment, Escape handling and an inert page for free. `/search` remains
 * the route for visitors without JavaScript.
 */
export default function CommandPalette({
  links,
  loadSearch = loadPagefind,
  loadSession = loadCurrentSession,
  triggerSelector = '[data-palette-trigger]',
}: CommandPaletteProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<Promise<SearchApi | null> | null>(null);
  const requestRef = useRef(0);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [found, setFound] = useState<{ term: string; hits: SearchHit[] }>({ term: '', hits: [] });
  const [unavailable, setUnavailable] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [copied, setCopied] = useState(false);

  const term = query.trim();
  const searching = term.length >= MIN_QUERY;
  const results = useMemo(
    () => (searching && found.term === term ? found.hits : []),
    [searching, found, term],
  );
  const loading = searching && !unavailable && found.term !== term;

  const show = useCallback(() => {
    setOpen(true);
    setQuery('');
    setActive(0);
    setCopied(false);
    void loadSession().then(setSession);
  }, [loadSession]);

  const close = useCallback(() => setOpen(false), []);

  // The dialog element follows the `open` state; the native close event (Escape) feeds it back.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  // Global shortcut, header triggers and backdrop clicks.
  useEffect(() => {
    const dialog = dialogRef.current;
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => {
          if (!current) show();
          return !current;
        });
      }
    };
    const onTrigger = (event: Event) => {
      event.preventDefault();
      show();
    };
    const onBackdrop = (event: MouseEvent) => {
      if (event.target === dialog) close();
    };
    const triggers = Array.from(document.querySelectorAll<HTMLElement>(triggerSelector));
    document.addEventListener('keydown', onKey);
    for (const trigger of triggers) trigger.addEventListener('click', onTrigger);
    dialog?.addEventListener('click', onBackdrop);
    // Marks the moment the shortcut and triggers work, for tests and for styling the trigger.
    dialog?.setAttribute('data-ready', '');
    return () => {
      document.removeEventListener('keydown', onKey);
      for (const trigger of triggers) trigger.removeEventListener('click', onTrigger);
      dialog?.removeEventListener('click', onBackdrop);
      dialog?.removeAttribute('data-ready');
    };
  }, [close, show, triggerSelector]);

  // Pagefind search, loaded on first use; the module is missing until a build has run.
  useEffect(() => {
    if (!open || !searching) return;
    searchRef.current ??= loadSearch()
      .then(async (api) => {
        await api.init();
        return api;
      })
      .catch(() => null);
    const request = ++requestRef.current;
    void searchRef.current.then(async (api) => {
      if (request !== requestRef.current) return;
      if (!api) {
        setUnavailable(true);
        return;
      }
      const response = await api.debouncedSearch(term);
      if (request !== requestRef.current || response === null) return;
      const hits = await Promise.all(
        response.results.slice(0, MAX_RESULTS).map((result) => result.data()),
      );
      if (request !== requestRef.current) return;
      setFound({ term, hits });
    });
  }, [open, searching, term, loadSearch]);

  const items = useMemo<Item[]>(() => {
    const defaultGroups = [...new Set(links.map((link) => link.group))].slice(0, DEFAULT_GROUPS);
    const linkItems: Item[] = links
      .filter((link) =>
        term === ''
          ? defaultGroups.includes(link.group)
          : matches(term, link.label, link.group, link.keywords ?? ''),
      )
      .slice(0, MAX_LINKS)
      .map((link) => ({
        kind: 'link',
        id: `link:${link.href}`,
        label: link.label,
        href: link.href,
        group: link.group,
      }));

    const actionItems: Item[] = [
      action('theme', 'Switch theme', <SunMoon aria-hidden="true" />, () => {
        toggleTheme();
        setOpen(false);
      }),
      action(
        'copy',
        copied ? 'Link copied' : 'Copy link to this page',
        <Link2 aria-hidden="true" />,
        () => {
          void navigator.clipboard?.writeText(location.href).then(() => setCopied(true));
        },
      ),
      session
        ? action(
            'dashboard',
            `Dashboard (${session.name})`,
            <LayoutDashboard aria-hidden="true" />,
            () => location.assign('/dashboard'),
          )
        : action('sign-in', 'Sign in', <LogIn aria-hidden="true" />, () =>
            location.assign('/login'),
          ),
      ...(session?.admin
        ? [
            action('admin', 'Admin area', <Shield aria-hidden="true" />, () =>
              location.assign('/admin'),
            ),
          ]
        : []),
    ].filter((entry) => term === '' || matches(term, entry.label, 'actions'));

    const resultItems: Item[] = results.map((hit) => ({
      kind: 'result',
      id: `result:${hit.url}`,
      label: hit.meta.title ?? hit.url,
      href: hit.url,
      group: 'Search results',
      excerpt: hit.excerpt,
    }));

    return [...linkItems, ...actionItems, ...resultItems];
  }, [links, term, results, session, copied]);

  const activeIndex = Math.min(active, Math.max(items.length - 1, 0));
  const activeItem = items[activeIndex];

  const select = useCallback((item: Item) => {
    if (item.kind === 'action') {
      item.run();
      return;
    }
    setOpen(false);
    location.assign(item.href);
  }, []);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive(items.length ? (activeIndex + 1) % items.length : 0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(items.length ? (activeIndex - 1 + items.length) % items.length : 0);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActive(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActive(Math.max(items.length - 1, 0));
    } else if (event.key === 'Enter') {
      if (activeItem) {
        event.preventDefault();
        select(activeItem);
      }
    }
  };

  const groups = useMemo(() => {
    const order: string[] = [];
    const byGroup = new Map<string, Item[]>();
    for (const item of items) {
      if (!byGroup.has(item.group)) {
        byGroup.set(item.group, []);
        order.push(item.group);
      }
      byGroup.get(item.group)!.push(item);
    }
    return order.map((group) => ({ group, items: byGroup.get(group)! }));
  }, [items]);

  const optionId = (item: Item) => `${listId}-${item.id.replace(/[^a-z0-9]+/gi, '-')}`;

  return (
    <dialog
      ref={dialogRef}
      aria-label="Command palette"
      className="m-0 w-full max-w-none bg-transparent p-0 backdrop:bg-black/40 open:flex open:justify-center sm:mt-[10vh] sm:h-auto sm:max-h-[80vh]"
      onClose={() => setOpen(false)}
    >
      {open && (
        <div className="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground shadow-lg sm:h-auto sm:max-h-[80vh] sm:w-[36rem] sm:rounded-xl sm:border">
          <div className="flex items-center gap-3 border-b px-4">
            <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              type="text"
              role="combobox"
              aria-label="Search pages, docs and actions"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={activeItem ? optionId(activeItem) : undefined}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Search pages, docs and actions…"
              className="h-14 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              // eslint-disable-next-line jsx-a11y/no-autofocus -- the dialog just opened for typing
              autoFocus
            />
            <kbd className="hidden h-5 items-center rounded border bg-muted px-1.5 font-mono text-[11px] font-medium text-muted-foreground sm:inline-flex">
              Esc
            </kbd>
          </div>

          <div
            id={listId}
            role="listbox"
            aria-label="Results"
            className="flex-1 overflow-y-auto p-2"
          >
            {groups.map(({ group, items: groupItems }) => (
              <div key={group} role="group" aria-label={group} className="mb-1">
                <div
                  role="presentation"
                  aria-hidden="true"
                  className="px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  {group}
                </div>
                {groupItems.map((item) => {
                  const index = items.indexOf(item);
                  const selected = index === activeIndex;
                  return (
                    <div
                      key={item.id}
                      id={optionId(item)}
                      role="option"
                      aria-selected={selected}
                      tabIndex={-1}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm',
                        selected ? 'bg-muted text-foreground' : 'text-foreground/90',
                      )}
                      onMouseMove={() => setActive(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => select(item)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') select(item);
                      }}
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground [&>svg]:size-4">
                        {item.kind === 'action' ? (
                          item.icon
                        ) : item.kind === 'result' ? (
                          <FileText aria-hidden="true" />
                        ) : item.group === 'Pages' ? (
                          <ArrowRight aria-hidden="true" />
                        ) : (
                          <BookOpen aria-hidden="true" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{item.label}</span>
                        {item.kind === 'result' && (
                          <span
                            className="block truncate text-xs text-muted-foreground [&_mark]:bg-transparent [&_mark]:font-semibold [&_mark]:text-primary"
                            // Pagefind excerpts are generated from the site's own built HTML.
                            dangerouslySetInnerHTML={{ __html: item.excerpt }}
                          />
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {items.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground" role="status">
              {loading ? 'Searching…' : 'Nothing matches that yet.'}
            </p>
          )}
          {unavailable && searching && (
            <p className="px-4 py-2 text-xs text-muted-foreground">
              Full-text search needs the index from a build; pages and actions still work.
            </p>
          )}

          <p className="flex flex-wrap gap-x-4 gap-y-1 border-t px-4 py-2 text-xs text-muted-foreground">
            <span>
              <kbd className="font-mono">↑↓</kbd> to move
            </span>
            <span>
              <kbd className="font-mono">Enter</kbd> to open
            </span>
            <span>
              <kbd className="font-mono">Esc</kbd> to close
            </span>
            <a href="/search" className="ml-auto underline-offset-4 hover:underline">
              Full search page
            </a>
          </p>
        </div>
      )}
    </dialog>
  );
}
