import React from 'react';
import { Button, ButtonGroup, Checkbox, Icon } from '@contentstack/venus-components';
import './index.scss';
import { FilterOption } from '../AuditLogs/auditLogs.interface';

interface AuditFilterModalProps {
    isOpen: boolean;
    closeModal: () => void;
    updateValue: ({ value, isChecked }: { value: FilterOption; isChecked: boolean }) => void;
    onApply: () => void;
    selectedLevels: FilterOption[];
    setFilterValue: React.Dispatch<React.SetStateAction<FilterOption[]>>;
    selectedFileType?: string;
}

const AuditFilterModal = ({
    isOpen,
    closeModal,
    updateValue,
    onApply,
    selectedLevels,
    setFilterValue,
    selectedFileType
}: AuditFilterModalProps) => {
    // Generate filter options based on selected file type
    const getFilterOptions = () => {
        if (!selectedFileType) return [];

        if (selectedFileType.includes('content-types') || selectedFileType.includes('global-fields')) {
            return [
                { label: 'Single Line Textbox', value: 'text' },
                { label: 'Multi Line Textbox', value: 'textarea' },
                { label: 'Rich Text Editor', value: 'rte' },
                { label: 'Markdown', value: 'markdown' },
                { label: 'Select', value: 'select' },
                { label: 'Reference', value: 'reference' },
                { label: 'File', value: 'file' },
                { label: 'Number', value: 'number' },
                { label: 'Boolean', value: 'boolean' },
                { label: 'Date', value: 'date' },
                { label: 'Group', value: 'group' }
            ];
        } else if (selectedFileType.includes('Entries')) {
            return [
                { label: 'Text', value: 'text' },
                { label: 'Reference', value: 'reference' },
                { label: 'File', value: 'file' },
                { label: 'Select', value: 'select' },
                { label: 'Group', value: 'group' }
            ];
        }

        return [];
    };

    const filterOptions = getFilterOptions();

    const clearAll = () => {
        setFilterValue([]);
    };

    console.info("Filter modal render - isOpen:", isOpen);
    console.info("Selected file type:", selectedFileType);
    console.info("Filter options:", filterOptions);

    // Always render the component, let the parent control visibility
    return (
        <div className="tableFilterModalStories" style={{ display: isOpen ? 'block' : 'none' }}>
            {/* Modal header */}
            <div className="tableFilterModalStories__header">
                <span className="text-size">
                    {selectedFileType?.includes('Entries') ? 'Display Type' : 'Field Type'}
                </span>
                <div className="close-btn">
                    <Icon version="v2" icon={'CloseNoborder'} size="medium" onClick={closeModal} />
                </div>
            </div>

            {/* Modal Body */}
            <ul>
                {filterOptions.length > 0 ? (
                    filterOptions.map((item) => (
                        <li key={item.value}>
                            <div className="tableFilterModalStories__suggestion-item">
                                <Checkbox
                                    checked={selectedLevels.some((v) => v.value === item.value)}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                        updateValue({ value: item, isChecked: e.target.checked })
                                    }
                                    version="v2"
                                    label={item.label}
                                    className="text-size"
                                />
                            </div>
                        </li>
                    ))
                ) : (
                    <li>
                        <div className="tableFilterModalStories__no-data">
                            No filter options available for this selection
                        </div>
                    </li>
                )}
            </ul>

            {/* Modal Footer */}
            <div className="tableFilterModalStories__footer">
                <Button
                    buttonType="tertiary"
                    version="v2"
                    onClick={clearAll}
                    disabled={selectedLevels.length === 0}
                >
                    Clear All
                </Button>
                <ButtonGroup>
                    <Button size="regular" version="v2" onClick={onApply}>
                        Apply
                    </Button>
                </ButtonGroup>
            </div>
        </div>
    );
};

export default AuditFilterModal;