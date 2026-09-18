import type { JSX } from 'react';

export interface OgTemplateProps {
  title: string;
  description?: string | undefined;
  /** Small uppercase label, e.g. "Docs" or "Blog". */
  kind: string;
  /** Secondary line in the footer, e.g. a date or section name. */
  meta?: string | undefined;
  siteName: string;
  host: string;
}

const MAX_DESCRIPTION = 150;

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

/**
 * 1200×630 Open Graph card rendered by Satori. Satori supports a subset of CSS:
 * every element with more than one child needs `display: flex`.
 */
export function OgTemplate({
  title,
  description,
  kind,
  meta,
  siteName,
  host,
}: OgTemplateProps): JSX.Element {
  const titleSize = title.length > 60 ? 52 : title.length > 36 ? 60 : 72;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        padding: '64px',
        background: 'linear-gradient(135deg, #0b0f19 0%, #111a2e 55%, #1e1b4b 100%)',
        color: '#f8fafc',
        fontFamily: 'Inter',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #6d5dfc, #22c1c3)',
          }}
        >
          <svg width="34" height="34" viewBox="0 0 64 64">
            <path
              d="M32 11l5.6 15.4L53 32l-15.4 5.6L32 53l-5.6-15.4L11 32l15.4-5.6z"
              fill="#ffffff"
            />
          </svg>
        </div>
        <span style={{ fontSize: '30px', fontWeight: 700 }}>{siteName}</span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: '22px',
            fontWeight: 700,
            letterSpacing: '4px',
            textTransform: 'uppercase',
            color: '#a5b4fc',
          }}
        >
          {kind}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div
          style={{
            display: 'flex',
            fontSize: `${titleSize}px`,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '-1.5px',
          }}
        >
          {title}
        </div>
        {description ? (
          <div style={{ display: 'flex', fontSize: '30px', lineHeight: 1.4, color: '#cbd5e1' }}>
            {truncate(description, MAX_DESCRIPTION)}
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '24px',
          color: '#94a3b8',
        }}
      >
        <span>{meta ?? ''}</span>
        <span>{host}</span>
      </div>
    </div>
  );
}
