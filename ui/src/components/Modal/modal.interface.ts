import { IDropDown } from '../../context/app/app.interface';
import { ModalType } from '../../pages/Projects/projects.interface';

/**
 * Represents a modal object.
 */
export interface ModalObj {
  /**
   * Closes the modal.
   */
  closeModal: () => void;
}

/**
 * Represents the props for the ProjectModal component.
 */
export interface ProjectModalProps {
  /**
   * The data for the modal.
   */
  modalData: ModalType;
  
  /**
   * The selected organization from the dropdown.
   */
  selectedOrg: IDropDown;
  
  /**
   * A function to close the modal.
   */
  closeModal: () => void;
}
/**
 * Represents the props for the SettingsModal component.
 */
export interface SettingsModalProps {
  /**
   * The selected organization from the dropdown.
   */
  selectedOrg: IDropDown;

  /**
   * The ID of the project.
   */
  projectId?: string;

  /**
   * The name of the project.
   */
  projectName?: string;

  /**
   * Callback function to close the modal.
   */
  closeModal: () => void;

  /**
   * Function to navigate to a specific URL.
   * @param url - The URL to navigate to.
   */
  navigate: (url: string) => void;
}
