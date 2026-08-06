// Libraries
import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Search,
  Icon,
  Tooltip,
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
  getFieldMapping,
  getEntryMapping,
  updateEntryMapper,
} from '../../services/api/migration.service';
import { getProject } from '../../services/api/project.service';

// Redux
import { RootState } from '../../store';
import { updateMigrationData, updateNewMigrationData } from '../../store/slice/migrationDataSlice';

// Utilities
import { CS_ENTRIES, CONTENT_MAPPING_STATUS, STATUS_ICON_Mapping, ENTRY_MAPPER_EMPTY_STATE, MAPPER_SEARCH_EMPTY_STATE } from '../../utilities/constants';
import { validateArray } from '../../utilities/functions';

// Interface
import { DEFAULT_CONTENT_MAPPING_DATA, INewMigration } from '../../context/app/app.interface';
import {
  ContentType,
  TableTypes,
  UidMap,
  EntryMapperType,
  MouseOrKeyboardEvent,
} from './contentMapper.interface';
import { ModalObj } from '../Modal/modal.interface';

// Components
import SchemaModal from '../SchemaModal';

// Pure logic (unit-tested in __tests__/entryMapper.utils.test.ts)
import {
  mapEntriesToRows,
  buildSelectedEntryRowIds,
  applySelectionToEntries,
  filterContentTypesByStatus,
  applyContentTypeStatus,
} from './entryMapper.utils';
import { toSelectedMap, computeChangedUids } from './assetMapper.utils';
import { useMeasuredTableHeight } from './useMeasuredTableHeight';

// Styles and Assets
import './index.scss';
import { NoDataFound, SCHEMA_PREVIEW } from '../../common/assets';

interface entryMapperProps {
  handleStepChange: (currentStep: number) => void;
}

/**
 * Step 4 — Map Entry (delta migration).
 * Standalone step: left content-type list (only ALREADY-MIGRATED content types, fetched with
 * filter='old') + right entry-mapping table. Maps source entries to destination Contentstack
 * entries for content types that were migrated in a previous iteration.
 */
const EntryMapper = ({ handleStepChange }: entryMapperProps) => {
  /** ALL CONTEXT HERE */
  const migrationData = useSelector((state: RootState) => state?.migration?.migrationData);
  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);
  const selectedOrganisation = useSelector((state: RootState) => state?.authentication?.selectedOrganisation);

  const {
    contentMappingData: {
      content_types_heading: contentTypesHeading,
      search_placeholder: searchPlaceholder,
    } = {}
  } = migrationData;

  const dispatch = useDispatch();

  /** ALL STATE HERE */
  const [tableData, setTableData] = useState<EntryMapperType[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(newMigrationData?.isprojectMapped);
  const [totalCounts, setTotalCounts] = useState<number>(0);

  const [searchText, setSearchText] = useState<string>('');
  const [searchContentType, setSearchContentType] = useState('');
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [filteredContentTypes, setFilteredContentTypes] = useState<ContentType[]>([]);
  const [count, setCount] = useState<number>(0);
  const [otherCmsTitle, setOtherCmsTitle] = useState('');
  const [otherCmsUid, setOtherCmsUid] = useState<string>('');
  const [contentTypeUid, setContentTypeUid] = useState<string>('');

  const [active, setActive] = useState<number | null>(0);
  const [showFilter, setShowFilter] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<string>('');

  const [rowIds, setRowIds] = useState<Record<string, boolean>>({});
  const [persistedRowIds, setPersistedRowIds] = useState<Record<string, boolean>>({});
  const [isLoadingSaveButton, setisLoadingSaveButton] = useState<boolean>(false);

  // Locale dropdown — sourced from project.json (master_locale + locales) so it reflects the
  // user's configured mapping regardless of redux hydration timing on restart.
  const [localeOptions, setLocaleOptions] = useState<{ label: string; value: string }[]>([]);
  const [selectedLocale, setSelectedLocale] = useState<{ label: string; value: string } | null>(null);
  // True once the locale-fetch effect below has settled (success or failure). Used as a
  // safety net: if getProject fails, or the project has no master_locale/locales at all,
  // selectedLocale stays null forever and the entries-fetch effect (keyed on
  // contentTypeUid && selectedLocale) would never fire — leaving Map Entry on an empty
  // table with no spinner and no error. Once resolution has settled with no options, fall
  // back to the unfiltered fetch (server-side getEntryMapping already falls open when no
  // locale is provided).
  const [localesResolved, setLocalesResolved] = useState(false);

  /** ALL HOOKS HERE */
  const { projectId = '' } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const filterRef = useRef<HTMLDivElement | null>(null);
  const tableWrapperRef = useRef<HTMLDivElement | null>(null);
  // Monotonic id per fetchEntries call. Any response whose id no longer matches the
  // latest issued call is ignored — prevents a stale in-flight fetch from a previous
  // locale/content-type from clobbering the current view's rowIds / persistedRowIds
  // when responses land out of order.
  const fetchGenerationRef = useRef(0);
  // Bumped after every successful seedSelection fetch. Used as part of the Table's
  // `key` so the Table remounts with FRESH rowIds already committed — remounting on
  // locale change alone was too early (rowIds was still the previous locale's).
  const [tableRevision, setTableRevision] = useState(0);

  /********** ALL USEEFFECT HERE *************/
  useEffect(() => {
    // check if offline CMS data field is set to true, if then read data from cms data file.
    getCMSDataFromFile(CS_ENTRIES.CONTENT_MAPPING)
      .then((data) => {
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

  // Close filter panel when clicking outside
  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        if (opts?.length > 0) setSelectedLocale(opts[0]);
      } catch (err) {
        console.error('Failed to load project locales', err);
      } finally {
        setLocalesResolved(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, selectedOrganisation?.uid]);

  // Fetch the entry list once both contentTypeUid AND selectedLocale are ready, and refetch
  // whenever either changes. Depending on both handles the initial-mount race where content
  // types load before/after the locale mapping — whichever resolves last triggers the fetch,
  // so we never call the API without a locale filter (which would return mixed-locale rows
  // and clobber the Venus Table's initial selection snapshot).
  useEffect(() => {
    if (contentTypeUid && selectedLocale?.value) {
      fetchEntries(contentTypeUid, searchText || '', { seedSelection: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocale?.value, contentTypeUid]);

  // Safety net: locale resolution settled (getProject failed, or the project has no
  // master_locale/locales at all) with nothing selected — fall back to the unfiltered
  // fetch instead of leaving the table empty forever with no spinner and no error.
  useEffect(() => {
    if (contentTypeUid && localesResolved && !selectedLocale?.value) {
      fetchEntries(contentTypeUid, searchText || '', { seedSelection: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentTypeUid, localesResolved]);

  /********** HELPERS *************/
  /********** CONTENT TYPE LIST (left panel) *************/
  // Fetch ALREADY-MIGRATED content types only (filter='old') — these are the ones whose entries
  // exist and can be mapped in this delta iteration.
  const fetchContentTypes = async (searchVal: string) => {
    setIsLoading(true);
    try {
      const { data } = await getContentTypes(projectId || '', 0, 5000, searchContentType || '', 'old');

      setIsLoading(false);
      setContentTypes(data?.contentTypes ?? []);
      setFilteredContentTypes(data?.contentTypes ?? []);
      setCount(data?.contentTypes?.length ?? 0);
      setOtherCmsTitle(data?.contentTypes?.[0]?.otherCmsTitle ?? '');
      setContentTypeUid(data?.contentTypes?.[0]?.id ?? '');
      setOtherCmsUid(data?.contentTypes?.[0]?.otherCmsUid ?? '');
      // Don't fetch entries here — the locale-effect at [selectedLocale.value] will fire
      // once both contentTypeUid and selectedLocale are ready. Fetching now would run
      // without a locale filter (selectedLocale is still null on initial mount), so the
      // server would return all-locale rows and Venus's Table would snapshot that mixed
      // selection state before the correct per-locale fetch could overwrite it.
    } catch (error) {
      setIsLoading(false);
      console.error(error);
      return error;
    }
  };

  // Reset the right-hand entry table state — used when the left list becomes empty so we
  // don't keep showing stale entries from a now-deselected content type.
  const clearEntryTableState = () => {
    setTableData([]);
    setTotalCounts(0);
    setRowIds({});
    setPersistedRowIds({});
    setOtherCmsTitle('');
    setContentTypeUid('');
    setOtherCmsUid('');
    setActive(null);
  };

  // Search content types in the left list
  const handleSearch = async (searchCT: string) => {
    setSearchContentType(searchCT);
    try {
      const { data } = await getContentTypes(projectId, 0, 1000, searchCT || '', 'old');
      const next = data?.contentTypes ?? [];
      setContentTypes(next);
      setFilteredContentTypes(next);
      setCount(next?.length ?? 0);
      // When the search matches no content types, keep the currently-selected content
      // type and its entries on the right — only the left list shows "No Content Types
      // Found." Clearing the table here would strand the user on "No Records Found".
    } catch (error) {
      console.error(error);
      return error;
    }
  };

  const handleOpenContentType = (i = 0) => {
    // Reset scroll position to top when switching content types
    if (tableWrapperRef?.current) {
      const elements = tableWrapperRef.current?.querySelectorAll('.Table__body');
      elements?.forEach((el) => {
        if (el instanceof HTMLElement) {
          el.scrollTop = 0;
        }
      });
    }

    setActive(i);
    const ct = filteredContentTypes?.[i];
    setOtherCmsTitle(ct?.otherCmsTitle ?? '');
    setOtherCmsUid(ct?.otherCmsUid ?? '');
    // setContentTypeUid alone re-triggers the [contentTypeUid, selectedLocale] data-load
    // effect above — calling fetchEntries directly here too would double the request.
    setContentTypeUid(ct?.id ?? '');
  };

  const handleSchemaPreview = async (title: string, ctId: string) => {
    try {
      const { data } = await getFieldMapping(ctId ?? '', 0, 1000, searchText ?? '', projectId);
      return cbModal({
        component: (props: ModalObj) => (
          <SchemaModal schemaData={data?.fieldMapping} contentType={title} {...props} />
        ),
        modalProps: {
          shouldCloseOnOverlayClick: true
        }
      });
    } catch (err) {
      console.error(err);
      return err;
    }
  };

  // Toggle filter panel
  const handleFilter = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setShowFilter(!showFilter);
  };

  // Filter content types by status
  const handleContentTypeFilter = (value: string, e: MouseOrKeyboardEvent) => {
    setActiveFilter(value);
    const li_list = document.querySelectorAll('.filter-wrapper li');
    li_list?.forEach((ele) => ele?.classList?.remove('active-filter'));
    (e?.target as HTMLElement)?.closest('li')?.classList?.add('active-filter');

    const nextList = value !== 'All' ? filterContentTypesByStatus(contentTypes, value) : contentTypes;
    setFilteredContentTypes(nextList);
    setCount(nextList?.length ?? 0);

    if (!nextList?.length) {
      // No content types match the filter — drop the right-hand table so it doesn't
      // keep showing entries from the previously-selected (now-hidden) content type.
      clearEntryTableState();
      setShowFilter(false);
      return;
    }

    // Keep the current selection if it's still in the filtered list; otherwise fall
    // back to the first content type and load its entries. Without this, resetting the
    // filter (or applying one that hides the active CT) leaves the table on "No Records
    // Found" because the entry list is never re-fetched.
    const selectedIndex = nextList.findIndex((ct) => ct?.otherCmsUid === otherCmsUid);
    if (selectedIndex >= 0) {
      setActive(selectedIndex);
    } else {
      const first = nextList[0];
      setActive(0);
      setOtherCmsTitle(first?.otherCmsTitle ?? '');
      setOtherCmsUid(first?.otherCmsUid ?? '');
      // setContentTypeUid alone re-triggers the data-load effect — see handleOpenContentType.
      setContentTypeUid(first?.id ?? '');
    }
    setShowFilter(false);
  };

  const handleClickOutside = (evt: MouseEvent) => {
    if (!filterRef.current?.contains(evt.target as Node)) {
      setShowFilter(false);
    }
  };

  /********** ENTRY TABLE (right panel) *************/
  // Single server-paginated fetch for the entry table. The Venus table drives
  // paging by calling fetchData with { skip, limit, searchText }; we ask the API
  // for just that page and use the returned `count` as the grand total.
  //
  // seedSelection: only on the initial content-type open (page 0, no search) do we
  // seed rowIds/persistedRowIds from the server's persisted isUpdate and refresh the
  // content-type status icon. On search / clear-search / page change we instead
  // re-apply the user's current (possibly unsaved) selection so nothing gets wiped.
  const fetchEntries = async (
    ctId: string,
    searchVal: string,
    { skip = 0, limit = 30, seedSelection = false }: { skip?: number; limit?: number; seedSelection?: boolean } = {},
  ) => {
    const gen = ++fetchGenerationRef.current;
    try {
      setLoading(true);

      const { data } = await getEntryMapping(ctId || '', skip, limit, searchVal, projectId, selectedLocale?.value);

      // Ignore this response entirely if the user has since triggered another fetch —
      // e.g. quickly switched locales or content types. Without this, an earlier fetch
      // finishing after a later one would overwrite rowIds/persistedRowIds with data
      // for the wrong locale, silently deselecting entries the user just saved.
      if (gen !== fetchGenerationRef.current) return;

      setLoading(false);

      const validTableData: EntryMapperType[] = mapEntriesToRows(data?.entryMapping);
      const total = data?.count ?? validTableData?.length ?? 0;

      setTotalCounts(total);

      if (!seedSelection) {
        // Re-apply the user's current selection onto the freshly fetched page;
        // don't touch rowIds/persistedRowIds so nothing gets deselected.
        setTableData(applySelectionToEntries(validTableData ?? [], rowIds));
        return;
      }

      const initialSelected = buildSelectedEntryRowIds(validTableData ?? []);
      setTableData(validTableData ?? []);
      setRowIds(initialSelected);
      setPersistedRowIds(initialSelected);
      // Force the Table to remount so it re-reads initialSelectedRowIds with the
      // just-committed rowIds. Venus's InfiniteScrollTable snapshots that prop at
      // mount and ignores subsequent updates; without a remount, switching locales
      // shows the previous locale's checkboxes on the new data.
      setTableRevision((r) => r + 1);
      // Reflect any pre-existing entry selections on the content type icon (green when present).
      updateContentTypeStatus(ctId, Object.keys(initialSelected ?? {}).length > 0);
    } catch (error) {
      if (gen !== fetchGenerationRef.current) return;
      console.error('fetchEntries -> error', error);
      setLoading(false);
    }
  };

  // Driven by the table: page change, rows-per-page change, and search all land here.
  const fetchData = async ({ searchText: search, skip, limit }: TableTypes) => {
    setSearchText(search ?? '');
    // Searching / paging must not drop the user's in-progress selection.
    contentTypeUid && fetchEntries(contentTypeUid, search ?? '', { skip, limit });
  };

  /**
   * Reflect entry-update selection on the content type's status icon:
   * has selected entries → 'Updated' (status '2', green); none → 'Mapped' (status '1', blue).
   */
  const updateContentTypeStatus = (contentTypeId: string, hasSelection: boolean) => {
    if (!contentTypeId) return;
    setContentTypes((prev) => applyContentTypeStatus(prev, contentTypeId, hasSelection));
    setFilteredContentTypes((prev) => applyContentTypeStatus(prev, contentTypeId, hasSelection));
  };

  // Handle selected entries
  const handleSelectedEntries = (singleSelectedRowIds: string[]) => {
    const selectedObj: UidMap = toSelectedMap(singleSelectedRowIds);
    setRowIds(selectedObj);
    setTableData((prev) => applySelectionToEntries(prev ?? [], selectedObj));
  };

  const handleSaveContentType = async () => {
    setisLoadingSaveButton(true);
    const changedUids = computeChangedUids(rowIds, persistedRowIds);
    const orgId = selectedOrganisation?.uid;

    if (orgId && contentTypeUid) {
      const dataCs: Record<string, unknown> = { ids: changedUids };
      if (selectedLocale?.value) dataCs.locale = selectedLocale.value;
      try {
        if (changedUids.length === 0) {
          setisLoadingSaveButton(false);
          return Notification({
            notificationContent: { text: 'No changes to save' },
            notificationProps: { position: 'bottom-center', hideProgressBar: true },
            type: 'info'
          });
        }
        const { status } = await updateEntryMapper(projectId, dataCs);
        setisLoadingSaveButton(false);
        if (status === 200) {
          setPersistedRowIds({ ...(rowIds ?? {}) });
          setLoading(false);
          // Reflect the saved state on the content type icon: green (Updated) when entries remain
          // selected after save, blue (Mapped) when all selections were cleared.
          updateContentTypeStatus(contentTypeUid, Object.values(rowIds ?? {}).some(Boolean));
          return Notification({
            notificationContent: { text: 'Entries saved successfully' },
            notificationProps: { position: 'bottom-center', hideProgressBar: true },
            type: 'success'
          });
        }
        return Notification({
          notificationContent: { text: 'Failed to save entries' },
          notificationProps: { position: 'bottom-center', hideProgressBar: true },
          type: 'error'
        });
      } catch (error) {
        console.error(error);
        setisLoadingSaveButton(false);
        return error;
      }
    }
  };

  /********** TABLE COLUMNS *************/
  const accessorCall = (data: EntryMapperType) => (
    <div>
      <div className="d-flex align-items-center">
        <div className={'cms-field'}>{data?.entryName}</div>
      </div>
    </div>
  );

  const accessorForCMSUid = (data: EntryMapperType) => (
    <div>
      <div className="d-flex align-items-center">
        <div className={'cms-field'}>{data?.otherCmsEntryUid ? data?.otherCmsEntryUid : '-'}</div>
      </div>
    </div>
  );

  const accessorContentstackCall = (data: EntryMapperType) => (
    <div>
      <div className="d-flex align-items-center">
        <div className={'cms-field'}>{data?.contentstackEntryUid ? data?.contentstackEntryUid : '-'}</div>
      </div>
    </div>
  );

  const columns = [
    {
      disableSortBy: true,
      Header: (
        <span>{`${newMigrationData?.legacy_cms?.selectedCms?.title}: ${otherCmsTitle}`}</span>
      ),
      accessor: accessorCall,
      id: 'uuid',
      width: '340px',
    },
    {
      disableSortBy: true,
      Header: <span>{`${newMigrationData?.legacy_cms?.selectedCms?.title} UIDs:`}</span>,
      accessor: accessorForCMSUid,
      id: '1',
      width: '360px',
    },
    {
      disableSortBy: true,
      Header: <span>{'Contentstack UIDs:'}</span>,
      accessor: accessorContentstackCall,
      id: '2'
    }
  ];

  // Responsive table height for the entry mapper — see useMeasuredTableHeight for the why.
  const tableHeight = useMeasuredTableHeight(tableWrapperRef, [contentTypeUid, tableData?.length], {
    panelSelector: '.TablePanel',
    footerSelector: '.mapper-footer',
  });

  return (
    isLoading || newMigrationData?.isprojectMapped
      ? <div className="loader-container">
        <CircularLoader />
      </div>
      :
      <div className="step-container">
        {(contentTypes?.length > 0 || tableData?.length > 0 || searchContentType?.length > 0) ?
          <div className="d-flex flex-wrap table-container">
            {/* Content Types List */}
            <div className="content-types-list-wrapper">
              <div className="content-types-list-header d-flex align-items-center justify-content-between">
                {contentTypesHeading && <h2>{`${contentTypesHeading} (${contentTypes && count})`}</h2>}
              </div>

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
              <div
                className={`entry-table-wrapper entry-mapper-container${localeOptions?.length > 0 ? ' has-locale-select' : ''}`}
                ref={tableWrapperRef}
              >
                {localeOptions?.length > 0 && (
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
                <div className="entry-mapper-table">
                  <InfiniteScrollTable
                  // `tableRevision` bumps AFTER a seedSelection fetch commits rowIds — so
                  // the Table remounts with the correct initial selection already in state.
                  // Keying on selectedLocale alone would remount too early (rowIds still
                  // holding the previous locale's data, since the new fetch is still
                  // in flight).
                  key={`${contentTypeUid || 'entry-mapper-table'}::${tableRevision}`}
                  loading={loading}
                  canSearch={true}
                  totalCounts={totalCounts ?? 0}
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
                  itemSize={70}
                  getSelectedRow={handleSelectedEntries}
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
                {(totalCounts > 0 || (tableData?.length ?? 0) > 0) && (
                  <div className="mapper-footer">
                    <div>
                      {/* Total Entries: <strong>{totalCounts}</strong> */}
                    </div>
                    <Button
                      className="saveButton"
                      onClick={handleSaveContentType}
                      version="v2"
                      // Lock the Save button only while a migration is actively in flight.
                      // Using migrationStarted alone would permanently lock revisits on delta
                      // iterations since migrationStarted stays true after completion.
                      // Also lock when there's nothing to save: no pending selection AND the
                      // current page has no mappable row. tableData is only the current
                      // server-paginated page, so we must fall back to rowIds (persisted +
                      // pending selection) — otherwise a content type whose mappable rows sit
                      // on page 2+ would wrongly disable Save.
                      disabled={
                        (!!newMigrationData?.migration_execution?.migrationStarted &&
                          !newMigrationData?.migration_execution?.migrationCompleted) ||
                        (Object.keys(rowIds ?? {}).length === 0 &&
                          !tableData?.some((row) => row?._canSelect))
                      }
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
            heading={<div className="empty_search_heading">{ENTRY_MAPPER_EMPTY_STATE.NO_ENTRIES_HEADING}</div>}
            description={
              <div className="empty_search_description">
                {ENTRY_MAPPER_EMPTY_STATE.NO_ENTRIES_DESCRIPTION}
              </div>
            }
            className="mapper-emptystate mapper-emptystate--centered"
            img={NoDataFound}
            version="v2"
            testId="no-results-found-page"
          />}
      </div>
  );
};

export default EntryMapper;