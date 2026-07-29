import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

/**
 * TDD — v3 FilePanel component. Backs TC_SRC_017 (initial dropzone + disabled
 * extract), TC_SRC_025 (select → card, remove → dropzone), TC_SRC_030 (specific
 * scope with no module checked keeps the action disabled). Thunks mocked.
 */
vi.mock('../../../../../v3/store/thunks/source.thunks', () => ({
  uploadFile: () => () => {},
  startExportAndPoll: () => () => {},
}));

import sourceReducer, { sourceActions } from '../../../../../v3/store/slice/source.slice';
import FilePanel from '../../../../../v3/components/source/FilePanel';

const renderFile = (setup?: (store: any) => void) => {
  const store = configureStore({ reducer: { source: sourceReducer } });
  setup?.(store);
  const utils = render(
    <Provider store={store}>
      <FilePanel projectId="P1" />
    </Provider>
  );
  return { store, ...utils };
};

const pickFile = (container: HTMLElement, name = 'export.zip') => {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File([new Blob(['zip'])], name)] } });
};

describe('v3 FilePanel', () => {
  it('TC_SRC_017 (positive): initial state shows the dropzone and disables the extract action', () => {
    renderFile();
    expect(screen.getByText(/Drop a migration file or click to browse/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Extract & validate/i })).toBeDisabled();
  });

  // Negative — once a file is picked the extract action enables.
  it('TC_SRC_017 (negative): after a file is picked the extract action enables', () => {
    const { container } = renderFile();
    pickFile(container);
    expect(screen.getByRole('button', { name: /Extract & validate/i })).not.toBeDisabled();
  });

  it('TC_SRC_025 (positive): a picked file shows a file card with its name', () => {
    const { container } = renderFile();
    pickFile(container, 'my-export.zip');
    expect(screen.getByText('my-export.zip')).toBeInTheDocument();
  });

  // Negative — removing the picked file returns to the dropzone.
  it('TC_SRC_025 (negative): removing the picked file returns to the dropzone', () => {
    const { container } = renderFile();
    pickFile(container, 'my-export.zip');
    fireEvent.click(screen.getByLabelText('Remove file'));
    expect(screen.getByText(/Drop a migration file or click to browse/i)).toBeInTheDocument();
  });

  it('TC_SRC_030 (positive): specific scope with no module checked disables the build action', () => {
    renderFile((store) => {
      store.dispatch(sourceActions.setFileValidated({ sourceId: 's1', manifest: [{ name: 'Content Types', count: 2 }] }));
      store.dispatch(sourceActions.setFileField({ field: 'scope', value: 'specific' }));
      store.dispatch(sourceActions.setFileField({ field: 'modules', value: [{ key: 'contentTypes', label: 'Content Types', count: 2, dependsOn: [] }] }));
    });
    expect(screen.getByRole('button', { name: /Build content graph/i })).toBeDisabled();
  });

  // Negative — checking a module enables the build action.
  it('TC_SRC_030 (negative): checking a module enables the build action', () => {
    renderFile((store) => {
      store.dispatch(sourceActions.setFileValidated({ sourceId: 's1', manifest: [{ name: 'Content Types', count: 2 }] }));
      store.dispatch(sourceActions.setFileField({ field: 'scope', value: 'specific' }));
      store.dispatch(sourceActions.setFileField({ field: 'modules', value: [{ key: 'contentTypes', label: 'Content Types', count: 2, dependsOn: [] }] }));
      store.dispatch(sourceActions.setFileField({ field: 'selectedModules', value: ['contentTypes'] }));
    });
    expect(screen.getByRole('button', { name: /Build content graph/i })).not.toBeDisabled();
  });

  it('TC_SRC_018 (positive): a picked file shows the card with name and "selected just now"', () => {
    const { container } = renderFile();
    pickFile(container, 'us-export.zip');
    expect(screen.getByText('us-export.zip')).toBeInTheDocument();
    expect(screen.getByText(/selected just now/i)).toBeInTheDocument();
  });

  // Negative — before any pick there is no file card (dropzone only).
  it('TC_SRC_018 (negative): before a pick there is no file card', () => {
    renderFile();
    expect(screen.queryByText(/selected just now/i)).toBeNull();
  });

  it('TC_SRC_022 (positive): specific scope lists the file modules with counts', () => {
    renderFile((store) => {
      store.dispatch(sourceActions.setFileValidated({ sourceId: 's1', manifest: [] }));
      store.dispatch(sourceActions.setFileField({ field: 'scope', value: 'specific' }));
      store.dispatch(sourceActions.setFileField({ field: 'modules', value: [
        { key: 'contentTypes', label: 'Content Types', count: 5, dependsOn: [] },
        { key: 'entries', label: 'Entries', count: 9, dependsOn: ['contentTypes'] },
      ] }));
    });
    expect(screen.getByLabelText('Content Types')).toBeInTheDocument();
    expect(screen.getByLabelText('Entries')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  // Negative — "everything" scope shows no module checklist.
  it('TC_SRC_022 (negative): "everything" scope shows no module checklist', () => {
    renderFile((store) => {
      store.dispatch(sourceActions.setFileValidated({ sourceId: 's1', manifest: [] }));
      store.dispatch(sourceActions.setFileField({ field: 'modules', value: [
        { key: 'contentTypes', label: 'Content Types', count: 5, dependsOn: [] },
      ] }));
      // scope stays 'all'
    });
    expect(screen.queryByLabelText('Content Types')).toBeNull();
  });

  it('TC_SRC_027 (positive): actions are locked while an extract is running', () => {
    renderFile((store) => {
      store.dispatch(sourceActions.setFileValidated({ sourceId: 's1', manifest: [] }));
      store.dispatch(sourceActions.setRunning(true));
    });
    expect(screen.getByRole('button', { name: /Upload another file/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Building/i })).toBeDisabled();
  });

  // Negative — when not running, the actions are usable.
  it('TC_SRC_027 (negative): actions are usable when not running', () => {
    renderFile((store) => {
      store.dispatch(sourceActions.setFileValidated({ sourceId: 's1', manifest: [] }));
      // scope 'all' → canProceed true, running false
    });
    expect(screen.getByRole('button', { name: /Upload another file/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /Build content graph/i })).not.toBeDisabled();
  });
});
