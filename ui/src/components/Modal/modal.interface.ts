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
  createProject: (values : FormData)=> Promise<CreateProjectResponse>
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

export interface Project {
  name: string;
  id: string;
  status: string;
  created_at: string;   
  modified_at: string;  
}

export interface CreateProjectResponse {
  status: "success";
  message: string;
  project: Project;
}