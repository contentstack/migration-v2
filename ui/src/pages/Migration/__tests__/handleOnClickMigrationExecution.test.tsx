import { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router';
import { configureStore, combineReducers } from '@reduxjs/toolkit';

import migrationDataSlice, { setNewMigrationData, updateNewMigrationData } from '../../../store/slice/migrationDataSlice';
import authSlice, { setSelectedOrganisation } from '../../../store/slice/authSlice';
import { DEFAULT_NEW_MIGRATION, DEFAULT_DROPDOWN } from '../../../context/app/app.interface';
import Migration from '../index';

const mockStartMigration = vi.hoisted(() => vi.fn());
const mockGetCMSDataFromFile = vi.hoisted(() => vi.fn());
const mockGetMigrationData = vi.hoisted(() => vi.fn());

vi.mock('../../../services/api/migration.service', () => ({
  getMigrationData: mockGetMigrationData,
  updateCurrentStepData: vi.fn().mockResolvedValue({ status: 200 }),
  updateLegacyCMSData: vi.fn().mockResolvedValue({ status: 200 }),
  updateDestinationStack: vi.fn().mockResolvedValue({ status: 200 }),
  updateAffixData: vi.fn().mockResolvedValue({ status: 200 }),
  fileformatConfirmation: vi.fn().mockResolvedValue({ status: 200 }),
  updateFileFormatData: vi.fn().mockResolvedValue({ status: 200 }),
  affixConfirmation: vi.fn().mockResolvedValue({ status: 200 }),
  updateStackDetails: vi.fn().mockResolvedValue({ status: 200 }),
  getExistingContentTypes: vi.fn().mockResolvedValue({ status: 201, data: { contentTypes: [] } }),
  getExistingGlobalFields: vi.fn().mockResolvedValue({ status: 201, data: { globalFields: [] } }),
  startMigration: mockStartMigration,
  updateMigrationKey: vi.fn().mockResolvedValue({ status: 200 }),
  updateLocaleMapper: vi.fn().mockResolvedValue({ status: 200 }),
  restartMigration: vi.fn().mockResolvedValue({ status: 200 })
}));
vi.mock('../../../services/api/project.service', () => ({
  getMigratedStacks: vi.fn().mockResolvedValue({ data: { destinationStacks: [] } })
}));
vi.mock('../../../services/api/upload.service', () => ({
  getConfig: vi.fn().mockResolvedValue({ data: {} })
}));
vi.mock('../../../cmsData/cmsSelector', () => ({
  getCMSDataFromFile: mockGetCMSDataFromFile
}));
// Irrelevant to this test, and it pulls in useLocation from 'react-router-dom' — a separate
// module realm from the 'react-router' hooks (useNavigate/useParams) the page itself uses,
// which don't share a Router context in this test environment.
vi.mock('../../../hooks/userNavigation', () => ({ default: () => undefined }));

// This page has no test coverage otherwise (see the QA sweep) — mocking every step
// component keeps this test scoped to the "Start Migration" CTA wiring rather than
// pulling in five unrelated subtrees' worth of dependencies.
vi.mock('../../../components/Common/SaveChangesModal', () => ({ default: () => null }));
vi.mock('../../../components/LegacyCms', () => ({ default: () => null }));
vi.mock('../../../components/DestinationStack', () => ({ default: () => null }));
vi.mock('../../../components/ContentMapper', () => ({ default: () => null }));
vi.mock('../../../components/ContentMapper/entryAssetMapper', () => ({ default: () => null }));
vi.mock('../../../components/TestMigration', () => ({ default: () => null }));
vi.mock('../../../components/MigrationExecution', () => ({ default: () => null }));
vi.mock('../../../components/Stepper/HorizontalStepper/HorizontalStepper', () => ({
  default: () => <div data-testid="stepper-stub" />
}));
// Exposing the handler's own name (arrow functions assigned to a const are named in JS) lets
// the test assert deterministically which CTA is wired up, instead of guessing from timing.
vi.mock('../../../components/MigrationFlowHeader', () => ({
  default: (props: any) => (
    <button
      data-testid="flow-header-cta"
      data-handler={props?.handleOnClick?.name}
      onClick={() => props?.handleOnClick?.()}
    >
      CTA
    </button>
  )
}));

const buildStore = () => {
  const rootReducer = combineReducers({ migration: migrationDataSlice, authentication: authSlice });
  const store = configureStore({ reducer: rootReducer });
  store.dispatch(setSelectedOrganisation({ ...DEFAULT_DROPDOWN, value: 'org-1', label: 'Org 1' }));
  store.dispatch(setNewMigrationData({ ...DEFAULT_NEW_MIGRATION, iteration: 1 }));
  return store;
};

const renderMigrationPage = (store: ReturnType<typeof buildStore>) =>
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/projects/proj-1/migration/steps/5']}>
        <Routes>
          <Route path="/projects/:projectId/migration/steps/:stepId" element={<Migration />} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );

describe('Migration page — handleOnClickMigrationExecution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMigrationData.mockResolvedValue({
      data: {
        _id: 'proj-1',
        org_id: 'org-1',
        region: 'NA',
        iteration: 1,
        current_step: 5,
        isMigrationStarted: false,
        isMigrationCompleted: false,
        legacy_cms: { cms: 'wordpress', file_format: 'zip' },
        destination_stack_id: 'dest-1',
        stackDetails: {},
        test_stacks: [],
        source_locales: [],
        master_locale: {}
      }
    });
    mockGetCMSDataFromFile.mockImplementation(async (key: string) => {
      if (key === 'migration_steps') {
        return {
          all_steps: [1, 2, 3, 4, 5].map((n) => ({ flow_id: `step-${n}`, name: `${n}` })),
          migration_steps_heading: 'Migration',
          settings: {}
        };
      }
      if (key === 'legacy_cms') {
        return { all_cms: [] };
      }
      return {};
    });
  });

  it('rebuilds the post-start dispatch from the latest redux state (ref), not the stale render-time closure, when redux changes while startMigration is in flight', async () => {
    const store = buildStore();

    // Simulates another concurrent redux update (e.g. a websocket-driven update) landing
    // while startMigration's request is still outstanding.
    mockStartMigration.mockImplementation(async () => {
      await act(async () => {
        store.dispatch(
          updateNewMigrationData({
            content_mapping: {
              ...store.getState().migration.newMigrationData.content_mapping,
              otherCmsTitle: 'concurrent-update-marker'
            }
          })
        );
      });
      return { status: 200 };
    });

    renderMigrationPage(store);

    const cta = await waitFor(() => {
      const button = screen.getByTestId('flow-header-cta');
      expect(button).toHaveAttribute('data-handler', 'handleOnClickMigrationExecution');
      return button;
    });

    fireEvent.click(cta);

    await waitFor(() =>
      expect(store.getState().migration.newMigrationData?.migration_execution?.migrationStarted).toBe(true)
    );

    // Regression: without reading from newMigrationDataRef.current, this dispatch spreads the
    // stale closure captured before startMigration's await, silently discarding the concurrent
    // update above the moment the "migration started" dispatch lands.
    expect(store.getState().migration.newMigrationData?.content_mapping?.otherCmsTitle).toBe(
      'concurrent-update-marker'
    );
  });
});
