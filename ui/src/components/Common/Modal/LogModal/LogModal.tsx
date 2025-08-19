import { ModalBody, ModalHeader } from '@contentstack/venus-components'
import { LogEntry } from '../../../ExecutionLogs/executionlog.interface';
import './LogModal.scss'

interface LogModalProps {
  readonly props: {
    closeModal: () => void;
  };
  readonly data: LogEntry;
}

export default function LogModal({ props, data }: LogModalProps) {
  return (
    <>
      <ModalHeader title={data?.level} closeModal={props?.closeModal} closeIconTestId="cs-default-header-close" className='text'/>

      <ModalBody className="modalBodyCustomClass">
        {data?.methodName && (<><h3>Method Name: {data?.methodName}</h3><br /></>)}
        <div className='log-modal'>
          <p className='text'>{data?.message}</p>
        </div>
      </ModalBody>
    </>
  );
}
