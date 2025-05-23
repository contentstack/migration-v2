import React, { useEffect, useRef } from 'react';
import {
    Button,
    ButtonGroup,
    Checkbox,
    Icon
} from '@contentstack/venus-components';
import './index.scss';
import { FilterOption } from '../AuditLogs/auditLogs.interface';
import { auditLogsConstants } from '../../utilities/constants';
import { AuditFilterModalProps } from './auditlog.interface';

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

    const getFilterOptions = (): FilterOption[] => {
        if (!selectedFileType) return [];

        if (selectedFileType?.includes?.('content-types') || selectedFileType?.includes?.('global-fields')) {
            return [
                { label: 'global_field', value: 'global_field' },
                { label: 'reference', value: 'reference' }
            ];
        }

        if (selectedFileType?.includes?.('Entries')) {
            return [{ label: 'dropdown', value: 'dropdown' }];
        }

        return [];
    };

    const filterOptions = getFilterOptions();

    const clearAll = () => {
        setFilterValue([]);
    };

    useEffect(() => {
        if (isOpen && modalRef.current) {
            const modalElement = modalRef.current;
            const rect = modalElement.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;

            if (rect.bottom > viewportHeight) {
                modalElement.classList.add('position-bottom');
            }

            if (rect.right > viewportWidth) {
                modalElement.classList.add('position-right');
            }
        }
    }, [isOpen]);

    if (!isOpen) return <div></div>;

    return (
        <div className="tableFilterModalStories" ref={modalRef}>
            <div className="tableFilterModalStories__header">
                <span className="text-size">
                    {selectedFileType?.includes?.('Entries') ? 'Display Type' : 'Field Type'}
                </span>
                <div className="close-btn">
                    <Icon version="v2" icon="CloseNoborder" size="medium" onClick={closeModal} />
                </div>
            </div>

            <div className="tableFilterModalStories__list">
                {filterOptions?.length > 0 ? (
                    filterOptions.map((item, index) => (
                        <div key={'item' + index?.toString()?.replace(/[^a-zA-Z0-9_.\s-]/g, '')} >
                            <div className="tableFilterModalStories__suggestion-item">
                                <Checkbox
                                    checked={selectedLevels?.some((v) => v?.value === item?.value)}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                        updateValue({ value: item, isChecked: e?.target?.checked })
                                    }
                                    version="v2"
                                    label={item?.label}
                                    className="text-size"
                                />
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="tableFilterModalStories__no-data">
                        {auditLogsConstants?.filterModal?.noFilterAvailabe}
                    </div>
                )}
            </div>

            <div className="tableFilterModalStories__footer">
                <Button
                    buttonType="tertiary"
                    version="v2"
                    onClick={clearAll}
                    disabled={selectedLevels?.length === 0}
                >
                    {auditLogsConstants?.filterModal?.clearAll}
                </Button>
                <ButtonGroup>
                    <Button size="regular" version="v2" onClick={onApply}>
                        {auditLogsConstants?.filterModal?.apply}
                    </Button>
                </ButtonGroup>
            </div>
        </div>
    );
};

export default AuditFilterModal;
