import { FilterOption } from "../ExecutionLogs/executionlog.interface";

export type FilterModaleProps = {
  isOpen: boolean;
  closeModal: () => void;
  updateValue: (params: { value: FilterOption; isChecked: boolean }) => void;
  onApply: () => void;
  selectedLevels: FilterOption[];
  setFilterValue: (levels: FilterOption[]) => void;
};
