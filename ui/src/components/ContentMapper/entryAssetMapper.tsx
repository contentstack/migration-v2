// Libraries
import { useEffect, useRef, useState } from 'react';
import { Button } from '@contentstack/venus-components';

// Components
import EntryMapper from './entryMapper';
import AssetMapper from './assetMapper';

// Styles
import './index.scss';

interface entryAssetMapperProps {
  handleStepChange: (currentStep: number) => void;
}

// CSS fallback (calc(100vh - 246px) in index.scss) assumes a fixed header-chrome height above
// this box. That number drifts whenever the stepper/title chrome changes height even slightly
// (project title length, browser zoom, etc.), silently pushing the sticky Save footer below the
// viewport with no way to reach it. Measure this box's own top offset instead so its height is
// always exactly "the rest of the viewport", regardless of what's above it.
const useMeasuredBoxHeight = (ref: React.RefObject<HTMLElement | null>): number | undefined => {
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const measure = () => {
      const top = ref.current?.getBoundingClientRect().top;
      if (top == null) return;
      setHeight(Math.max(0, window.innerHeight - top));
    };

    measure();
    const ro = new ResizeObserver(measure);
    if (ref.current) ro.observe(ref.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return height;
};

/**
 * Step 4 — Map Entry / Map Asset (delta migration).
 * Wraps the standalone Entry and Asset mappers behind an Entries / Assets toggle.
 * Both tabs are always available: the Entry mapper shows "no entries available" and the
 * Asset mapper shows "no assets available" when their respective lists are empty.
 */
const EntryAssetMapper = ({ handleStepChange }: entryAssetMapperProps) => {
  const [mapperView, setMapperView] = useState<'entries' | 'assets'>('entries');
  const boxRef = useRef<HTMLDivElement>(null);
  const measuredHeight = useMeasuredBoxHeight(boxRef);

  return (
    // Plain flex-column wrapper — NOT .step-container. Both child mappers render their own
    // .step-container (height: 100%), so reusing it here would nest two full-height flex
    // containers around the toggle and clip the table. This wrapper just stacks the toggle
    // above the child and lets the child own the height.
    //
    // Height is measured via JS (see useMeasuredBoxHeight) rather than trusted to the CSS
    // calc(100vh - 246px) fallback alone — that fallback still applies for the one frame
    // before this effect runs.
    <div
      className="entry-asset-mapper"
      ref={boxRef}
      style={measuredHeight != null ? { height: measuredHeight, maxHeight: measuredHeight } : undefined}
    >
      <div className="mapper-view-toggle">
        <Button
          buttonType={mapperView === 'entries' ? 'secondary' : 'light'}
          version="v2"
          size="small"
          onClick={() => setMapperView('entries')}
        >
          Entries
        </Button>
        <Button
          buttonType={mapperView === 'assets' ? 'secondary' : 'light'}
          version="v2"
          size="small"
          onClick={() => setMapperView('assets')}
        >
          Assets
        </Button>
      </div>

      {mapperView === 'assets' ? (
        <AssetMapper />
      ) : (
        <EntryMapper handleStepChange={handleStepChange} />
      )}
    </div>
  );
};

export default EntryAssetMapper;