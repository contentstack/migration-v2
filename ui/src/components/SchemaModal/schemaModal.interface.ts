import { FieldMapType } from '../ContentMapper/contentMapper.interface';

/**
 * Represents the Icons interface.
 * This interface defines the structure of an object that contains various icon names.
 */
export interface Icons {
  title?: string;
  text?: string;
  multitext?: string;
  rte?: string;
  jsonRte?: string;
  markdown?: string;
  select?: string;
  number?: string;
  boolean?: string;
  isodate?: string;
  file?: string;
  reference?: string;
  group?: string;
  global_field?: string;
  blocks?: string;
  link?: string;
  bullet?: string;
  custom?: string;
  tag?: string;
  experience_container?: string;
}

/**
 * Represents the props for the SchemaModal component.
 */
export interface SchemaProps {
  /**
   * The content type of the schema.
   */
  contentType?: string;
  
  /**
   * A function to close the modal.
   */
  closeModal: () => void;
  
  /**
   * The schema data as an array of FieldMapType.
   */
  schemaData: FieldMapType[];
}

export interface schemaType {
  schema: FieldMapType[];
}
