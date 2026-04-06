// Libraries
import { useEffect, useState} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import {
  Button,
  InfiniteScrollTable,
  Notification,

} from '@contentstack/venus-components';

// Services
import { getCMSDataFromFile } from '../../cmsData/cmsSelector';
import {
  getContentTypes,
  getEntryMapping,
  updateEntryMapper,
} from '../../services/api/migration.service';

// Redux
import { RootState } from '../../store';
import { updateMigrationData, updateNewMigrationData } from '../../store/slice/migrationDataSlice';

// Utilities
import { CS_ENTRIES, CONTENT_MAPPING_STATUS, STATUS_ICON_Mapping } from '../../utilities/constants';
import { isEmptyString, validateArray } from '../../utilities/functions';
import useBlockNavigation from '../../hooks/userNavigation';

// Interface
import { DEFAULT_CONTENT_MAPPING_DATA, INewMigration } from '../../context/app/app.interface';
import {
  ContentType,
  FieldMapType,
  FieldTypes,
  TableTypes,
  UidMap, 
  EntryMapperType
} from './contentMapper.interface';
import { ItemStatusMapProp } from '@contentstack/venus-components/build/components/Table/types';


// Styles and Assets
import './index.scss';

const EntryMapper = ({selectedContentTypeId, tableHeight}: {selectedContentTypeId: ContentType | null, tableHeight: number}) => {
  // Redux State
  const dispatch = useDispatch();

  const { projectId = '' } = useParams<{ projectId: string }>();

  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);
  const selectedOrganisation = useSelector((state: RootState) => state?.authentication?.selectedOrganisation);

  // Component State
  const [tableData, setTableData] = useState<EntryMapperType[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [totalCounts, setTotalCounts] = useState<number>(tableData?.length);
  const [searchText, setSearchText] = useState<string>('');
  const [selectedContentType, setSelectedContentType] = useState<ContentType | null>(selectedContentTypeId);
  const [contentTypes, setContentTypes] = useState<ContentType  []>([]);
  const [itemStatusMap, setItemStatusMap] = useState({});

  const [otherCmsTitle, setOtherCmsTitle] = useState('');
  const [contentTypeUid, setContentTypeUid] = useState<string>(selectedContentTypeId?.id || '');

  const [isContentType, setIsContentType] = useState<boolean>(true);
 
  const [otherCmsUid, setOtherCmsUid] = useState<string>(contentTypes?.[0]?.otherCmsUid);
  const [rowIds, setRowIds] = useState<Record<string, boolean>>({});
  const [persistedRowIds, setPersistedRowIds] = useState<Record<string, boolean>>({});
  const [isLoadingSaveButton, setisLoadingSaveButton] = useState<boolean>(false);
  const [initialRowSelectedData, setInitialRowSelectedData] = useState<EntryMapperType[]>([]);



    /********** ALL USEEFFECT HERE *************/
  useEffect(() => {
    //check if offline CMS data field is set to true, if then read data from cms data file.
    getCMSDataFromFile(CS_ENTRIES.CONTENT_MAPPING)
      .then((data) => {
        //Check for null
        if (!data) {
          dispatch(updateMigrationData({ contentMappingData: DEFAULT_CONTENT_MAPPING_DATA }));
          return;
        }

        dispatch(updateMigrationData({ contentMappingData: data }));
      })
      .catch((err) => {
        console.error(err);
      });

    fetchContentTypes(searchText || '');
  }, []);

  useEffect(() => {
    if (selectedContentTypeId) {
        fetchEntries(selectedContentTypeId?.id || '', searchText);
        setOtherCmsTitle(selectedContentTypeId?.otherCmsTitle);
    }
      
    },[selectedContentTypeId]);

  const buildSelectedRowIds = (entries: EntryMapperType[]) => {
    return (entries ?? []).reduce<UidMap>((acc, item) => {
      if (item?._canSelect && item?.isUpdate) {
        acc[item.id] = true;
      }
      return acc;
    }, {});
  };

  const applySelectionToEntries = (
    entries: EntryMapperType[],
    selected: Record<string, boolean>,
  ) => {
    return (entries ?? []).map((item) => {
      if (!item?._canSelect) return item;
      return {
        ...item,
        isUpdate: !!selected?.[item.id],
      };
    });
  };

  const fetchContentTypes = async (searchText: string) => {
    //setIsLoading(true);

    try {
      const { data } = await getContentTypes(projectId || '', 0, 5000, ''); //org id will always present

      //setIsLoading(false);
      setContentTypes(data?.contentTypes);
      //setCount(data?.contentTypes?.length);
      //setFilteredContentTypes(data?.contentTypes);
      setSelectedContentType(data?.contentTypes?.[0]);
      //setTotalCounts(data?.contentTypes?.[0]?.fieldMapping?.length);
      setOtherCmsTitle(data?.contentTypes?.[0]?.otherCmsTitle);
      setContentTypeUid(data?.contentTypes?.[0]?.id);
    //   fetchFields(data?.contentTypes?.[0]?.id, searchText || '');
      fetchEntries(data?.contentTypes?.[0]?.id, searchText ?? '');
      setOtherCmsUid(data?.contentTypes?.[0]?.otherCmsUid);
      setIsContentType(data?.contentTypes?.[0]?.type === "content_type");
    } catch (error) {
      console.error(error);
      return error;
    }
  };

   // Method to get fieldmapping
  const fetchEntries = async (contentTypeId: string, searchText: string) => {
    try {
      const itemStatusMap: ItemStatusMapProp = {};

      for (let index = 0; index <= 1000; index++) {
        itemStatusMap[index] = 'loading';
      }

      setItemStatusMap(itemStatusMap);
      setLoading(true);
     
      const { data } = await getEntryMapping(contentTypeId || '', 0, 1000, searchText, projectId);
      
      for (let index = 0; index <= 1000; index++) {
        itemStatusMap[index] = 'loaded';
      }

      setItemStatusMap({ ...itemStatusMap });
      setLoading(false);

      const validTableData: EntryMapperType[] = (data?.entryMapping ?? []).map((entry: EntryMapperType) => ({
        ...entry,
        _canSelect: !!entry?.contentstackEntryUid,
      }));

      //setIsAllCheck(true);
      const initialSelected = buildSelectedRowIds(validTableData ?? []);
      setTableData(validTableData ?? []);
      setRowIds(initialSelected);
      setPersistedRowIds(initialSelected);
      setTotalCounts(validTableData?.length);
      setInitialRowSelectedData(validTableData?.filter((item: EntryMapperType) => !item?.isUpdate))
     
    } catch (error) {
      console.error('fetchData -> error', error);
    }
  };

    // Fetch table data
  const fetchData = async ({ searchText }: TableTypes) => {
    setSearchText(searchText)
    selectedContentTypeId?.id && fetchEntries(selectedContentTypeId?.id, searchText);
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

      const { data } = await getEntryMapping(contentTypeUid || '', skip, limit, searchText || '', projectId);

      const updateditemStatusMapCopy: ItemStatusMapProp = { ...itemStatusMap };

      for (let index = startIndex; index <= stopIndex; index++) {
        updateditemStatusMapCopy[index] = 'loaded';
      }

      setItemStatusMap({ ...updateditemStatusMapCopy });
      setLoading(false);

      const validTableData: EntryMapperType[] = (data?.entryMapping ?? []).map((entry: EntryMapperType) => ({
        ...entry,
        _canSelect: !!entry?.contentstackEntryUid,
      }));

      // eslint-disable-next-line no-unsafe-optional-chaining
      setTableData(applySelectionToEntries(validTableData ?? [], rowIds));

    } catch (error) {
      console.error('loadMoreItems -> error', error);
    }
  };

   /**
     * Handle the selected entries
     * @param singleSelectedRowIds - The single selected row IDs
     * @returns void
     */
    const handleSelectedEntries = (singleSelectedRowIds: string[]) => {
      const selectedObj: UidMap = {};
      singleSelectedRowIds?.forEach((uid: string) => {
        selectedObj[uid] = true;
      });

      setRowIds(selectedObj);
      setTableData((prev) => applySelectionToEntries(prev ?? [], selectedObj));
    };
    
    const handleSaveContentType = async () => {
      console.info("handleSaveContentType", rowIds);
      setisLoadingSaveButton(true);
      const allKeys = new Set([
        ...Object.keys(rowIds ?? {}),
        ...Object.keys(persistedRowIds ?? {}),
      ]);
      const changedUids = Array.from(allKeys).filter(
        (uid) => !!rowIds?.[uid] !== !!persistedRowIds?.[uid],
      );
          const orgId = selectedOrganisation?.uid;
          // const projectID = projectId;
      
      if (orgId && contentTypeUid) {
        const dataCs = {
          ids: changedUids
        };
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
        const {data, status} = await updateEntryMapper(projectId, dataCs);
        console.info("status", status, typeof status, data);
      
        setisLoadingSaveButton(false);  
        if (status === 200) {
          setPersistedRowIds({ ...(rowIds ?? {}) });
          setLoading(false);
          return Notification({
            notificationContent: { text: 'Entries saved successfully' },
            notificationProps: {
              position: 'bottom-center',
              hideProgressBar: true
            },
            type: 'success'
          });
        }
        else{
          setisLoadingSaveButton(false);
          return Notification({
            notificationContent: { text: 'Failed to save entries' },
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
      
      }
    }
   const accessorCall = (data: EntryMapperType) => {
    // Clean field name (remove parent hierarchy)
    const cleanFieldName = data?.entryName
    return (
        <div>
          <div className='d-flex align-items-center '>           
            <div className={'cms-field'}>
              {cleanFieldName}
            </div>           
          </div>
        </div>
    );
  };

    const accessorContentstackCall = (data: EntryMapperType) => {
    // Clean field name (remove parent hierarchy)
    const cleanFieldName = data?.contentstackEntryUid
    return ( 
        <div>
          <div className='d-flex align-items-center'>           
            <div className={'cms-field'}>
              {cleanFieldName ? cleanFieldName : '-'}
            </div>           
          </div>
        </div>
    
    );
  };

  const accessorForCMSUid = (data: EntryMapperType) => { 
    const cleanFieldName = data?.otherCmsEntryUid
    return (
      <div>
        <div className='d-flex align-items-center'>           
          <div className={'cms-field'}>
            {cleanFieldName ? cleanFieldName : '-'}
          </div>           
        </div>
      </div>
    );
  }

   const columns = [
    {
      disableSortBy: true,
      Header: (
        <span >
          {`${newMigrationData?.legacy_cms?.selectedCms?.title}: ${otherCmsTitle}`}
        </span>
      ),
      accessor: accessorCall,
      id: 'uuid',
      width: '250px',
    },
    {
      disableSortBy: true,
      Header: (
        <span >
          {`${newMigrationData?.legacy_cms?.selectedCms?.title} UIDs:`}
        </span>
      ),
      accessor: accessorForCMSUid,
      id: '1'
    },
    {
      disableSortBy: true,
      Header: (
        <span >
          {'Contentstack UIDs:'}
        </span>
      ),
     accessor: accessorContentstackCall,
      id: '2'
    }
  ];

  return (
    <div className='entry-mapper-container'>
      <InfiniteScrollTable
        key={contentTypeUid || selectedContentTypeId?.id || 'entry-mapper-table'}
        loading={loading}
        canSearch={true}
        totalCounts={Math.max(0, tableData?.length)}
        // data={tableData?.length > 0 ? [...tableData] : []}
        data={[...tableData]}
        columns={columns}
        uniqueKey={'id'}
        isRowSelect={true}
        fullRowSelect={true}
        itemStatusMap={itemStatusMap}
        //searchPlaceholder={tableSearchPlaceholder}
        fetchTableData={fetchData}
        loadMoreItems={loadMoreItems}
        tableHeight={tableHeight}
        equalWidthColumns={true}
        columnSelector={false}
    //   initialRowSelectedData={initialRowSelectedData}
        initialSelectedRowIds={rowIds}
        itemSize={80}
        getSelectedRow={handleSelectedEntries}
        rowSelectCheckboxProp={{ key: '_canSelect', value: true }}
        name={{
            singular: '',
            plural: `${totalCounts === 0 ? 'Count' : ''}`
        }}

    />
    <div className="mapper-footer">
          <div>Total Entries: <strong>{totalCounts}</strong></div>
          <Button
            className="saveButton"
            onClick={handleSaveContentType}
            version="v2"
            disabled={newMigrationData?.project_current_step > 4}
            //isLoading={isLoadingSaveButton}
          >
            Save
          </Button>
    </div>

      
    </div>
    
  )
}
export default EntryMapper;