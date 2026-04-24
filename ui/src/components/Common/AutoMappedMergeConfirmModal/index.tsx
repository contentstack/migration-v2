import {
  ModalBody,
  ModalHeader,
  ModalFooter,
  ButtonGroup,
  Button
} from '@contentstack/venus-components';

interface Props {
  closeModal: () => void;
  onContinue: () => void | Promise<void>;
}

const AutoMappedMergeConfirmModal = (props: Props) => {
  return (
    <>
      <ModalHeader
        title="Auto-mapped content types"
        closeModal={() => props.closeModal()}
      />
      <ModalBody>
        All auto-mapped content types will be merged into your exisitng content types and global fields. You can cancel to stay on this step or continue to the next step.
      </ModalBody>
      <ModalFooter>
        <ButtonGroup>
          <Button buttonType="light" version="v2" onClick={() => props.closeModal()}>
            Cancel
          </Button>
          <Button
            version="v2"
            onClick={async () => {
              await props.onContinue();
            }}
          >
            Continue
          </Button>
        </ButtonGroup>
      </ModalFooter>
    </>
  );
};

export default AutoMappedMergeConfirmModal;
