import { FC } from 'react';

import { useV3Dispatch, useV3Selector } from '../../store/hooks';
import { destinationActions } from '../../store/slice/destination.slice';
import { LockedValue, MapDash, MAP_GRID, MapSelect, MappingHeader } from './MappingRow';

const MAIN_ONLY = [{ value: 'main', label: 'main' }];

/**
 * Branch mapping (UC-8 / FR-9.1–9.3).
 *
 * Exactly one row, always: the source branch is inherited from the Source step
 * and locked, and there is only ever one of it — so no add/remove affordance
 * exists (FR-9.2). A stack this panel just created has only Contentstack's
 * default `main` branch (EC-12).
 */
const BranchMapping: FC = () => {
  const dispatch = useV3Dispatch();
  const { branchMapping, branches, stackWasCreated } = useV3Selector((s) => s.destination);

  const options = stackWasCreated || branches.length === 0 ? MAIN_ONLY : branches;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <MappingHeader
        title="Branch mapping"
        hint="Match each destination branch to the source branch its content comes from."
      />
      <div data-testid="branch-map-row" style={MAP_GRID}>
        <LockedValue
          testId="branch-src-locked"
          value={branchMapping.srcBranch || '—'}
          badge="Locked"
          badgeTitle="Set in the source step"
        />
        <MapDash />
        <MapSelect
          label="Destination branch"
          value={branchMapping.destBranch}
          options={options}
          onChange={(v) => dispatch(destinationActions.setDestBranch(v))}
        />
        <span />
      </div>
    </div>
  );
};

export default BranchMapping;
