// src/components/AuditLogs/interfaces.ts


export interface FileData {
    fileData: any;
    [key: string]: any;
}

export interface StackOption {
    label: string;
    value: string;
    name?: string;
    stackName?: string;
    stackUid?: string;
    [key: string]: any;
}

export interface FileOption {
    label: string;
    value: string;
}

export interface TableDataItem {
    uid?: string;
    name?: string;
    display_name?: string;
    display_type?: string;
    data_type?: string;
    missingRefs?: string[] | string;
    treeStr?: string;
    fixStatus?: string;
    missingCTSelectFieldValues?: string;
    parentKey?: string;
    ct_uid?: string;
    [key: string]: any;
}

export interface TableColumn {
    Header: string;
    accessor: (data: TableDataItem) => JSX.Element;
    addToColumnSelector: boolean;
    disableSortBy: boolean;
    disableResizing: boolean;
    canDragDrop: boolean;
    width: number;
}