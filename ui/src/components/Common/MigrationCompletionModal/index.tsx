// Libraries
import { ModalBody, ModalFooter, Button, Link } from '@contentstack/venus-components';

interface Props {
  closeModal: () => void;
  data?: StackDetail;
  isopen: (flag: boolean) => void;
  stackLink?: string;
}
interface StackDetail {
  value?: string;
  label?: string;
}

const MigrationCompletionModal = (props: Props) => {
  return (
    <>
      <ModalBody>
        Migration Execution process is completed. You can view in the selected stack
        <Link href={props?.stackLink} target="_blank" className="ml-4">
          <strong>{props?.data?.label}</strong>
        </Link>
      </ModalBody>
      <ModalFooter>
        <Button
          buttonType="light"
          version={'v2'}
          onClick={() => {
            props.closeModal();
            props.isopen(false);
          }}
        >
          Close
        </Button>
      </ModalFooter>
    </>
  );
};

export default MigrationCompletionModal;
