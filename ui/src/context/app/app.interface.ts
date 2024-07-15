import {
  DEFAULT_IFLOWSTEP,
  IFlowStep
} from '../../components/Stepper/FlowStepper/flowStep.interface';
import { ICardType, defaultCardType } from '../../components/Common/Card/card.interface';
import { CTA } from '../../types/common.interface';
import { IFilterType } from '../../components/Common/Modal/FilterModal/filterModal.interface';

/**
 * Represents a Call-to-Action (CTA) object.
 */
export interface ICTA {
  /**
   * The title of the CTA.
   */
  title: string;
  
  /**
   * The URL or href of the CTA.
   */
  href: string;
}

/**
 * Represents a map of content types.
 * The keys are strings and the values are also strings.
 */
interface ContentTypeMap {
  [key: string]: string;
}

/**
 * Represents an organization.
 */
export interface Organization {
  /**
   * The unique identifier of the organization.
   */
  uid: string;

  /**
   * The name of the organization.
   */
  name: string;

  /**
   * The plan ID of the organization.
   */
  plan_id: string;

  /**
   * The expiration date of the organization's plan.
   */
  expires_on: string;

  /**
   * Indicates whether the organization is enabled or not.
   */
  enabled: boolean;

  /**
   * Indicates whether over-usage is allowed for the organization.
   */
  is_over_usage_allowed: boolean;

  /**
   * The date and time when the organization was created.
   */
  created_at: string;

  /**
   * The date and time when the organization was last updated.
   */
  updated_at: string;

  /**
   * The tags associated with the organization.
   */
  tags: string[];
}

/**
 * Represents a user in the application.
 */
export interface User {
  /**
   * The email address of the user.
   */
  email: string;

  /**
   * The username of the user.
   */
  username: string;

  /**
   * The first name of the user.
   */
  first_name: string;

  /**
   * The last name of the user.
   */
  last_name: string;

  /**
   * The mobile number of the user.
   */
  mobile_number: string;

  /**
   * The country code associated with the user's mobile number.
   */
  country_code: string;

  /**
   * The organizations the user belongs to.
   */
  organizations: Organization[];
}

/**
 * Represents the details of a file.
 */
export interface FileDetails {
  /**
   * Specifies whether the file path is a local path.
   */
  isLocalPath?: boolean;

  /**
   * Specifies the type of CMS (Content Management System) for the file.
   */
  cmsType?: string;

  /**
   * Specifies the local path of the file.
   */
  localPath?: string;

  /**
   * Specifies the AWS (Amazon Web Services) data for the file.
   */
  awsData?: {
    /**
     * Specifies the AWS region for the file.
     */
    awsRegion?: string;

    /**
     * Specifies the AWS bucket name for the file.
     */
    bucketName?: string;

    /**
     * Specifies the AWS bucket key for the file.
     */
    buketKey?: string;
  };
}

/**
 * Represents a file object.
 */
export interface IFile {
  /**
   * The unique identifier of the file.
   */
  id?: string;

  /**
   * The name of the file.
   */
  name: string;

  /**
   * The size of the file in bytes.
   */
  size?: number;

  /**
   * The type of the file.
   */
  type?: string;

  /**
   * The URL of the file.
   */
  url?: string;

  /**
   * The validation status of the file.
   */
  validation?: string;

  /**
   * The details of the file.
   */
  file_details?: FileDetails;

  /**
   * Indicates whether the file has been validated.
   */
  isValidated: boolean;
}

/**
 * Represents a CMS Type.
 * Extends the ICardType interface.
 */
export interface ICMSType extends ICardType {
  allowed_file_formats: ICardType[];
  doc_url: ICTA;
  parent: string;
}

/**
 * Represents a step in the application.
 */
export interface IStep {
  /**
   * The unique identifier of the step.
   */
  step_id: string;

  /**
   * The title of the step.
   */
  title: string;

  /**
   * The description of the step.
   */
  description: string;

  /**
   * The text to display when the step is locked.
   */
  step_lock_text?: string;

  /**
   * The status of the step.
   */
  status?: string;

  /**
   * Indicates whether the step is locked.
   */
  lock: boolean;

  /**
   * Indicates whether the step is active.
   */
  active?: boolean;

  /**
   * The data component to render for the step.
   */
  data?: (props: any) => JSX.Element;

  /**
   * The summary component to render for the step.
   */
  summery?: (props: any) => JSX.Element;

  /**
   * The placeholder text to display when the step is empty.
   */
  empty_step_placeholder?: string;
}

/**
 * Represents a URL type with a title and href.
 */
export interface IURLType {
  title: string;
  href: string;
}

/**
 * Represents a legacy CMS component.
 */
export interface ILegacyCMSComponent {
  /**
   * The title of the component.
   */
  title: string;

  /**
   * An array of CMS types.
   */
  all_cms: ICMSType[];

  /**
   * The call-to-action text.
   */
  cta: string;

  /**
   * An array of steps.
   */
  all_steps: IStep[];

  /**
   * The restricted keyword link.
   */
  restricted_keyword_link: IURLType;

  /**
   * The text for the restricted keyword checkbox.
   */
  restricted_keyword_checkbox_text: string;

  /**
   * The text for the file format checkbox.
   */
  file_format_checkbox_text: string;

  /**
   * An array of filter types for CMS.
   */
  cmsFilterList: IFilterType[];

  /**
   * The affix call-to-action text.
   */
  affix_cta: string;

  /**
   * The file format call-to-action text.
   */
  file_format_cta: string;
}

/**
 * Represents the interface for the destination stack component.
 */
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

/**
 * Represents the interface for content mapping.
 */
export interface IContentMapping {
  content_types_heading: string;
  description: string;
  contentstack_fields: ContentstackFields;
  action_cta: ActionCta[];
  cta: CTA;
  search_placeholder: '';
  table_search_placeholder: '';
}

/**
 * Represents the interface for MigrationExecution.
 */
export interface MigrationExecution {
  disable: boolean;
  title: string;
  width: string;
}

/**
 * Represents the migration execution information.
 */
export interface IMigrationExecution {
  migration_information: MigrationExecution[];
}

/**
 * Represents an action call-to-action (CTA).
 */
interface ActionCta {
  /**
   * The title of the CTA.
   */
  title: string;

  /**
   * The theme of the CTA.
   */
  theme: string;
}

/**
 * Represents the fields of a Contentstack object.
 */
interface ContentstackFields {
  title: string;
  field_types: FieldTypes[];
}

/**
 * Represents the types of fields.
 */
interface FieldTypes {
  label: string;
  value: string;
}

/**
 * Represents a locale.
 */
interface locales {
  code: string;
  name: string;
}

/**
 * Represents the interface for the legacy CMS.
 */
export interface ILegacyCms {
  selectedCms: ICMSType;
  selectedFileFormat: ICardType;
  uploadedFile: IFile;
  affix: string;
  isRestictedKeywordCheckboxChecked: boolean;
  isFileFormatCheckboxChecked: boolean;
  currentStep:number
}

/**
 * Represents the destination stack information.
 */
export interface IDestinationStack {
  selectedOrg: IDropDown;
  selectedStack: IDropDown;
}

/**
 * Represents the interface for the content mapper.
 */
export interface IContentMapper {
  content_type_mapping: ContentTypeMap;
}

/**
 * Represents the interface for a new migration.
 */
export interface INewMigration {
  legacy_cms: ILegacyCms;
  destination_stack: IDestinationStack;
  content_mapping: IContentMapper;
  test_migration: ITestMigration;
}

/**
 * Represents the data structure for migration data.
 */
export interface IMigrationData {
  /**
   * An array of all flow steps.
   */
  allFlowSteps: IFlowStep[];

  /**
   * The current flow step.
   */
  currentFlowStep: IFlowStep;

  /**
   * The legacy CMS component data.
   */
  legacyCMSData: ILegacyCMSComponent;

  /**
   * The destination stack component data.
   */
  destinationStackData: IDestinationStackComponent;

  /**
   * The content mapping data.
   */
  contentMappingData: IContentMapping;

  /**
   * The migration execution data.
   */
  migrationexecution: IMigrationExecution;

  /**
   * The settings data.
   */
  settings: string;

  /**
   * The heading for migration steps.
   */
  migration_steps_heading: string;

  /**
   * The test migration data.
   */
  testmigrationData: ITestMigration;
}

/**
 * Represents a dropdown item.
 */
export interface IDropDown {
  uid?: string;
  label: string;
  value: string;
  default?: boolean;
  master_locale: string;
  locales: locales[];
  created_at: string;
}

/**
 * Represents the interface for the migration test.
 */
export interface ITestMigration {
  stack_link: string;
  stack_api_key: string;
}

/**
 * Represents the interface for the application context.
 */
export interface IAppContext {
  /**
   * The authentication token.
   */
  authToken: string;

  /**
   * Sets the authentication token.
   * @param token - The authentication token.
   */
  setAuthToken: (token: string) => void;

  /**
   * The user object.
   */
  user: User;

  /**
   * Updates the user object.
   * @param user - The updated user object.
   */
  updateUser: (user: User) => void;

  /**
   * The list of organisations as dropdown options.
   */
  organisationsList: IDropDown[];

  /**
   * Updates the list of organisations.
   * @param list - The updated list of organisations.
   */
  updateOrganisationsList: (list: IDropDown[]) => void;

  /**
   * The selected organisation as a dropdown option.
   */
  selectedOrganisation: IDropDown;

  /**
   * Updates the selected organisation.
   * @param dropdown - The updated selected organisation.
   */
  updateSelectedOrganisation: (dropdown: IDropDown) => void;

  /**
   * Indicates whether the user is authenticated or not.
   */
  isAuthenticated: boolean;

  /**
   * Sets the authentication flag.
   * @param flag - The authentication flag.
   */
  setIsAuthenticated: (flag: boolean) => void;

  /**
   * The data for a new migration.
   */
  newMigrationData: INewMigration;

  /**
   * Updates the data for a new migration.
   * @param data - The updated data for a new migration.
   */
  updateNewMigrationData: (data: Partial<INewMigration>) => void;

  /**
   * The data for a migration.
   */
  migrationData: IMigrationData;

  /**
   * Updates the data for a migration.
   * @param data - The updated data for a migration.
   */
  updateMigrationData: (data: Partial<IMigrationData>) => void;
}

/**
 * Represents the default dropdown configuration.
 */
export const DEFAULT_DROPDOWN: IDropDown = {
  label: '',
  value: '',
  default: false,
  uid: '',
  master_locale: '',
  locales: [],
  created_at: ''
};

/**
 * Represents the default organization.
 */
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

/**
 * Represents the default user object.
 */
export const DEFAULT_USER: User = {
  email: '',
  username: '',
  first_name: '',
  last_name: '',
  mobile_number: '',
  country_code: '',
  organizations: []
};

/**
 * Represents a file with its details.
 */
export const DEFAULT_FILE: IFile = {
  /**
   * The unique identifier of the file.
   */
  id: '',
  /**
   * The name of the file.
   */
  name: '',
  /**
   * The size of the file in bytes.
   */
  size: 0,
  /**
   * The type of the file.
   */
  type: '',
  /**
   * Additional details about the file.
   */
  file_details: {
    /**
     * Indicates if the file is a local path.
     */
    isLocalPath: false,
    /**
     * The type of the CMS (Content Management System) associated with the file.
     */
    cmsType: '',
    /**
     * The local path of the file.
     */
    localPath: '',
    /**
     * AWS (Amazon Web Services) data associated with the file.
     */
    awsData: {
      /**
       * The AWS region where the file is stored.
       */
      awsRegion: '',
      /**
       * The name of the AWS S3 bucket where the file is stored.
       */
      bucketName: '',
      /**
       * The key of the file in the AWS S3 bucket.
       */
      buketKey: ''
    }
  },
  /**
   * Indicates if the file has been validated.
   */
  isValidated: false
};

/**
 * Represents the default CMS type.
 */
export const DEFAULT_CMS_TYPE: ICMSType = {
  /**
   * The allowed file formats for the CMS type.
   */
  allowed_file_formats: [],

  /**
   * The title of the CMS type.
   */
  title: '',

  /**
   * The description of the CMS type.
   */
  description: '',

  /**
   * The group name of the CMS type.
   */
  group_name: '',

  /**
   * The documentation URL for the CMS type.
   */
  doc_url: {
    /**
     * The href of the documentation URL.
     */
    href: '',

    /**
     * The title of the documentation URL.
     */
    title: ''
  },

  /**
   * The parent of the CMS type.
   */
  parent: ''
};

/**
 * Represents the default legacy CMS configuration.
 */
export const DEFAULT_LEGACY_CMS: ILegacyCms = {
  selectedCms: DEFAULT_CMS_TYPE,
  selectedFileFormat: defaultCardType,
  uploadedFile: DEFAULT_FILE,
  affix: '',
  isRestictedKeywordCheckboxChecked: false,
  isFileFormatCheckboxChecked: false,
  currentStep:-1,
};

/**
 * Represents the default destination stack.
 */
export const DEFAULT_DESTINATION_STACK: IDestinationStack = {
  selectedOrg: DEFAULT_DROPDOWN,
  selectedStack: DEFAULT_DROPDOWN
};

/**
 * Default content mapper object.
 */
export const DEFAULT_CONTENT_MAPPER: IContentMapper = {
  content_type_mapping: {}
};

/**
 * Default test migration object.
 */
export const DEFAULT_TEST_MIGRATION: ITestMigration = {
  stack_link: '',
  stack_api_key: ''
};

/**
 * Default new migration object.
 */
export const DEFAULT_NEW_MIGRATION: INewMigration = {
  legacy_cms: DEFAULT_LEGACY_CMS,
  destination_stack: DEFAULT_DESTINATION_STACK,
  content_mapping: DEFAULT_CONTENT_MAPPER,
  test_migration: DEFAULT_TEST_MIGRATION
};

/**
 * Represents the default URL type.
 */
export const DEFAULT_URL_TYPE: IURLType = {
  title: '',
  href: ''
};

/**
 * Represents the default legacy CMS data.
 */
export const DEFAULT_LEGACY_CMS_DATA: ILegacyCMSComponent = {
  /**
   * The title of the legacy CMS component.
   */
  title: '',
  /**
   * An array of all CMS items.
   */
  all_cms: [],
  /**
   * The call-to-action text.
   */
  cta: '',
  /**
   * An array of all steps.
   */
  all_steps: [],
  /**
   * The restricted keyword link.
   */
  restricted_keyword_link: DEFAULT_URL_TYPE,
  /**
   * The list of CMS filter items.
   */
  cmsFilterList: [],
  /**
   * The text for the restricted keyword checkbox.
   */
  restricted_keyword_checkbox_text: '',
  /**
   * The text for the file format checkbox.
   */
  file_format_checkbox_text: '',
  /**
   * The affix call-to-action text.
   */
  affix_cta: '',
  /**
   * The file format call-to-action text.
   */
  file_format_cta: ''
};

/**
 * Represents the default destination stack data.
 */
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

/**
 * Represents the default content mapping data.
 */
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

/**
 * Represents the default migration execution object.
 */
export const DEFAULT_MIGRATION_EXECUTION: IMigrationExecution = {
  migration_information: [
    {
      disable: false,
      title: '',
      width: ''
    }
  ]
};

/**
 * Default migration data object.
 */
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

/**
 * Default application context object.
 */
export const DEFAULT_APP_CONTEXT: IAppContext = {
  /**
   * Authentication token.
   */
  authToken: '',
  /**
   * Function to set the authentication token.
   */
  setAuthToken: function (): void {
    return;
  },
  /**
   * User object.
   */
  user: DEFAULT_USER,
  /**
   * Function to update the user object.
   */
  updateUser: function (): void {
    return;
  },
  /**
   * Flag indicating whether the user is authenticated.
   */
  isAuthenticated: false,
  /**
   * Function to set the authentication status.
   */
  setIsAuthenticated: function (): void {
    return;
  },
  /**
   * New migration data object.
   */
  newMigrationData: DEFAULT_NEW_MIGRATION,
  /**
   * Function to update the new migration data object.
   */
  updateNewMigrationData: function (): void {
    return;
  },
  /**
   * Migration data object.
   */
  migrationData: DEFAULT_MIGRATION_DATA,
  /**
   * Function to update the migration data object.
   */
  updateMigrationData: function (): void {
    return;
  },
  /**
   * List of organisations.
   */
  organisationsList: [],
  /**
   * Function to update the list of organisations.
   */
  updateOrganisationsList: function () {
    return;
  },
  /**
   * Selected organisation object.
   */
  selectedOrganisation: DEFAULT_DROPDOWN,
  /**
   * Function to update the selected organisation object.
   */
  updateSelectedOrganisation: function (): void {
    return;
  }
};
