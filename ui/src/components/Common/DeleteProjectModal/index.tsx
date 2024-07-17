// Libraries
import {
  Icon,
  Button,
  Notification,
  ModalBody,
  ModalHeader,
  ModalFooter,
  ButtonGroup
} from '@contentstack/venus-components';

// Service
import { deleteProject } from '../../../services/api/project.service';

// Interfaces
import { SettingsModalProps } from '../../../components/Modal/modal.interface';

/**
 * Renders a modal component for deleting a project.
 *
 * @param {SettingsModalProps} props - The component props.
 * @returns {JSX.Element} The rendered DeleteProjectModal component.
 */
const DeleteProjectModal = (props: SettingsModalProps) => {
  const {
    closeModal,
    navigate,
    projectId,
    projectName,
    selectedOrg
  } = props;

  /**
   * Handles the deletion of the project.
   *
   * @param {() => void} closeModal - A function to close the modal.
   * @returns {Promise<void>} A promise that resolves when the project is deleted.
   */
  const handleDeleteProject = async (closeModal: () => void): Promise<void> => {
    const response = await deleteProject(selectedOrg?.value || '', projectId ?? '',);

    if (response?.status === 200) {
      closeModal();
      setTimeout(() => {
        navigate('/projects')
      }, 800)
      setTimeout(() => {
        Notification({
          notificationContent: { text: response?.data?.data?.message },
          notificationProps: {
            position: 'bottom-center',
            hideProgressBar: true
          },
          type: 'success'
        });
      }, 1200)
    }
  }

  return (
    <>
      <ModalHeader
        title="Delete Project"
        closeIconTestId="cs-default-header-close"
        closeModal={closeModal}
      />

      <ModalBody className="modalBodyCustomClass">
        <h3>You are about to delete the project, {projectName}</h3> <br />
        <p>
          All the content stored within the project will be deleted permanently. This action
          cannot be undone.
        </p>
      </ModalBody>

      <ModalFooter>
        <ButtonGroup>
          <Button buttonType="light" onClick={() => closeModal()}>
            Cancel
          </Button>
          <Button className="Button Button--destructive Button--icon-alignment-left Button--size-large Button--v2" onClick={() => handleDeleteProject(closeModal)} buttonType="submit">
            <div className="flex-center">
              <div className="flex-v-center Button__mt-regular Button__visible">
                <Icon icon="Delete" version="v2" size="tiny" />
              </div>
            </div>
            Delete
          </Button>
        </ButtonGroup>
      </ModalFooter>
    </>
  );
};

export default DeleteProjectModal;