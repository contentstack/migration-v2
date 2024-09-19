import {
  DEFAULT_IFLOWSTEP,
  IFlowStep
} from '../../components/Stepper/FlowStepper/flowStep.interface';
import { ICardType, defaultCardType } from '../../components/Common/Card/card.interface';
import { CTA } from '../../types/common.interface';
import { IFilterType } from '../../components/Common/Modal/FilterModal/filterModal.interface';
export interface ICTA {
  title: string;
  href: string;
}

export type DataProps = {
  stepComponentProps:  ()=>{}; 
  currentStep: number;
  handleStepChange: (step: number) => void;
};

export type SummaryProps = {
  stepData: IStep;
  stepComponentProps: ()=>{};
};
interface ContentTypeMap {
  [key: string]: string;
}

export interface Organization {
  uid: string;
  name: string;
  plan_id: string;
  expires_on: string;
  enabled: boolean;
  is_over_usage_allowed: boolean;
  created_at: string;
  updated_at: string;
  tags: string[];
}

export interface User {
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  mobile_number: string;
  country_code: string;
  organizations: Organization[];
}
export interface FileDetails {
  isLocalPath?: boolean;
  cmsType?: string;
  localPath?: string;
  awsData?: {
    awsRegion?: string;
    bucketName?: string;
    buketKey?: string;
  };
}
export interface IFile {
  id?: string;
  name: string;
  size?: number;
  type?: string;
  url?: string;
  validation?: string;
  file_details?: FileDetails;
  isValidated: boolean;
}

export interface ICMSType extends ICardType {
  allowed_file_formats: ICardType[];
  doc_url: ICTA;
  parent: string;
}

export interface IStep {
  step_id: string;
  title: string;
  description: string;
  step_lock_text?: string;
  status?: string;
  lock: boolean;
  active?: boolean;
  data?: (props:DataProps) => JSX.Element;
  summery?: (props: SummaryProps) => JSX.Element;
  empty_step_placeholder?: string;
}

export interface IURLType {
  title: string;
  href: string;
}

export interface ILegacyCMSComponent {
  title: string;
  all_cms: ICMSType[];
  cta: string;
  all_steps: IStep[];
  restricted_keyword_link: IURLType;
  restricted_keyword_checkbox_text: string;
  file_format_checkbox_text: string;
  cmsFilterList: IFilterType[];
  affix_cta: string;
  file_format_cta: string;
}

export interface IDestinationStackComponent {
  title: string;
  description: string;
  cta: string;
  new_stack: {
    save_stack_cta: string;
    new_stack_input: string;
    add_stack_cta: string;
  };
  all_steps: IStep[];
}
export interface IContentMapping {
  content_types_heading: string;
  description: string;
  contentstack_fields: ContentstackFields;
  action_cta: ActionCta[];
  cta: CTA;
  search_placeholder: '';
  table_search_placeholder: '';
}

export interface MigrationExecution {
  disable: boolean;
  title: string;
  width: string;
}
export interface IMigrationExecution {
  migration_information: MigrationExecution[];
}

interface ActionCta {
  title: string;
  theme: string;
}

interface ContentstackFields {
  title: string;
  field_types: FieldTypes[];
}

interface FieldTypes {
  label: string;
  value: string;
}
interface locales {
  code: string;
  name: string;
}
export interface ILegacyCms {
  selectedCms: ICMSType;
  selectedFileFormat: ICardType;
  uploadedFile: IFile;
  affix: string;
  isRestictedKeywordCheckboxChecked: boolean;
  isFileFormatCheckboxChecked: boolean;
  currentStep:number,
  projectStatus:number,
}
export interface IDestinationStack {
  selectedOrg: IDropDown;
  selectedStack: IDropDown;
  stackArray: IDropDown[];
}
export interface IContentMapper {
  content_type_mapping: ContentTypeMap;
  isDropDownChanged?: boolean;
  otherCmsTitle?: string;
}
export interface INewMigration {
  mapperKeys: ContentTypeMap;
  legacy_cms: ILegacyCms;
  destination_stack: IDestinationStack;
  content_mapping: IContentMapper;
  test_migration: ITestMigration;
  isprojectMapped: boolean;
  stackDetails: IDropDown;
}

export interface IMigrationData {
  allFlowSteps: IFlowStep[];
  currentFlowStep: IFlowStep;
  legacyCMSData: ILegacyCMSComponent;
  destinationStackData: IDestinationStackComponent;
  contentMappingData: IContentMapping;
  migrationexecution: IMigrationExecution;
  settings: string;
  migration_steps_heading: string;
  testmigrationData: ITestMigration;
}

export interface IDropDown { 
  uid?: string;
  label: string;
  value: string;
  default?: boolean;
  master_locale: string;
  locales: locales[];
  created_at: string;
  isNewStack?: boolean;
}
export interface ITestMigration {
  stack_link: string;
  stack_api_key: string;
}
export interface IAppContext {
  authToken: string;
  setAuthToken: (token: string) => void;
  user: User;
  updateUser: (user: User) => void;
  organisationsList: IDropDown[];
  updateOrganisationsList: (list: IDropDown[]) => void;
  selectedOrganisation: IDropDown;
  updateSelectedOrganisation: (dropdown: IDropDown) => void;
  isAuthenticated: boolean;
  setIsAuthenticated: (flag: boolean) => void;
  newMigrationData: INewMigration;
  updateNewMigrationData: (data: Partial<INewMigration>) => void;
  migrationData: IMigrationData;
  updateMigrationData: (data: Partial<IMigrationData>) => void;
}

export const DEFAULT_DROPDOWN: IDropDown = {
  label: '',
  value: '',
  default: false,
  uid: '',
  master_locale: '',
  locales: [],
  created_at: '',
  isNewStack: false
};

export const DEFAULT_ORGANISATION: Organization = {
  uid: '',
  name: '',
  plan_id: '',
  expires_on: '',
  enabled: false,
  is_over_usage_allowed: false,
  created_at: '',
  updated_at: '',
  tags: []
};

export const DEFAULT_USER: User = {
  email: '',
  username: '',
  first_name: '',
  last_name: '',
  mobile_number: '',
  country_code: '',
  organizations: []
};

export const DEFAULT_FILE: IFile = {
  id: '',
  name: '',
  size: 0,
  type: '',
  file_details: {
    isLocalPath: false,
    cmsType: '',
    localPath: '',
    awsData: {
      awsRegion: '',
      bucketName: '',
      buketKey: ''
    }
  },
  isValidated: false
};

export const DEFAULT_CMS_TYPE: ICMSType = {
  allowed_file_formats: [],
  title: '',
  description: '',
  group_name: '',
  doc_url: {
    href: '',
    title: ''
  },
  parent: ''
};

export const DEFAULT_LEGACY_CMS: ILegacyCms = {
  selectedCms: DEFAULT_CMS_TYPE,
  selectedFileFormat: defaultCardType,
  uploadedFile: DEFAULT_FILE,
  affix: '',
  isRestictedKeywordCheckboxChecked: false,
  isFileFormatCheckboxChecked: false,
  currentStep:-1,
  projectStatus:0
};

export const DEFAULT_DESTINATION_STACK: IDestinationStack = {
  selectedOrg: DEFAULT_DROPDOWN,
  selectedStack: DEFAULT_DROPDOWN,
  stackArray: [],
};

export const DEFAULT_CONTENT_MAPPER: IContentMapper = {
  content_type_mapping: {},
  isDropDownChanged: false,
  otherCmsTitle: ''
};

export const DEFAULT_TEST_MIGRATION: ITestMigration = {
  stack_link: '',
  stack_api_key: ''
};

export const DEFAULT_NEW_MIGRATION: INewMigration = {
  mapperKeys: {},
  legacy_cms: DEFAULT_LEGACY_CMS,
  destination_stack: DEFAULT_DESTINATION_STACK,
  content_mapping: DEFAULT_CONTENT_MAPPER,
  test_migration: DEFAULT_TEST_MIGRATION,
  isprojectMapped: false,
  stackDetails: DEFAULT_DROPDOWN
};

export const DEFAULT_URL_TYPE: IURLType = {
  title: '',
  href: ''
};

export const DEFAULT_LEGACY_CMS_DATA: ILegacyCMSComponent = {
  title: '',
  all_cms: [],
  cta: '',
  all_steps: [],
  restricted_keyword_link: DEFAULT_URL_TYPE,
  cmsFilterList: [],
  restricted_keyword_checkbox_text: '',
  file_format_checkbox_text: '',
  affix_cta: '',
  file_format_cta: ''
};

export const DEFAULT_DESTINATION_STACK_DATA: IDestinationStackComponent = {
  title: '',
  cta: '',
  description: '',
  new_stack: {
    save_stack_cta: '',
    new_stack_input: '',
    add_stack_cta: ''
  },
  all_steps: []
};

export const DEFAULT_CONTENT_MAPPING_DATA: IContentMapping = {
  content_types_heading: '',
  description: '',
  contentstack_fields: {
    field_types: [],
    title: ''
  },
  action_cta: [],
  cta: {
    title: '',
    theme: ''
  },
  search_placeholder: '',
  table_search_placeholder: ''
};

export const DEFAULT_MIGRATION_EXECUTION: IMigrationExecution = {
  migration_information: [
    {
      disable: false,
      title: '',
      width: ''
    }
  ]
};

export const DEFAULT_MIGRATION_DATA: IMigrationData = {
  allFlowSteps: [],
  currentFlowStep: DEFAULT_IFLOWSTEP,
  legacyCMSData: DEFAULT_LEGACY_CMS_DATA,
  destinationStackData: DEFAULT_DESTINATION_STACK_DATA,
  contentMappingData: DEFAULT_CONTENT_MAPPING_DATA,
  migrationexecution: DEFAULT_MIGRATION_EXECUTION,
  migration_steps_heading: '',
  settings: '',
  testmigrationData: DEFAULT_TEST_MIGRATION
};

export const DEFAULT_APP_CONTEXT: IAppContext = {
  authToken: '',
  setAuthToken: function (): void {
    return;
  },
  user: DEFAULT_USER,
  updateUser: function (): void {
    return;
  },
  isAuthenticated: false,
  setIsAuthenticated: function (): void {
    return;
  },
  newMigrationData: DEFAULT_NEW_MIGRATION,
  updateNewMigrationData: function (): void {
    return;
  },
  migrationData: DEFAULT_MIGRATION_DATA,
  updateMigrationData: function (): void {
    return;
  },
  organisationsList: [],
  updateOrganisationsList: function () {
    return;
  },
  selectedOrganisation: DEFAULT_DROPDOWN,
  updateSelectedOrganisation: function (): void {
    return;
  }
};
