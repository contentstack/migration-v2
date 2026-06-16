// Libraries
import { useEffect, useState} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import {
  Button,
  InfiniteScrollTable,
  Notification,
  cbModal,
  CircularLoader,
  EmptyState,
  Select,
} from '@contentstack/venus-components';

// Services
import { getCMSDataFromFile } from '../../cmsData/cmsSelector';
import {
  getContentTypes,
  getEntryMapping,
  updateEntryMapper,
} from '../../services/api/migration.service';
import { getProject } from '../../services/api/project.service';

// Redux
import { RootState } from '../../store';
import { updateMigrationData } from '../../store/slice/migrationDataSlice';

// Utilities
import { CS_ENTRIES } from '../../utilities/constants';
import useBlockNavigation from '../../hooks/userNavigation';

// Interface
import { DEFAULT_CONTENT_MAPPING_DATA } from '../../context/app/app.interface';
import {
  ContentType,
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

  // Fetch the project's configured locale mapping (master + additional) on mount so the
  // dropdown reflects the actual project state, not stale/missing redux.
  useEffect(() => {
    const orgId = selectedOrganisation?.uid;
    if (!orgId || !projectId) return;
    (async () => {
      try {
        const res: any = await getProject(orgId, projectId);
        const project = res?.data?.project ?? res?.data ?? res;
        const masterMap: Record<string, string> = project?.master_locale ?? {};
        const additional: Record<string, string> = project?.locales ?? {};
        const opts: { label: string; value: string }[] = [];
        Object.keys(masterMap).forEach((code) => {
          opts.push({ label: `${code} (master)`, value: code });
        });
        Object.keys(additional).forEach((code) => {
          if (!opts.some((o) => o.value === code)) {
            opts.push({ label: code, value: code });
          }
        });
        setLocaleOptions(opts);
        if (opts.length > 0) setSelectedLocale(opts[0]);
      } catch (err) {
        console.error('Failed to load project locales', err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, selectedOrganisation?.uid]);

  // Refetch the entry list when the user switches locale so isUpdate reflects the per-locale flag.
  useEffect(() => {
    if (contentTypeUid && selectedLocale?.value) {
      fetchEntries(contentTypeUid, searchText || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocale?.value]);

  /********** HELPERS *************/
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


      setContentTypes(data?.contentTypes);
      setSelectedContentType(data?.contentTypes?.[0]);
      setOtherCmsTitle(data?.contentTypes?.[0]?.otherCmsTitle);
      setContentTypeUid(data?.contentTypes?.[0]?.id);
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

      const { data } = await getEntryMapping(ctId || '', 0, 1000, searchVal, projectId, selectedLocale?.value);

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

      const { data } = await getEntryMapping(contentTypeUid || '', skip, limit, search || '', projectId, selectedLocale?.value);

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

  // Handle selected entries
  const handleSelectedEntries = (singleSelectedRowIds: string[]) => {
    const selectedObj: UidMap = {};
    singleSelectedRowIds?.forEach((uid: string) => {
      selectedObj[uid] = true;
    });
    setRowIds(selectedObj);
    setTableData((prev) => applySelectionToEntries(prev ?? [], selectedObj));
  };

  const handleSaveContentType = async () => {
    setisLoadingSaveButton(true);
    const allKeys = new Set([
      ...Object.keys(rowIds ?? {}),
      ...Object.keys(persistedRowIds ?? {}),
    ]);
    const changedUids = Array.from(allKeys).filter(
      (uid) => !!rowIds?.[uid] !== !!persistedRowIds?.[uid],
    );
    const orgId = selectedOrganisation?.uid;

    if (orgId && contentTypeUid) {
      const dataCs: Record<string, unknown> = { ids: changedUids };
      if (selectedLocale?.value) dataCs.locale = selectedLocale.value;
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
        data={[...tableData]}
        columns={columns}
        uniqueKey={'id'}
        isRowSelect={true}
        fullRowSelect={true}
        itemStatusMap={itemStatusMap}
        fetchTableData={fetchData}
        loadMoreItems={loadMoreItems}
        tableHeight={tableHeight}
        equalWidthColumns={true}
        columnSelector={false}
        initialSelectedRowIds={rowIds}
        itemSize={80}
        getSelectedRow={handleSelectedEntries}
        rowSelectCheckboxProp={{ key: '_canSelect', value: true }}
        name={{
            singular: '',
            plural: `${totalCounts === 0 ? 'Count' : ''}`
        }}

              <div className='ct-search-wrapper'>
                <div className='d-flex align-items-center'>
                  <Search
                    placeholder={searchPlaceholder}
                    type="secondary"
                    version="v2"
                    onChange={(search: string) => handleSearch(search)}
                    onClear={true}
                    value={searchContentType}
                    debounceSearch={true}
                  />

                  <Button buttonType="light" onClick={handleFilter} className="ml-8">
                    <Icon icon="Filter" version="v2" />
                  </Button>
                  {showFilter && (
                    <div className='filter-wrapper' ref={filterRef}>
                      <ul>
                        {Object.keys(CONTENT_MAPPING_STATUS)?.map?.((key, keyInd) => (
                          <li key={`${keyInd?.toString()}`}>
                            <button
                              className='list-button'
                              onClick={(e) => handleContentTypeFilter(CONTENT_MAPPING_STATUS[key], e)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleContentTypeFilter(CONTENT_MAPPING_STATUS[key], e);
                                }
                              }}
                            >
                              {CONTENT_MAPPING_STATUS[key] && <span className={`${activeFilter === CONTENT_MAPPING_STATUS[key] ? 'filter-status filterButton-color' : 'filter-status'}`}>{CONTENT_MAPPING_STATUS[key]}</span>}
                              {STATUS_ICON_Mapping[key] && <Icon size="small" icon={STATUS_ICON_Mapping[key]} className={STATUS_ICON_Mapping[key] === 'CheckedCircle' ? 'mapped-icon' : ''} />}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {filteredContentTypes && validateArray(filteredContentTypes)
                ? <div className='ct-list-wrapper'>
                  <ul className="ct-list">
                    {filteredContentTypes?.map?.((content: ContentType, index: number) => {
                      const icon = STATUS_ICON_Mapping[content?.status] || '';
                      const format = (str: string) => {
                        const frags = str?.split('_');
                        for (let i = 0; i < frags?.length; i++) {
                          frags[i] = frags?.[i]?.charAt?.(0)?.toUpperCase() + frags?.[i]?.slice(1);
                        }
                        return frags?.join?.(' ');
                      };
                      return (
                        <li key={`${index?.toString()}`} className={`${active == index ? 'active-ct' : ''}`}>
                          <button
                            type='button'
                            className='list-button ct-names'
                            onClick={(e) => {
                              if (otherCmsUid === filteredContentTypes[index]?.otherCmsUid) {
                                e.preventDefault();
                              } else {
                                handleOpenContentType(index);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && otherCmsUid !== filteredContentTypes[index]?.otherCmsUid) {
                                handleOpenContentType(index);
                              }
                            }}
                          >
                            <div className='cms-title'>
                              <Tooltip content={format(content?.type)} position="bottom">
                                {content?.type === "content_type"
                                  ? <Icon icon={active == index ? "ContentModelsMediumActive" : "ContentModelsMedium"} size="small" />
                                  : <Icon icon={active == index ? "GlobalFieldsMediumActive" : "GlobalFieldsMedium"} size="small" />
                                }
                              </Tooltip>
                              {content?.otherCmsTitle && <span title={content?.otherCmsTitle}>{content?.otherCmsTitle}</span>}
                            </div>
                          </button>
                          <div className='d-flex align-items-center ct-options'>
                            <span>
                              {icon && (
                                <Tooltip content={CONTENT_MAPPING_STATUS[content?.status]} position="bottom">
                                  <Icon size="small" icon={icon} className={icon === 'CheckedCircle' ? 'mapped-icon' : ''} />
                                </Tooltip>
                              )}
                            </span>
                            <span className='ml-10'>
                              <Tooltip content="Schema Preview" position="bottom">
                                <button className='list-button schema-preview' aria-label="schemaPreview" onClick={() => handleSchemaPreview(content?.otherCmsTitle, content?.id ?? '')}>{SCHEMA_PREVIEW}</button>
                              </Tooltip>
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                : <div className='no-content'>No Content Types Found.</div>
              }
            </div>

            {/* Entry Mapping Table */}
            <div className="content-types-fields-wrapper">
              <div className="table-wrapper" ref={tableWrapperRef}>
                <div className={`entry-mapper-container${localeOptions?.length > 1 ? ' has-locale-select' : ''}`}>
                  {localeOptions?.length > 1 && (
                    <div className="locale-select-inline">
                      <Select
                        className="locale-select"
                        value={selectedLocale}
                        options={localeOptions}
                        onChange={(opt: { label: string; value: string }) => setSelectedLocale(opt)}
                        isSearchable={false}
                        isClearable={false}
                        placeholder="Select locale"
                        width="240px"
                        version="v2"
                      />
                    </div>
                  )}
                  <InfiniteScrollTable
                    key={contentTypeUid || 'entry-mapper-table'}
                    loading={loading}
                    canSearch={true}
                    totalCounts={Math.max(0, tableData?.length)}
                    data={[...tableData]}
                    columns={columns}
                    uniqueKey={'id'}
                    isRowSelect={true}
                    fullRowSelect={true}
                    itemStatusMap={itemStatusMap}
                    fetchTableData={fetchData}
                    loadMoreItems={loadMoreItems}
                    tableHeight={tableHeight}
                    equalWidthColumns={true}
                    columnSelector={false}
                    initialRowSelectedData={initialRowSelectedData}
                    initialSelectedRowIds={rowIds}
                    itemSize={80}
                    getSelectedRow={handleSelectedEntries}
                    rowSelectCheckboxProp={{ key: '_canSelect', value: true }}
                    name={{
                      singular: '',
                      plural: `${totalCounts === 0 ? 'Count' : ''}`
                    }}
                  />
                  {totalCounts > 0 && (
                    <div className="mapper-footer">
                      <div>Total Entries: <strong>{totalCounts}</strong></div>
                      <Button
                        className="saveButton"
                        onClick={handleSaveContentType}
                        version="v2"
                        disabled={newMigrationData?.project_current_step > 4}
                        isLoading={isLoadingSaveButton}
                      >
                        Save
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div> :
          <EmptyState
            forPage="emptyStateV2"
            heading={<div className="empty_search_heading">No Content Types available</div>}
            description={
              <div className="empty_search_description">
                {modalProps?.body}
              </div>
            }
            className="mapper-emptystate"
            img={NoDataFound}
            actions={
              <Button buttonType="secondary" size="small" version="v2"
                onClick={() => {
                  const newMigrationDataObj: INewMigration = {
                    ...newMigrationData,
                    legacy_cms: {
                      ...newMigrationData?.legacy_cms,
                      uploadedFile: {
                        ...newMigrationData?.legacy_cms?.uploadedFile,
                        reValidate: true,
                        buttonClicked: true,
                      }
                    }
                  };
                  dispatch(updateNewMigrationData(newMigrationDataObj));
                  handleStepChange(0);
                  const url = `/projects/${projectId}/migration/steps/1`;
                  navigate(url, { replace: true });
                }}
                className='ml-10'>Go to Legacy CMS</Button>
            }
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