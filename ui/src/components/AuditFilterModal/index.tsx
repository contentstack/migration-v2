import React, { useEffect, useRef } from 'react';
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
    const modalRef = useRef<HTMLDivElement>(null);
    console.info("in modal", isOpen)
    // Generate filter options based on selected file type
    const getFilterOptions = () => {
        if (!selectedFileType) return [];

        if (selectedFileType.includes('content-types') || selectedFileType.includes('global-fields')) {
            return [
                { label: "global_field", value: "global_field" },
                { label: "reference", value: "reference" },
            ];
        } else if (selectedFileType.includes('Entries')) {
            return [
                { label: 'dropdown', value: 'dropdown' },

            ];
        }

        return [];
    };

    const filterOptions = getFilterOptions();

    const clearAll = () => {
        setFilterValue([]);
    };

    // Position the modal properly when it opens
    useEffect(() => {
        if (isOpen && modalRef.current) {
            // Ensure the modal is positioned correctly
            const modalElement = modalRef.current;
            const rect = modalElement.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;

            // Ensure the modal stays within the viewport
            if (rect.bottom > viewportHeight) {
                modalElement.style.top = 'auto';
                modalElement.style.bottom = '0px';
            }

            if (rect.right > viewportWidth) {
                modalElement.style.left = 'auto';
                modalElement.style.right = '0px';
            }
        }
    }, [isOpen]);

    return (
        isOpen ? (
            <div
                className="tableFilterModalStories"
                ref={modalRef}
                style={{
                    position: 'absolute',
                    zIndex: 1000,
                    backgroundColor: 'white',
                    border: '1px solid #e0e0e0',
                    borderRadius: '4px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    width: '250px',
                    display: isOpen ? 'block' : 'none',
                    top: '100%',
                    left: '0',
                    marginTop: '5px'
                }}
            >
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
        ) : <div></div>);
};

export default AuditFilterModal;