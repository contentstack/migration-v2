import { IDropDown } from '../../context/app/app.interface';
import { ModalType } from '../../pages/Projects/projects.interface';

export interface ModalObj {
  closeModal: () => void;
}
export interface ProjectModalProps {
  modalData: ModalType;
  selectedOrg: IDropDown;
  closeModal: () => void;
  isOpen: (flag: boolean) => void;
  createProject: (values : FormData)=> void
}
export interface SettingsModalProps {
  selectedOrg: IDropDown;
  projectId?: string;
  projectName?: string;
  closeModal: () => void;
  navigate: (url: string) => void;
  handleDeleteProject: () => void;
}

export interface FormData {
  name?: string;
}
