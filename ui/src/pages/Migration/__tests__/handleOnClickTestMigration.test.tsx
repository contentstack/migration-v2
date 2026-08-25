import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { configureStore, combineReducers } from '@reduxjs/toolkit';

import migrationDataSlice, { setNewMigrationData } from '../../../store/slice/migrationDataSlice';
import authSlice, { setSelectedOrganisation } from '../../../store/slice/authSlice';
import { DEFAULT_NEW_MIGRATION, DEFAULT_DROPDOWN } from '../../../context/app/app.interface';
import Migration from '../index';

const mockUpdateCurrentStepData = vi.hoisted(() => vi.fn());
const mockGetCMSDataFromFile = vi.hoisted(() => vi.fn());
const mockGetMigrationData = vi.hoisted(() => vi.fn());

vi.mock('../../../services/api/migration.service', () => ({
  getMigrationData: mockGetMigrationData,
  updateCurrentStepData: mockUpdateCurrentStepData,
  updateLegacyCMSData: vi.fn().mockResolvedValue({ status: 200 }),
  updateDestinationStack: vi.fn().mockResolvedValue({ status: 200 }),
  updateAffixData: vi.fn().mockResolvedValue({ status: 200 }),
  fileformatConfirmation: vi.fn().mockResolvedValue({ status: 200 }),
  updateFileFormatData: vi.fn().mockResolvedValue({ status: 200 }),
  affixConfirmation: vi.fn().mockResolvedValue({ status: 200 }),
  updateStackDetails: vi.fn().mockResolvedValue({ status: 200 }),
  getExistingContentTypes: vi.fn().mockResolvedValue({ status: 201, data: { contentTypes: [] } }),
  getExistingGlobalFields: vi.fn().mockResolvedValue({ status: 201, data: { globalFields: [] } }),
  startMigration: vi.fn().mockResolvedValue({ status: 200 }),
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
vi.mock('../../../hooks/userNavigation', () => ({ default: () => undefined }));

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

const LocationDisplay = () => {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
};

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
      <MemoryRouter initialEntries={['/projects/proj-1/migration/steps/4']}>
        <Routes>
          <Route path="/projects/:projectId/migration/steps/:stepId" element={<Migration />} />
        </Routes>
        <LocationDisplay />
      </MemoryRouter>
    </Provider>
  );

describe('Migration page — handleOnClickTestMigration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMigrationData.mockResolvedValue({
      data: {
        _id: 'proj-1',
        org_id: 'org-1',
        region: 'NA',
        iteration: 1,
        current_step: 4,
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

  const clickTestMigrationCta = async () => {
    const cta = await waitFor(() => {
      const button = screen.getByTestId('flow-header-cta');
      expect(button).toHaveAttribute('data-handler', 'handleOnClickTestMigration');
      return button;
    });
    fireEvent.click(cta);
  };

  it('advances to Migration Execution when updateCurrentStepData succeeds', async () => {
    mockUpdateCurrentStepData.mockResolvedValue({ status: 200 });
    const store = buildStore();
    renderMigrationPage(store);

    await clickTestMigrationCta();

    await waitFor(() =>
      expect(screen.getByTestId('location-display')).toHaveTextContent('/projects/proj-1/migration/steps/5')
    );
  });

  it('stays on Test Migration and surfaces an error instead of silently advancing when updateCurrentStepData fails', async () => {
    // Regression: this status check used to be commented out, so a failed save silently
    // navigated the user to Migration Execution anyway, with no indication anything went wrong.
    mockUpdateCurrentStepData.mockResolvedValue({
      status: 500,
      data: { error: { message: 'Failed to persist current step' } }
    });
    const store = buildStore();
    renderMigrationPage(store);

    await clickTestMigrationCta();

    await screen.findByText('Failed to persist current step');
    expect(screen.getByTestId('location-display')).toHaveTextContent('/projects/proj-1/migration/steps/4');
  });
});
