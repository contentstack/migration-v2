// Libraries
import { useState } from 'react';
import {
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

  const [isLoading, setIsLoading] = useState<boolean>(false)


  /**
   * Handles the deletion of the project.
   *
   * @param {() => void} closeModal - A function to close the modal.
   * @returns {Promise<void>} A promise that resolves when the project is deleted.
   */
  const handleDeleteProject = async (closeModal: () => void): Promise<void> => {
    setIsLoading(true);
    const response = await deleteProject(selectedOrg?.value || '', projectId ?? '',);

    if (response?.status === 200) {
      setIsLoading(false);
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
          <Button 
            version="v2"
            buttonType="destructive"
            type="submit"
            icon="v2-Delete"
            tabindex={0}
            isLoading={isLoading}
            onClick={() => handleDeleteProject(closeModal)}>
            Delete
          </Button>
        </ButtonGroup>
      </ModalFooter>
    </>
  );
};

export default DeleteProjectModal;