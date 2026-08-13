import { CSSProperties, FC, useEffect, useRef, useState } from 'react';

/**
 * A themed dropdown replacing native `<select>`. Browsers render a native
 * `<select>`'s OPEN option list using the OS's own popup chrome — it ignores
 * the page's CSS entirely, so on macOS Chrome it shows the OS's dark popup
 * background regardless of this app's light theme. Rendering the option
 * list ourselves keeps it inside `.v3-scope` so it's themed consistently.
 */
export interface V3SelectOption {
  value: string;
  label: string;
}

interface V3SelectProps {
  id?: string;
  ariaLabel: string;
  value: string;
  placeholder: string;
  options: V3SelectOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
  className?: string;
  style?: CSSProperties;
  buttonStyle?: CSSProperties;
}

const V3Select: FC<V3SelectProps> = ({
  id,
  ariaLabel,
  value,
  placeholder,
  options,
  disabled,
  onChange,
  className,
  style,
  buttonStyle,
}) => {
  const [open, setOpen] = useState(false);
  // Whether to flip the list above the trigger instead of below — decided
  // fresh each time the list opens, so a field near the bottom of the
  // viewport (e.g. Stack, with a long options list) never renders its popup
  // partly off-screen or under the page's sticky footer.
  const [openUpward, setOpenUpward] = useState(false);
  // The list's own maxHeight is clamped to whatever room actually exists on
  // the chosen side (not just a fixed constant) — otherwise a field with
  // little space in BOTH directions (e.g. Stack, sitting just above the
  // wizard's sticky footer) would still render a fixed-height popup that
  // spills past the viewport or over the footer no matter which way it opens.
  const [listMaxHeight, setListMaxHeight] = useState(260);
  const rootRef = useRef<HTMLDivElement>(null);
  const MAX_LIST_HEIGHT = 260;
  const MIN_LIST_HEIGHT = 120;
  const VIEWPORT_MARGIN = 8;

  useEffect(() => {
    if (!open) return;
    const el = rootRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
      const spaceAbove = rect.top - VIEWPORT_MARGIN;
      const upward = spaceBelow < MAX_LIST_HEIGHT && spaceAbove > spaceBelow;
      setOpenUpward(upward);
      const available = upward ? spaceAbove : spaceBelow;
      setListMaxHeight(Math.max(MIN_LIST_HEIGHT, Math.min(MAX_LIST_HEIGHT, available)));
    }
    const onDocMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);
  /*
    What the closed control shows. When a value is set but its option list has not loaded
    — or does not contain it, because the stack was removed or access was lost — the raw
    value is shown rather than the placeholder.

    Falling through to the placeholder was the bug: a restored project displayed
    "Select an organization…" on a DISABLED control, stating the opposite of the truth.
    An id is ugly; claiming nothing is selected is wrong.
  */
  const shown = selected?.label ?? (value ? value : placeholder);
  const hasValue = !!selected || !!value;

  return (
    <div ref={rootRef} style={{ position: 'relative', ...style }}>
      <button
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={className ?? 'v3-field'}
        style={{
          width: '100%', textAlign: 'left', display: 'block',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          color: hasValue ? 'var(--text-strong)' : 'var(--text-subtle)',
          ...buttonStyle,
        }}
      >
        {shown}
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          style={{
            position: 'absolute', zIndex: 500, left: 0, right: 0,
            ...(openUpward ? { bottom: 'calc(100% + 4px)' } : { top: 'calc(100% + 4px)' }),
            margin: 0, padding: 4, listStyle: 'none', maxHeight: listMaxHeight, overflowY: 'auto',
            background: 'var(--surface-card)', border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)',
          }}
        >
          {options.map((o) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              data-selected={o.value === value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className="v3-select-option"
              style={{
                cursor: 'pointer', padding: '5px 10px', borderRadius: 'var(--radius-sm)',
                fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: o.value === value ? 700 : 500,
                color: 'var(--text-strong)', lineHeight: 1.4,
              }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default V3Select;
