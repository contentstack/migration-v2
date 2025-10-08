import { Field } from "./contentstackFields/index"

export abstract class ContentstackComponent {
  uid: string;
  title: string;
  fields: Field[];

  constructor(config: {
    uid: string;
    title: string;
    fields: Field[];
  }) {
    this.uid = config.uid;
    this.title = config.title;
    this.fields = config.fields;
  }

  /**
   * Converts component definition to Contentstack schema
   */
  toContentstack() {
    return {
      title: this.title,
      uid: this.uid,
      schema: this.fields.map(field => field.toContentstack())
    };
  }
}