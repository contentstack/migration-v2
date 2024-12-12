export interface IFilterType {
  value: string;
  label: string;
  isChecked: boolean;
}

/**
 * Represents the interface for the filter status type.
 * It is a key-value pair where the key is a string and the value is a boolean.
 */
export interface IFilterStatusType {
  [key: string]: boolean;
}
