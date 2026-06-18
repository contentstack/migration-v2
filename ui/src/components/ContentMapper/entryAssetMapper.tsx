// Libraries
import { useState } from 'react';
import { Button } from '@contentstack/venus-components';

// Components
import EntryMapper from './entryMapper';
import AssetMapper from './assetMapper';

// Styles
import './index.scss';

interface entryAssetMapperProps {
  handleStepChange: (currentStep: number) => void;
}

/**
 * Step 4 — Map Entry / Map Asset (delta migration).
 * Wraps the standalone Entry and Asset mappers behind an Entries / Assets toggle.
 * Both tabs are always available: the Entry mapper shows "no entries available" and the
 * Asset mapper shows "no assets available" when their respective lists are empty.
 */
const EntryAssetMapper = ({ handleStepChange }: entryAssetMapperProps) => {
  const [mapperView, setMapperView] = useState<'entries' | 'assets'>('entries');

  const calcHeight = () => window.innerHeight - 361;
  const tableHeight = calcHeight();

  return (
    // Plain flex-column wrapper — NOT .step-container. Both child mappers render their own
    // .step-container (height: 100%), so reusing it here would nest two full-height flex
    // containers around the toggle and clip the table. This wrapper just stacks the toggle
    // above the child and lets the child own the height.
    <div className="entry-asset-mapper">
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
        <AssetMapper tableHeight={tableHeight} />
      ) : (
        <EntryMapper handleStepChange={handleStepChange} />
      )}
    </div>
  );
};

export default EntryAssetMapper;