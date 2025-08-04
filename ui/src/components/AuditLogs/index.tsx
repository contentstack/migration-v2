import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useParams } from 'react-router';
import { Button, EmptyState, InfiniteScrollTable, Select } from '@contentstack/venus-components';
// Redux
import { RootState } from '../../store';
// Service
import { getAuditData } from '../../services/api/project.service';
// Interfaces
import {
    StackOption,
    FileOption,
    TableDataItem,
    FilterOption
} from './auditLogs.interface';
import './index.scss';
import { auditLogsConstants } from '../../utilities/constants';
import AuditFilterModal from '../AuditFilterModal';

const renderCell = (value: any) => <div>{value ?? '-'}</div>;

const AuditLogs: React.FC = () => {
    const params = useParams<{ projectId?: string }>();
    const [loading, setLoading] = useState<boolean>(false);
    const [selectedStack, setSelectedStack] = useState<StackOption | null>(null);
    const [stackOptions, setStackOptions] = useState<StackOption[]>([]);
    const [selectedFile, setSelectedFile] = useState<FileOption | null>(null);
    const [fileOptions, setFileOptions] = useState<FileOption[]>([]);
    const [searchText, setSearchText] = useState<string>('');
    const [tableData, setTableData] = useState<TableDataItem[]>([]);
    const [totalCounts, setTotalCounts] = useState<number>(0);
    const [tableUid, setTableUid] = useState<number>(0);
    const [filterOption, setFilterOption] = useState<string>('all');
    const [filterValue, setFilterValue] = useState<FilterOption[]>([]);
    const [isCursorInside, setIsCursorInside] = useState(true);
    const [isFilterApplied, setIsFilterApplied] = useState(false);
    const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
    const [dropDownOptions, setDropDownOptions] = useState<string>();
    const selectedOrganisation = useSelector(
        (state: RootState) => state?.authentication?.selectedOrganisation
    );
    const stacks = useSelector((state: RootState) => state?.migration?.newMigrationData?.testStacks);
    const isMigDone = useSelector((state: RootState) => state?.migration?.newMigrationData?.migration_execution?.migrationCompleted);
    const label1 = useSelector((state: RootState) => state?.migration?.newMigrationData?.stackDetails?.label);
    const value1 = useSelector((state: RootState) => state?.migration?.newMigrationData?.stackDetails?.value);
    useEffect(() => {
        if (stacks && stacks?.length > 0) {
            const formattedOptions: StackOption[] = stacks.map((stack: any) => ({
                label: stack?.stackName,
                value: stack?.stackUid,
                ...stack
            }));
            if (isMigDone && label1 && value1) {
                formattedOptions.push({
                    label: label1,
                    value: value1,
                    ...stacks
                });
            }
            setStackOptions(formattedOptions);
            if (!selectedStack) {
                setSelectedStack(formattedOptions[stacks?.length - 1]);
                updateFileOptionsForStack(formattedOptions[0]);
            }
        }
    }, [stacks]);
    const updateFileOptionsForStack = (stack: StackOption | null) => {
        if (stack && selectedOrganisation?.value) {
            const predefinedOptions: FileOption[] = [
                { label: 'Content Types', value: 'content-types' },
                { label: 'Global Fields', value: 'global-fields' },
                { label: 'Entries', value: 'Entries_Select_feild' }
            ];
            setFileOptions(predefinedOptions);
            handleFileChange(predefinedOptions?.[0]);
        }
    };
    const handleStackChange = async (selectedOption: StackOption | null) => {
        setSelectedStack(selectedOption);
        resetFileSelection();
        if (selectedOption) {
            updateFileOptionsForStack(selectedOption);
        }
    };
    const resetFileSelection = () => {
        setSelectedFile(null);
        setTableData([]);
        setSearchText('');
        setTotalCounts(0);
        setFilterValue([]);
        setFilterOption('all');
        setIsFilterApplied(false);
    };

    const fetchTableData = async ({
        skip = 0,
        limit = 30,
        startIndex = 0,
        stopIndex = 30,
        searchText = 'null',
        filter = filterOption
    }) => {
        if (!selectedStack || !selectedFile || !selectedOrganisation?.value) {
            return { data: [], count: 0 };
        }
        searchText = searchText === '' ? 'null' : searchText;
        setLoading(true);
        try {
            const response = await getAuditData(
                selectedOrganisation?.value,
                params?.projectId ?? '',
                selectedStack?.value,
                selectedFile?.value,
                skip,
                limit,
                startIndex,
                stopIndex,
                searchText,
                filter
            );
            if (response?.data) {
                setTableData(response?.data?.data || []);
                setTotalCounts(response?.data?.totalCount || 0);
                return {
                    data: response?.data?.data || [],
                    count: response?.data?.totalCount || 0
                };
            }
            return { data: [], count: 0 };
        } catch (error) {
            console.error('Error fetching audit data:', error);
            if (startIndex === 0) {
                setTableData([]);
                setTotalCounts(0);
            }
            return { data: [], count: 0 };
        } finally {
            setLoading(false);
        }
    };
    const handleFileChange = async (selectedOption: FileOption | null) => {
        setSelectedFile(selectedOption);
        setDropDownOptions(selectedOption?.value);
        setSearchText('');
        setFilterValue([]);
        setFilterOption('all');
        setIsFilterApplied(false);
        if (selectedOption) {
            setTableUid((prevUid) => prevUid + 1);
        }
    };

    const ColumnFilter = () => {
        const closeModal = () => {
            setIsFilterDropdownOpen(false);
        };
        const openFilterDropdown = () => {
            if (!isFilterDropdownOpen) {
                setIsFilterDropdownOpen(true);
            }
            setIsFilterDropdownOpen(true);
        };

        const iconProps = {
            className: isFilterApplied
                ? auditLogsConstants?.filterIcon?.filterOn
                : auditLogsConstants?.filterIcon?.filterOff,
            withTooltip: true,
            tooltipContent: 'Filter',
            tooltipPosition: 'left'
        };
        // Method to update filter value
        const updateValue = ({ value, isChecked }: { value: FilterOption; isChecked: boolean }) => {
            try {
                let filterValueCopy = [...filterValue];
                if (!filterValueCopy.length && isChecked) {
                    filterValueCopy.push(value);
                } else if (isChecked) {
                    const updatedFilter = filterValueCopy.filter((v) => v?.value !== value?.value);
                    filterValueCopy = [...updatedFilter, value];
                } else if (!isChecked) {
                    filterValueCopy = filterValueCopy.filter((v) => v?.value !== value?.value);
                }
                setFilterValue(filterValueCopy);
            } catch (error) {
                // console.error('Error updating filter value:', error);
            }
        };
        const handleClickOutside = () => {
            if (!isCursorInside) {
                closeModal && closeModal();
            }
        };
        const onApply = () => {
            try {
                if (!filterValue?.length) {
                    const newFilter = 'all';
                    setFilterOption(newFilter);
                    fetchTableData({ filter: newFilter });
                    closeModal();
                    setIsFilterApplied(false);
                    return;
                }
                const usersQueryArray = filterValue.map((item) => item.value);
                const newFilter =
                    usersQueryArray?.length > 1 ? usersQueryArray.join('-') : usersQueryArray[0];
                setFilterOption(newFilter);
                fetchTableData({ filter: newFilter });
                setIsFilterApplied(true);
                closeModal();
            } catch (error) {
                console.error('Error applying filter:', error);
            }
        };
        useEffect(() => {
            document.addEventListener('click', handleClickOutside, false);
            return () => {
                document.removeEventListener('click', handleClickOutside, false);
            };
        }, [isCursorInside]);
        return (
            <div
                onMouseEnter={() => {
                    setIsCursorInside(true);
                }}
                onMouseLeave={() => {
                    setIsCursorInside(false);
                }}>
                <Button
                    onClick={openFilterDropdown}
                    icon="v2-Filter"
                    buttonType="tertiary"
                    onlyIcon={true}
                    version="v2"
                    onlyIconHoverColor="secondary"
                    iconProps={iconProps}
                />
                <AuditFilterModal
                    isOpen={isFilterDropdownOpen}
                    closeModal={closeModal}
                    updateValue={updateValue}
                    onApply={onApply}
                    selectedLevels={filterValue}
                    setFilterValue={setFilterValue}
                    selectedFileType={selectedFile?.value ?? ''}
                />
            </div>
        );
    };
    const contentTypeHeader = [
        {
            Header: 'Title',
            accessor: (data: TableDataItem) => renderCell(data?.name),
            addToColumnSelector: true,
            disableSortBy: true,
        },
        {
            Header: 'Field Name',
            accessor: (data: TableDataItem) => renderCell(data?.display_name),
            addToColumnSelector: true,
            disableSortBy: true,
        },
        {
            Header: 'Field Type',
            accessor: (data: TableDataItem) => renderCell(data?.data_type),
            addToColumnSelector: true,
            disableSortBy: true,
            filter: ColumnFilter
        },
        {
            Header: 'Missing Reference',
            accessor: (data: TableDataItem) => {
                const missing = Array.isArray(data?.missingRefs)
                    ? data.missingRefs.join(', ')
                    : typeof data?.missingRefs === 'string'
                        ? data?.missingRefs
                        : '-';
                return renderCell(missing);
            },
            addToColumnSelector: true,
            disableSortBy: true,
        },
        {
            Header: 'Tree Structure',
            accessor: (data: TableDataItem) => renderCell(data?.treeStr),
            addToColumnSelector: true,
            disableSortBy: true,
        },
        {
            Header: 'Fix Status',
            accessor: (data: TableDataItem) => renderCell(data?.fixStatus),
            addToColumnSelector: true,
            disableSortBy: true,
        }
    ];
    const entryHeader = [
        {
            Header: 'Entry UID',
            accessor: (data: TableDataItem) => renderCell(data?.uid),
            addToColumnSelector: true,
            disableSortBy: true,
            disableResizing: false,
            canDragDrop: true,
            width: 350
        },
        {
            Header: 'Name',
            accessor: (data: TableDataItem) => renderCell(data?.name),
            addToColumnSelector: true,
            disableSortBy: true,
            disableResizing: false,
            canDragDrop: true,
            width: 200
        },
        {
            Header: 'Display Name',
            accessor: (data: TableDataItem) => renderCell(data?.display_name),
            addToColumnSelector: true,
            disableSortBy: true,
        },
        {
            Header: 'Display Type',
            accessor: (data: TableDataItem) => renderCell(data?.display_type || data?.data_type),
            addToColumnSelector: true,
            disableSortBy: true,
            filter: ColumnFilter
        },
        {
            Header: 'Missing Value',
            cssClass: "missing-val",
            accessor: (data: TableDataItem) => {
                if (data?.missingCTSelectFieldValues) {
                    return renderCell(data?.missingCTSelectFieldValues);
                }
                if (typeof data?.missingRefs === 'object' && data?.missingRefs) {
                    const ctUid = (data?.missingRefs as any)?.[0]?._content_type_uid;
                    if (Array.isArray(ctUid)) {
                        return renderCell(ctUid?.length > 0 ? ctUid?.join(', ') : null);
                    } else if (typeof ctUid === 'string') {
                        return renderCell(ctUid);
                    }
                }
                return renderCell(null);
            },
            addToColumnSelector: true,
            disableSortBy: true,
        },
        {
            Header: 'Tree Structure',
            width: 300,
            accessor: (data: TableDataItem) => renderCell(data?.treeStr),
            addToColumnSelector: true,
            disableSortBy: true,
            default: false,
            cssClass: "tree-struct"
        }
    ];

    const exportCtaComponent = (
        <div className="select-container">
            <div className="select-wrapper">
                <Select
                    value={selectedStack}
                    onChange={handleStackChange}
                    options={stackOptions}
                    placeholder={auditLogsConstants.placeholders.selectStack}
                    isSearchable
                    version="v2"
                    isDisabled={loading}
                    className="select-box"
                />
            </div>
            <div className="select-wrapper">
                <Select
                    value={selectedFile}
                    onChange={handleFileChange}
                    options={fileOptions}
                    placeholder={auditLogsConstants.placeholders.selectModule}
                    isSearchable
                    version="v2"
                    isDisabled={loading || !selectedStack || fileOptions?.length === 0}
                    className="select-box"
                />
            </div>
        </div>
    );
    return (
        <div className='table-height'>
            <InfiniteScrollTable
                key={tableUid}
                itemSize={80}
                data={tableData}
                columns={dropDownOptions == 'content-types' || dropDownOptions == 'global-fields' ? contentTypeHeader : entryHeader}
                uniqueKey={'id'}
                fetchTableData={fetchTableData}
                totalCounts={totalCounts}
                loading={loading}
                rowPerPageOptions={[10, 30, 50, 100]}
                minBatchSizeToFetch={30}
                v2Features={{
                    pagination: true,
                    isNewEmptyState: true
                }}
                isResizable={false}
                isRowSelect={false}
                columnSelector={false}
                canSearch={true}
                searchPlaceholder={auditLogsConstants?.placeholders?.searchLogs}
                searchValue={searchText ?? ''}
                onSearchChangeEvent={(value: string) => setSearchText(value)}
                withExportCta={{
                    component: exportCtaComponent,
                    showExportCta: true
                }}
                customEmptyState={
                    <EmptyState
                        heading={selectedStack && selectedFile ? auditLogsConstants?.noResult : auditLogsConstants?.noLogs}
                        description={
                            !selectedStack
                                ? auditLogsConstants?.executeTestMigration
                                : selectedStack && !selectedFile
                                    ? auditLogsConstants?.selectModuleMessage
                                    : auditLogsConstants?.queryChangeMessage
                        }
                        moduleIcon={
                            (selectedStack && !selectedFile) || !selectedStack
                                ? auditLogsConstants?.emptyStateIcon?.noLogs
                                : auditLogsConstants?.emptyStateIcon?.noMatch
                        }
                        type="secondary"
                        className="custom-empty-state"
                    />
                }
            />
        </div>
    );
}
export default AuditLogs;