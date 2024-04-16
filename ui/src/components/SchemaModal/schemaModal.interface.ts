import { FieldMapType } from "../ContentMapper/contentMapper.interface"; 

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
 export interface SchemaProps {
  contentType?: string;
  closeModal: () => void;
  schemaData: FieldMapType[];
 }

 export interface schemaType {
  schema: FieldMapType[];
 }