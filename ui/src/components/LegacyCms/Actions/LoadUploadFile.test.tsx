import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import migrationDataSlice, { setNewMigrationData } from '../../../store/slice/migrationDataSlice';
import authSlice from '../../../store/slice/authSlice';
import { DEFAULT_NEW_MIGRATION } from '../../../context/app/app.interface';
import LoadUploadFile from './LoadUploadFile';

vi.mock('react-router', () => ({
  useParams: () => ({ projectId: 'proj-1' })
}));

vi.mock('../../../services/api/upload.service', () => ({
  fileValidation: vi.fn().mockResolvedValue({ status: 200, data: {} }),
  uploadLocalFileToContainer: vi.fn().mockResolvedValue(null)
}));
vi.mock('../../../services/api/migration.service', () => ({
  getMigrationData: vi.fn().mockResolvedValue({ data: {} })
}));

/**
 * Regression: the "File Validate" button's disabled condition was fixed to require a
 * non-empty local path (see routes/index.ts's matching backend guard) — but the fix
 * referenced a bare `localPath` identifier that doesn't exist anywhere in THIS
 * component's scope (a same-named variable exists only in an unrelated, earlier
 * function in the same file). That's a ReferenceError on every render, caught by the
 * app's ErrorBoundary and shown as a full-page "Server Error" — confirmed live. The
 * correct reference, matching the pattern already used elsewhere in this exact
 * component, is `fileDetails?.localPath`.
 */
const buildStore = (localPath: string) => {
  const rootReducer = combineReducers({ migration: migrationDataSlice, authentication: authSlice });
  const store = configureStore({ reducer: rootReducer });
  store.dispatch(
    setNewMigrationData({
      ...DEFAULT_NEW_MIGRATION,
      legacy_cms: {
        ...DEFAULT_NEW_MIGRATION.legacy_cms,
        affix: 'cs',
        selectedFileFormat: { fileformat_id: 'directory', title: 'Folder' },
        uploadedFile: {
          ...DEFAULT_NEW_MIGRATION.legacy_cms.uploadedFile,
          isValidated: false,
          file_details: { ...DEFAULT_NEW_MIGRATION.legacy_cms.uploadedFile?.file_details, localPath }
        }
      }
    })
  );
  return store;
};

const renderWithStore = (localPath: string) =>
  render(
    <Provider store={buildStore(localPath)}>
      <LoadUploadFile currentStep={1} handleStepChange={() => {}} />
    </Provider>
  );

describe('LoadUploadFile — File Validate button', () => {
  it('renders without crashing (no ReferenceError) when the local path is empty', () => {
    expect(() => renderWithStore('')).not.toThrow();
  });

  it('renders without crashing when the local path is non-empty', () => {
    expect(() => renderWithStore('/Users/qa/export/catalog.impex')).not.toThrow();
  });

  it('disables the File Validate button when the local path is empty', () => {
    renderWithStore('');
    const button = screen.getByText('File Validate').closest('button');
    expect(button).toBeDisabled();
  });
});
