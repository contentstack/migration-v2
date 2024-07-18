
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
  isopen: any;
  otherCmsTitle?: string;
  saveContentType: () => void;
  openContentType: () => void;
}

const SaveChangesModal = (props:Props) => {
  return(
      <>
      <ModalHeader title={'Save Changes'} closeModal={()=>{props?.closeModal(),props.isopen(false)}} className="text-capitalize" />
      <ModalBody>
        <div className='modal-data'>             
          <Paragraph tagName="p" text={`You have unsaved changes on this page. Please save the content type ${props?.otherCmsTitle || ''}.`} variant={"p1"}/>
        </div>
      </ModalBody>
      <ModalFooter>
        <ButtonGroup>
          <Button buttonType="secondary"version={"v2"}  onClick={() => {props.closeModal(); props.isopen(false)}}> 
            Cancel
          </Button>
          <Button version={"v2"} onClick={() => { props.saveContentType(); props.closeModal(); props.openContentType() }}>Save</Button>
        </ButtonGroup>
      </ModalFooter>
    </>
  )

}

export default SaveChangesModal;