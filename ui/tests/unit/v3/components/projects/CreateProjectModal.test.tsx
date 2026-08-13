import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * TDD — v3 CreateProjectModal.
 *
 * Backs TC_PD_064 (the two fields), TC_PD_065–079 (validation: required name,
 * both length caps and their boundaries, leading whitespace, optional
 * description, submit gating), TC_PD_075–084 (cancel via control, close and
 * overlay), TC_PD_079 (failure keeps the modal open with input preserved).
 *
 * feature.md FR-7.1–FR-7.7, FR-7.11, FR-7.13, AC-4.1–AC-4.5, AC-4.8, AC-4.10,
 * EC-5.
 *
 * Creating a project is irreversible in v3 — nothing can delete one — so every
 * cancel path asserts that no submission was attempted at all.
 */
import CreateProjectModal from '../../../../../v3/components/projects/CreateProjectModal';

const mockSubmit = vi.fn();
const mockCancel = vi.fn();

const renderModal = (over: Record<string, unknown> = {}) =>
  render(
    <CreateProjectModal
      open
      creating={false}
      error={undefined}
      onSubmit={mockSubmit}
      onCancel={mockCancel}
      {...(over as never)}
    />
  );

const nameField = () => screen.getByTestId('create-project-name');
const descField = () => screen.getByTestId('create-project-description');
const submit = () => screen.getByTestId('create-project-submit');

beforeEach(() => {
  mockSubmit.mockReset().mockResolvedValue(undefined);
  mockCancel.mockReset();
});

describe('v3 CreateProjectModal — fields', () => {
  it('TC_PD_064 (positive): renders a name field and a description field', () => {
    renderModal();
    expect(nameField()).toBeInTheDocument();
    expect(descField()).toBeInTheDocument();
  });

  // Negative — taxonomy #4 (forbidden state): nothing is rendered while the modal
  // is closed, so its fields cannot be reached or submitted from a closed modal.
  it('TC_PD_064 (negative): nothing is rendered while the modal is closed', () => {
    renderModal({ open: false });
    expect(screen.queryByTestId('create-project-name')).toBeNull();
    expect(screen.queryByTestId('create-project-submit')).toBeNull();
  });
});

describe('v3 CreateProjectModal — validation', () => {
  it('TC_PD_065 (positive): submitting with an empty name sends nothing and leaves the modal open', async () => {
    renderModal();

    await userEvent.click(submit());

    expect(mockSubmit).not.toHaveBeenCalled();
    expect(nameField()).toBeInTheDocument();
  });

  // Negative — taxonomy #1 (missing input, contrast): a valid name does submit,
  // so the refusal above is the empty-name guard and not a dead submit control.
  it('TC_PD_065 (negative): a valid name does submit', async () => {
    renderModal();

    await userEvent.type(nameField(), 'EU region migration');
    await userEvent.click(submit());

    expect(mockSubmit).toHaveBeenCalledOnce();
  });

  it('TC_PD_066 (positive): a 201-character name is rejected with a message and sends nothing', async () => {
    renderModal();

    await userEvent.type(nameField(), 'x'.repeat(201));
    await userEvent.click(submit());

    expect(screen.getByRole('alert')).toHaveTextContent('Project name must be 200 characters or fewer');
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  // Negative — taxonomy #3 (boundary): 200 characters is inside the cap, so the
  // rejection above is the boundary rather than a blanket refusal of long names.
  it('TC_PD_066 (negative): a 200-character name shows no length message', async () => {
    renderModal();

    await userEvent.type(nameField(), 'x'.repeat(200));

    expect(screen.queryByText(/200 characters or fewer/)).toBeNull();
  });

  it('TC_PD_067 (positive): a name of exactly 200 characters is accepted and submitted', async () => {
    renderModal();
    const name = 'x'.repeat(200);

    await userEvent.type(nameField(), name);
    await userEvent.click(submit());

    expect(mockSubmit).toHaveBeenCalledWith({ name, description: '' });
  });

  // Negative — taxonomy #3 (boundary): one character past the cap is not
  // submitted, so acceptance is bounded rather than unlimited.
  it('TC_PD_067 (negative): one character past the cap is not submitted', async () => {
    renderModal();

    await userEvent.type(nameField(), 'x'.repeat(201));
    await userEvent.click(submit());

    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('TC_PD_068 (positive): a name beginning with whitespace is rejected and sends nothing', async () => {
    renderModal();

    await userEvent.type(nameField(), ' Leading space');
    await userEvent.click(submit());

    expect(screen.getByRole('alert')).toHaveTextContent('Project name cannot start with a space');
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  // Negative — taxonomy #2 (invalid shape): only a LEADING space is forbidden.
  // A name containing interior spaces is ordinary and must be accepted.
  it('TC_PD_068 (negative): interior spaces are accepted', async () => {
    renderModal();

    await userEvent.type(nameField(), 'EU region migration');
    await userEvent.click(submit());

    expect(mockSubmit).toHaveBeenCalledWith({ name: 'EU region migration', description: '' });
  });

  it('TC_PD_069 (positive): a valid name with no description is submitted', async () => {
    renderModal();

    await userEvent.type(nameField(), 'Docs stack copy');
    await userEvent.click(submit());

    expect(mockSubmit).toHaveBeenCalledWith({ name: 'Docs stack copy', description: '' });
  });

  // Negative — taxonomy #1 (missing input): the description being optional must
  // not mean it is discarded when supplied.
  it('TC_PD_069 (negative): a supplied description is included rather than discarded', async () => {
    renderModal();

    await userEvent.type(nameField(), 'Docs stack copy');
    await userEvent.type(descField(), 'Quarterly refresh');
    await userEvent.click(submit());

    expect(mockSubmit).toHaveBeenCalledWith({
      name: 'Docs stack copy',
      description: 'Quarterly refresh',
    });
  });

  it('TC_PD_070 (positive): a 256-character description is rejected and sends nothing', async () => {
    renderModal();

    await userEvent.type(nameField(), 'Docs stack copy');
    await userEvent.type(descField(), 'y'.repeat(256));
    await userEvent.click(submit());

    expect(screen.getByRole('alert')).toHaveTextContent('Description must be 255 characters or fewer');
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  // Negative — taxonomy #3 (boundary): 255 characters is inside the cap.
  it('TC_PD_070 (negative): a 255-character description shows no length message', async () => {
    renderModal();

    await userEvent.type(descField(), 'y'.repeat(255));

    expect(screen.queryByText(/255 characters or fewer/)).toBeNull();
  });

  it('TC_PD_071 (positive): a description of exactly 255 characters is accepted and submitted', async () => {
    renderModal();
    const description = 'y'.repeat(255);

    await userEvent.type(nameField(), 'Docs stack copy');
    await userEvent.type(descField(), description);
    await userEvent.click(submit());

    expect(mockSubmit).toHaveBeenCalledWith({ name: 'Docs stack copy', description });
  });

  // Negative — taxonomy #3 (boundary): one character past the description cap is
  // not submitted even though the name is valid.
  it('TC_PD_071 (negative): one character past the description cap blocks submission', async () => {
    renderModal();

    await userEvent.type(nameField(), 'Docs stack copy');
    await userEvent.type(descField(), 'y'.repeat(256));
    await userEvent.click(submit());

    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('TC_PD_072 (positive): the submit control is inoperative while the name is invalid', async () => {
    renderModal();

    expect(submit()).toBeDisabled();
    await userEvent.click(submit());

    expect(mockSubmit).not.toHaveBeenCalled();
  });

  // Negative — taxonomy #4 (forbidden state, contrast): it becomes operative once
  // the name is valid, so the disable is the validity gate and not permanent.
  it('TC_PD_072 (negative): the submit control becomes operative once the name is valid', async () => {
    renderModal();

    await userEvent.type(nameField(), 'Blog content move');

    expect(submit()).toBeEnabled();
  });
});

describe('v3 CreateProjectModal — cancelling', () => {
  it('TC_PD_075 (positive): the cancel control submits nothing', async () => {
    renderModal();

    await userEvent.type(nameField(), 'EU region migration');
    await userEvent.click(screen.getByTestId('create-project-cancel'));

    expect(mockSubmit).not.toHaveBeenCalled();
    expect(mockCancel).toHaveBeenCalledOnce();
  });

  // Negative — taxonomy #4 (forbidden state): cancelling must not submit even
  // when the entered values are entirely valid.
  it('TC_PD_075 (negative): cancelling with a fully valid form still submits nothing', async () => {
    renderModal();

    await userEvent.type(nameField(), 'EU region migration');
    await userEvent.type(descField(), 'Quarterly refresh');
    await userEvent.click(screen.getByTestId('create-project-cancel'));

    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('TC_PD_076 (positive): the close control submits nothing', async () => {
    renderModal();

    await userEvent.type(nameField(), 'EU region migration');
    await userEvent.click(screen.getByTestId('create-project-close'));

    expect(mockSubmit).not.toHaveBeenCalled();
    expect(mockCancel).toHaveBeenCalledOnce();
  });

  // Negative — taxonomy #5 (permission denial): the close control must be
  // reachable by keyboard too, so cancelling is not pointer-only.
  it('TC_PD_076 (negative): the close control is reachable and operable from the keyboard', async () => {
    renderModal();

    screen.getByTestId('create-project-close').focus();
    await userEvent.keyboard('{Enter}');

    expect(mockCancel).toHaveBeenCalledOnce();
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('TC_PD_077 (positive): the overlay submits nothing', async () => {
    renderModal();

    await userEvent.type(nameField(), 'EU region migration');
    await userEvent.click(screen.getByTestId('create-project-overlay'));

    expect(mockSubmit).not.toHaveBeenCalled();
    expect(mockCancel).toHaveBeenCalledOnce();
  });

  // Negative — taxonomy #4 (forbidden state): a click inside the panel is not a
  // click on the overlay, so interacting with the form does not close the modal.
  it('TC_PD_077 (negative): clicking inside the panel does not cancel', async () => {
    renderModal();

    await userEvent.click(screen.getByTestId('create-project-panel'));

    expect(mockCancel).not.toHaveBeenCalled();
  });
});

describe('v3 CreateProjectModal — failure', () => {
  it('TC_PD_079 (positive): a failed creation keeps the modal open, shows the failure and preserves the name', () => {
    renderModal({ error: 'Could not create the project.' });

    expect(screen.getByTestId('create-project-panel')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not create the project.');
  });

  // Negative — taxonomy #6 (dependency failure): what the user typed survives the
  // failure, so the form is not reset and retypeable input is not lost.
  it('TC_PD_079 (negative): the typed name is not cleared when a creation fails', async () => {
    const { rerender } = renderModal();

    await userEvent.type(nameField(), 'EU region migration');
    rerender(
      <CreateProjectModal
        open
        creating={false}
        error="Could not create the project."
        onSubmit={mockSubmit}
        onCancel={mockCancel}
      />
    );

    expect(nameField()).toHaveValue('EU region migration');
  });
});

/**
 * cs-project-lifecycle, tranche 1e — TC_PL_095–102 (FR-4.1–FR-4.4).
 *
 * The modal already accepts an `error` prop rendered in a `role="alert"` element, so
 * the duplicate-name refusal needs no new surface — what these tests pin is that the
 * refusal does not cost the operator their typed input, and that the optional
 * pre-submit hint uses the same comparison rule the server does.
 */
describe('cs-project-lifecycle — duplicate-name refusal in the create modal', () => {
  const DUPLICATE = 'A project named "Migration Test" already exists.';

  it('TC_PL_095 (positive): displays the refusal reason', () => {
    renderModal({ error: DUPLICATE });

    expect(screen.getByTestId('create-project-error')).toHaveTextContent(DUPLICATE);
  });

  /*
    Negative — taxonomy #1 (missing input): no error means no alert. A permanently
    rendered empty alert region trains the operator to ignore the one place a real
    refusal appears.
  */
  it('TC_PL_095 (negative): renders no refusal region when there is no error', () => {
    renderModal();

    expect(screen.queryByTestId('create-project-error')).toBeNull();
  });

  it('TC_PL_096 (positive): announces the refusal through a live alert', () => {
    renderModal({ error: DUPLICATE });

    expect(screen.getByRole('alert')).toHaveTextContent(DUPLICATE);
  });

  /*
    Negative — taxonomy #2 (invalid shape): the refusal must not be announced as an
    ordinary status. `role="alert"` is what makes a screen reader interrupt with it; a
    silent status leaves a blind operator waiting for a create that already failed.
  */
  it('TC_PL_096 (negative): does not render the refusal as a non-assertive status only', () => {
    renderModal({ error: DUPLICATE });

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('TC_PL_097 (positive): keeps the typed name and description when a refusal arrives', async () => {
    const { rerender } = renderModal();
    await userEvent.type(nameField(), 'Migration Test');
    await userEvent.type(descField(), 'Q3 rollout');

    rerender(
      <CreateProjectModal
        open
        creating={false}
        error={DUPLICATE}
        onSubmit={mockSubmit}
        onCancel={mockCancel}
      />
    );

    expect(nameField()).toHaveValue('Migration Test');
    expect(descField()).toHaveValue('Q3 rollout');
  });

  /*
    Negative — taxonomy #4 (forbidden state): the fields must not be cleared. Losing
    typed input on a validation failure is a defect in its own right, and the existing
    component comments record that its reset is deliberately not keyed on `error` for
    exactly this reason — this test protects that decision.
  */
  it('TC_PL_097 (negative): does not clear the fields when a refusal arrives', async () => {
    const { rerender } = renderModal();
    await userEvent.type(nameField(), 'Migration Test');

    rerender(
      <CreateProjectModal
        open
        creating={false}
        error={DUPLICATE}
        onSubmit={mockSubmit}
        onCancel={mockCancel}
      />
    );

    expect(nameField()).not.toHaveValue('');
  });

  it('TC_PL_098 (positive): stays open when a refusal arrives', () => {
    renderModal({ error: DUPLICATE });

    expect(nameField()).toBeInTheDocument();
    expect(submit()).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #4: the refusal must not close the modal or disable the submit
    control. Either would leave the operator unable to correct the name they were asked
    to change.
  */
  it('TC_PL_098 (negative): leaves the submit control usable after a refusal', async () => {
    renderModal({ error: DUPLICATE, existingNames: [] });
    await userEvent.clear(nameField());
    await userEvent.type(nameField(), 'A Fresh Name');

    expect(submit()).not.toBeDisabled();
  });

  it('TC_PL_099 (positive): submits again once the name is corrected', async () => {
    renderModal({ error: DUPLICATE });
    await userEvent.clear(nameField());
    await userEvent.type(nameField(), 'A Fresh Name');
    await userEvent.click(submit());

    expect(mockSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'A Fresh Name' }));
  });

  /*
    Negative — taxonomy #7 (conflict): resubmitting the SAME duplicate name must not be
    treated as a fresh attempt by the client. The server rule still decides, but the
    client must not pretend the refusal was resolved by pressing submit again.
  */
  it('TC_PL_099 (negative): does not clear the standing refusal without a change to the name', async () => {
    renderModal({ error: DUPLICATE });
    /*
      The name must be typed for this scenario to be the one described. With the field
      left empty, pressing submit raises the local "name is required" rule instead, which
      legitimately takes precedence — so the original version of this test was asserting
      the refusal survived a situation that replaces it for a different reason.
    */
    await userEvent.type(nameField(), 'Migration Test');

    await userEvent.click(submit());

    expect(screen.getByTestId('create-project-error')).toHaveTextContent(DUPLICATE);
  });

  it('TC_PL_100 (positive): warns before submit when the name clashes with a loaded project', async () => {
    renderModal({ existingNames: ['Migration Test'] });

    await userEvent.type(nameField(), 'Migration Test');

    expect(screen.getByRole('alert').textContent).toMatch(/already/i);
  });

  /*
    Negative — taxonomy #7: the pre-submit hint must not stop the submission from being
    attempted when the operator insists. The server rule is the contract (FR-3.7); the
    hint is an affordance and must not become a second, divergent gate.
  */
  it('TC_PL_100 (negative): still lets the operator submit a name the hint flagged', async () => {
    renderModal({ existingNames: ['Migration Test'] });
    await userEvent.type(nameField(), 'Migration Test');

    await userEvent.click(submit());

    expect(mockSubmit).toHaveBeenCalled();
  });

  it('TC_PL_101 (positive): applies the same case and whitespace rule as the server', async () => {
    renderModal({ existingNames: ['Migration Test'] });

    /*
      TRAILING whitespace, not leading. A name beginning with a space is rejected by the
      modal's pre-existing leading-space rule, which takes precedence in the message
      chain — correctly, because that name can never be created at all, so telling the
      operator it clashes would be the less actionable of the two messages. Trailing
      whitespace is the case where trimming is what decides the comparison, which is what
      this row is about.
    */
    await userEvent.type(nameField(), 'migration test  ');

    expect(screen.getByRole('alert').textContent).toMatch(/already/i);
  });

  /*
    Negative — taxonomy #3 (boundary): inner whitespace is part of the name, so
    'Migration  Test' is a different project and must NOT be flagged. A hint that
    collapsed inner spaces would disagree with the server and warn about a name the
    server would accept.
  */
  it('TC_PL_101 (negative): does not flag a name differing by inner whitespace', async () => {
    renderModal({ existingNames: ['Migration Test'] });

    await userEvent.type(nameField(), 'Migration  Test');

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('TC_PL_102 (positive): shows no hint for a name that clashes with nothing', async () => {
    renderModal({ existingNames: ['Migration Test'] });

    await userEvent.type(nameField(), 'Something Else Entirely');

    expect(screen.queryByRole('alert')).toBeNull();
  });

  /*
    Negative — taxonomy #1 (empty input): an empty field must not be reported as a
    clash. The presence rule already covers it, and 'that name is taken' for a name the
    operator has not typed would be actively misleading.
  */
  it('TC_PL_102 (negative): shows no clash hint for an empty name field', async () => {
    renderModal({ existingNames: ['Migration Test'] });

    await userEvent.type(nameField(), 'x');
    await userEvent.clear(nameField());

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
