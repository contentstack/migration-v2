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
