import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useParams } from 'react-router';
import { EmptyState, InfiniteScrollTable, Select } from '@contentstack/venus-components';
// Redux
import { RootState } from '../../store';
// Service
import { getAuditData } from '../../services/api/project.service';
// Interfaces
import {
    FileData,
    StackOption,
    FileOption,
    TableDataItem,
    TableColumn
} from './auditLogs.interface';

// Import NoDataSvg similar to ExecutionLogs component
import { NoDataFound } from '../../common/assets'
import './index.scss';

const AuditLogs: React.FC = () => {
    const params = useParams<{ projectId?: string }>();
    const [loading, setLoading] = useState<boolean>(false);
    const [initialLoadComplete, setInitialLoadComplete] = useState<boolean>(false);
    const [selectedStack, setSelectedStack] = useState<StackOption | null>(null);
    const [stackOptions, setStackOptions] = useState<StackOption[]>([]);
    const [selectedFile, setSelectedFile] = useState<FileOption | null>(null);
    const [fileOptions, setFileOptions] = useState<FileOption[]>([]);
    const [fileContent, setFileContent] = useState<FileData | null>(null);
    const [searchText, setSearchText] = useState<string>('');
    const [tableColumns, setTableColumns] = useState<TableColumn[]>([]);
    const [tableData, setTableData] = useState<TableDataItem[]>([]);
    const [totalCounts, setTotalCounts] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [tableKey, setTableKey] = useState<number>(0);

    const selectedOrganisation = useSelector(
        (state: RootState) => state?.authentication?.selectedOrganisation
    );
    const stacks = useSelector((state: RootState) => state?.migration?.newMigrationData?.testStacks);

    useEffect(() => {
        if (stacks && stacks.length > 0) {
            const formattedOptions: StackOption[] = stacks.map((stack: any) => ({
                label: stack.name || stack.stackName || stack.stackUid || '',
                value: stack.stackUid || '',
                ...stack
            }));
            setStackOptions(formattedOptions);

            if (!selectedStack) {
                setSelectedStack(formattedOptions[0]);
                updateFileOptionsForStack(formattedOptions[0]);
            }
        }
    }, [stacks]);

    const updateFileOptionsForStack = (stack: StackOption | null) => {
        if (stack && selectedOrganisation?.value) {
            const predefinedOptions: FileOption[] = [
                { label: 'Content Types', value: 'content-types' },
                { label: 'Global Fields', value: 'global-fields' },
                { label: 'Entries', value: 'Entries_Select_feild' },
            ];
            setFileOptions(predefinedOptions);
            setInitialLoadComplete(true);
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
        setFileContent(null);
        setTableData([]);
        setTableColumns([]);
        setCurrentPage(1);
        setSearchText('');
        setTotalCounts(0);
    };

    const handleFileChange = async (selectedOption: FileOption | null) => {
        setSelectedFile(selectedOption);
        setCurrentPage(1);
        setSearchText('');

        if (selectedOption) {
            const columns = generateColumnsForFile(selectedOption.value);
            setTableColumns(columns);

            setTableData([]);

            setTableKey(prevKey => prevKey + 1);
        } else {
            setFileContent(null);
            setTableData([]);
            setTableColumns([]);
        }
    };

    useEffect(() => {
        if (selectedStack && selectedFile && selectedOrganisation?.value) {
            fetchInitialData();
        }
    }, [selectedStack, selectedFile]);

    const handleSearchChange = (value: string) => {
        setSearchText(value);
        setCurrentPage(1);
        setTableKey(prevKey => prevKey + 1);
    };

    // Function to fetch initial data when selections change
    const fetchInitialData = async () => {
        if (!selectedStack || !selectedFile || !selectedOrganisation?.value) {
            return;
        }

        setLoading(true);
        try {
            const searchParam = searchText === '' ? 'null' : searchText;

            const response = await getAuditData(
                selectedOrganisation.value,
                params?.projectId ?? '',
                selectedStack.value,
                selectedFile.value,
                0,
                15,
                0,
                15,
                searchParam
            );

            if (response.data) {
                setTableData(response.data.data || []);
                setTotalCounts(response.data.totalCount || 0);
            } else {
                setTableData([]);
                setTotalCounts(0);
            }
        } catch (error) {
            console.error('Error fetching initial audit data:', error);
            setTableData([]);
            setTotalCounts(0);
        } finally {
            setLoading(false);
        }
    };

    const generateColumnsForFile = (fileName: string): TableColumn[] => {
        const renderCell = (value: any) => (
            <div>{value}</div>
        );

        if (fileName.includes('content-types') || fileName.includes('global-fields')) {
            return [
                {
                    Header: 'Title',
                    accessor: (data: TableDataItem) => renderCell(data.name || data.ct_uid || '-'),
                    addToColumnSelector: true,
                    disableSortBy: true,
                    disableResizing: false,
                    canDragDrop: true,
                    width: 150
                },
                {
                    Header: 'Field Name',
                    accessor: (data: TableDataItem) => renderCell(data.display_name || '-'),
                    addToColumnSelector: true,
                    disableSortBy: true,
                    disableResizing: false,
                    canDragDrop: true,
                    width: 200
                },
                {
                    Header: 'Field Type',
                    accessor: (data: TableDataItem) => renderCell(data.data_type || '-'),
                    addToColumnSelector: true,
                    disableSortBy: true,
                    disableResizing: false,
                    canDragDrop: true,
                    width: 200
                },
                {
                    Header: 'Missing Reference',
                    accessor: (data: TableDataItem) => {
                        const missing = data.missingRefs ?
                            (typeof data.missingRefs === 'string' ? data.missingRefs : data.missingRefs.join(', ')) :
                            '-';
                        return renderCell(missing);
                    },
                    addToColumnSelector: true,
                    disableSortBy: true,
                    disableResizing: false,
                    canDragDrop: true,
                    width: 200
                },
                {
                    Header: 'Tree Structure',
                    accessor: (data: TableDataItem) => renderCell(data.treeStr || '-'),
                    addToColumnSelector: true,
                    disableSortBy: true,
                    disableResizing: false,
                    canDragDrop: true,
                    width: 200
                },
                {
                    Header: 'Fix Status',
                    accessor: (data: TableDataItem) => {
                        const status = data.fixStatus || 'Fixed';
                        const statusClass = status === 'Fixed' ? 'status-fixed' : 'status-not-fixed';
                        return (
                            <div className={`cell-content ${statusClass}`}>
                                <div>{status}</div>
                            </div>
                        );
                    },
                    addToColumnSelector: true,
                    disableSortBy: true,
                    disableResizing: false,
                    canDragDrop: true,
                    width: 200
                }
            ];
        }
        else if (fileName.includes('Entries')) {
            return [
                {
                    Header: 'Entry UID',
                    accessor: (data: TableDataItem) => renderCell(data.uid || '-'),
                    addToColumnSelector: true,
                    disableSortBy: true,
                    disableResizing: false,
                    canDragDrop: true,
                    width: 150
                },
                {
                    Header: 'Name',
                    accessor: (data: TableDataItem) => renderCell(data.name || '-'),
                    addToColumnSelector: true,
                    disableSortBy: true,
                    disableResizing: false,
                    canDragDrop: true,
                    width: 200
                },
                {
                    Header: 'Display Name',
                    accessor: (data: TableDataItem) => renderCell(data.display_name || '-'),
                    addToColumnSelector: true,
                    disableSortBy: true,
                    disableResizing: false,
                    canDragDrop: true,
                    width: 200
                },
                {
                    Header: 'Display Type',
                    accessor: (data: TableDataItem) => renderCell(data.display_type || '-'),
                    addToColumnSelector: true,
                    disableSortBy: true,
                    disableResizing: false,
                    canDragDrop: true,
                    width: 200
                },
                {
                    Header: 'Missing Select Value',
                    accessor: (data: TableDataItem) => renderCell(data.missingCTSelectFieldValues || '-'),
                    addToColumnSelector: true,
                    disableSortBy: true,
                    disableResizing: false,
                    canDragDrop: true,
                    width: 200
                },
                {
                    Header: 'Tree Structure',
                    accessor: (data: TableDataItem) => renderCell(data.treeStr || '-'),
                    addToColumnSelector: true,
                    disableSortBy: true,
                    disableResizing: false,
                    canDragDrop: true,
                    width: 200
                },
                {
                    Header: 'Fix Status',
                    accessor: (data: TableDataItem) => {
                        const status = data.fixStatus || 'Fixed';
                        return (
                            <div>{status}</div>
                        );
                    },
                    addToColumnSelector: true,
                    disableSortBy: true,
                    disableResizing: false,
                    canDragDrop: true,
                    width: 200
                }
            ];
        }
        else {
            // Default columns for other file types
            return [
                {
                    Header: 'Name',
                    accessor: (data: TableDataItem) => renderCell(data.name || data.uid || '-'),
                    addToColumnSelector: true,
                    disableSortBy: true,
                    disableResizing: false,
                    canDragDrop: true,
                    width: 150
                },
                {
                    Header: 'Type',
                    accessor: (data: TableDataItem) => renderCell(data.type || data.data_type || '-'),
                    addToColumnSelector: true,
                    disableSortBy: true,
                    disableResizing: false,
                    canDragDrop: true,
                    width: 200
                },
                {
                    Header: 'Details',
                    accessor: (data: TableDataItem) => renderCell(data.details || data.description || '-'),
                    addToColumnSelector: true,
                    disableSortBy: true,
                    disableResizing: false,
                    canDragDrop: true,
                    width: 200
                }
            ];
        }
    };

    // Fetch table data function for pagination and other table operations
    const fetchTableData = async ({
        skip = 0,
        limit = 30,
        startIndex = 0,
        stopIndex = 30,
        searchText: tableSearchText = null,
    }) => {
        if (!selectedStack || !selectedFile || !selectedOrganisation?.value) {
            return { data: [], count: 0 };
        }

        // Use component's searchText state if tableSearchText isn't provided
        const finalSearchText = tableSearchText !== null ? tableSearchText : searchText;
        const searchParam = finalSearchText === '' ? 'null' : finalSearchText;

        setLoading(true);
        try {
            const response = await getAuditData(
                selectedOrganisation.value,
                params?.projectId ?? '',
                selectedStack.value,
                selectedFile.value,
                skip,
                limit,
                startIndex,
                stopIndex,
                searchParam
            );

            if (response.data) {
                // Only update the state if this is not being called as part of table's internal operations
                setTableData(response.data.data || []);
                setTotalCounts(response.data.totalCount || 0);


                return {
                    data: response.data.data || [],
                    count: response.data.totalCount || 0
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
    const EmptyObj = {
        heading: !selectedStack ? `execute test migraiton` : selectedStack && !selectedFile ? `select module` : '',
        forPage: "emptyStateV2",
        description: (
            <>
                <EmptyState
                    heading={
                        <div className="empty_text">
                            {!selectedStack ? `execute test migraiton` : selectedStack && !selectedFile ? `select module` : ''}
                        </div>
                    }
                    // img={NoDataFound}
                    version="v2"
                    className="emptycomponent"
                />
            </>
        ),
    }
    // Create the export CTA component for the table with both stack and file selectors
    const exportCtaComponent = (
        <div className="d-flex align-items-center">
            <div className="d-flex justify-content-end ml-8">
                <Select
                    value={selectedStack}
                    onChange={handleStackChange}
                    options={stackOptions}
                    width="220px"
                    maxWidth="220px"
                    placeholder="Select Stack"
                    isSearchable
                    version="v2"
                    isDisabled={loading}
                    className="select-box"
                />
            </div>
            <div className="d-flex justify-content-end ml-8">
                <Select
                    value={selectedFile}
                    onChange={handleFileChange}
                    options={fileOptions}
                    width="220px"
                    maxWidth="220px"
                    placeholder="Select Module"
                    isSearchable
                    version="v2"
                    isDisabled={loading || !selectedStack || fileOptions.length === 0}
                    className="select-box"
                />
            </div>
        </div>
    );

    const defaultEmptyColumns: TableColumn[] = [
        {
            Header: 'Name',
            accessor: (data: TableDataItem) => <div className="cell-content"><div>{data.name || '-'}</div></div>,
            addToColumnSelector: true,
            disableSortBy: true,
            disableResizing: false,
            canDragDrop: true,
            width: 200
        },
        {
            Header: 'Type',
            accessor: (data: TableDataItem) => <div className="cell-content"><div>{data.type || '-'}</div></div>,
            addToColumnSelector: true,
            disableSortBy: true,
            disableResizing: false,
            canDragDrop: true,
            width: 200
        },
        {
            Header: 'Details',
            accessor: (data: TableDataItem) => <div className="cell-content"><div>{data.details || '-'}</div></div>,
            addToColumnSelector: true,
            disableSortBy: true,
            disableResizing: false,
            canDragDrop: true,
            width: 200
        }
    ];

    return (
        <InfiniteScrollTable
            key={tableKey}
            tableHeight={570}
            itemSize={80}
            data={tableData}
            columns={tableColumns.length > 0 ? tableColumns : defaultEmptyColumns}
            uniqueKey={"id"}
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
            searchPlaceholder={'Search Audit Logs'}
            searchValue={searchText}
            onSearchChangeEvent={handleSearchChange}
            withExportCta={{
                component: exportCtaComponent,
                showExportCta: true
            }}
            customEmptyState={
                <EmptyState
                    heading="No Logs"
                    description={!selectedStack ? `execute test migraiton` : selectedStack && !selectedFile ? `select module` : ''}
                    moduleIcon="NoDataEmptyState"
                    type="secondary"
                    className="custom-empty-state"
                />
            }
        />
    );
};

export default AuditLogs;