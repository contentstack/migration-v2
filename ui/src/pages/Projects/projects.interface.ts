import { CTA } from '../../types/common.interface';

/**
 * Represents the type definition for the ProjectsType interface.
 */
export interface ProjectsType {
  cta?: CTA;
  restore_cta?: CTA;
  heading?: string;
  search_projects?: string;
  emptystate?: EmptyState;
  create_project_modal?: ModalType;
}

/**
 * Represents the interface for the ModalType object.
 */
export interface ModalType {
  cta?: CTA[];
  description?: string;
  description_placeholder?: string;
  info?: string;
  name?: string;
  name_placeholder?: string;
  title?: string;
  primary_cta?: CTA;
  secondary_cta?: CTA;
}

/**
 * Represents the empty state of a project.
 */
interface EmptyState {
  cta?: CTA[];
  description: string;
  heading: string;
  help_text: string;
  empty_search_heading: string;
  empty_search_description: string;
}

/**
 * Represents a project object.
 */
export interface ProjectsObj {
  /**
   * The unique identifier of the project.
   */
  uid: string;

  /**
   * The name of the project.
   */
  name: string;

  /**
   * The creation date of the project.
   */
  created_at: string;

  /**
   * The last update date of the project.
   */
  updated_at: string;

  /**
   * The optional identifier of the project.
   */
  id?: string;

  /**
   * The status of the project.
   */
  status: string;

  // tags?: TagPill[];
}
