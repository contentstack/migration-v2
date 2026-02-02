// Libraries
import { useEffect, useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import {
  InfiniteScrollTable,
  InstructionText,
  Tooltip,

} from '@contentstack/venus-components';

// Services
import { getCMSDataFromFile } from '../../cmsData/cmsSelector';
import {
  getContentTypes,
  getEntryMapping,
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
  console.info(selectedContentTypeId)

  // Component State
  const [tableData, setTableData] = useState<FieldMapType[]>([]);
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
        fetchEntries(selectedContentTypeId?.id || '');
    }
      
    },[selectedContentTypeId]);

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
      fetchEntries(data?.contentTypes?.[0]?.id);
      setOtherCmsUid(data?.contentTypes?.[0]?.otherCmsUid);
      setIsContentType(data?.contentTypes?.[0]?.type === "content_type");
    } catch (error) {
      console.error(error);
      return error;
    }
  };

   // Method to get fieldmapping
  const fetchEntries = async (contentTypeId: string) => {
    try {
      const itemStatusMap: ItemStatusMapProp = {};

      for (let index = 0; index <= 1000; index++) {
        itemStatusMap[index] = 'loading';
      }

      setItemStatusMap(itemStatusMap);
      setLoading(true);

      const { data } = await getEntryMapping(contentTypeId || '', 0, 1000, searchText || '', projectId);
      console.info("data in fetchEntries", data);
      for (let index = 0; index <= 1000; index++) {
        itemStatusMap[index] = 'loaded';
      }

      setItemStatusMap({ ...itemStatusMap });
      setLoading(false);

      const validTableData = data?.entryMapping;

      //setIsAllCheck(true);
      setTableData(validTableData ?? []);
      //setSelectedEntries(validTableData ?? []);
      setTotalCounts(validTableData?.length);
      //setInitialRowSelectedData(validTableData?.filter((item: FieldMapType) => !item?.isDeleted))
     
    } catch (error) {
      console.error('fetchData -> error', error);
    }
  };

    // Fetch table data
  const fetchData = async ({ searchText }: TableTypes) => {
    setSearchText(searchText)
    contentTypeUid && fetchEntries(contentTypeUid);
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

      const validTableData = data?.entryMapping;

      // eslint-disable-next-line no-unsafe-optional-chaining
      setTableData(validTableData ?? []);

    } catch (error) {
      console.error('loadMoreItems -> error', error);
    }
  };

   const accessorCall = (data: EntryMapperType) => {
    // Clean field name (remove parent hierarchy)
    const cleanFieldName = data?.entryName
    console.info("data in accessorCall", data);
      
    
    // const tooltipContent = data?.otherCmsField?.includes(' > ') 
    //   ? `Field: ${cleanFieldName} \nFull path: ${data.otherCmsField}`
    //   : `Field: ${cleanFieldName}`;

    // Simple checks for visual indicators
    // const isModularBlock = data?.contentstackFieldType === 'modular_blocks';
    // const isModularBlockChild = data?.contentstackFieldType === 'modular_blocks_child';
    // const isGroup = data?.contentstackFieldType === 'group';
    
    
    // Calculate nesting level for proper indentation
    // const nestingLevel = getNestingLevel(data?.uid || '');
    
    // Count children only if this is a modular block parent
    // const childrenCount = isModularBlockChild ? 
    //   tableData?.filter(item => item?.uid?.startsWith(data?.uid + '.'))?.length || 0 : 0;
    return (
      <Tooltip content={''} position="top">
        <div>
          <div className='d-flex align-items-center'>
            
            <div className={'cms-field'}>
              {cleanFieldName}
            </div>
            
          </div>
          <InstructionText>
            <div>
              UID: <span className="uid-text">{data?.otherCmsEntryUid}</span>
            </div>
          </InstructionText>
        </div>
      </Tooltip>
    );
  };

   const columns = [
    {
      disableSortBy: true,
      Header: (
        <span className="nowrap-header">
          {`${newMigrationData?.legacy_cms?.selectedCms?.title}: ${otherCmsTitle}`}
        </span>
      ),
      accessor: accessorCall,
      id: 'uuid'
    },
    {
      disableSortBy: true,
      Header: (
        <span className="nowrap-header">
          {'Contentstack:'}
        </span>
      ),
    //   accessor: accessorCall,
      id: '1'
    }
  ];

  return (
    <InfiniteScrollTable
        loading={loading}
        canSearch={true}
        totalCounts={Math.max(0, tableData?.length)}
        // data={tableData?.length > 0 ? [...tableData] : []}
        data={[...tableData]}
        columns={columns}
        uniqueKey={'id'}
        isRowSelect
        // fullRowSelect
        itemStatusMap={itemStatusMap}
        //searchPlaceholder={tableSearchPlaceholder}
        fetchTableData={fetchData}
        loadMoreItems={loadMoreItems}
        tableHeight={tableHeight}
        equalWidthColumns={true}
        columnSelector={false}
    //   initialRowSelectedData={initialRowSelectedData}
    //   initialSelectedRowIds={rowIds}
        itemSize={80}
        
        rowSelectCheckboxProp={{ key: '_canSelect', value: true }}
        name={{
            singular: '',
            plural: `${totalCounts === 0 ? 'Count' : ''}`
        }}
    />
  )
}
export default EntryMapper;