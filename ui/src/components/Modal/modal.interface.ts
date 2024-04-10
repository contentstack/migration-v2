import { IDropDown } from '../../context/app/app.interface';
import { ModalType } from '../../pages/Projects/projects.interface';

export interface ModalObj {
  closeModal: () => void;
  data: ModalType;
  selectedOrg: IDropDown;
}
