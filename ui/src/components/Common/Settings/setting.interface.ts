/**
 * Represents a project.
 */
interface IProject {
  title: string;
  name: string;
  description: string;
  general: string;
  delete_project: CTA;
  save_project: CTA;
  email: string;
}
/**
 * Represents a Call to Action (CTA) object.
 */
interface CTA {
  open_in_new_tab: boolean;
  theme: string;
  title: string;
  url: string;
  with_icon: boolean;
}
interface IExecutionLogs {
  title: string;
}

/**
 * Represents a setting object.
 */
export interface Setting {
  project?: IProject;
  execution_logs?: IExecutionLogs;
  title?: string;
}
