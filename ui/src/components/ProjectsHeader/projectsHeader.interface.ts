import { CTA } from '../../types/common.interface';

export interface ProjectsHeaderType {
  cta?: CTA;
  headingText: string | undefined;
  searchText: string;
  setSearchText: (value: string) => void;
  searchPlaceholder: string;
  handleModal?: () => void;
}
