import { v4 as uuidv4 } from 'uuid';


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
    return uuidv4();
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
      contentstackFieldType: fieldType,
      backupFieldType: fieldType,
      backupFieldUid: this.uid,
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
      backupFieldUid: this.uid,
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
      backupFieldUid: this.uid,
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
      id: this.generateId(),
      uid: this.uid,
      otherCmsField: this.displayName,
      otherCmsType: 'group',
      contentstackField: this.displayName,
      contentstackFieldUid: this.uid,
      contentstackFieldType: 'group',
      backupFieldType: 'group',
      backupFieldUid: this.uid,
      schema: this.fields.filter(Boolean),
      advanced: {
        mandatory: !!this.required,
        multiple: this.multiple,
      }
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
    const name = this.displayName;
    const type = 'link';
    const uid = this.uid;
    const default_value = this.defaultValue ?? '';

    return {
      id: id,
      uid: uid,
      otherCmsField: name,
      otherCmsType: type,
      contentstackField: name,
      contentstackFieldUid: uid,
      contentstackFieldType: 'link',
      backupFieldType: 'link',
      backupFieldUid: uid,
      advanced: { default_value: default_value !== '' ? default_value : null }
    };
  }
}

export class ReferenceField extends Field {
  refrenceTo: string[];
  isDeleted: boolean;
  backupFieldUid?: string;

  constructor(config: {
    uid: string;
    displayName: string;
    required?: boolean;
    description?: string;
    refrenceTo: string[];
    isDeleted?: boolean;
    backupFieldUid?: string;
  }) {
    super(config);
    this.refrenceTo = config.refrenceTo;
    this.isDeleted = config.isDeleted ?? false;
    this.backupFieldUid = config.backupFieldUid ?? config.uid;
  }

  toContentstack() {
    return {
      uid: this.uid,
      otherCmsField: this.displayName,
      otherCmsType: this.displayName,
      contentstackField: this.displayName,
      contentstackFieldUid: this.uid,
      contentstackFieldType: 'reference',
      isDeleted: this.isDeleted,
      backupFieldType: 'reference',
      backupFieldUid: this.uid,
      refrenceTo: this.refrenceTo
    };
  }
}

export class ImageField extends Field {
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
    const uid = this.uid;
    const name = this.displayName;
    const type = 'image';
    const default_value = this.defaultValue ?? '';

    return {
      id: id,
      uid,
      otherCmsField: name,
      otherCmsType: type,
      contentstackField: name,
      contentstackFieldUid: uid,
      contentstackFieldType: 'file',
      backupFieldType: 'file',
      backupFieldUid: uid,
      advanced: { default_value: default_value !== '' ? default_value : null }
    };
  }
}

export class JsonField extends Field {
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
    const uid = this.uid;
    const name = this.displayName;
    const type = 'json';
    const default_value = this.defaultValue ?? '';

    return {
      id: id,
      uid: uid,
      otherCmsField: name,
      otherCmsType: type,
      contentstackField: name,
      contentstackFieldUid: uid,
      contentstackFieldType: 'json',
      backupFieldType: 'json',
      backupFieldUid: uid,
      advanced: { default_value: default_value !== '' ? default_value : null }
    };
  }
}

/**
 * Modular Blocks field implementation
 */
export class ModularBlocksField extends Field {
  multiple: boolean;
  blocks: any[];

  constructor(config: {
    uid: string;
    displayName: string;
    required?: boolean;
    description?: string;
    blocks: any[];
    multiple?: boolean;
  }) {
    super(config);
    this.blocks = config.blocks;
    this.multiple = config.multiple ?? true;
  }

  toContentstack() {
    const id = this.generateId();
    return {
      id: id,
      uid: this.uid,
      otherCmsField: this.displayName,
      otherCmsType: 'container',
      blocks: this.blocks,
      contentstackField: this.displayName,
      contentstackFieldUid: this.uid,
      contentstackFieldType: 'modular_blocks',
      backupFieldType: 'modular_blocks',
      backupFieldUid: this.uid,
    };
  }
}