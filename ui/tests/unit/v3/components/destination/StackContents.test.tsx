import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

/**
 * TDD — v3 StackContents component ("Stack contents" sidebar card).
 * Backs TC_DEST_046 (shows the selected stack's name), TC_DEST_047 (empty-stack
 * message), TC_DEST_048 (stat tiles for a non-empty stack), TC_DEST_049 (a
 * just-created stack always reads as empty).
 * feature.md AC-9.1–9.3, FR-10.1–10.3, UC-9a.
 */
import destinationReducer, {
  destinationActions,
} from '../../../../../v3/store/slice/destination.slice';
import StackContents from '../../../../../v3/components/destination/StackContents';

const EMPTY_MSG = 'This stack is empty — everything you migrate will be created fresh.';

const renderContents = (setup?: (store: any) => void) => {
  const store = configureStore({ reducer: { destination: destinationReducer } });
  setup?.(store);
  render(
    <Provider store={store}>
      <StackContents />
    </Provider>
  );
  return store;
};

/** Selects an existing stack named "Production — EU Marketing Site". */
const selectExistingStack = (store: any) => {
  store.dispatch(
    destinationActions.setStacks([{ value: 'blt1', label: 'Production — EU Marketing Site' }])
  );
  store.dispatch(destinationActions.setField({ field: 'stackApiKey', value: 'blt1' }));
};

describe('v3 StackContents', () => {
  it('TC_DEST_046 (positive): the card shows the selected destination stack name', () => {
    renderContents(selectExistingStack);
    expect(screen.getByTestId('stack-contents-name')).toHaveTextContent(
      'Production — EU Marketing Site'
    );
  });

  // Negative — taxonomy #1 (missing input): with no stack selected the card renders no
  // stack name at all rather than a blank/placeholder name.
  it('TC_DEST_046 (negative): with no stack selected the card renders no stack name', () => {
    renderContents();
    expect(screen.queryByTestId('stack-contents-name')).toBeNull();
  });

  it('TC_DEST_047 (positive): an empty destination stack shows the empty-state message', () => {
    renderContents((store) => {
      selectExistingStack(store);
      store.dispatch(destinationActions.setStackStats({ isEmpty: true, stats: [] }));
    });
    expect(screen.getByText(EMPTY_MSG)).toBeInTheDocument();
  });

  // Negative — taxonomy #4 (forbidden state): a stack WITH content must not show the
  // empty-state copy.
  it('TC_DEST_047 (negative): a non-empty destination stack does not show the empty-state message', () => {
    renderContents((store) => {
      selectExistingStack(store);
      store.dispatch(
        destinationActions.setStackStats({
          isEmpty: false,
          stats: [{ label: 'Content types', value: '12' }],
        })
      );
    });
    expect(screen.queryByText(EMPTY_MSG)).toBeNull();
  });

  it('TC_DEST_048 (positive): a non-empty destination stack renders its stat tiles', () => {
    renderContents((store) => {
      selectExistingStack(store);
      store.dispatch(
        destinationActions.setStackStats({
          isEmpty: false,
          stats: [
            { label: 'Content types', value: '12' },
            { label: 'Entries', value: '2,410' },
          ],
        })
      );
    });

    const tiles = screen.getAllByTestId('stack-stat-tile');
    expect(tiles).toHaveLength(2);
    expect(tiles[0]).toHaveTextContent('Content types');
    expect(tiles[0]).toHaveTextContent('12');
  });

  // Negative — taxonomy #4 (forbidden state): an empty stack renders NO stat tiles —
  // the empty message replaces the grid rather than sitting above a grid of zeroes.
  it('TC_DEST_048 (negative): an empty destination stack renders no stat tiles', () => {
    renderContents((store) => {
      selectExistingStack(store);
      store.dispatch(destinationActions.setStackStats({ isEmpty: true, stats: [] }));
    });
    expect(screen.queryAllByTestId('stack-stat-tile')).toHaveLength(0);
  });

  it('TC_DEST_049 (positive): a just-created stack reads as empty without needing a stats fetch', () => {
    renderContents((store) => {
      store.dispatch(destinationActions.stackCreated({ apiKey: 'blt-new', name: 'brand-new-stack' }));
    });

    expect(screen.getByTestId('stack-contents-name')).toHaveTextContent('brand-new-stack');
    expect(screen.getByText(EMPTY_MSG)).toBeInTheDocument();
  });

  // Negative — taxonomy #4 (forbidden state): creating a stack must not leak the
  // previously-selected stack's statistics into the new stack's card.
  it('TC_DEST_049 (negative): creating a stack clears the previous stack’s stat tiles', () => {
    renderContents((store) => {
      selectExistingStack(store);
      store.dispatch(
        destinationActions.setStackStats({
          isEmpty: false,
          stats: [{ label: 'Entries', value: '2,410' }],
        })
      );
      store.dispatch(destinationActions.stackCreated({ apiKey: 'blt-new', name: 'brand-new-stack' }));
    });

    expect(screen.queryAllByTestId('stack-stat-tile')).toHaveLength(0);
    expect(screen.queryByText('2,410')).toBeNull();
  });
});
