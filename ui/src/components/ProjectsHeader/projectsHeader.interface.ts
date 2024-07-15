import { CTA } from '../../types/common.interface';
import { ProjectsObj } from '../../pages/Projects/projects.interface';

/**
 * Represents the type definition for the ProjectsHeader component.
 */
export interface ProjectsHeaderType {
  /**
   * The call-to-action button for the ProjectsHeader component.
   */
  cta?: CTA;

  /**
   * The restore call-to-action button for the ProjectsHeader component.
   */
  restore_cta?: CTA;

  /**
   * The heading text for the ProjectsHeader component.
   */
  headingText: string | undefined;

  /**
   * The search text for the ProjectsHeader component.
   */
  searchText: string;

  /**
   * A function to set the search text for the ProjectsHeader component.
   * @param value - The value to set as the search text.
   */
  setSearchText: (value: string) => void;

  /**
   * The placeholder text for the search input in the ProjectsHeader component.
   */
  searchPlaceholder: string;

  /**
   * A function to handle the modal in the ProjectsHeader component.
   */
  handleModal?: () => void;

  /**
   * An array of projects for the ProjectsHeader component.
   */
  allProject: ProjectsObj[] | null;
}
