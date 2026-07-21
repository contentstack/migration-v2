import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useParams } from 'react-router';
import {
  Button,
  Icon,
  InfiniteScrollTable,
  Notification,
  Select,
  TextInput,
  Tooltip
} from '@contentstack/venus-components';
import { RootState } from '../../store';
import {
  runSourceAudit,
  getSourceAudit,
  updateAuditSelections,
  persistAuditSummary
} from '../../services/api/migration.service';
import { updateNewMigrationData } from '../../store/slice/migrationDataSlice';
import './index.scss';

// Types for audit data
interface AuditItem {
  id: string;
  uid: string;
  type: 'asset' | 'entry' | 'content_type' | 'global_field';
  title?: string;
  filename?: string;
  contentType?: string;
  locale?: string;
  isPublished?: boolean;
  isEmpty?: boolean;
  isUnused?: boolean;
  url?: string;
  selected?: boolean; // For migration selection
  /** Required by Venus InfiniteScrollTable when using `rowSelectCheckboxProp` */
  _canSelect?: boolean;
}

type PersistedExcludedItem = {
  uid: string;
  type: string;
  contentType?: string;
  locale?: string;
};

const auditRowPersistKey = (item: {
  uid: string;
  type: string;
  contentType?: string;
  locale?: string;
}) => `${item.uid}_${item.type}_${item.contentType || ''}_${item.locale || ''}`;

/** Map persisted `excludedItems` from the project to table row ids (`selectedItems` = excluded). */
const buildExcludedRowIdsSet = (
  rows: AuditItem[],
  excludedItems: PersistedExcludedItem[] | undefined
): Set<string> => {
  if (!excludedItems?.length) return new Set();
  const keys = new Set(excludedItems.map((ex) => auditRowPersistKey(ex)));
  const next = new Set<string>();
  rows.forEach((row) => {
    if (keys.has(auditRowPersistKey(row))) next.add(row.id);
  });
  return next;
};

const AuditReport = () => {
  const dispatch = useDispatch();
  const { projectId = '' } = useParams();
  const selectedOrganisation = useSelector(
    (state: RootState) => state?.authentication?.selectedOrganisation
  );
  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);

  // Table states
  const [loading, setLoading] = useState(false);
  const [tableData, setTableData] = useState<AuditItem[]>([]);
  const [filteredData, setFilteredData] = useState<AuditItem[]>([]);
  const [totalFilteredCount, setTotalFilteredCount] = useState<number>(0);
  const [selectedType, setSelectedType] = useState<string>('all');

  // Selection states for migration control (selectedItems = excluded items)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [initializedDefaults, setInitializedDefaults] = useState(false);

  // Track if we've attempted to load audit to prevent duplicate calls
  const loadAttempted = useRef(false);
  // Track if we're updating to prevent infinite loops
  const isUpdating = useRef(false);
  // Table ref for direct manipulation
  const tableRef = useRef<any>(null);

  // Type filter options
  const typeOptions = [
    { label: 'All Items', value: 'all' },
    { label: 'Assets', value: 'asset' },
    { label: 'Entries', value: 'entry' },
    { label: 'Content Types', value: 'content_type' },
    { label: 'Global Fields', value: 'global_field' }
  ];

  // Original states
  const [detailedData, setDetailedData] = useState<any>(null);
  const [showDetailedTable, setShowDetailedTable] = useState(false);
  const [localSummary, setLocalSummary] = useState<any>(null);

  const summary = (newMigrationData as any)?.legacy_cms?.audit?.summary;

  // Update local summary when Redux summary changes
  useEffect(() => {
    if (summary) {
      setLocalSummary(summary);
    }
  }, [summary]);

  // Use local summary for rendering (it persists during regeneration)
  const displaySummary = localSummary;

  const initialSelectedRowIds = useMemo(() => {
    const obj: Record<string, boolean> = {};
    selectedItems.forEach((id) => {
      obj[id] = true;
    });
    return obj;
  }, [selectedItems]);

  /** Venus InfiniteScrollTable uses `getSelectedRow`, not `onRowSelect` / `selectedRows`. */
  const handleSelectedRows = useCallback((selectedRowIds: string[]) => {
    setSelectedItems(new Set(selectedRowIds));
  }, []);

  // Define runAuditFlow before useEffects that depend on it
  const runAuditFlow = useCallback(async () => {
    setLoading(true);
    try {
      const auditResp = await runSourceAudit(selectedOrganisation?.value, projectId);
      if (auditResp?.status !== 200) {
        throw new Error(auditResp?.data?.message || 'Audit generation failed');
      }

      const summary = auditResp?.data?.data?.summary ?? auditResp?.data?.summary;

      const persistRes = await persistAuditSummary(
        selectedOrganisation.value,
        projectId,
        summary
      );
      if (persistRes?.status !== 200) {
        throw new Error(
          persistRes?.data?.message ||
            'Audit ran but could not save summary to the project. Try again or refresh.'
        );
      }

      // Update the summary in Redux (same source as persisted project)
      dispatch(
        updateNewMigrationData({
          ...newMigrationData,
          legacy_cms: {
            ...newMigrationData?.legacy_cms,
            audit: {
              ...newMigrationData?.legacy_cms?.audit,
              summary
            }
          }
        })
      );
    } catch (error: any) {
      console.error('Error running audit:', error);
      Notification({
        notificationContent: {
          text: error?.message || 'Audit failed. Check the export path and try again.'
        },
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [selectedOrganisation?.value, projectId, newMigrationData, dispatch]);

  // Reset load attempted flag when project/org changes
  useEffect(() => {
    loadAttempted.current = false;
  }, [selectedOrganisation?.value, projectId]);

  // Re-apply persisted exclusions when opening the detailed table for this project again
  useEffect(() => {
    setInitializedDefaults(false);
  }, [selectedOrganisation?.value, projectId]);

  // Auto-load audit report when component mounts and when dependencies change
  useEffect(() => {
    if (selectedOrganisation?.value && projectId && !loading && !loadAttempted.current) {
      loadAttempted.current = true;

      // Check if we already have audit summary from Step 1 background generation
      if (summary && localSummary) {
        return;
      }

      // Only generate if we don't have summary yet
      runAuditFlow();
    }
  }, [selectedOrganisation?.value, projectId, runAuditFlow, loading]);

  // Check if we already have detailed data on mount
  useEffect(() => {
    if (detailedData && tableData.length > 0) {
      setShowDetailedTable(true);
    }
  }, [detailedData, tableData]);

  // Helper function to transform audit data to table format
  const transformAuditData = (auditData: any): AuditItem[] => {
    const items: AuditItem[] = [];

    // Transform assets
    if (auditData.assets) {
      auditData.assets.forEach((asset: any, index: number) => {
        items.push({
          id: `asset_${asset.uid || index}`,
          uid: asset.uid,
          type: 'asset',
          title: asset.filename || asset.title || 'Untitled',
          filename: asset.filename,
          isPublished: asset.isPublished,
          isUnused: !asset.isReferred,
          url: asset.url,
          _canSelect: true
        });
      });
    }

    // Transform entries
    if (auditData.entries) {
      auditData.entries.forEach((entry: any, index: number) => {
        // Entry UID can repeat across locales; include content type + locale for stable unique row keys.
        const entryUid = entry.entryUid ?? entry.uid;
        const entryRowKey = [entryUid, entry.contentType, entry.locale]
          .filter(Boolean)
          .join('__');
        items.push({
          id: entryUid ? `entry_${entryRowKey}` : `entry_fallback_${index}`,
          uid: entryUid ?? '',
          type: 'entry',
          title: entry.title || `${entry.contentType} Entry`,
          contentType: entry.contentType,
          locale: entry.locale,
          isPublished: entry.isPublished,
          isEmpty: entry.isEmpty,
          url: entry.url,
          _canSelect: true
        });
      });
    }

    // Transform content types
    if (auditData.content_types) {
      auditData.content_types.forEach((ct: any, index: number) => {
        items.push({
          id: `ct_${ct.uid || index}`,
          uid: ct.uid,
          type: 'content_type',
          title: ct.title || ct.uid,
          isEmpty: ct.isEmpty,
          isUnused: ct.isUnused,
          url: ct.url,
          _canSelect: true
        });
      });
    }

    // Transform global fields
    if (auditData.global_fields) {
      auditData.global_fields.forEach((gf: any, index: number) => {
        items.push({
          id: `gf_${gf.uid || index}`,
          uid: gf.uid,
          type: 'global_field',
          title: gf.title || gf.uid,
          isUnused: gf.isUnused,
          isEmpty: gf.isEmpty,
          url: gf.url,
          _canSelect: true
        });
      });
    }

    return items;
  };


  // Hydrate checkboxes from project `legacy_cms.audit.excludedItems` (GET project / Redux)
  useEffect(() => {
    if (loading || tableData.length === 0 || initializedDefaults) return;
    const excludedItems = (newMigrationData?.legacy_cms?.audit as { excludedItems?: PersistedExcludedItem[] })
      ?.excludedItems;
    setSelectedItems(buildExcludedRowIdsSet(tableData, excludedItems));
    setInitializedDefaults(true);
  }, [loading, tableData, initializedDefaults, newMigrationData?.legacy_cms?.audit]);

  // Handle table data fetching with search and filters
  const fetchTableData = useCallback(
    ({ searchText = '', sortBy, limit, offset, startIndex, stopIndex }: any) => {
      let data = [...tableData];

      if (selectedType !== 'all') {
        data = data.filter((item) => item.type === selectedType);
      }

      if (searchText && searchText.trim()) {
        const searchLower = searchText.toLowerCase();
        data = data.filter(
          (item) =>
            item.uid?.toLowerCase().includes(searchLower) ||
            item.title?.toLowerCase().includes(searchLower) ||
            item.type?.toLowerCase().includes(searchLower) ||
            item.contentType?.toLowerCase().includes(searchLower) ||
            item.locale?.toLowerCase().includes(searchLower) ||
            item.filename?.toLowerCase().includes(searchLower)
        );
      }

      if (sortBy && sortBy.length > 0) {
        const sortField = sortBy[0]?.id;
        const desc =
          sortBy[0]?.desc ??
          (typeof sortBy[0]?.sortingDirection === 'string'
            ? sortBy[0].sortingDirection.toLowerCase() === 'desc'
            : false);
        if (sortField) {
          data.sort((a: any, b: any) => {
            const aVal = `${a?.[sortField] ?? ''}`;
            const bVal = `${b?.[sortField] ?? ''}`;
            return desc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
          });
        }
      }

      const totalCount = data.length;
      const resolvedStart =
        typeof startIndex === 'number' ? startIndex : typeof offset === 'number' ? offset : 0;
      const resolvedLimit =
        typeof limit === 'number' && limit > 0
          ? limit
          : typeof stopIndex === 'number' && typeof startIndex === 'number'
            ? Math.max(stopIndex - startIndex, 0)
            : totalCount;
      const endIndex = resolvedStart + resolvedLimit;
      const pageData = data.slice(resolvedStart, endIndex);

      setTotalFilteredCount(totalCount);
      setFilteredData(pageData);

      return Promise.resolve({
        data: pageData,
        totalCount
      });
    },
    [tableData, selectedType]
  );

  // Save exclusion preferences to backend and Redux store
  const saveSelectionPreferences = useCallback(async () => {
    if (tableData.length > 0 && !isUpdating.current) {
      isUpdating.current = true;

      try {
        // Note: selectedItems contains the IDs of EXCLUDED items (checked = excluded)
        const excludedItems = Array.from(selectedItems)
          .map((id) => {
            const item = tableData.find((item) => item.id === id);
            return {
              uid: item?.uid,
              type: item?.type,
              contentType: item?.contentType,
              locale: item?.locale
            };
          })
          .filter((item) => item.uid);

        const selectionStats = {
          totalItems: tableData.length,
          selectedItems: tableData.length - selectedItems.size, // Items to migrate
          excludedItems: selectedItems.size // Items to exclude
        };

        // Save to backend
        if (selectedOrganisation?.value && projectId) {
          const response = await updateAuditSelections(
            selectedOrganisation.value,
            projectId,
            excludedItems,
            selectionStats
          );
          if (response?.status === 200) {
            dispatch(
              updateNewMigrationData({
                legacy_cms: {
                  ...newMigrationData?.legacy_cms,
                  audit: {
                    ...(newMigrationData?.legacy_cms?.audit || {}),
                    excludedItems,
                    selectionStats
                  }
                }
              })
            );
          }
        }
      } catch (error) {
        console.error('Error saving audit selections:', error);
      } finally {
        // Reset flag after a short delay
        setTimeout(() => {
          isUpdating.current = false;
        }, 100);
      }
    }
  }, [
    selectedItems,
    tableData,
    newMigrationData,
    selectedOrganisation?.value,
    projectId,
    dispatch
  ]);

  // Auto-save selection preferences when selections change
  useEffect(() => {
    if (selectedItems.size >= 0 && initializedDefaults) {
      const timeoutId = setTimeout(() => {
        saveSelectionPreferences();
      }, 500); // Debounce for 500ms

      return () => clearTimeout(timeoutId);
    }
  }, [selectedItems, initializedDefaults, saveSelectionPreferences]);

  // Include initializedDefaults so the table remounts after hydration (with correct selections).
  // Without it: table mounts when tableData loads but selectedItems is still empty; hydration runs
  // after mount so initialSelectedRowIds never gets applied on the first render.
  const tableRenderKey = useMemo(
    () => `audit-table-${projectId}-${selectedType}-${tableData.length}-${initializedDefaults ? 'hydrated' : 'pending'}`,
    [projectId, selectedType, tableData.length, initializedDefaults]
  );

  const fetchDetailedAuditData = async () => {
    setLoading(true);
    setTableData([]);
    setInitializedDefaults(false);
    try {
      const response = await getSourceAudit(projectId, 'all');
      if (response?.status === 200 && response.data?.data) {
        setDetailedData(response.data.data);
        const transformedData = transformAuditData(response.data.data);
        setTableData(transformedData);
        setShowDetailedTable(true);
      }
    } catch (error) {
      console.error('Error fetching detailed audit data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to render table cells
  const renderCell = (value: string | null | undefined) => {
    const displayValue = value?.trim() || '-';

    if (displayValue === '-') {
      return <div className="table-cell">-</div>;
    }

    return (
      <div className="table-cell-tooltip">
        <Tooltip content={displayValue} position="top">
          <div className="table-cell">{displayValue}</div>
        </Tooltip>
      </div>
    );
  };

  // Table columns configuration
  const tableColumns = [
    {
      Header: 'UID',
      accessor: (data: AuditItem) => renderCell(data.uid),
      addToColumnSelector: true,
      disableSortBy: true,
      minWidth: 220,
      width: 220
    },
    {
      Header: 'Type',
      accessor: (data: AuditItem) => (
        <div className={`type-badge type-${data.type}`}>
          {data.type === 'asset'
            ? 'Asset'
            : data.type === 'entry'
              ? 'Entry'
              : data.type === 'content_type'
                ? 'Content Type'
                : 'Global Field'}
        </div>
      ),
      addToColumnSelector: true,
      disableSortBy: true,
      minWidth: 160,
      width: 160
    },
    {
      Header: 'Title/Name',
      accessor: (data: AuditItem) => renderCell(data.title),
      addToColumnSelector: true,
      disableSortBy: true,
      minWidth: 300,
      width: 300
    },
    {
      Header: 'Content Type',
      accessor: (data: AuditItem) => renderCell(data.contentType),
      addToColumnSelector: true,
      disableSortBy: true,
      minWidth: 200,
      width: 200
    },
    {
      Header: 'Locale',
      accessor: (data: AuditItem) => renderCell(data.locale),
      addToColumnSelector: true,
      disableSortBy: true,
      minWidth: 140,
      width: 140
    },
    {
      Header: 'Status',
      accessor: (data: AuditItem) => {
        let status = '';
        if (data.type === 'entry') {
          status = data.isPublished ? 'Published' : 'Unpublished';
        } else if (data.type === 'content_type') {
          status = data.isEmpty ? 'Empty' : 'Has Content';
        } else if (data.type === 'asset' || data.type === 'global_field') {
          status = data.isUnused ? 'Unused' : 'In Use';
        }
        return (
          <div className="status-badge-cell">
            <div className={`status-badge ${status.toLowerCase().replace(' ', '-')}`}>{status}</div>
          </div>
        );
      },
      addToColumnSelector: true,
      disableSortBy: true,
      minWidth: 120,
      width: 120
    },
    {
      Header: 'Actions',
      accessor: (data: AuditItem) => (
        <div className="action-cell">
          {data.url ? (
            <Button
              size="small"
              buttonType="tertiary"
              onClick={() => window.open(data.url, '_blank')}>
              View Details
            </Button>
          ) : (
            <Button size="small" buttonType="tertiary" disabled>
              No URL
            </Button>
          )}
        </div>
      ),
      addToColumnSelector: true,
      disableSortBy: true,
      minWidth: 110,
      width: 110
    }
  ];

  return (
    <div className="content-block audit-report-content-block">
      <div className="audit-intro">
        <h2>Content Audit Report</h2>
        <p className="pb-3">
          Generate a comprehensive audit report to identify unused assets, unpublished entries,
          empty content types, and unused global fields in your source stack. This helps optimize
          your content before migration.
        </p>
      </div>

      {!displaySummary && !loading && (
        <div className="audit-placeholder">
          <Icon icon="BarChart" size="large" />
          <p>
            No audit data available. The audit may still be generating in the background from Step
            1. Please wait a moment or ensure you have completed the export process.
          </p>
        </div>
      )}

      {loading && (
        <div className="audit-loading">
          <Icon icon="BarChart" size="large" />
          <p>Analyzing your exported content...</p>
        </div>
      )}

      {displaySummary && (
        <div className="audit-summary-stats">
          <h3>Audit Summary</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <Icon icon="Image" size="mini" />
              <span className="stat-number">{displaySummary?.unused_assets || 0}</span>
              <span className="stat-label">Unused Assets</span>
            </div>
            <div className="stat-card">
              <Icon icon="Document" size="mini" />
              <span className="stat-number">{displaySummary?.unpublished_entries || 0}</span>
              <span className="stat-label">Unpublished Entries</span>
            </div>
            <div className="stat-card">
              <Icon icon="Layout" size="mini" />
              <span className="stat-number">{displaySummary?.empty_content_types || 0}</span>
              <span className="stat-label">Empty Content Types</span>
            </div>
            <div className="stat-card">
              <Icon icon="Global" size="mini" />
              <span className="stat-number">{displaySummary?.unused_global_fields || 0}</span>
              <span className="stat-label">Unused Global Fields</span>
            </div>
          </div>

          {!showDetailedTable && (
            <div className="view-details-section">
              <Button
                version="v2"
                buttonType="secondary"
                onClick={fetchDetailedAuditData}
                isLoading={loading}
                disabled={loading}>
                {loading ? 'Loading Details...' : 'View More Details'}
              </Button>
            </div>
          )}
        </div>
      )}

      {showDetailedTable && (
        <div className="audit-table-section">
            <InfiniteScrollTable
              key={tableRenderKey}
              ref={tableRef}
              itemSize={60}
              data={filteredData}
              columns={tableColumns}
              uniqueKey="id"
              totalCounts={totalFilteredCount}
            loading={loading}
            tableHeight={520}
            rowPerPageOptions={[10, 25, 50, 100]}
            minBatchSizeToFetch={25}
            v2Features={{
              pagination: true,
              isNewEmptyState: true,
              search: true
            }}
            canSearch={true}
            searchPlaceholder="Search by UID, title, content type, locale..."
            searchProps={{
              searchKeys: ['uid', 'title', 'type', 'contentType', 'locale', 'filename'],
              placeholder: 'Search by UID, title, content type, locale...'
            }}
            withExportCta={{
              component: (
                <Select
                  options={typeOptions}
                  placeholder="Filter by type"
                  value={typeOptions.find((opt) => opt.value === selectedType)}
                  onChange={(selected: any) => setSelectedType(selected?.value || 'all')}
                  className="type-filter"
                />
              ),
              showExportCta: true
            }}
            isResizable={true}
            isRowSelect={true}
            name={{ singular: 'item', plural: 'items' }}
            initialSelectedRowIds={initialSelectedRowIds}
            getSelectedRow={handleSelectedRows}
            rowSelectCheckboxProp={{ key: '_canSelect', value: true }}
            fetchTableData={fetchTableData}
            getRowProps={(rowData: AuditItem) => ({
              className: selectedItems.has(rowData.id)
                ? 'audit-table-row excluded'
                : 'audit-table-row'
            })}
          />
        </div>
      )}
    </div>
  );
};

export default AuditReport;
