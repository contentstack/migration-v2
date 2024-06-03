import { CTA } from '../../types/common.interface';
import { ProjectsObj } from '../../pages/Projects/projects.interface';

export interface ProjectsHeaderType {
  cta?: CTA;
  headingText: string | undefined;
  searchText: string;
  setSearchText: (value: string) => void;
  searchPlaceholder: string;
  handleModal?: () => void;
  allProject: ProjectsObj[] | null;
}
