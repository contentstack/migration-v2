
import {
  ModalBody,
  ModalHeader,
  ModalFooter,
  ButtonGroup,
  Button,
  Paragraph
} from '@contentstack/venus-components';

interface Props {
    closeModal: () => void;
    goBack : () => void;
    isopen: any;
}

const NotificationModal = (props:Props) => {
    return(
        <>
        <ModalHeader title={'Save Changes'} closeModal={()=>{props?.closeModal(),props.isopen(false)}} className="text-capitalize" />
        <ModalBody>
          <div className='modal-data'>             
            <Paragraph tagName="p" text={'You have unsaved changes on this page. Do you want to go back without saving?'} variant={"p1"}/>
          </div>
        </ModalBody>
        <ModalFooter>
        <ButtonGroup>
            <Button buttonType="light"version={"v2"}  onClick={() => {props.closeModal(), props.isopen(false)}}> 
               Cancel
           </Button>
            <Button version={"v2"} onClick={()=> {props?.goBack(), props.closeModal()}}>Yes, go back</Button>
          </ButtonGroup>
        </ModalFooter>
      </>
    )

}

export default NotificationModal;