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
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
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
          color: selected ? 'var(--text-strong)' : 'var(--text-subtle)',
          ...buttonStyle,
        }}
      >
        {selected ? selected.label : placeholder}
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          style={{
            position: 'absolute', zIndex: 20, top: 'calc(100% + 4px)', left: 0, right: 0,
            margin: 0, padding: 4, listStyle: 'none', maxHeight: 260, overflowY: 'auto',
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
                cursor: 'pointer', padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                fontSize: 13.5, fontFamily: 'var(--font-sans)', fontWeight: o.value === value ? 700 : 500,
                color: 'var(--text-strong)',
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
