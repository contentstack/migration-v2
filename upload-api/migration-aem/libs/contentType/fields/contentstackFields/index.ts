/**
 * Base field class for Contentstack components
 */
export abstract class Field {
  uid: string;
  displayName: string;
  required: boolean;
  description?: string;

  constructor(config: {
    uid: string;
    displayName: string;
    required?: boolean;
    description?: string;
  }) {
    this.uid = config.uid;
    this.displayName = config.displayName;
    this.required = config.required || false;
    this.description = config.description;
  }

  abstract toContentstack(): any;

  // Generate a common ID based on the UID
  protected generateId(): string {
    return `field-${this.uid}`;
  }
}

/**
 * Text field implementation
 */
export class TextField extends Field {
  defaultValue?: string;
  multiline: boolean;
  isNumber?: boolean;

  constructor(config: {
    uid: string;
    displayName: string;
    required?: boolean;
    description?: string;
    defaultValue?: string;
    multiline?: boolean;
    isNumber?: boolean;
  }) {
    super(config);
    this.defaultValue = config.defaultValue;
    this.multiline = config.multiline || false;
    this.isNumber = config.isNumber || false;
  }

  toContentstack() {
    let fieldType: string = this.multiline ? 'multi_line_text' : 'single_line_text';
    if (this.isNumber === true) {
      fieldType = 'number';
    }

    return {
      id: this.generateId(),
      uid: this.uid,
      otherCmsField: this.displayName,
      otherCmsType: 'text',
      contentstackField: this.displayName,
      contentstackFieldUid: this.uid,
      contentstackFieldType: `${fieldType}`,
      backupFieldType: fieldType,
      backupFieldUid: fieldType,
      advanced: {
        default_value: this.defaultValue !== undefined ? this.defaultValue : null,
        description: this.description,
        required: this.required
      }
    };
  }
}

/**
 * Select field implementation
 */
export class SelectField extends Field {
  options: Array<{ value: string, displayValue: string }>;
  defaultValue?: string;
  multiple: boolean;

  constructor(config: {
    uid: string;
    displayName: string;
    required?: boolean;
    description?: string;
    options: Array<{ value: string, displayValue: string }>;
    defaultValue?: string;
    multiple?: boolean;
  }) {
    super(config);
    this.options = config.options;
    this.defaultValue = config.defaultValue;
    this.multiple = config.multiple || false;
  }

  toContentstack() {
    return {
      id: this.generateId(),
      uid: this.uid,
      otherCmsField: this.displayName,
      otherCmsType: 'select',
      contentstackField: this.displayName,
      contentstackFieldUid: this.uid,
      contentstackFieldType: this.multiple ? 'multi_select' : 'select',
      backupFieldType: 'select',
      backupFieldUid: 'select',
      advanced: {
        default_value: this.defaultValue !== undefined ? this.defaultValue : null,
        description: this.description,
        required: this.required,
        options: this.options.map(opt => ({
          value: opt.value,
          display_value: opt.displayValue
        }))
      }
    };
  }
}

/**
 * Boolean field implementation
 */
export class BooleanField extends Field {
  defaultValue?: boolean;

  constructor(config: {
    uid: string;
    displayName: string;
    required?: boolean;
    description?: string;
    defaultValue?: boolean;
  }) {
    super(config);
    this.defaultValue = config.defaultValue;
  }

  toContentstack() {
    return {
      id: this.generateId(),
      uid: this.uid,
      otherCmsField: this.displayName,
      otherCmsType: 'boolean',
      contentstackField: this.displayName,
      contentstackFieldUid: this.uid,
      contentstackFieldType: 'boolean',
      backupFieldType: 'boolean',
      backupFieldUid: 'boolean',
      advanced: {
        default_value: this.defaultValue !== undefined ? this.defaultValue : null,
        description: this.description,
        required: this.required
      }
    };
  }
}


/**
 * Group field implementation
 */
export class GroupField extends Field {
  fields: Field[];
  multiple?: boolean;

  constructor(config: {
    uid: string;
    displayName: string;
    required?: boolean;
    description?: string;
    fields: Field[];
    multiple?: boolean;
  }) {
    super(config);
    this.fields = config.fields;
    this.multiple = config.multiple || false;
  }

  toContentstack() {
    return {
      data_type: 'group',
      display_name: this.displayName,
      field_metadata: {},
      schema: this.fields.filter(Boolean),
      uid: this.uid,
      multiple: this.multiple, // or true if you want to support multiple groups
      mandatory: !!this.required,
      unique: false
    };
  }
}

export class LinkField extends Field {
  defaultValue?: string;

  constructor(config: {
    uid: string;
    displayName: string;
    required?: boolean;
    description?: string;
    defaultValue?: string;
  }) {
    super(config);
    this.defaultValue = config.defaultValue;
  }

  toContentstack() {
    const id = this.generateId();
    const sitecoreKey = this.uid;
    const name = this.displayName;
    const type = 'link';
    const uid = this.uid;
    const default_value = this.defaultValue ?? '';

    return {
      id: id,
      uid: sitecoreKey,
      otherCmsField: name,
      otherCmsType: type,
      contentstackField: name,
      contentstackFieldUid: uid,
      contentstackFieldType: 'link',
      backupFieldType: 'link',
      backupFieldUid: 'link',
      advanced: { default_value: default_value !== '' ? default_value : null }
    };
  }
}