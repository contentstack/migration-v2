// Libraries
import { useState } from 'react';
import {
  Button,
  ModalBody,
  ModalHeader,
  ModalFooter,
  ButtonGroup
} from '@contentstack/venus-components';

// Interfaces
import { SettingsModalProps } from '../../../components/Modal/modal.interface';

/**
 * Renders a modal component for deleting a project.
 *
 * @param {SettingsModalProps} props - The component props.
 * @returns {JSX.Element} The rendered DeleteProjectModal component.
 */
const DeleteProjectModal = (props: SettingsModalProps) => {
  const { closeModal, projectName, handleDeleteProject } = props;

  const [isLoading, setIsLoading] = useState<boolean>(false);

  
  return (
    <>
      <ModalHeader
        title="Delete Project"
        closeIconTestId="cs-default-header-close"
        closeModal={closeModal}
      />

      <ModalBody className="modalBodyCustomClass">
        You are about to delete this project. <br />
        This will permanently remove the project and all its content. This action cannot be undone.
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
            onClick={() => handleDeleteProject()}
          >
            Delete
          </Button>
        </ButtonGroup>
      </ModalFooter>
    </>
  );
};

export default DeleteProjectModal;
