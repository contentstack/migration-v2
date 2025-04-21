export type LogEntry = {
  level: string;
  message: string;
  methodName: string;
  timestamp: string;
};

export type StackIds = {
  stackUid?: string;
  stackName?: string;
};

export type DropdownOption = {
  label: string;
  value: string;
};

export type FilterOption = {
  label: string;
  value: string;
};