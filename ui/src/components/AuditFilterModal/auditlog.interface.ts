import { FilterOption } from "../AuditLogs/auditLogs.interface";

export type AuditFilterModalProps = {
    isOpen: boolean;
    closeModal: () => void;
    updateValue: (params: { value: FilterOption; isChecked: boolean }) => void;
    onApply: () => void;
    selectedLevels: FilterOption[];
    setFilterValue: (levels: FilterOption[]) => void;
    selectedFileType: string;
};
