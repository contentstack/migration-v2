import { FilterOption } from "../ExecutionLogs/executionlog.interface";

export type FilterModalProps = {
  isOpen: boolean;
  closeModal: () => void;
  updateValue: (params: { value: FilterOption; isChecked: boolean }) => void;
  onApply: () => void;
  selectedLevels: FilterOption[];
  setSelectedFilterOption: (levels: FilterOption[]) => void;
  filterOptions: FilterOption[]
};
