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
import { ASSET_MAPPER_EMPTY_STATE } from '../../utilities/constants';

// Interface
import { AssetMapperType, TableTypes, UidMap } from './contentMapper.interface';
import { ItemStatusMapProp } from '@contentstack/venus-components/build/components/Table/types';

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
  tableHeight,
  onCountChange,
}: {
  tableHeight: number;
  onCountChange?: (count: number) => void;
}) => {
  const { projectId = '' } = useParams<{ projectId: string }>();

  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);

  // Component State
  const [tableData, setTableData] = useState<AssetMapperType[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [totalCounts, setTotalCounts] = useState<number>(0);
  const [itemStatusMap, setItemStatusMap] = useState({});
  const [rowIds, setRowIds] = useState<Record<string, boolean>>({});
  const [persistedRowIds, setPersistedRowIds] = useState<Record<string, boolean>>({});
  const [isLoadingSaveButton, setisLoadingSaveButton] = useState<boolean>(false);
  // True once the initial fetch has settled — used to gate the empty state so it
  // doesn't flash before assets have loaded.
  const [hasFetched, setHasFetched] = useState<boolean>(false);

  useEffect(() => {
    fetchAssets('');
  }, []);

  const fetchAssets = async (searchText: string) => {
    try {
      const statusMap: ItemStatusMapProp = {};
      for (let index = 0; index <= 1000; index++) {
        statusMap[index] = 'loading';
      }
      setItemStatusMap(statusMap);
      setLoading(true);

      const { data } = await getAssetMapping(0, 1000, searchText ?? '', projectId);

      for (let index = 0; index <= 1000; index++) {
        statusMap[index] = 'loaded';
      }
      setItemStatusMap({ ...statusMap });
      setLoading(false);

      const validTableData: AssetMapperType[] = mapAssetsToRows(data?.assetMapping);

      // The API returns the full (filtered) total separately from the page it
      // sends back. Use that so the count and pagination are correct when the
      // result set is larger than the requested page size.
      const total = data?.count ?? validTableData?.length ?? 0;

      const initialSelected = buildSelectedRowIds(validTableData ?? []);
      setTableData(validTableData ?? []);
      setRowIds(initialSelected);
      setPersistedRowIds(initialSelected);
      setTotalCounts(total);
      onCountChange?.(total);
      setHasFetched(true);
    } catch (error) {
      console.error('fetchAssets -> error', error);
      setHasFetched(true);
    }
  };

  // Fetch table data
  const fetchData = async ({ searchText }: TableTypes) => {
    fetchAssets(searchText ?? '');
  };

  // Method for Load more table data
  const loadMoreItems = async ({ searchText, skip, limit, startIndex, stopIndex }: TableTypes) => {
    try {
      const itemStatusMapCopy: ItemStatusMapProp = { ...itemStatusMap };
      for (let index = startIndex; index <= stopIndex; index++) {
        itemStatusMapCopy[index] = 'loading';
      }
      setItemStatusMap({ ...itemStatusMapCopy });
      setLoading(true);

      const { data } = await getAssetMapping(skip, limit, searchText ?? '', projectId);

      const updateditemStatusMapCopy: ItemStatusMapProp = { ...itemStatusMap };
      for (let index = startIndex; index <= stopIndex; index++) {
        updateditemStatusMapCopy[index] = 'loaded';
      }
      setItemStatusMap({ ...updateditemStatusMapCopy });
      setLoading(false);

      const validTableData: AssetMapperType[] = mapAssetsToRows(data?.assetMapping);
      const newRows = applySelectionToAssets(validTableData ?? [], rowIds);

      // Merge the fetched page into the existing rows at its offset so the
      // virtualized table keeps previously loaded rows instead of dropping
      // them when the next range is requested.
      setTableData((prev) => {
        const merged = [...(prev ?? [])];
        newRows.forEach((row, index) => {
          merged[Number(skip) + index] = row;
        });
        return merged;
      });
    } catch (error) {
      console.error('loadMoreItems -> error', error);
    }
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
      width: '220px',
    },
    {
      disableSortBy: true,
      Header: (<span>{'Path:'}</span>),
      accessor: accessorAssetPath,
      id: '1'
    },
    {
      disableSortBy: true,
      Header: (<span>{'Size:'}</span>),
      accessor: accessorFileSize,
      id: '2',
      width: '100px',
    },
    {
      disableSortBy: true,
      Header: (<span>{'Contentstack UIDs:'}</span>),
      accessor: accessorContentstackUid,
      id: '3'
    }
  ];

  return (
    <div className="step-container">
      {(hasFetched && !loading && totalCounts === 0) ?
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
        <div className='entry-mapper-container'>
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
            itemStatusMap={itemStatusMap}
            fetchTableData={fetchData}
            loadMoreItems={loadMoreItems}
            tableHeight={tableHeight}
            equalWidthColumns={false}
            columnSelector={false}
            initialSelectedRowIds={rowIds}
            itemSize={80}
            getSelectedRow={handleSelectedAssets}
            rowSelectCheckboxProp={{ key: '_canSelect', value: true }}
            name={{
              singular: '',
              plural: `${totalCounts === 0 ? 'Count' : ''}`
            }}
          />
          <div className="mapper-footer">
            <div>Total Assets: <strong>{totalCounts}</strong></div>
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
