// Libraries
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import {
  Button,
  InfiniteScrollTable,
  Notification,
  EmptyState,
} from '@contentstack/venus-components';

// Services
import {
  getAssetMapping,
  updateAssetMapper,
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
  // True once the initial fetch has settled — used to gate the empty state so it
  // doesn't flash before assets have loaded.
  const [hasFetched, setHasFetched] = useState<boolean>(false);
  // Current search term driven by the table. When a search is active we keep the
  // table (and its search box) mounted even on 0 results, otherwise the user is
  // stranded on the full-page empty state with no way to clear the search.
  const [searchText, setSearchText] = useState<string>('');

  useEffect(() => {
    fetchAssets('', { seedSelection: true });
  }, []);

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

      const { data } = await getAssetMapping(skip, limit, searchVal ?? '', projectId);

      setLoading(false);

      const validTableData: AssetMapperType[] = mapAssetsToRows(data?.assetMapping);

      // The API returns the full (filtered) total separately from the page it
      // sends back. Use that so the count and pagination are correct when the
      // result set is larger than the requested page size.
      const total = data?.count ?? validTableData?.length ?? 0;
      setTotalCounts(total);
      onCountChange?.(total);
      setHasFetched(true);

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

  const accessorAssetName = (data: AssetMapperType) => {
    return (
      <div>
        <div className='d-flex align-items-center'>
          <div className={'cms-field cms-field--wrap'}>
            {data?.filename || data?.title || '-'}
          </div>
        </div>
      </div>
    );
  };

  const accessorAssetPath = (data: AssetMapperType) => {
    return (
      <div>
        <div className='d-flex align-items-center'>
          <div className={'cms-field cms-field--wrap'}>
            {data?.assetPath || '-'}
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
    return (
      <div>
        <div className='d-flex align-items-center'>
          <div className={'cms-field'}>
            {data?.contentstackAssetUid ? data?.contentstackAssetUid : '-'}
          </div>
        </div>
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
      width: '400px',
    },
    {
      disableSortBy: true,
      Header: (<span>{'Path:'}</span>),
      accessor: accessorAssetPath,
      id: '1',
      width: '550px',
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
    }
  ];

  return (
    <div className="step-container">
      {(hasFetched && !loading && totalCounts === 0 && !searchText) ?
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
        <div>
          <InfiniteScrollTable
            key={'asset-mapper-table'}
            className={'asset-mapper-table'}
            loading={loading}
            canSearch={true}
            totalCounts={Math.max(0, totalCounts)}
            data={[...tableData]}
            columns={columns}
            uniqueKey={'id'}
            isRowSelect={true}
            fullRowSelect={true}
            fetchTableData={fetchData}
            tableHeight={400}
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
                type="secondary"
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
