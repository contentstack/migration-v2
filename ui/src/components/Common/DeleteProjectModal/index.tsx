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
        <h3>You are about to delete the project, {projectName}</h3> <br />
        <p>
          All the content stored within the project will be deleted permanently. This action cannot
          be undone.
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
