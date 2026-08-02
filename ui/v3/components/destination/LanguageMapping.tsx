import { FC } from 'react';

import { useV3Dispatch, useV3Selector } from '../../store/hooks';
import { destinationActions } from '../../store/slice/destination.slice';
import { LockedValue, MapDash, MAP_GRID, MapSelect, MappingHeader } from './MappingRow';

/**
 * Language mapping (UC-4 / FR-4.1–4.3).
 *
 * A mandatory master-locale row (source master locale locked, destination locale
 * chosen) plus zero or more additional rows. Additional rows can be removed all
 * the way down to zero — the master row guarantees the destination never has no
 * locale mapping at all (EC-7).
 */
const LanguageMapping: FC = () => {
  const dispatch = useV3Dispatch();
  const { masterLocaleMapping, additionalLanguageMappings, locales } = useV3Selector(
    (s) => s.destination
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <MappingHeader
        title="Language mapping"
        hint="The source stack's master locale is locked; pick the destination locale it maps to."
      />

      {/* mandatory master-locale row */}
      <div style={MAP_GRID}>
        <LockedValue
          testId="master-locale-src"
          value={masterLocaleMapping.srcLocale || '—'}
          badge="Master"
          badgeTitle="Master locale of the source stack"
        />
        <MapDash />
        <MapSelect
          label="Destination master locale"
          value={masterLocaleMapping.destLocale}
          placeholder="Select a locale…"
          options={locales}
          onChange={(v) => dispatch(destinationActions.setDestMasterLocale(v))}
        />
        <span />
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-subtle)', lineHeight: 1.45 }}>
        The source master locale is fixed. Choose which locale it becomes in the destination stack,
        then map any additional locales below.
      </div>

      {additionalLanguageMappings.map((row, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <div key={i} data-testid="lang-map-row" style={MAP_GRID}>
          <MapSelect
            label={`Source locale ${i + 1}`}
            value={row.srcLocale}
            placeholder="Select a locale…"
            options={locales}
            onChange={(v) =>
              dispatch(destinationActions.setLanguageRow({ index: i, field: 'srcLocale', value: v }))
            }
          />
          <MapDash />
          <MapSelect
            label={`Destination locale ${i + 1}`}
            value={row.destLocale}
            placeholder="Select a locale…"
            options={locales}
            onChange={(v) =>
              dispatch(destinationActions.setLanguageRow({ index: i, field: 'destLocale', value: v }))
            }
          />
          <button
            type="button"
            className="v3-rowremove"
            aria-label={`Remove language mapping ${i + 1}`}
            title="Remove"
            onClick={() => dispatch(destinationActions.removeLanguageRow(i))}
            style={{
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ))}

      <div style={{ display: 'flex' }}>
        <button
          type="button"
          className="v3-addrow"
          onClick={() => dispatch(destinationActions.addLanguageRow())}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '8px 14px',
            borderRadius: 'var(--radius-md)',
            fontSize: 12.5,
            fontWeight: 700,
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Add language
        </button>
      </div>
    </div>
  );
};

export default LanguageMapping;
