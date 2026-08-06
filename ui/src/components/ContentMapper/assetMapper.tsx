// Libraries
import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import {
  Button,
  Icon,
  InfiniteScrollTable,
  Notification,
  EmptyState,
  Select,
} from '@contentstack/venus-components';

// Services
import {
  getAssetMapping,
  updateAssetMapper,
  retryAssetDownload,
} from '../../services/api/migration.service';

// Redux
import { RootState } from '../../store';

// Utilities
import { ASSET_MAPPER_EMPTY_STATE, MAPPER_SEARCH_EMPTY_STATE } from '../../utilities/constants';

// Interface
import { AssetMapperType, TableTypes, UidMap } from './contentMapper.interface';

// Styles and Assets
import { NoDataFound } from '../../common/assets';

// Pure logic (unit-tested in assetMapper.utils.test.ts)
import {
  formatFileSize,
  mapAssetsToRows,
  buildSelectedRowIds,
  applySelectionToAssets,
  toSelectedMap,
  computeChangedUids,
} from './assetMapper.utils';

// Hooks
import { useMeasuredTableHeight } from './useMeasuredTableHeight';

// Styles and Assets
import './index.scss';

const AssetMapper = ({
  onCountChange,
}: {
  onCountChange?: (count: number) => void;
}) => {
  const { projectId = '' } = useParams<{ projectId: string }>();

  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);

  // Component State
  const [tableData, setTableData] = useState<AssetMapperType[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [totalCounts, setTotalCounts] = useState<number>(0);
  const [rowIds, setRowIds] = useState<Record<string, boolean>>({});
  const [persistedRowIds, setPersistedRowIds] = useState<Record<string, boolean>>({});
  const [isLoadingSaveButton, setisLoadingSaveButton] = useState<boolean>(false);
  // Tracks in-flight retry calls per asset id so only that row's button shows a spinner.
  const [retryingIds, setRetryingIds] = useState<Record<string, boolean>>({});
  // True once the initial fetch has settled — used to gate the empty state so it
  // doesn't flash before assets have loaded.
  const [hasFetched, setHasFetched] = useState<boolean>(false);
  // Current search term driven by the table. When a search is active we keep the
  // table (and its search box) mounted even on 0 results, otherwise the user is
  // stranded on the full-page empty state with no way to clear the search.
  const [searchText, setSearchText] = useState<string>('');
  // Status filter dropdown: 'all' | 'ok' | 'missing' | 'failed'.
  const [statusFilter, setStatusFilter] = useState<{ label: string; value: string }>({
    label: 'All statuses',
    value: 'all',
  });
  // Aggregate counts across the FULL visible set (server-computed, unaffected by
  // pagination/search/status-filter) — drives the "N assets won't be migrated" banner.
  const [missingCount, setMissingCount] = useState<number>(0);
  const [failedCount, setFailedCount] = useState<number>(0);

  const statusFilterOptions = [
    { label: 'All statuses', value: 'all' },
    { label: 'Failed', value: 'failed' },
    { label: 'No source', value: 'missing' },
  ];

  const tableWrapperRef = useRef<HTMLDivElement | null>(null);
  // Guards against a duplicate fetch when the mount-fetch and the
  // status-filter-change-fetch would otherwise both fire on initial render.
  const isFirstFetchRef = useRef(true);

  // Fetch on mount, and refetch whenever the status filter changes (reset to page 1).
  // Only the very first fetch seeds rowIds/persistedRowIds from the server.
  useEffect(() => {
    const seedSelection = isFirstFetchRef.current;
    isFirstFetchRef.current = false;
    fetchAssets(searchText, { seedSelection });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter?.value]);

  // Responsive table height for the asset mapper — see useMeasuredTableHeight for the why.
  const tableHeight = useMeasuredTableHeight(tableWrapperRef, [tableData?.length], {
    panelSelector: '.TablePanel',
    footerSelector: '.mapper-footer',
  });

  // Single server-paginated fetch (same pattern as entryMapper's fetchEntries). The
  // Venus table drives paging by calling fetchData with { skip, limit, searchText };
  // we ask the API for just that page and use the returned `count` as the grand total.
  //
  // seedSelection: only on the initial load do we seed rowIds/persistedRowIds from the
  // server's persisted selection. On search / page change we instead re-apply the
  // user's current (possibly unsaved) selection so nothing gets wiped.
  const fetchAssets = async (
    searchVal: string,
    { skip = 0, limit = 30, seedSelection = false }: { skip?: number; limit?: number; seedSelection?: boolean } = {},
  ) => {
    try {
      setLoading(true);

      const statusParam = statusFilter?.value && statusFilter.value !== 'all' ? statusFilter.value : undefined;
      const { data } = await getAssetMapping(skip, limit, searchVal ?? '', projectId, statusParam);

      setLoading(false);

      const validTableData: AssetMapperType[] = mapAssetsToRows(data?.assetMapping);

      // The API returns the full (filtered) total separately from the page it
      // sends back. Use that so the count and pagination are correct when the
      // result set is larger than the requested page size.
      const total = data?.count ?? validTableData?.length ?? 0;
      setTotalCounts(total);
      onCountChange?.(total);
      setHasFetched(true);
      // Aggregate counts (missing/failed) are computed server-side across the full
      // visible set, unaffected by pagination/search/status-filter — used for the banner.
      setMissingCount(data?.missingCount ?? 0);
      setFailedCount(data?.failedCount ?? 0);

      if (!seedSelection) {
        // Re-apply the user's current selection onto the freshly fetched page;
        // don't touch rowIds/persistedRowIds so nothing gets deselected.
        setTableData(applySelectionToAssets(validTableData ?? [], rowIds));
        return;
      }

      const initialSelected = buildSelectedRowIds(validTableData ?? []);
      setTableData(validTableData ?? []);
      setRowIds(initialSelected);
      setPersistedRowIds(initialSelected);
    } catch (error) {
      console.error('fetchAssets -> error', error);
      setLoading(false);
      setHasFetched(true);
    }
  };

  // Driven by the table: page change, rows-per-page change, and search all land here.
  const fetchData = async ({ searchText: search, skip, limit }: TableTypes) => {
    setSearchText(search ?? '');
    // Searching / paging must not drop the user's in-progress selection.
    fetchAssets(search ?? '', { skip, limit });
  };

  /**
   * Handle the selected assets. A selected (checked) asset is updated in place
   * on the existing Contentstack asset; an unselected matched asset is kept
   * as-is (reused from the previous migration).
   */
  const handleSelectedAssets = (singleSelectedRowIds: string[]) => {
    const selectedObj: UidMap = toSelectedMap(singleSelectedRowIds);

    setRowIds(selectedObj);
    setTableData((prev) => applySelectionToAssets(prev ?? [], selectedObj));
  };

  const handleSaveAssets = async () => {
    setisLoadingSaveButton(true);
    const changedUids = computeChangedUids(rowIds, persistedRowIds);

    try {
      if (changedUids.length === 0) {
        setisLoadingSaveButton(false);
        return Notification({
          notificationContent: { text: 'No changes to save' },
          notificationProps: {
            position: 'bottom-center',
            hideProgressBar: true
          },
          type: 'info'
        });
      }
      const { status } = await updateAssetMapper(projectId, { ids: changedUids });

      setisLoadingSaveButton(false);
      if (status === 200) {
        setPersistedRowIds({ ...(rowIds ?? {}) });
        return Notification({
          notificationContent: { text: 'Assets saved successfully' },
          notificationProps: {
            position: 'bottom-center',
            hideProgressBar: true
          },
          type: 'success'
        });
      } else {
        return Notification({
          notificationContent: { text: 'Failed to save assets' },
          notificationProps: {
            position: 'bottom-center',
            hideProgressBar: true
          },
          type: 'error'
        });
      }
    } catch (error) {
      console.error(error);
      setisLoadingSaveButton(false);
      return error;
    }
  };

  /**
   * Re-attempts the download for one asset that failed during the last migration run.
   * Only re-stages the file locally — it lands in the destination stack on the next
   * migration run, so success here just clears the "failed" status, it doesn't create
   * the asset in Contentstack immediately.
   */
  const handleRetryAsset = async (asset: AssetMapperType) => {
    const sourceUid = asset?.otherCmsAssetUid || asset?.id;
    if (!sourceUid || retryingIds[sourceUid]) return;

    setRetryingIds((prev) => ({ ...prev, [sourceUid]: true }));
    try {
      const { data } = await retryAssetDownload(projectId, sourceUid);
      if (data?.success) {
        setTableData((prev) =>
          prev.map((row) =>
            row.otherCmsAssetUid === sourceUid
              ? { ...row, status: 'ok', errorMessage: undefined }
              : row
          )
        );
        Notification({
          notificationContent: { text: data?.message || 'Asset downloaded successfully.' },
          notificationProps: { position: 'bottom-center', hideProgressBar: true },
          type: 'success',
        });
      } else {
        setTableData((prev) =>
          prev.map((row) =>
            row.otherCmsAssetUid === sourceUid
              ? { ...row, status: 'failed', errorMessage: data?.message }
              : row
          )
        );
        Notification({
          notificationContent: { text: data?.message || 'Retry failed.' },
          notificationProps: { position: 'bottom-center', hideProgressBar: true },
          type: 'error',
        });
      }
    } catch (error) {
      console.error('handleRetryAsset -> error', error);
      Notification({
        notificationContent: { text: 'Retry failed.' },
        notificationProps: { position: 'bottom-center', hideProgressBar: true },
        type: 'error',
      });
    } finally {
      setRetryingIds((prev) => {
        const next = { ...prev };
        delete next[sourceUid];
        return next;
      });
    }
  };

  const accessorAssetName = (data: AssetMapperType) => {
    const name = data?.filename || data?.title || '-';
    return (
      <div>
        <div className='d-flex align-items-center'>
          <div className={'cms-field cms-field--wrap'} title={name}>
            {name}
          </div>
        </div>
      </div>
    );
  };

  const accessorAssetPath = (data: AssetMapperType) => {
    const assetPath = data?.assetPath || '-';
    return (
      <div>
        <div className='d-flex align-items-center'>
          <div className={'cms-field cms-field--wrap'} title={assetPath}>
            {assetPath}
          </div>
        </div>
      </div>
    );
  };

  const accessorFileSize = (data: AssetMapperType) => {
    return (
      <div>
        <div className='d-flex align-items-center'>
          <div className={'cms-field'}>
            {formatFileSize(data?.file_size)}
          </div>
        </div>
      </div>
    );
  };

  const accessorContentstackUid = (data: AssetMapperType) => {
    const uid = data?.contentstackAssetUid ? data?.contentstackAssetUid : '-';
    return (
      <div>
        <div className='d-flex align-items-center'>
          <div className={'cms-field'} title={uid}>
            {uid}
          </div>
        </div>
      </div>
    );
  };

  const accessorAssetStatus = (data: AssetMapperType) => {
    const sourceUid = data?.otherCmsAssetUid || data?.id;
    if (data?.status === 'missing') {
      return (
        <div
          className="asset-status-badge asset-status-badge--missing"
          title={data?.errorMessage || 'No source file found for this asset.'}
        >
          <Icon icon="InformationCircle" version="v2" size="tiny" />
          <span>No source</span>
        </div>
      );
    }
    if (data?.status === 'failed') {
      return (
        <div className="asset-status-badge asset-status-badge--failed-wrapper">
          <span
            className="asset-status-badge asset-status-badge--failed"
            title={data?.errorMessage || 'Failed to download this asset.'}
          >
            <Icon icon="WarningBold" version="v2" size="tiny" />
            <span>Failed</span>
          </span>
          <Button
            className="asset-retry-button"
            version="v2"
            buttonType="tertiary"
            size="small"
            icon="Refresh"
            isLoading={!!retryingIds[sourceUid]}
            onClick={() => handleRetryAsset(data)}
          >
            Retry
          </Button>
        </div>
      );
    }
    return (
      <div className="asset-status-badge asset-status-badge--ok">
        <Icon icon="CheckCircle" version="v2" size="tiny" />
        <span>Ready</span>
      </div>
    );
  };

  const columns = [
    {
      disableSortBy: true,
      Header: (
        <span>
          {`${newMigrationData?.legacy_cms?.selectedCms?.title}: Assets`}
        </span>
      ),
      accessor: accessorAssetName,
      id: 'uuid',
      width: '260px',
    },
    {
      disableSortBy: true,
      Header: (<span>{'Path:'}</span>),
      accessor: accessorAssetPath,
      id: '1',
      width: '480px',
    },
    {
      disableSortBy: true,
      Header: (<span>{'Size:'}</span>),
      accessor: accessorFileSize,
      id: '2',
      width: '120px',
    },
    {
      disableSortBy: true,
      Header: (<span>{'Contentstack UIDs:'}</span>),
      accessor: accessorContentstackUid,
      id: '3',
      width: '280px',
    },
    {
      disableSortBy: true,
      Header: (<span>{'Status:'}</span>),
      accessor: accessorAssetStatus,
      id: '4',
      width: '200px',
    }
  ];

  const brokenAssetCount = missingCount + failedCount;

  return (
    <div className="step-container">
      {(hasFetched && !loading && totalCounts === 0 && !searchText && statusFilter?.value === 'all') ?
        <EmptyState
          forPage="emptyStateV2"
          heading={<div className="empty_search_heading">{ASSET_MAPPER_EMPTY_STATE.NO_ASSETS_HEADING}</div>}
          description={
            <div className="empty_search_description">
              {ASSET_MAPPER_EMPTY_STATE.NO_ASSETS_DESCRIPTION}
            </div>
          }
          className="mapper-emptystate mapper-emptystate--centered"
          img={NoDataFound}
          version="v2"
          testId="no-results-found-page"
        /> :
        <div className="asset-mapper-table" ref={tableWrapperRef}>
          <div className="asset-mapper-toolbar">
            {brokenAssetCount > 0 ? (
              <div className="asset-broken-banner">
                <Icon icon="WarningBold" version="v2" size="small" />
                <span>
                  <strong>{brokenAssetCount}</strong>{' '}
                  {`asset${brokenAssetCount === 1 ? '' : 's'} won't be migrated because the source file is broken or missing.`}
                </span>
              </div>
            ) : (
              <span />
            )}
            <div className="asset-status-filter">
              <span className="asset-status-filter__label">Filter by status</span>
              <Select
                className="asset-status-select"
                value={statusFilter}
                options={statusFilterOptions}
                onChange={(opt: { label: string; value: string }) => setStatusFilter(opt)}
                isSearchable={false}
                isClearable={false}
                width="180px"
                version="v2"
              />
            </div>
          </div>
          <InfiniteScrollTable
            key={'asset-mapper-table'}
            loading={loading}
            canSearch={true}
            totalCounts={Math.max(0, totalCounts)}
            data={[...tableData]}
            columns={columns}
            uniqueKey={'id'}
            isRowSelect={true}
            fullRowSelect={true}
            fetchTableData={fetchData}
            tableHeight={tableHeight}
            equalWidthColumns={false}
            columnSelector={false}
            v2Features={{ pagination: true, isNewEmptyState: true }}
            rowPerPageOptions={[10, 30, 50, 100]}
            minBatchSizeToFetch={30}
            initialSelectedRowIds={rowIds}
            itemSize={60}
            getSelectedRow={handleSelectedAssets}
            rowSelectCheckboxProp={{ key: '_canSelect', value: true }}
            name={{
              singular: '',
              plural: `${totalCounts === 0 ? 'Count' : ''}`
            }}
            customEmptyState={
              <EmptyState
                forPage="list"
                heading={MAPPER_SEARCH_EMPTY_STATE.NO_MATCH_HEADING}
                description={MAPPER_SEARCH_EMPTY_STATE.NO_MATCH_DESCRIPTION}
                moduleIcon={MAPPER_SEARCH_EMPTY_STATE.NO_MATCH_ICON}
                className="custom-empty-state"
              />
            }
          />
          <div className="mapper-footer">
            <div></div>
            <Button
              className="saveButton"
              onClick={handleSaveAssets}
              version="v2"
              disabled={newMigrationData?.project_current_step > 4}
              isLoading={isLoadingSaveButton}
            >
              Save
            </Button>
          </div>
        </div>}
    </div>
  );
};

export default AssetMapper;
