import { LegacyCms } from '../../services/api/service.interface';
import { CTA } from '../../types/common.interface';

export interface ProjectsType {
  cta?: CTA;
  restore_cta?: CTA;
  heading?: string;
  search_projects?: string;
  emptystate?: EmptyState;
  create_project_modal?: ModalType;
}

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
interface EmptyState {
  cta?: CTA[];
  description: string;
  heading: string;
  help_text: string;
  empty_search_heading: string;
  empty_search_description: string;
}
export interface ProjectsObj {
  legacy_cms: LegacyCms;
  id: string;
  uid:string;
  region: string;
  org_id: string;
  owner: string;
  created_by: string;
  former_owner_ids: any[];
  prefix: string;
  name: string;
  description: string;
  status: number;
  created_at: string;
  updated_at: string;
  destination_stack_id: string;
  current_step: number;
  // tags?: TagPill[];
}
