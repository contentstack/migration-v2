// Libraries
import {
  ModalBody,
  ModalHeader,
  ModalFooter,
  ButtonGroup,
  Button
} from '@contentstack/venus-components';

interface Props {
  closeModal: () => void;
  isopen?: (flag: boolean) => void;
  otherCmsTitle?: string;
  saveContentType?: () => void | Promise<void>;
  openContentType?: () => void;
  changeStep?: () => void | Promise<void>;
  dropdownStateChange: () => void;
}

const SaveChangesModal = (props: Props) => {
  return (
    <>
      <ModalHeader
        title={'Save Changes'}
        closeModal={() => {
          props?.closeModal();
          props?.isopen?.(false);
        }}
        className="text-capitalize"
      />
      <ModalBody className="">
        You have unsaved changes on content type <strong>{props?.otherCmsTitle ?? ''}</strong>. Save
        your changes if you don&apos;t want to lose them.
      </ModalBody>
      <ModalFooter>
        <ButtonGroup>
          <Button
            buttonType="light"
            version={'v2'}
            onClick={() => {
              props.closeModal();
              props?.isopen?.(false);
            }}
          >
            Cancel
          </Button>
          <Button
            buttonType="secondary"
            version={'v2'}
            onClick={async () => {
              props.closeModal();
              props?.dropdownStateChange();
              props.openContentType?.();
              props?.isopen?.(false);
              await props?.changeStep?.();
            }}
          >
            Don&apos;t Save
          </Button>
          <Button
            version={'v2'}
            onClick={async () => {
              props?.dropdownStateChange();
              await props?.saveContentType?.();
              props.closeModal();
              props.openContentType?.();
              await props?.changeStep?.();
            }}
          >
            Save
          </Button>
        </ButtonGroup>
      </ModalFooter>
    </>
  );
};

export default SaveChangesModal;
