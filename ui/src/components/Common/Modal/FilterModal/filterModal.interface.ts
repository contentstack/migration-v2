/**
 * Represents the interface for a filter type.
 */
export interface IFilterType {
  value: string;
  label: string;
  isChecked: boolean;
}

export interface IFilterStatusType {
  [key: string]: boolean;
}
