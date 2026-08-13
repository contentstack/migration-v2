import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * TDD — cs-project-lifecycle, Phase 1 tranche 1e: the delete confirmation dialog.
 *
 * Covers TC_PL_044–054, against `feature.md` FR-2.2, FR-2.3, FR-2.4, FR-2.5 and
 * NFR-3.
 *
 * No design exists for this dialog (feature.md Q-1 resolved), so its semantics follow
 * the existing confirmation dialog in `ContentMappingPanel` — `role="dialog"`,
 * `aria-modal="true"`, an accessible name, and focus moved into the dialog and
 * returned on close. Those are asserted here as the contract, not as an approximation
 * of a mockup.
 */
import DeleteProjectDialog from '../../../../../v3/components/projects/DeleteProjectDialog';

const PROJECT = { id: 'P1', name: 'Migration Test' };

const mockConfirm = vi.fn();
const mockCancel = vi.fn();

const renderDialog = (over: Record<string, unknown> = {}) =>
  render(
    <DeleteProjectDialog
      project={PROJECT}
      deleting={false}
      onConfirm={mockConfirm}
      onCancel={mockCancel}
      {...over}
    />
  );

/** The dialog's confirm control, found by role so the markup can change freely. */
const confirmBtn = () => screen.getByRole('button', { name: /delete/i });
const cancelBtn = () => screen.getByRole('button', { name: /cancel|keep/i });

beforeEach(() => {
  mockConfirm.mockReset();
  mockCancel.mockReset();
});

describe('cs-project-lifecycle — delete confirmation dialog', () => {
  it('TC_PL_044 (positive): renders a dialog without having deleted anything', () => {
    renderDialog();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  /*
    Negative — taxonomy #4 (forbidden state): merely opening the dialog must not delete.
    Paired with the above so "a dialog exists" cannot be satisfied by a component that
    fires its action on mount.
  */
  it('TC_PL_044 (negative): fires no confirm callback until the operator activates it', async () => {
    renderDialog();

    await userEvent.click(screen.getByRole('dialog'));

    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it("TC_PL_045 (positive): names the project being deleted", () => {
    renderDialog();

    expect(screen.getByRole('dialog')).toHaveTextContent('Migration Test');
  });

  /*
    Negative — taxonomy #2 (invalid shape): the dialog must name the project it was
    given, not a different one. With duplicate names in the store, showing the wrong
    project is how an operator deletes the wrong migration.
  */
  it("TC_PL_045 (negative): does not name a project other than the one supplied", () => {
    renderDialog({ project: { id: 'P2', name: 'Some Other Project' } });

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Some Other Project');
    expect(dialog).not.toHaveTextContent('Migration Test');
  });

  it('TC_PL_046 (positive): states that the exported content will be removed', () => {
    renderDialog();

    expect(screen.getByRole('dialog').textContent).toMatch(/export/i);
  });

  /*
    Negative — taxonomy #1 (missing information): the dialog must also say the action
    cannot be undone. Deletion removes the export folder, so consent without that
    sentence is uninformed — it is the only warning the operator gets.
  */
  it('TC_PL_046 (negative): does not omit that the action cannot be undone', () => {
    renderDialog();

    expect(screen.getByRole('dialog').textContent).toMatch(/cannot be undone|can't be undone|permanent/i);
  });

  it('TC_PL_047 (positive): identifies the project by the id it was given, not by name', async () => {
    renderDialog({ project: { id: 'P-second', name: 'Chirag Sample' } });

    await userEvent.click(confirmBtn());

    expect(mockConfirm).toHaveBeenCalledWith('P-second');
  });

  /*
    Negative — taxonomy #7 (conflict): two projects share the name 'Chirag Sample' in
    the live store. Confirming must carry the ID through, so the name collision cannot
    route the deletion to the wrong record.
  */
  it('TC_PL_047 (negative): does not pass the project name to the confirm callback', async () => {
    renderDialog({ project: { id: 'P-second', name: 'Chirag Sample' } });

    await userEvent.click(confirmBtn());

    expect(mockConfirm).not.toHaveBeenCalledWith('Chirag Sample');
  });

  it('TC_PL_048 (positive): calls cancel when the operator cancels', async () => {
    renderDialog();

    await userEvent.click(cancelBtn());

    expect(mockCancel).toHaveBeenCalledTimes(1);
  });

  // Negative — taxonomy #4: cancelling must not also confirm.
  it('TC_PL_048 (negative): does not call confirm when the operator cancels', async () => {
    renderDialog();

    await userEvent.click(cancelBtn());

    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('TC_PL_049 (positive): issues no delete when cancelled', async () => {
    renderDialog();

    await userEvent.click(cancelBtn());

    expect(mockConfirm).not.toHaveBeenCalled();
    expect(mockCancel).toHaveBeenCalled();
  });

  /*
    Negative — taxonomy #4: confirming DOES issue the delete. Paired so "issues no
    delete" cannot be satisfied by a dialog whose confirm control does nothing at all.
  */
  it('TC_PL_049 (negative): issues the delete when confirmed rather than cancelled', async () => {
    renderDialog();

    await userEvent.click(confirmBtn());

    expect(mockConfirm).toHaveBeenCalledWith('P1');
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('TC_PL_050 (positive): cancels on Escape', async () => {
    renderDialog();

    await userEvent.keyboard('{Escape}');

    expect(mockCancel).toHaveBeenCalledTimes(1);
  });

  // Negative — taxonomy #4: Escape must not delete.
  it('TC_PL_050 (negative): does not confirm the delete on Escape', async () => {
    renderDialog();

    await userEvent.keyboard('{Escape}');

    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('TC_PL_051 (positive): carries role="dialog" and aria-modal="true"', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  /*
    Negative — taxonomy #2 (invalid shape): a modal must not be reachable as a plain
    region. Asserting the ABSENCE of a non-modal fallback keeps the semantics from
    silently degrading to a styled div, which is what screen readers would announce as
    ordinary content.
  */
  it('TC_PL_051 (negative): is not exposed as a non-modal container', () => {
    renderDialog();

    expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-modal', 'false');
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('TC_PL_052 (positive): exposes a non-empty accessible name', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog');
    const name = dialog.getAttribute('aria-label') ?? dialog.getAttribute('aria-labelledby');
    expect(name).toBeTruthy();
  });

  /*
    Negative — taxonomy #2: the accessible NAME must not be the project name alone.
    Announcing only "Migration Test" tells a screen-reader user nothing about what is
    being asked; the name has to describe the action.
  */
  it('TC_PL_052 (negative): does not use the bare project name as the accessible name', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-label')).not.toBe('Migration Test');
  });

  it('TC_PL_053 (positive): moves focus into the dialog when it opens', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement) || document.activeElement === dialog).toBe(true);
  });

  /*
    Negative — taxonomy #5 (keyboard access denied): every control must be reachable by
    keyboard, and confirming must work without a pointer. A dialog only operable by
    mouse is unusable for a keyboard user, and this one gates a destructive action.
  */
  it('TC_PL_053 (negative): confirms from the keyboard alone, without a pointer', async () => {
    renderDialog();

    confirmBtn().focus();
    await userEvent.keyboard('{Enter}');

    expect(mockConfirm).toHaveBeenCalledWith('P1');
  });

  it('TC_PL_054 (positive): does not leave focus on the document body while open', () => {
    renderDialog();

    expect(document.activeElement).not.toBe(document.body);
  });

  /*
    Negative — taxonomy #1 (missing behaviour): focus must return to the control that
    OPENED the dialog, not merely stay off the body.

    ⚠️ The scenario has to include a trigger. An earlier version of this test rendered
    the dialog in isolation and then asserted focus was not on the body — but with
    nothing focused beforehand, the body IS the correct place to return to, so the test
    was demanding behaviour the situation could not produce. Focusing a stand-in trigger
    first reproduces the real flow and lets the assertion be the stronger one: focus
    goes back to exactly where it came from.
  */
  it('TC_PL_054 (negative): returns focus to the control that opened the dialog', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Delete';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { unmount } = renderDialog();
    await userEvent.click(cancelBtn());
    unmount();

    expect(mockCancel).toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
