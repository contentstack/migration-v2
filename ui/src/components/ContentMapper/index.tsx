// Libraries
import { useEffect, useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import {
  InfiniteScrollTable,
  Select,
  Button,
  Search,
  Icon,
  Tooltip,
  Notification,
  cbModal,
  InstructionText,
  CircularLoader,
  EmptyState,
  OutlineTag
} from '@contentstack/venus-components';

// Services
import { getCMSDataFromFile } from '../../cmsData/cmsSelector';
import {
  getContentTypes,
  getFieldMapping,
  updateContentType,
  resetToInitialMapping,
  getExistingContentTypes,
  getExistingGlobalFields,
  updateContentMapper
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
  Mapping,
  ExistingFieldType,
  ContentTypeList,
  ContentTypesSchema,
  OptionsType,
  UidMap,
  ContentTypeMap,
  Advanced,
  ContentTypeSaveHandles,
  MouseOrKeyboardEvent,
  MappingFields,
  FieldHistoryObj
} from './contentMapper.interface';
import { ItemStatusMapProp } from '@contentstack/venus-components/build/components/Table/types';
import { ModalObj } from '../Modal/modal.interface';
import { UpdatedSettings } from '../AdvancePropertise/advanceProperties.interface';

// Components
import SchemaModal from '../SchemaModal';
import AdvanceSettings from '../AdvancePropertise';
import SaveChangesModal from '../Common/SaveChangesModal';

// Styles and Assets
import './index.scss';
import { NoDataFound, SCHEMA_PREVIEW } from '../../common/assets';

const rowHistoryObj: FieldHistoryObj = {}

const Fields: MappingFields = {
  'single_line_text': {
    label: 'Single Line Textbox',
    options: {
      'Single Line Textbox': 'single_line_text',
      'Multi Line Textbox': 'multi_line_text',
      'HTML Rich Text Editor': 'html',
      'JSON Rich Text Editor': 'json'
    },
    type: 'text'
  },
  'multi_line_text': {
    label: 'Multi Line Textbox',
    options: {
      'Multi Line Textbox': 'multi_line_text',
      'HTML Rich Text Editor': 'html',
      'JSON Rich Text Editor': 'json'
    },
    type: 'multiline'
  },
  'json': {
    label: 'JSON Rich Text Editor',
    options: {
      'JSON Rich Text Editor': 'json',
      'HTML Rich Text Editor': 'html'
    },
    type: 'json',
  },
  'html': {
    label: 'HTML Rich Text Editor',
    options: {
      'HTML Rich Text Editor': 'html',
      'JSON Rich Text Editor': 'json'
    },
    type: 'allow_rich_text'

  },
  'markdown': {
    label: 'Markdown',
    options: {
      'Markdown': 'markdown',
      'HTML Rich Text Editor': 'html',
      'JSON Rich Text Editor': 'json'
    },
    type: 'markdown'
  },
  'text': {
    label: 'Single Line Textbox',
    options: {
      'Single Line Textbox': 'single_line_text'
    },
    type: ''
  },
  'url': {
    label: 'URL',
    options: { 'URL': 'url' },
    type: ''
  },
  'file': {
    label: 'File',
    options: {
      'File': 'file'
    },
    type: 'file',
  },
  'number': {
    label: 'Number',
    options: {
      'Number': 'number'
    },
    type: 'number'
  },
  'isodate': {
    label: 'Date',
    options: {
      'Date': 'isodate'
    },
    type: 'isodate'
  },
  'boolean': {
    label: 'Boolean',
    options: {
      'Boolean': 'boolean'
    },
    type: 'boolean',
  },
  'link': {
    label: 'Link',
    options: {
      'Link': 'link'
    },
    type: 'link',
  },
  'reference': {
    label: 'Reference',
    options: {
      'Reference': 'reference'
    },
    type: '',
  },
  'dropdown': {
    label: 'Dropdown',
    options: {
      'Dropdown': 'dropdown'
    },
    type: '',
  },
  'radio': {
    label: 'Radio',
    options: {
      'Radio': 'radio'
    },
    type: '',
  },
  'checkbox': {
    label: 'Checkbox',
    options: {
      'Checkbox': 'checkbox'
    },
    type: ''
  },
  'global_field': {
    label: 'Global Field',
    options: { 'Global Field': 'global_field' },
    type: ""
  },
  'group': {
    label: 'Group',
    options: { 'Group': 'group' },
    type: 'Group'
  },
  'app': {
    label: 'Marketplace app',
    options: { 'Marketplace app': 'app' },
    type: ''
  },
  'extension': {
    label: 'Extension',
    options: { 'Extension': 'extension' },
    type: ''
  },
  'modular_blocks':{
    label: 'Modular Blocks',
    options: {'Modular Blocks':'modular_blocks'},
    type:''
  },
  'modular_blocks_child':{
    label: 'Block',
    options: {'Block':'modular_blocks_child'},
    type:''
  }
}
type contentMapperProps = {
  handleStepChange: (currentStep: number) => void;
}

const ContentMapper = forwardRef(({ handleStepChange }: contentMapperProps, ref: React.ForwardedRef<ContentTypeSaveHandles>) => {
  /** ALL CONTEXT HERE */

  const migrationData = useSelector((state: RootState) => state?.migration?.migrationData);
  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);
  const selectedOrganisation = useSelector((state: RootState) => state?.authentication?.selectedOrganisation);

  // When setting contentModels from Redux, ensure it's cloned
  const reduxContentTypes = newMigrationData?.content_mapping?.existingCT; // Assume this gets your Redux state
  const reduxGlobalFields = newMigrationData?.content_mapping?.existingGlobal

  const dispatch = useDispatch();

  const {
    contentMappingData: {
      content_types_heading: contentTypesHeading,
      search_placeholder: searchPlaceholder,
      table_search_placeholder: tableSearchPlaceholder
    } = {}
  } = migrationData;

  const [tableData, setTableData] = useState<FieldMapType[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(newMigrationData?.isprojectMapped);
  const [itemStatusMap, setItemStatusMap] = useState({});
  const [totalCounts, setTotalCounts] = useState<number>(tableData?.length);
  const [fieldValue, setFieldValue] = useState<FieldTypes>();

  const [searchText, setSearchText] = useState('');
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [otherCmsTitle, setOtherCmsTitle] = useState('');
  const [contentTypeUid, setContentTypeUid] = useState<string>('');

  const [isContentType, setIsContentType] = useState<boolean>(true);
  const [contentModels, setContentModels] = useState<ContentTypeList[]>([]);

  const [selectedContentType, setSelectedContentType] = useState<ContentType>();
  const [existingField, setExistingField] = useState<ExistingFieldType>({});
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isDropDownChanged, setIsDropDownChanged] = useState<boolean>(false);
  const [contentTypeMapped, setContentTypeMapped] = useState<ContentTypeMap>(
    newMigrationData?.content_mapping?.content_type_mapping || {}
  );

  const [otherContentType, setOtherContentType] = useState<FieldTypes>({
    label: contentTypeMapped?.[otherCmsTitle] ?? `Select ${isContentType ? 'Content Type' : 'Global Field'} from Destination Stack`,
    value: contentTypeMapped?.[otherCmsTitle] ?? `Select ${isContentType ? 'Content Type' : 'Global Field'} from Destination Stack`,
  });
  const [otherCmsUid, setOtherCmsUid] = useState<string>(contentTypes?.[0]?.otherCmsUid);

  const [active, setActive] = useState<number | null>(0);
  const [searchContentType, setSearchContentType] = useState('');
  const [rowIds, setRowIds] = useState<Record<string, boolean>>({});
  const [selectedEntries, setSelectedEntries] = useState<FieldMapType[]>([]);
  const [contentTypeSchema, setContentTypeSchema] = useState<ContentTypesSchema[] | undefined>([]);
  const [showFilter, setShowFilter] = useState<boolean>(false);
  const [filteredContentTypes, setFilteredContentTypes] = useState<ContentType[]>([])
  const [count, setCount] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [nestedList, setNestedList] = useState<FieldMapType[]>([]);
  const [isUpdated, setIsUpdated] = useState(false);
  let updatedRows: FieldMapType[] = tableData;
  let updatedExstingField: ExistingFieldType = existingField;
  const updatedSelectedOptions: string[] = selectedOptions;
  const [initialRowSelectedData, setInitialRowSelectedData] = useState();
  const deletedExstingField: ExistingFieldType = existingField;
  const isNewStack = newMigrationData?.stackDetails?.isNewStack;
  const [isFieldDeleted, setIsFieldDeleted] = useState<boolean>(false);
  const [isContentDeleted, setIsContentDeleted] = useState<boolean>(false);
  const [isCsCTypeUpdated, setsCsCTypeUpdated] = useState<boolean>(false);
  const [isLoadingSaveButton, setisLoadingSaveButton] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<string>('');
  const [isAllCheck, setIsAllCheck] = useState<boolean>(false);
  const [isResetFetch, setIsResetFetch] = useState<boolean>(false);


  /** ALL HOOKS Here */
  const { projectId = '' } = useParams();
  const navigate = useNavigate();

  const filterRef = useRef<HTMLDivElement | null>(null);
  const tableWrapperRef = useRef<HTMLDivElement | null>(null);

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

  // Make title and url field non editable
  useEffect(() => {
    tableData?.forEach((field) => {
      if(field?.backupFieldType === 'reference' &&  field?.refrenceTo?.length === 0) {
        field._canSelect = false;
      }
      else if (field?.backupFieldType !== 'text' && field?.backupFieldType !== 'url') {
        field._canSelect = true;
      }
    });
  }, [tableData]);

  useEffect(() => {
    const mappedContentType = contentModels && contentModels?.find((item) => item?.uid === newMigrationData?.content_mapping?.content_type_mapping?.[selectedContentType?.contentstackUid || '']);

    if (mappedContentType?.uid) {
      setOtherContentType({
        id: mappedContentType?.uid,
        label: mappedContentType?.title,
        value: mappedContentType?.title
      });
      setIsContentDeleted(false);
    }
  }, [contentTypeMapped, otherCmsTitle, contentModels]);

  useEffect(() => {
    if (isContentDeleted) {
      setContentTypeMapped((prevState: ContentTypeMap) => {
        const { [otherCmsTitle]: removed, ...newState } = prevState;

        return newState;
      });

      setIsFieldDeleted(false);
    }

  }, [isContentDeleted, contentModels, otherCmsTitle]);

  // useEffect for rendering mapped fields with existing stack
  useEffect(() => {


    if (newMigrationData?.content_mapping?.content_type_mapping?.[selectedContentType?.contentstackUid || ''] === otherContentType?.id) {
      setIsAllCheck(false);

      tableData?.forEach((row) => {
        contentTypeSchema?.forEach((schema) => {

          if (row?.contentstackField === schema?.display_name) {
            if (!updatedSelectedOptions?.includes?.(schema?.display_name)) {
              updatedSelectedOptions.push(schema?.display_name);
            }
            updatedExstingField[row?.backupFieldUid] = {
              label: schema?.display_name,
              value: schema
            };
          }

          // 1st level group nesting
          if (schema?.schema) {
            schema?.schema?.forEach((childSchema) => {
              if (row?.contentstackField === `${schema?.display_name} > ${childSchema?.display_name}`) {
                if (!isFieldDeleted) {
                  if (!updatedSelectedOptions?.includes?.(`${schema?.display_name} > ${childSchema?.display_name}`)) {
                    updatedSelectedOptions.push(`${schema?.display_name} > ${childSchema?.display_name}`);
                  }
                  updatedExstingField[row?.backupFieldUid] = {
                    label: `${schema?.display_name} > ${childSchema?.display_name}`,
                    value: childSchema
                  }
                }
              }

              // 2nd level group nesting
              if (childSchema?.schema) {
                childSchema?.schema?.forEach((nestedSchema) => {
                  if (row?.contentstackField === `${schema?.display_name} > ${childSchema?.display_name} > ${nestedSchema?.display_name}`) {
                    if (!isFieldDeleted) {
                      if (!updatedSelectedOptions?.includes?.(`${schema?.display_name} > ${childSchema?.display_name} > ${nestedSchema?.display_name}`)) {
                        updatedSelectedOptions.push(`${schema?.display_name} > ${childSchema?.display_name} > ${nestedSchema?.display_name}`);
                      }
                      updatedExstingField[row?.backupFieldUid] = {
                        label: `${schema?.display_name} > ${childSchema?.display_name} > ${nestedSchema?.display_name}`,
                        value: nestedSchema
                      }
                    }
                  }

                  // 3rd level group nesting
                  if (nestedSchema?.schema) {
                    nestedSchema?.schema?.forEach((nestedChild) => {
                      if (row?.contentstackField === `${schema?.display_name} > ${childSchema?.display_name} > ${nestedSchema?.display_name} > ${nestedChild?.display_name}`) {
                        if (!isFieldDeleted) {
                          if (!updatedSelectedOptions?.includes?.(`${schema?.display_name} > ${childSchema?.display_name} > ${nestedSchema?.display_name} > ${nestedChild?.display_name}`)) {
                            updatedSelectedOptions.push(`${schema?.display_name} > ${childSchema?.display_name} > ${nestedSchema?.display_name} > ${nestedChild?.display_name}`);
                          }
                          updatedExstingField[row?.backupFieldUid] = {
                            label: `${schema?.display_name} > ${childSchema?.display_name} > ${nestedSchema?.display_name} > ${nestedChild?.display_name}`,
                            value: nestedChild
                          }
                        }
                      }
                    })
                  }
                })
              }
            })
          }
        });
      });
      setSelectedOptions(updatedSelectedOptions);
      setExistingField(updatedExstingField);
    }
  }, [tableData, otherContentType]);

  useEffect(() => {
    if (isUpdated && !isCsCTypeUpdated) {
      setIsAllCheck(false);
      setTableData(updatedRows);
      setExistingField(updatedExstingField);
      setSelectedOptions(updatedSelectedOptions);
      setSelectedEntries(updatedRows);
      setIsUpdated(false);
    }
    else {
      setIsAllCheck(false);
      setExistingField({});
      setSelectedOptions([]);

    }
  }, [isUpdated, otherContentType]);

  // To make all the fields checked
  useEffect(() => {
    const selectedId = tableData?.reduce<UidMap>((acc, item) => {
      if (!item?.isDeleted && isAllCheck) {
        acc[item?.id] = true;

      }
      return acc;
    }, {});

    isAllCheck && setRowIds(selectedId);
  }, [tableData, isAllCheck]);

  // To fetch existing content types or global fields as per the type
  useEffect(() => {
    if (isContentType) {
      setContentModels(JSON?.parse(JSON?.stringify(reduxContentTypes ?? [])));
    } else {
      // if (reduxGlobalFields?.length > 0) {
      setContentModels(JSON?.parse(JSON?.stringify(reduxGlobalFields ?? [])));
      // }
    }
  }, [isContentType, reduxContentTypes, reduxGlobalFields]);

  // To close the filter panel on outside click
  useEffect(() => {
    document.addEventListener('click', handleClickOutside, true);

    return () => {
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, []); 

  /**
   * Debounces a function call by delaying its execution until after the specified delay has elapsed since the last invocation.
   * @param fn - The function to debounce
   * @param delay - The delay in milliseconds to wait before executing the function
   * @returns A debounced version of the function
   */
  const debounce = (fn: (...args: any[]) => any, delay: number | undefined) => {
    let timeoutId: string | number | NodeJS.Timeout | undefined;
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  };

  const checkAndUpdateField = (
  item: any,
  value: any,
  key: string,
  parentLabel = ''
) => {
  // Construct label with group hierarchy
  const currentLabel = parentLabel ? `${parentLabel} > ${item?.display_name}` : item?.display_name;

  // Check for match
  if (value?.value?.uid === item?.uid && value?.label === currentLabel) {
    if (!updatedSelectedOptions?.includes?.(currentLabel)) {
      updatedSelectedOptions?.push?.(currentLabel);
    }

    setSelectedOptions(updatedSelectedOptions);
    setExistingField((prevOptions: ExistingFieldType) => ({
      ...prevOptions,
      [key]: { label: currentLabel, value: item },
    }));

    return true;
  }

  // Check children recursively
  if (item?.data_type === 'group' && Array?.isArray(item?.schema)) {
    for (const child of item.schema) {
      const found = checkAndUpdateField(child, value, key, currentLabel);
      if (found) return true;
    }

    // If no match and it was part of the label, remove it
    if (
      !item?.schema?.some((schema:any) => schema?.uid === value?.value?.uid) &&
      value?.data_type !== 'group' &&
      value?.label?.includes(item?.display_name)
    ) {
      setIsUpdated(true);
      updatedRows = updatedRows?.map((row: FieldMapType) => {

        if (row?.uid === key && row?.backupFieldType === value?.value?.data_type) {
          return {
            ...row,
            contentstackField: row?.otherCmsField,
            contentstackFieldUid: row?.backupFieldUid,
            contentstackFieldType: row?.backupFieldType,
            
          };
        }
        return row;
      });

      setTableData(updatedRows);
      setSelectedEntries(updatedRows)
      setExistingField((prevOptions: ExistingFieldType) => {
        const { [key]: _, ...rest } = prevOptions;
        return { ...rest };
      });
      
    }
  }

  return false;
};

  // if exsting content type is changed in contentstack, reflect those changes for 
  // maaped fields
  useEffect(() => {
    if (existingField && !isCsCTypeUpdated) {

      contentTypeSchema?.forEach((item) => {
        for (const [key, value] of Object.entries(existingField)) {
          if (value?.value?.uid === item?.uid) {
            if (!updatedSelectedOptions?.includes?.(item?.display_name)) {
              updatedSelectedOptions.push(item?.display_name);
            }
            setSelectedOptions(updatedSelectedOptions);
            setExistingField((prevOptions: ExistingFieldType) => ({
              ...prevOptions,
              [key]: { label: item?.display_name, value: item },
            }));
          }
          if (contentTypeSchema?.every((item) => value?.value?.uid !== item?.uid)) {
            setExistingField((prevOptions: ExistingFieldType) => {
              const { [key]: _, ...rest } = prevOptions; // Destructure to exclude the key to remove
              return {
                ...rest
              };
            })
          }
          else if (item?.data_type === "group" && Array.isArray(item?.schema)) {
            item?.schema?.forEach((schemaItem) => {

              if (value?.value?.uid === schemaItem?.uid && value?.label === `${item?.display_name} > ${schemaItem?.display_name}`) {
                if (!updatedSelectedOptions?.includes?.(`${item?.display_name} > ${schemaItem?.display_name}`)) {
                  updatedSelectedOptions.push(`${item?.display_name} > ${schemaItem?.display_name}`);
                }
                setSelectedOptions(updatedSelectedOptions);
                setExistingField((prevOptions: ExistingFieldType) => ({
                  ...prevOptions,
                  [key]: { label: `${item?.display_name} > ${schemaItem?.display_name}`, value: schemaItem },
                }));
              }
              else if (!item?.schema?.some(
                (schema) => schema?.uid === existingField[key]?.value?.uid) && existingField[key]?.value?.data_type !== 'group' && existingField[key]?.label?.includes?.(item?.display_name)) {

                setExistingField((prevOptions: ExistingFieldType) => {
                  const { [key]: _, ...rest } = prevOptions; // Destructure to exclude the key to remove
                  return {
                    ...rest
                  };
                });

              }
            });
          }
           checkAndUpdateField(item, value, key);
        }
      });

      if (newMigrationData?.content_mapping?.content_type_mapping?.[otherCmsTitle] !== otherContentType?.label) {
        //setSelectedOptions([]);
      }

    }

  }, [contentTypeSchema]);
  useEffect(() => {
    if (isCsCTypeUpdated) {
      // Clear existing field mappings and selected options when content type changes
      setExistingField({});
      setSelectedOptions([]);
      setsCsCTypeUpdated(false);
    }

  }, [otherContentType]);


  useBlockNavigation(isModalOpen);
  // Method to fetch content types
  const fetchContentTypes = async (searchText: string) => {
    setIsLoading(true);

    try {
      const { data } = await getContentTypes(projectId || '', 0, 5000, searchContentType || ''); //org id will always present

      setIsLoading(false);
      setContentTypes(data?.contentTypes);
      setCount(data?.contentTypes?.length);
      setFilteredContentTypes(data?.contentTypes);
      setSelectedContentType(data?.contentTypes?.[0]);
      setTotalCounts(data?.contentTypes?.[0]?.fieldMapping?.length);
      setOtherCmsTitle(data?.contentTypes?.[0]?.otherCmsTitle);
      setContentTypeUid(data?.contentTypes?.[0]?.id);
      fetchFields(data?.contentTypes?.[0]?.id, searchText || '');
      setOtherCmsUid(data?.contentTypes?.[0]?.otherCmsUid);
      setIsContentType(data?.contentTypes?.[0]?.type === "content_type");
    } catch (error) {
      console.error(error);
      return error;
    }
  };

  // Method to search content types
  const handleSearch = async (searchCT: string) => {
    setSearchContentType(searchCT);

    try {
      const { data } = await getContentTypes(projectId, 0, 1000, searchCT || ''); //org id will always present

      setContentTypes(data?.contentTypes);
      setFilteredContentTypes(data?.contentTypes);
      setCount(data?.contentTypes?.length);
    } catch (error) {
      console.error(error);
      return error;
    }
  };

  // Method to get fieldmapping
  const fetchFields = async (contentTypeId: string, searchText: string) => {
    try {
      const itemStatusMap: ItemStatusMapProp = {};

      for (let index = 0; index <= 1000; index++) {
        itemStatusMap[index] = 'loading';
      }

      setItemStatusMap(itemStatusMap);
      setLoading(true);

      const { data } = await getFieldMapping(contentTypeId || '', 0, 1000, searchText || '', projectId);

      for (let index = 0; index <= 1000; index++) {
        itemStatusMap[index] = 'loaded';
      }

      setItemStatusMap({ ...itemStatusMap });
      setLoading(false);

      const validTableData = data?.fieldMapping?.filter((field: FieldMapType) => field?.otherCmsType !== undefined);

      setIsAllCheck(true);
      setTableData(validTableData ?? []);
      setSelectedEntries(validTableData ?? []);
      setTotalCounts(validTableData?.length);
      setInitialRowSelectedData(validTableData?.filter((item: FieldMapType) => !item?.isDeleted))
      generateSourceGroupSchema(validTableData);
    } catch (error) {
      console.error('fetchData -> error', error);
    }
  };

  // Fetch table data
  const fetchData = async ({ searchText }: TableTypes) => {
    setSearchText(searchText)
    contentTypeUid && fetchFields(contentTypeUid, searchText);
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

      const { data } = await getFieldMapping(contentTypeUid || '', skip, limit, searchText || '', projectId);

      const updateditemStatusMapCopy: ItemStatusMapProp = { ...itemStatusMap };

      for (let index = startIndex; index <= stopIndex; index++) {
        updateditemStatusMapCopy[index] = 'loaded';
      }

      setItemStatusMap({ ...updateditemStatusMapCopy });
      setLoading(false);

      const validTableData = data?.fieldMapping?.filter((field: FieldMapType) => field?.otherCmsType !== undefined);

      // eslint-disable-next-line no-unsafe-optional-chaining
      setTableData(validTableData ?? []);
      setSelectedEntries(validTableData ?? []);
      setTotalCounts(validTableData?.length);
      setIsAllCheck(true);
    } catch (error) {
      console.error('loadMoreItems -> error', error);
    }
  };

  // Method to change the content type
  const handleOpenContentType = (i = 0) => {
    if (isDropDownChanged) {
      setIsModalOpen(true);
      return cbModal({
        component: (props: ModalObj) => (
          <SaveChangesModal
            {...props}
            isopen={setIsModalOpen}
            otherCmsTitle={otherCmsTitle}
            saveContentType={handleSaveContentType}
            openContentType={() => openContentType(i)}
            dropdownStateChange={handleDropdownState}
          />
        ),
        modalProps: {
          size: 'xsmall',
          shouldCloseOnOverlayClick: false
        }
      });
    } else {
      openContentType(i);
    }
  };

  const openContentType = (i: number) => {
    // Reset scroll position to top immediately when switching content types
    if (tableWrapperRef?.current) {
      const elements = tableWrapperRef.current?.querySelectorAll('.Table__body');
      elements?.forEach(el => {
        if (el instanceof HTMLElement) {
          el.scrollTop = 0;
        }
      });
    }
    
    setIsAllCheck(true);
    setIsFieldDeleted(false);
    setActive(i);
    const otherTitle = filteredContentTypes?.[i]?.contentstackUid;
    const mappedContentType = contentModels?.find((item) => item?.uid === newMigrationData?.content_mapping?.content_type_mapping?.[otherTitle]);
    setOtherCmsTitle(filteredContentTypes?.[i]?.otherCmsTitle);
    setContentTypeUid(filteredContentTypes?.[i]?.id ?? '');
    fetchFields(filteredContentTypes?.[i]?.id ?? '', searchText || '');
    setOtherCmsUid(filteredContentTypes?.[i]?.otherCmsUid);
    setSelectedContentType(filteredContentTypes?.[i]);
    setIsContentType(filteredContentTypes?.[i]?.type === "content_type");
    setOtherContentType({
      label: mappedContentType?.title ?? `Select ${filteredContentTypes?.[i]?.type === "content_type" ? 'Content Type' : 'Global Field'} from Destination Stack`,
      value: mappedContentType?.title ?? `Select ${filteredContentTypes?.[i]?.type === "content_type" ? 'Content Type' : 'Global Field'} from Destination Stack`,

    });
  }

  const updateFieldSettings = (rowId: string, updatedSettings: Advanced, checkBoxChanged: boolean, rowContentstackFieldUid: string) => {
    setIsDropDownChanged(checkBoxChanged);
    const newTableData = tableData?.map?.((row: any) => {
      if (row?.uid === rowId && row?.contentstackFieldUid === rowContentstackFieldUid) {
        const updatedRow = {
          ...row,
          refrenceTo: updatedSettings?.referenedItems || row?.refrenceTo,
          advanced: { ...row?.advanced, ...updatedSettings }
        };
        return updatedRow;
      }
      return row;
    });
    setTableData(newTableData);
    setSelectedEntries(newTableData);
  };

  const handleSchemaPreview = async (title: string, contentTypeId: string) => {
    try {
      const { data } = await getFieldMapping(contentTypeId ?? '', 0, 1000, searchText ?? '', projectId);
      return cbModal({
        component: (props: ModalObj) => (
          <SchemaModal
            schemaData={data?.fieldMapping}
            contentType={title}
            {...props}
          />
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

  const accessorCall = (data: FieldMapType) => {
    // Clean field name (remove parent hierarchy)
    const cleanFieldName = data?.otherCmsField?.includes(' > ') 
      ? data.otherCmsField.split(' > ').pop() 
      : data?.otherCmsField;
    
    const tooltipContent = data?.otherCmsField?.includes(' > ') 
      ? `Field: ${cleanFieldName} \nFull path: ${data.otherCmsField}`
      : `Field: ${cleanFieldName}`;

    // Simple checks for visual indicators
    const isModularBlock = data?.contentstackFieldType === 'modular_blocks';
    const isModularBlockChild = data?.contentstackFieldType === 'modular_blocks_child';
    const isGroup = data?.contentstackFieldType === 'group';
    
    // Function to calculate nesting level from UID
    const getNestingLevel = (uid: string): number => {
      if (!uid || !uid.includes('.')) return 0;
      return uid.split('.').length - 1;
    };
    
    // Function to get nesting class based on level
    const getNestingClass = (level: number): string => {
      if (level === 0) return '';
      if (level === 1) return 'child-row';
      return `child-row-level-${level}`;
    };
    
    // Calculate nesting level for proper indentation
    const nestingLevel = getNestingLevel(data?.uid || '');
    
    // Count children only if this is a modular block parent
    const childrenCount = isModularBlockChild ? 
      tableData?.filter(item => item?.uid?.startsWith(data?.uid + '.'))?.length || 0 : 0;
    return (
      <Tooltip content={tooltipContent} position="top">
        <div className={`table-row-content ${nestingLevel > 0 ? getNestingClass(nestingLevel) : ''}`} style={isModularBlock || isModularBlockChild || isGroup ? {borderLeft: '0 none'} : {}}>
          <div className='d-flex align-items-center'>
            {/* Indentation for child rows */}
            {/* {isBlockChild && <div className="child-indent"></div>} */}
            
            {/* Parent indicator for modular blocks */}
            {data?.contentstackFieldType === 'modular_blocks' && <Icon icon="ModularBlocks" size="small" className="mr-8 mt-1" />}

            {isModularBlockChild && <Icon icon="ParentModularBlockIcon" size="small" className="mr-8 mt-1" />}
            {isGroup && <Icon icon="Group" size="small" className="mr-8 mt-1" />}
            
            <div className={`${data?.backupFieldType === 'text' || data?.backupFieldType === 'url' ? `cms-field w-auto` : `cms-field`}`}>
              {cleanFieldName}
            </div>
            
            {(data?.backupFieldType === 'text' || data?.backupFieldType === 'url') && (
              <OutlineTag content='Default Field' className="ml-10" />
            )}
            
            {/* Show indicators for parent/child relationship */}
            {isModularBlockChild && childrenCount > 0 && (
              <OutlineTag content={`${childrenCount} fields`} className="ml-10" type="primary" />
            )}
            {/* {isBlockChild && (
              <OutlineTag content='Child Field' className="ml-10" style={{backgroundColor: '#e8f5e8', color: '#2e7d32'}} />
            )} */}
          </div>
          <InstructionText>
            <div className={`${isModularBlock || isModularBlockChild || isGroup ? "instruction-text-indent" : ""}`}>
              Type: {data?.otherCmsType}
              <br />
              UID: <span className="uid-text">{data?.uid}</span>
            </div>
          </InstructionText>
        </div>
      </Tooltip>
    );
  };

  // add row ids with their data to rowHistoryObj
  useEffect(() => {
    Object.keys(rowHistoryObj)?.forEach(key => delete rowHistoryObj[key]);
    tableData?.forEach(item => {
      rowHistoryObj[item?.id] = [{ checked: true, at: Date.now(), ...modifiedObj(item) }]
    });
  }, [tableData]);

  const getParentId = (uid: string) => {
    return tableData?.find((i) => i?.uid?.toLowerCase() === uid?.toLowerCase() && i?.backupFieldType?.toLowerCase() === 'group')?.id ?? ''
  }

  const modifiedObj = (obj: FieldMapType) => {
    const { backupFieldType, uid, id, _canSelect } = obj ?? {}
    const excludeArr = ["group"]
    return {
      id,
      backupFieldType,
      uid,
      parentId: excludeArr?.includes?.(backupFieldType?.toLowerCase()) ? '' : getParentId(uid?.split('.')[0]?.toLowerCase()),
      _canSelect,
    }
  }

  // Update the object on selection or deselection
  const updateRowHistoryObj = (key: string, checked: boolean) => {
    const obj = tableData?.find(i => i?.id === key);
    if (obj) {
      rowHistoryObj[key].push({
        checked,
        at: Date.now(),
        ...modifiedObj(obj),
      });
    }
  };

  /**
 * Recursively gets all descendant row IDs for a given parent UID
 * @param parentUid - The UID of the parent
 * @param data - The table data array
 * @returns Array of all descendant row objects
 * @description Recursively gets all descendant row IDs for a given parent UID
 */
  const getAllDescendants = (parentUid: string, data: FieldMapType[]): FieldMapType[] => {
    const descendants: FieldMapType[] = [];
    const parentUidLower = parentUid?.toLowerCase();
    
    const children = data?.filter((item) => {
      const itemUidLower = item?.uid?.toLowerCase() || '';
      return itemUidLower?.startsWith(parentUidLower + '.') && itemUidLower !== parentUidLower;
    });
    
    children?.forEach((child) => {
      descendants?.push(child);
      
      if (
        child?.backupFieldType?.toLowerCase() === 'group' ||
        child?.backupFieldType?.toLowerCase() === 'modular_blocks' ||
        child?.backupFieldType?.toLowerCase() === 'modular_blocks_child' ||
        child?.contentstackFieldType?.toLowerCase() === 'modular_blocks' ||
        child?.contentstackFieldType?.toLowerCase() === 'modular_blocks_child'
      ) {
        const nestedDescendants = getAllDescendants(child?.uid, data);
        descendants?.push(...nestedDescendants);
      }
    });
    
    return descendants;
  };

  /**
   * 
   * @param childUid - The UID of the child
   * @param selectedObj - The selected object
   * @param data - The table data array
   * @returns 
   * @description Cascade DOWN to uncheck all descendants
   */
  const cascadeUncheckParents = (
    childUid: string,
    selectedObj: UidMap,
    data: FieldMapType[]
  ): void => {
    const uidParts = childUid?.split('.');
    if (uidParts?.length <= 1) return;

    const parentUid = uidParts?.slice(0, -1)?.join('.');
    const parentItem = data?.find((item) => item?.uid?.toLowerCase() === parentUid?.toLowerCase());
    
    if (!parentItem) return;

    const allChildren = data?.filter((item) => {
      const itemUid = item?.uid?.toLowerCase() || '';
      const parentUidLower = parentUid?.toLowerCase();
      return (
        itemUid?.startsWith(parentUidLower + '.') &&
        itemUid?.split('.')?.length === parentUidLower?.split('.')?.length + 1
      );
    });

    const allChildrenUnchecked = allChildren?.every((child) => !selectedObj?.[child?.id]);

    if (allChildrenUnchecked) {
      delete selectedObj[parentItem?.id];
      cascadeUncheckParents(parentItem?.uid, selectedObj, data);
    }
  };

  /**
   * Cascade UP to check all ancestors
   * @param childUid - The UID of the child
   * @param selectedObj - The selected object
   * @param data - The table data array
   * @returns void
   * @description Cascade UP to check all ancestors
   */
  const cascadeCheckParents = (
    childUid: string,
    selectedObj: UidMap,
    data: FieldMapType[]
  ): void => {
    const uidParts = childUid?.split('.');
    
    // Check all ancestors
    for (let i = 1; i < uidParts?.length; i++) {
      const ancestorUid = uidParts?.slice(0, i)?.join('.');
      const ancestorItem = data?.find(
        (item) => item?.uid?.toLowerCase() === ancestorUid?.toLowerCase()
      );
      if (ancestorItem) {
        selectedObj[ancestorItem?.id] = true;
      }
    }
  };

  /**
   * Check if an item is a leaf node
   * @param item - The item to check
   * @returns true if the item is a leaf node, false otherwise
  */
  const isLeafNode = (item: FieldMapType): boolean => {
    const type = item?.backupFieldType?.toLowerCase();
    return (
      type !== 'group' &&
      type !== 'modular_blocks' &&
      type !== 'modular_blocks_child'
    );
  };
    
  /**
   * Handle the selected entries
   * @param singleSelectedRowIds - The single selected row IDs
   * @returns void
   */
  const handleSelectedEntries = (singleSelectedRowIds: string[]) => {
    const selectedObj: UidMap = {};
    const previousRowIds: UidMap = { ...rowIds as UidMap };

    singleSelectedRowIds?.forEach((uid: string) => {
      const isId = selectedEntries?.some((item) => item?.id === uid);
      if (isId) {
        selectedObj[uid] = true;
      }
    });

    // Find all items that changed state
    const changedItems = tableData.filter((item) => {
      const wasSelected = !!previousRowIds[item?.id];
      const isSelected = !!selectedObj[item?.id];
      return wasSelected !== isSelected;
    });

    if (changedItems?.length === 0) {
      const updatedTableData = tableData?.map((tableItem) => ({
        ...tableItem,
        isDeleted: tableItem?._canSelect ? !selectedObj[tableItem?.id] : tableItem?.isDeleted
      }));
      setRowIds(selectedObj);
      setSelectedEntries(updatedTableData);
      return;
    }

    // Find the leaf node that changed (if any) - this is likely what user clicked
    let userClickedItem = changedItems?.find(item => isLeafNode(item));
    
    // If no leaf node changed, use the deepest changed item
    if (!userClickedItem) {
      changedItems?.sort((a, b) => {
        const depthA = a?.uid?.split('.')?.length;
        const depthB = b?.uid?.split('.')?.length;
        return depthB - depthA; // Deepest first
      });
      userClickedItem = changedItems?.[0];
    }

    const wasChecked = !!previousRowIds[userClickedItem?.id];
    const isNowChecked = !wasChecked;

    // Update history
    updateRowHistoryObj(userClickedItem?.id, isNowChecked);

    // Check if this is a parent container
    const isParentContainer =
      (userClickedItem?.contentstackFieldType?.toLowerCase() === 'group') ||
      userClickedItem?.contentstackFieldType?.toLowerCase() === 'modular_blocks' ||
      userClickedItem?.contentstackFieldType?.toLowerCase() === 'modular_blocks_child';

    if (isParentContainer) {
      const allDescendants = getAllDescendants(userClickedItem?.uid, tableData);
      
      if (isNowChecked) {
        // Parent checked - cascade DOWN to children AND UP to ancestors
        selectedObj[userClickedItem?.id] = true;
        allDescendants?.forEach((descendant) => {
          selectedObj[descendant?.id] = true;
        });
        
        cascadeCheckParents(userClickedItem?.uid, selectedObj, tableData);
      } else {
        delete selectedObj[userClickedItem?.id];
        allDescendants?.forEach((descendant) => {
          delete selectedObj?.[descendant?.id];
        });
        cascadeUncheckParents(userClickedItem?.uid, selectedObj, tableData);
      }
    } else {
      if (isNowChecked) {
        selectedObj[userClickedItem?.id] = true;
        
        // Cascade UP to ancestors
        cascadeCheckParents(userClickedItem?.uid, selectedObj, tableData);
      } else {
        // Leaf unchecked
        delete selectedObj[userClickedItem?.id];
        cascadeUncheckParents(userClickedItem?.uid, selectedObj, tableData);
      }
    }

    // Update table data
    const updatedTableData = tableData?.map((tableItem) => ({
      ...tableItem,
      isDeleted: tableItem?._canSelect ? !selectedObj[tableItem?.id] : tableItem?.isDeleted
    }));

    setRowIds(selectedObj);
    setSelectedEntries(updatedTableData);
  };

  // Method for change select value
  const handleValueChange = (value: FieldTypes, rowIndex: string, rowContentstackFieldUid: string) => {
    setIsDropDownChanged(true);
    setFieldValue(value);
    const updatedRows: FieldMapType[] = selectedEntries?.map?.((row) => {
      if (row?.uid === rowIndex && row?.contentstackFieldUid === rowContentstackFieldUid) {
        return { ...row, contentstackFieldType: value?.value };
      }
      return row;
    });
    setTableData(updatedRows);
    setSelectedEntries(updatedRows);

    const dropdownChangeState: INewMigration = {
      ...newMigrationData,
      content_mapping: {
        ...newMigrationData?.content_mapping,
        isDropDownChanged: true,
        otherCmsTitle: otherCmsTitle
      }
    }
    dispatch(updateNewMigrationData((dropdownChangeState)));
  };

  const handleDropDownChange = (value: FieldTypes) => {
    (value?.id !== otherContentType?.id) && setsCsCTypeUpdated(true);

    setIsAllCheck(false);
    setOtherContentType(value);
  };

  const handleAdvancedSetting = (fieldtype: string, fieldvalue: UpdatedSettings, rowId: string, data: FieldMapType) => {
    return cbModal({
      component: (props: ModalObj) => (
        <AdvanceSettings
          rowId={rowId}
          value={fieldvalue}
          fieldtype={fieldtype}
          isLocalised={newMigrationData?.destination_stack?.selectedStack?.locales?.length > 1}
          updateFieldSettings={updateFieldSettings}
          data={data}
          projectId={projectId}
          {...props}
        />
      ),
      modalProps: {
        shouldCloseOnOverlayClick: true
      }
    });
  };

  const SelectAccessor = (data: FieldMapType) => {
    const OptionsForRow = Fields?.[data?.backupFieldType]?.options;
    const initialOption = {
      label: Fields?.[data?.contentstackFieldType]?.label ?? 'No Option',
      value: Fields?.[data?.contentstackFieldType]?.label ?? 'No Option',
    };
    let option: FieldTypes[];
    if (Array.isArray(OptionsForRow)) {
      option = OptionsForRow?.map?.((option) => ({
        label: option,
        value: option,
      }));
    } else if (typeof OptionsForRow === 'object') {
      option = Object.entries(OptionsForRow)?.map?.(([label, value]) => ({
        label,
        value,
      }));

      if (option?.length === 1 && option?.[0]?.label === initialOption?.label) {
        option = [];
      }

    } else {
      option = [{ label: OptionsForRow, value: OptionsForRow }]
    }

    const fieldLabel = data?.contentstackFieldType === 'url' || data?.contentstackFieldType === 'group'
      ? data?.contentstackFieldType : initialOption?.label

    return (
      <div className="table-row">
        <div className="select">
          <Select
            id={data?.uid}
            value={initialOption || fieldValue}
            onChange={(selectedOption: FieldTypes) => handleValueChange(selectedOption, data?.uid, data?.contentstackFieldUid)}
            placeholder="Select Field"
            version={'v2'}
            maxWidth="290px"
            isClearable={false}
            options={option}
            menuPlacement="auto"
            isDisabled={
              !(data?.contentstackFieldType === 'single_line_text' ||
              data?.contentstackFieldType === 'multi_line_text' || data?.contentstackFieldType === 'html' || data?.contentstackFieldType === 'json') ||
              data?.otherCmsType === undefined ||
              newMigrationData?.project_current_step > 4
            }
          />
        </div>
        {!(
          data?.contentstackFieldType === 'group' ||
          data?.contentstackFieldType === 'text' ||
          data?.contentstackFieldType === 'url' ||
          data?.contentstackFieldType === 'global_field' ||
          data?.otherCmsType === undefined ||
          data?.backupFieldType === 'extension' ||
          data?.backupFieldType === 'app'
        ) && (
            <Tooltip
              content="Advanced properties"
              position="top"
              disabled={
                data?.otherCmsField === 'title' ||
                data?.otherCmsField === 'url' ||
                newMigrationData?.project_current_step > 4
              }
            >
              <Button
                buttonType="light"
                disabled={newMigrationData?.project_current_step > 4}
                onClick={() =>
                  handleAdvancedSetting(fieldLabel, data?.advanced || {}, data?.uid, data)
                }
              >
                <Icon
                  version="v2"
                  icon="Sliders"
                  size="small"
                  disabled={newMigrationData?.project_current_step > 4}
                />

              </Button>

            </Tooltip>
          )}
      </div>
    );
  };

  const handleFieldChange = (selectedValue: FieldTypes, rowIndex: string, contentstackFieldUid: string, backupFieldUid: string) => {
    setIsDropDownChanged(true);
    const previousSelectedValue = existingField[backupFieldUid]?.label;
    const groupArray = nestedList?.filter(item =>
      item?.child?.some(e => e?.id)
    )

    if (groupArray?.[0]?.child && previousSelectedValue !== selectedValue?.label && groupArray?.[0]?.uid === rowIndex) {
      for (const item of groupArray?.[0]?.child ?? []) {
        deletedExstingField[item?.backupFieldUid] = {
          label: item?.uid,
          value: existingField[item?.backupFieldUid]

        }
        setIsFieldDeleted(true);
        const index = selectedOptions?.indexOf(existingField[item?.backupFieldUid]?.value?.label);

        if (index > -1) {
          selectedOptions?.splice(index, 1);
        }
        delete existingField[item?.backupFieldUid]

      }
    }
    else {
      setIsFieldDeleted(false);
    }

    setExistingField((prevOptions: ExistingFieldType) => ({
      ...prevOptions,
      [backupFieldUid]: { label: selectedValue?.label, value: selectedValue?.value }
    }));

    //add selected option to array if it is not mapped to any other field
    setSelectedOptions((prevSelected) => {
      const newSelectedOptions = prevSelected?.filter(
        (item) => item !== previousSelectedValue
      );
      const newValue = selectedValue?.label;
      if (!newSelectedOptions?.includes?.(newValue)) {
        newSelectedOptions.push(newValue);
      }
      return newSelectedOptions;
    });


    const updatedRows: FieldMapType[] = tableData.map((row) => {
      if (row?.uid === rowIndex && row?.contentstackFieldUid === backupFieldUid) {
        return {
          ...row,
          contentstackField: selectedValue?.label,
          contentstackFieldUid: selectedValue?.uid,
          contentstackFieldType: selectedValue?.value?.field_metadata?.allow_rich_text ? 'html' : row?.contentstackFieldType,
          advanced: {
            validationRegex: selectedValue?.value?.format,
            mandatory: selectedValue?.value?.mandatory,
            multiple: selectedValue?.value?.multiple,
            unique: selectedValue?.value?.unique,
            nonLocalizable: selectedValue?.value?.non_localizable,
            minChars: selectedValue?.value?.max,
            maxChars: selectedValue?.value?.min
          }
        };
      }
      return row;
    });

    setTableData(updatedRows);
    setSelectedEntries(updatedRows);

    const dropdownChangeState: INewMigration = {
      ...newMigrationData,
      content_mapping: {
        ...newMigrationData?.content_mapping,
        isDropDownChanged: true,
        otherCmsTitle: otherCmsTitle
      }
    }
    dispatch(updateNewMigrationData((dropdownChangeState)));

  };

  //function to generate group schema structure of source cms 
  const generateSourceGroupSchema = (schema: FieldMapType[]) => {

    let groupId = '';
    const data: FieldMapType[] = [];
    schema?.forEach((field: FieldMapType) => {
      if (field?.contentstackFieldType === 'group') {
        groupId = field?.uid;
        data?.push({ ...field, child: [] });
      } else if (field?.uid?.startsWith(groupId + '.')) {
        const obj = data[data?.length - 1];
        if (Object.hasOwn(obj, 'child')) {
          obj?.child?.push(field);
        } else {
          obj.child = [field];
        }
      } else {
        data.push({ ...field, child: [] });
      }
    });
    setNestedList(data);
  }

  //utility function to create option object
  function getMatchingOption(value: ContentTypesSchema, matchFound: boolean, label: string, uid: string) {
    return matchFound ? { label, value, isDisabled: selectedOptions?.includes?.(label), uid: uid } : {}
  }

  //utility function to map the source cms field type to content type field type
  function checkConditions(fieldTypeToMatch: string | string[], value: ContentTypesSchema, data: FieldMapType) {
    const fieldTypes = new Set(['number', 'isodate', 'file', 'reference', 'boolean', 'group', 'link', 'global_field', 'json', 'blocks','taxonomy']);
    switch (fieldTypeToMatch) {
      case 'text':
        return (
          (value?.uid !== 'title' &&
            data?.backupFieldUid !== 'title') &&
          (value?.uid !== 'url' &&
            data?.backupFieldUid !== 'url') &&
          !fieldTypes.has(value?.data_type ?? '') &&
          !value?.field_metadata?.multiline &&
          !value?.enum &&
          !value?.field_metadata?.allow_rich_text &&
          !value?.field_metadata?.allow_json_rte &&
          !value?.field_metadata?.markdown
        );
      case 'multiline':
        return value?.field_metadata?.multiline === true;
      case 'url':
        return value?.uid === 'url';
      case 'file':
        return value?.data_type === 'file';
      case 'number':
        return value?.data_type === 'number' && !value?.enum;
      case 'isodate':
        return value?.data_type === 'isodate';
      case 'json':
        return value?.data_type === 'json' && value?.field_metadata?.allow_json_rte;
      // case 'enum':
      //   return 'enum' in value;
      case 'radio':
        return value?.display_type === 'radio';
      case 'dropdown':
        return value?.display_type === 'dropdown';
      case 'checkbox':
        return value?.display_type === 'checkbox';
      case 'allow_rich_text':
        return value?.field_metadata?.allow_rich_text === true;
      case 'Group':
        return value?.data_type === 'group';
      case 'reference':
        return value?.data_type === 'reference';
      case 'boolean':
        return value?.data_type === 'boolean';
      case 'link':
        return value?.data_type === 'link';
      case 'markdown':
        return value?.field_metadata?.markdown === true;
      default:
        return false;
    }
  }

  //function to process the nested group structure present in contentstack content type
  const processSchema = (
    value: ContentTypesSchema,
    data: FieldMapType,
    array: FieldMapType[],
    groupArray: FieldMapType[],
    OptionsForRow: OptionsType[],
    fieldsOfContentstack: Mapping,
    currentDisplayName = '',
    parentUid = '',
  ) => {
    // Update the current display name with the current value's display name
    const updatedDisplayName = currentDisplayName ? `${currentDisplayName} > ${value?.display_name}` : value?.display_name;
    const uid = parentUid ? `${parentUid}.${value?.uid}` : value?.uid
    if (value?.data_type === 'group') {

      // Check and process the group itself
      if (data?.backupFieldType === 'group' && checkConditions('Group', value, data)) {
        OptionsForRow.push(getMatchingOption(value, true, updatedDisplayName, uid ?? ''));
      }

      const existingLabel = existingField[groupArray?.[0]?.backupFieldUid]?.label ?? '';
      const lastLabelSegment = existingLabel.includes('>')
        ? existingLabel?.split('>')?.pop()?.trim()
        : existingLabel;

      if (value?.display_name === lastLabelSegment) {
        // Process nested schemas within the current group
        for (const item of array) {
          const fieldTypeToMatch = Fields[item?.backupFieldType as keyof Mapping]?.type;
          if (item?.id === data?.id) {
            for (const key of existingField[groupArray?.[0]?.backupFieldUid]?.value?.schema || []) {

              if (checkConditions(fieldTypeToMatch, key, item)) {
                OptionsForRow.push(getMatchingOption(key, true, `${updatedDisplayName} > ${key?.display_name}` || '', `${uid}.${key?.uid}`));
              }

              // Recursively process nested groups
              if (key?.data_type === 'group') {
                processSchema(key, data, array, groupArray, OptionsForRow, fieldsOfContentstack, updatedDisplayName, uid);
              }
            }
          }
        }

      }
      else {
        for (const key of value.schema || []) {
          if (key?.data_type === 'group') {
            processSchema(key, data, array, groupArray, OptionsForRow, fieldsOfContentstack, updatedDisplayName, uid);
          }
        }
      }
    }
    else {

      const fieldTypeToMatch = Fields[data?.backupFieldType as keyof Mapping]?.type;
      if (!array.some((item: FieldMapType) => item?.id === data?.id) && checkConditions(fieldTypeToMatch, value, data)) {
        OptionsForRow.push(getMatchingOption(value, true, updatedDisplayName || '', uid ?? ''));
      }

      // Process nested schemas if value is not a group
      for (const item of array) {
        if (item?.id === data?.id) {
          for (const key of value?.schema || []) {
            if (checkConditions(fieldTypeToMatch, key, item)) {
              OptionsForRow.push(getMatchingOption(key, true, `${updatedDisplayName} > ${key?.display_name}` || '', `${uid}.${key?.uid}`));
            }

            // Recursively process nested groups
            if (key?.data_type === 'group') {
              processSchema(key, data, array, groupArray, OptionsForRow, fieldsOfContentstack, updatedDisplayName, uid);
            }
          }
        }
      }
    }

    return OptionsForRow;
  };

  const SelectAccessorOfColumn = (data: FieldMapType) => {
    // Fetch options for the current row from Fields based on backupFieldType( empty stack options)
    const OptionsForEachRow = Fields?.[data?.backupFieldType]?.options;

    const initialOption = {
      label: Fields?.[data?.contentstackFieldType]?.label,
      value: Fields?.[data?.contentstackFieldType]?.label,
    };

    const fieldsOfContentstack: Mapping = {
      'single_line_text': 'text',
      'url': 'text',
      'text': 'text',
      'json': 'allow_rich_text',
      'Multi-Line Text': 'multiline',
      'multiline': 'multiline',
      'HTML Rich Text Editor': 'allow_rich_text',
      'JSON Rich Text Editor': 'json',
      'Rich Text': 'allow_rich_text',
      'Group': 'Group',
      'URL': 'url',
      'file': 'file',
      'Image': 'file',
      'number': 'number',
      'Integer': 'number',
      'Date': 'isodate',
      'boolean': 'boolean',
      'Checkbox': 'boolean',
      'link': 'link',
      'reference': 'reference',
      'dropdown': 'enum',
      'Droplist': 'display_type',
      'radio': 'enum',
      'General Link': 'link'
    };

    const OptionsForRow: OptionsType[] = [];

    // If OtherContentType label and contentModels are present, set the contentTypeSchema
    if (otherContentType?.label && contentModels) {
      const ContentType: ContentTypeList | undefined = contentModels?.find(
        ({ title }) => title === otherContentType?.label
      );
      setContentTypeSchema(ContentType?.schema);
    }

    if (contentTypeSchema && validateArray(contentTypeSchema)) {
      const fieldTypeToMatch = Fields[data?.backupFieldType as keyof Mapping]?.type;
      //check if UID of souce field is matching to exsting content type field UID
      for (const value of contentTypeSchema) {
        if (data?.uid === value?.uid && data?.backupFieldType === value?.data_type && fieldTypeToMatch) {
          OptionsForRow.push({ label: value?.display_name, value, isDisabled: false });
          break;
        }
      }

      if (OptionsForRow?.length === 0) {
        for (const value of contentTypeSchema) {

          const groupArray = nestedList.filter(item =>
            item?.child?.some(e => e?.id === data?.id)
          );

          const array = groupArray?.[0]?.child || []

          if (value?.data_type === 'group') {
            processSchema(value, data, array, groupArray, OptionsForRow, fieldsOfContentstack)
          }
          else if (!array?.some(item => item?.id === data?.id) && checkConditions(fieldTypeToMatch, value, data)) {

            OptionsForRow.push(getMatchingOption(value, true, value?.display_name || '', value?.uid ?? ''));

          }
        }
      }
    }

    const selectedOption = OptionsForRow?.filter((option) => !option?.isDisabled)?.length

    // Handle case where there is exactly one match and it is auto-mapped
    if (OptionsForRow?.length === 1 &&
      (OptionsForRow?.[0]?.value?.uid === 'url' || OptionsForRow?.[0]?.value?.uid === 'title' || OptionsForRow?.[0]?.value?.data_type === 'group' || OptionsForRow?.[0]?.value?.data_type === 'reference'
      )) {
      updatedRows = updatedRows.map((row: FieldMapType) => {
        if (row?.uid === data?.uid && row?.backupFieldType === data?.backupFieldType) {
          return {
            ...row,
            contentstackField: OptionsForRow?.[0]?.value?.display_name ?? '',
            contentstackFieldUid: OptionsForRow?.[0]?.value?.uid ?? '',
            advanced: {
              validationRegex: OptionsForRow?.[0]?.value?.format ?? '',
              mandatory: OptionsForRow?.[0]?.value?.mandatory,
              multiple: OptionsForRow?.[0]?.value?.multiple,
              unique: OptionsForRow?.[0]?.value?.unique,
              nonLocalizable: OptionsForRow?.[0]?.value?.non_localizable,
            },
          };
        }
        return row;
      });

      // Disable option if it's not already in existingField
      if (!existingField[data?.backupFieldUid] && OptionsForRow?.[0]) {
        OptionsForRow[0].isDisabled = true;
      }
      const newLabel = OptionsForRow?.[0]?.value?.display_name;
      const newvalue = OptionsForRow?.[0]?.value;

      // Check if there's already a matching entry in updatedExstingField
      const hasMatchingEntry = Object.values(updatedExstingField)?.some(
        (entry) => {
          return entry?.label === newLabel
        }
      );

      if (!hasMatchingEntry) {
        updatedExstingField = {
          ...updatedExstingField,
          [data?.backupFieldUid]: { label: newLabel, value: newvalue }
        };
        existingField[data?.backupFieldUid] = { label: newLabel, value: newvalue }
      }

      const newValue: string = OptionsForRow?.[0]?.value?.display_name;
      if (!updatedSelectedOptions?.includes?.(newValue)) {
        updatedSelectedOptions.push(newValue);
      }
      setIsAllCheck(false);
      setIsUpdated(true);
    }

    let option: FieldTypes[];
    if (Array.isArray(OptionsForEachRow)) {
      option = OptionsForEachRow?.map?.((option) => ({
        label: option,
        value: option,
      }));
    } else if (typeof OptionsForEachRow === 'object') {
      option = Object.entries(OptionsForEachRow)?.map?.(([label, value]) => ({
        label,
        value,
      }));

      if (option?.length === 1 && option?.[0]?.label === initialOption?.label) {
        option = [];
      }
    } else {
      option = [{ label: OptionsForEachRow, value: OptionsForEachRow }];
    }

    // Add 'Content Type(s)' as an option if not already present
    // if (!option?.some(opt => opt.label === 'Content Type(s)')) {
    //   option.unshift({ label: 'Content Type(s)', value: 'Content Type(s)' });
    // }


    const OptionValue: FieldTypes =
      OptionsForRow?.length === 1 && (existingField[data?.backupFieldUid] || updatedExstingField[data?.backupFieldUid]) &&
        (OptionsForRow?.[0]?.value?.uid === 'url' || OptionsForRow?.[0]?.value?.uid === 'title' || OptionsForRow?.[0]?.value?.data_type === 'group' || OptionsForRow?.[0]?.value?.data_type === 'reference'

        )
        ? {
          label: OptionsForRow?.[0]?.value?.display_name,
          value: OptionsForRow?.[0]?.value,
          isDisabled: true
        }
        : (OptionsForRow?.length === 0 || (OptionsForRow?.length > 0 && OptionsForRow?.every((item) => item?.isDisabled)
          && (!existingField[data?.backupFieldUid]?.label || !updatedExstingField[data?.backupFieldUid]?.label)))
          ? {
            label: Fields[data?.contentstackFieldType]?.label ?? 'No Option',
            value: Fields[data?.contentstackFieldType]?.label ?? 'No Option',
            isDisabled: !(data?.contentstackFieldType === 'single_line_text' ||
              data?.contentstackFieldType === 'multi_line_text' || data?.contentstackFieldType === 'html' || data?.contentstackFieldType === 'json') ||
              data?.otherCmsType === undefined
              
          }
          : {
            label: `${selectedOption} matches`,
            value: `${selectedOption} matches`,
            isDisabled: false
          };

    const adjustedOptions: OptionsType[] | OptionsType = (OptionsForRow.length === 0 && !contentTypeSchema) ? option :
      (OptionsForRow?.length > 0 && OptionsForRow?.every((item) => item?.isDisabled) && OptionValue?.label === Fields[data?.contentstackFieldType]?.label) ? []
        : OptionsForRow.map((option: OptionsType) => ({
          ...option,
          isDisabled: selectedOptions?.includes?.(option?.label ?? '')
        }));
    return (
      <div className="table-row">
        <div className="select">
          <Select
            value={(OptionsForRow?.length === 0 || (Fields[data?.backupFieldType as keyof Mapping]?.type !== existingField[data?.backupFieldUid]?.value?.data_type || existingField?.[data?.backupFieldUid]?.label === undefined)) ? OptionValue : 

            existingField[data?.backupFieldUid]}
            onChange={(selectedOption: FieldTypes) => {
              if (OptionsForRow?.length === 0) {
                handleValueChange(selectedOption, data?.uid, data?.backupFieldUid)
              } else {
                handleFieldChange(selectedOption, data?.uid, data?.contentstackFieldUid, data?.backupFieldUid)
              }
            }}
            placeholder="Select Field"
            version={'v2'}
            maxWidth="290px"
            isClearable={!!existingField[data?.backupFieldUid]?.label && selectedOptions?.includes?.(existingField[data?.backupFieldUid]?.label ?? '')}
            options={adjustedOptions}
            isDisabled={OptionValue?.isDisabled || newMigrationData?.project_current_step > 4}
            menuPlacement="auto"
          />
        </div>
        {(!OptionValue?.isDisabled || OptionValue?.label === 'Dropdown' ||
          (data?.backupFieldType !== 'extension' &&
            data?.backupFieldType !== 'app' &&
            data?.backupFieldUid !== 'title' &&
            data?.backupFieldUid !== 'url')) && (
            <div className='advanced-setting-button'>
              <Tooltip
                content="Advanced properties"
                position="top"
                disabled={
                  data?.otherCmsField === 'title' ||
                  data?.otherCmsField === 'url'
                }
              >
                <Button
                  buttonType="light"
                  disabled={(contentTypeSchema && existingField[data?.backupFieldUid]) || newMigrationData?.project_current_step > 4}
                  onClick={() => {
                    handleAdvancedSetting(initialOption?.label, data?.advanced || {}, data?.uid, data);
                  }}
                >
                  <Icon
                    version={'v2'}
                    icon="Sliders"
                    size="small"
                  />
                </Button>
              </Tooltip>
            </div>
          )}
      </div>
    );
  };

  const handleSaveContentType = async () => {
    setisLoadingSaveButton(true);
    const orgId = selectedOrganisation?.uid;
    const projectID = projectId;
    if (
      selectedContentType &&
      otherContentType &&
      selectedContentType?.otherCmsUid &&
      otherContentType?.label
    ) {
      otherContentType?.id && setContentTypeMapped((prevState: ContentTypeMap) => ({
        ...prevState,
        [selectedContentType?.contentstackUid]: otherContentType?.id ?? ''
      }));

    }

    if (orgId && contentTypeUid && selectedContentType) {
      const dataCs = {
        contentTypeData: {
          id: contentTypeUid,
          otherCmsTitle: otherCmsTitle,
          otherCmsUid: otherCmsUid,
          isUpdated: true,
          updateAt: new Date(),
          contentstackTitle: selectedContentType?.contentstackTitle,
          contentstackUid: selectedContentType?.contentstackUid,
          fieldMapping: selectedEntries
        }
      };

      try {
        const { data } = await updateContentType(
          orgId,
          projectID,
          selectedContentType?.id ?? '',
          dataCs
        );

        if (data?.status == 200) {
          setisLoadingSaveButton(false);
          Notification({
            notificationContent: { text: 'Content type saved successfully' },
            notificationProps: {
              position: 'bottom-center',
              hideProgressBar: true
            },
            type: 'success'
          });
          setIsDropDownChanged(false);
          if (otherContentType?.id) {
            const newMigrationDataObj: INewMigration = {
              ...newMigrationData,
              content_mapping: {
                ...newMigrationData?.content_mapping,
                content_type_mapping: {

                  ...newMigrationData?.content_mapping?.content_type_mapping,
                  [selectedContentType?.contentstackUid]: otherContentType?.id ?? ''
                },
                isDropDownChanged: false
              }
            };
            dispatch(updateNewMigrationData(newMigrationDataObj));

          }
          else {
            const newMigrationDataObj: INewMigration = {
              ...newMigrationData,
              content_mapping: {
                ...newMigrationData?.content_mapping,
                isDropDownChanged: false
              }
            };
            dispatch(updateNewMigrationData(newMigrationDataObj));

          }



          const savedCT = filteredContentTypes?.map?.(ct =>
            ct?.id === data?.data?.updatedContentType?.id ? { ...ct, status: data?.data?.updatedContentType?.status } : ct
          );
          let filteredCT = savedCT;
          if (!isEmptyString(activeFilter) && activeFilter !== 'All') {
            filteredCT = savedCT?.filter((ct) =>
              CONTENT_MAPPING_STATUS?.[ct?.status] === activeFilter
            );
          }
          const savedContentTypes = contentTypes?.map?.(ct =>
            ct?.id === selectedContentType?.id ? { ...ct, status: data?.data?.updatedContentType?.status } : ct
          );

          setFilteredContentTypes(filteredCT);
          setContentTypes(savedContentTypes);
          setCount(filteredCT?.length);
          try {
            otherContentType?.id && await updateContentMapper(orgId, projectID, { ...contentTypeMapped, [selectedContentType?.contentstackUid]: otherContentType?.id });
          } catch (err) {
            console.error(err);
            return err;
          }

        } else {
          const FailedCT = filteredContentTypes?.map?.(ct =>
            ct?.id === selectedContentType?.id ? { ...ct, status: selectedContentType?.status } : ct
          );

          setFilteredContentTypes(FailedCT);
          setContentTypes(FailedCT);
          Notification({
            notificationContent: { text: data?.message },
            notificationProps: {
              position: 'bottom-center',
              hideProgressBar: true
            },
            type: 'error'
          });
        }
      } catch (error) {
        console.error(error);
        return error;
      }
    }
  }

  const handleDropdownState = () => {
    setIsDropDownChanged(false);
    const dropdownChangeState: INewMigration = {
      ...newMigrationData,
      content_mapping: {
        ...newMigrationData?.content_mapping,
        isDropDownChanged: false
      }
    }
    dispatch(updateNewMigrationData((dropdownChangeState)));
  }

  useImperativeHandle(ref, () => ({
    handleSaveContentType,
    handleDropdownState
  }));

  const handleResetContentType = debounce(async () => {
    // Prevent duplicate clicks
    if (isResetFetch) return;

    const orgId = selectedOrganisation?.value;
    const projectID = projectId;
    setIsDropDownChanged(false);
    setIsResetFetch(true);
    const updatedRows: FieldMapType[] = tableData?.map?.((row) => {
      return {
        ...row,
        contentstackFieldType: row?.backupFieldType,
        contentstackField: row?.otherCmsField,
        contentstackFieldUid: row?.backupFieldUid,
        advanced: row?.advanced?.initial,
        ...(row?.refrenceTo && { refrenceTo: row?.initialRefrenceTo }),
       
      };
    });
    setTableData(updatedRows);
    setSelectedEntries(updatedRows);

    const dataCs = {
      contentTypeData: {
        status: selectedContentType?.status,
        id: selectedContentType?.id,
        projectId: projectId,
        otherCmsTitle: otherCmsTitle,
        otherCmsUid: selectedContentType?.otherCmsUid,
        isUpdated: true,
        updateAt: new Date(),
        contentstackTitle: selectedContentType?.contentstackTitle,
        contentstackUid: selectedContentType?.contentstackUid,
        fieldMapping: updatedRows
      }
    };
    let newstate = {};
    setContentTypeMapped((prevState: ContentTypeMap) => {
      const newState = { ...prevState };

      delete newState[selectedContentType?.contentstackUid ?? ''];
      newstate = newState;

      return newstate;
    });

    if (orgId && selectedContentType) {
      try {
        const { data, status } = await resetToInitialMapping(
          orgId,
          projectID,
          selectedContentType?.id ?? '',
          dataCs
        );

        setExistingField({});
        setContentTypeSchema([]);
        setOtherContentType({
          label: `Select ${isContentType ? 'Content Type' : 'Global Field'} from Destination Stack`,
          value: `Select ${isContentType ? 'Content Type' : 'Global Field'} from Destination Stack`
        });

        if (status === 200) {
          setIsResetFetch(false);
          const updatedContentMapping = { ...newMigrationData?.content_mapping?.content_type_mapping };
          delete updatedContentMapping[selectedContentType?.contentstackUid];

          const newMigrationDataObj: INewMigration = {
            ...newMigrationData,
            content_mapping: {
              ...newMigrationData?.content_mapping,
              content_type_mapping: updatedContentMapping,
              isDropDownChanged: false
            }
          };

          dispatch(updateNewMigrationData(newMigrationDataObj));
          const resetCT = filteredContentTypes?.map?.(ct =>
            ct?.id === selectedContentType?.id ? { ...ct, status: data?.data?.status } : ct
          )

          let filteredCT = resetCT;
          if (!isEmptyString(activeFilter) && activeFilter !== 'All') {
            filteredCT = resetCT?.filter((ct) =>
              CONTENT_MAPPING_STATUS?.[ct?.status] === activeFilter
            );
          }

          const resetContentTypes = contentTypes?.map?.(ct =>
            ct?.id === selectedContentType?.id ? { ...ct, status: data?.data?.status } : ct
          );

          setFilteredContentTypes(filteredCT);
          setContentTypes(resetContentTypes);
          setCount(filteredCT?.length);
          
          const updatedRowIds: Record<string, boolean> = {};
            updatedRows?.forEach((item: FieldMapType) => {
              if (item?.id) {
                updatedRowIds[item.id] = true;
              }
            });
          setRowIds(updatedRowIds);
          
          Notification({
            notificationContent: { text: data?.message },
            notificationProps: {
              position: 'bottom-center',
              hideProgressBar: true
            },
            type: 'success'
          });

          try {
            await updateContentMapper(orgId, projectID, { ...newstate });
          } catch (err) {
            console.error(err);
            return err;
          }


        }
      } catch (error) {
        console.error(error);
        return error;
      } finally {
        // Re-enable icon after API completes
        setIsResetFetch(false);
      }
    }
  }, 1500);
/**
 * Retrieves existing content types for a given project.
 * @returns An array containing the retrieved content types or global fields based on condition if itContentType true and if existing content type or global field id is passed then returns an object containing title, uid and schema of that particular content type or global field.
 */
  const handleFetchContentType = debounce(async () => {
    // Prevent duplicate clicks
    if (isResetFetch) return;

    setIsResetFetch(true);
    
    if (isContentType) {
      try {
        

        const { data, status } = await getExistingContentTypes(projectId, otherContentType?.id ?? '');
        if (status == 201 && data?.contentTypes?.length > 0) {
          (otherContentType?.id === data?.selectedContentType?.uid) && setsCsCTypeUpdated(false);
          setIsResetFetch(false);

          (otherContentType?.id && otherContentType?.label !== data?.selectedContentType?.title && data?.selectedContentType?.title)
            && setOtherContentType({
              label: data?.selectedContentType?.title,
              value: data?.selectedContentType?.title,
              id: data?.selectedContentType?.uid
            })
          setContentModels(data?.contentTypes);
          const newMigrationDataObj: INewMigration = {
            ...newMigrationData,
            content_mapping: {
              ...newMigrationData?.content_mapping,
              existingCT: data?.contentTypes
            }

          }
          dispatch(updateNewMigrationData(newMigrationDataObj));
          Notification({
            notificationContent: { text: 'Content Types fetched successfully' },
            notificationProps: {
              position: 'bottom-center',
              hideProgressBar: true
            },
            type: 'success'
          });
          if (data?.selectedContentType?.schema?.length > 0) {
            setContentTypeSchema(data?.selectedContentType?.schema);
          }
        } else {
          Notification({
            notificationContent: { text: "No content found in the stack" },
            notificationProps: {
              position: 'bottom-center',
              hideProgressBar: false
            },
            type: 'error'
          });
        }
        if (otherContentType?.id && data?.contentTypes?.every((item: FieldMapType) => item?.uid !== otherContentType?.id)) {
          await handleCTDeleted(isContentType, data?.contentTypes);
        }
      } catch (error) {
        console.error(error);
        return error;
      } finally {
        // Re-enable icon after API completes
        setIsResetFetch(false);
      }
    } else {
      try {
        const { data, status } = await getExistingGlobalFields(projectId, otherContentType?.id ?? '');

        if (status == 201 && data?.globalFields?.length > 0) {
          (otherContentType?.id === data?.selectedGlobalField?.uid) && setsCsCTypeUpdated(false);
          setIsResetFetch(false);

          (otherContentType?.id && otherContentType?.label !== data?.selectedGlobalField?.title && data?.selectedGlobalField?.title)
            && setOtherContentType({
              label: data?.selectedGlobalField?.title,
              value: data?.selectedGlobalField?.title,
              id: data?.selectedGlobalField?.uid
            })
          setContentModels(data?.globalFields);

          const newMigrationDataObj: INewMigration = {
            ...newMigrationData,
            content_mapping: {
              ...newMigrationData?.content_mapping,
              existingGlobal: data?.globalFields
            }

          }
          dispatch(updateNewMigrationData(newMigrationDataObj));

          Notification({
            notificationContent: { text: 'Global Fields fetched successfully' },
            notificationProps: {
              position: 'bottom-center',
              hideProgressBar: false
            },
            type: 'success'
          });

          if (data?.selectedGlobalField?.schema?.length > 0) {
            setContentTypeSchema(data?.selectedGlobalField?.schema);
          }
        } else {

          Notification({
            notificationContent: { text: "No Global Fields found in the stack" },
            notificationProps: {
              position: 'bottom-center',
              hideProgressBar: false
            },
            type: 'error'
          });
        }
        if (otherContentType?.id && data?.globalFields?.every((item: FieldMapType) => item?.uid !== otherContentType?.id)) {
          await handleCTDeleted(isContentType, data?.globalFields);
        }
      } catch (error) {
        console.error(error);
        return error;
      }  finally {
        // Re-enable icon after API completes
        setIsResetFetch(false);
      }
    }

    const contentField = contentModels?.find((item: ContentTypeList) => item?.title === otherContentType?.label);
    const contentFieldKey = Object.keys(contentTypeMapped).find(key => contentTypeMapped[key] === otherContentType?.label);

    if (!contentField && contentFieldKey) {
      const updatedState = { ...contentTypeMapped };
      delete updatedState[contentFieldKey];

      setContentTypeMapped((prevState: ContentTypeMap) => {
        const newState = { ...prevState };

        delete newState[contentFieldKey]

        return newState;
      });
      try {
        await updateContentMapper(selectedOrganisation?.value, projectId, { ...updatedState });
      } catch (err) {
        console.error(err);
        return err;
      }
      setOtherContentType({
        label: `Select ${isContentType ? 'Content Type' : 'Global Field'} from Destination Stack`,
        value: `Select ${isContentType ? 'Content Type' : 'Global Field'} from Destination Stack`

      });
    }
  }, 1500);

  /**
   * Handles the deletion of a content type or global field.
   * @param isContentType - Whether the content type is a content type or global field.
   * @param contentTypes - The content types to delete.
   */
  const handleCTDeleted = async (isContentType: boolean, contentTypes: ContentTypeList[]) => {
    // Prevent duplicate clicks
    if (isResetFetch) return;

    const updatedContentTypeMapping = Object.fromEntries(
      Object.entries(newMigrationData?.content_mapping?.content_type_mapping || {})?.filter(
        ([key]) => !selectedContentType?.contentstackUid?.includes?.(key)
      )
    );

    const orgId = selectedOrganisation?.value;
    const projectID = projectId;
    setIsDropDownChanged(false);

    const updatedRows: FieldMapType[] = tableData.map((row) => {
      return { ...row, contentstackFieldType: row?.backupFieldType };
    });
    setTableData(updatedRows);
    setSelectedEntries(updatedRows);

    const dataCs = {
      contentTypeData: {
        status: selectedContentType?.status,
        id: selectedContentType?.id,
        projectId: projectId,
        otherCmsTitle: otherCmsTitle,
        otherCmsUid: selectedContentType?.otherCmsUid,
        isUpdated: true,
        updateAt: new Date(),
        contentstackTitle: selectedContentType?.contentstackTitle,
        contentstackUid: selectedContentType?.contentstackUid,
        fieldMapping: updatedRows
      }
    };
    let newstate = {};
    setContentTypeMapped((prevState: ContentTypeMap) => {
      const newState = { ...prevState };

      delete newState[selectedContentType?.contentstackUid ?? ''];
      newstate = newState;

      return newstate;
    });

    if (orgId && selectedContentType) {
      try {
        const { data, status } = await resetToInitialMapping(
          orgId,
          projectID,
          selectedContentType?.id ?? '',
          dataCs
        );

        setExistingField({});
        setContentTypeSchema([]);
        setOtherContentType({
          label: `Select ${isContentType ? 'Content Type' : 'Global Field'} from Destination Stack`,
          value: `Select ${isContentType ? 'Content Type' : 'Global Field'} from Destination Stack`
        });

        if (status === 200) {
          const resetCT = filteredContentTypes?.map?.(ct =>
            ct?.id === selectedContentType?.id ? { ...ct, status: data?.data?.status } : ct
          );
          setFilteredContentTypes(resetCT);
          setContentTypes(resetCT);

          try {
            await updateContentMapper(orgId, projectID, { ...newstate });
          } catch (err) {
            console.error(err);
            return err;
          }
        }
      } catch (error) {
        console.error(error);
        return error;
      }
    }

    const newMigrationDataObj: INewMigration = {
      ...newMigrationData,
      content_mapping: {
        ...newMigrationData?.content_mapping,
        [isContentType ? 'existingCT' : 'existingGlobal']: contentTypes,
        content_type_mapping: updatedContentTypeMapping
      }
    }
    dispatch(updateNewMigrationData(newMigrationDataObj));
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
    }
  ];

  const isOtherContentType = contentModels?.some((ct) => ct?.title === otherContentType?.label);

  if (!isNewStack) {
    columns?.push({
      disableSortBy: true,
      Header: (
        <span className="nowrap-header">
          {`Contentstack: ${isOtherContentType ? otherContentType?.label : otherCmsTitle}`}
        </span>
      ),
      // accessor: 'ct_field',
      accessor: SelectAccessorOfColumn,
      id: 'contentstack_field',
    });
  } else {
    columns?.push({
      disableSortBy: true,
      Header: (
        <span className="nowrap-header">
          {`Contentstack: ${isNewStack ? otherCmsTitle : otherContentType?.label ?? ''}`}
        </span>
      ),
      accessor: SelectAccessor,
      id: 'contentstack_cms_field',
    });
  }

  const options = contentModels?.map?.((item) => {
    return {
      label: item?.title,
      value: item?.title,
      id: item?.uid,
      isDisabled: (contentTypeMapped && Object.values(contentTypeMapped).includes(item?.uid))
    };
  });



  const adjustedOption = options?.map?.((option) => ({
    ...option,
    isDisabled: filteredContentTypes?.some?.((ct) => ct?.contentstackUid === option?.id) || (contentTypeMapped && Object.values(contentTypeMapped)?.includes?.(option?.id))
  }));

  // Function to toggle filter panel
  const handleFilter = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setShowFilter(!showFilter)
  }

  // Function to filter content types as per the status
  const handleContentTypeFilter = (value: string, e: MouseOrKeyboardEvent) => {
    setActiveFilter(value);
    const li_list = document.querySelectorAll('.filter-wrapper li');
    if (li_list) {
      li_list?.forEach((ele) => {
        ele?.classList?.remove('active-filter');
      })
    }

    (e?.target as HTMLElement)?.closest('li')?.classList?.add('active-filter');

    const filteredCT = contentTypes?.filter((ct) => { return CONTENT_MAPPING_STATUS[ct?.status] === value });
    if (value !== 'All') {
      setFilteredContentTypes(filteredCT);
      setCount(filteredCT?.length);

      if (filteredCT?.some((ct) => ct?.otherCmsUid === otherCmsUid)) {
        const selectedIndex = filteredCT.findIndex(ct => ct?.otherCmsUid === otherCmsUid);
        setActive(selectedIndex);
      } else {
        setActive(null)
      }

    } else {
      setFilteredContentTypes(contentTypes);
      setCount(contentTypes?.length);

      const selectedIndex = contentTypes?.findIndex(ct => ct?.otherCmsUid === otherCmsUid);
      setActive(selectedIndex);
    }
    setShowFilter(false);
  }

  // Function to close filter panel on click outside
  const handleClickOutside = (evt: MouseEvent) => {
    if (!filterRef.current?.contains(evt.target as Node)) {
      setShowFilter(false);
    }
  };

  const calcHeight = () => {
    // Get the viewport height in pixels
    const viewportHeight = window.innerHeight;

    // Subtract 246 pixels from the viewport height
    const result = viewportHeight - 361;

    return result;
  }
  const tableHeight = calcHeight();

  //variable for button component in table
  const onlyIcon = true;

  const modalProps = {
    body: 'There is something error occured while generating content mapper. Please go to Legacy Cms step and validate the file again.',
    isCancel: false,
    header: "",
  }

  return (
    isLoading || newMigrationData?.isprojectMapped
      ? <div className="loader-container">
        <CircularLoader />
      </div>
      :
      <div className="step-container">
        {(contentTypes?.length > 0 || tableData?.length > 0) ?
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
                      }
                      return (
                        <li key={`${index?.toString()}`} className={`${active == index ? 'active-ct' : ''}`}>
                          <button
                            type='button'
                            className='list-button ct-names'
                            onClick={(e) => {
                              if (otherCmsUid === filteredContentTypes[index]?.otherCmsUid) {
                                e.preventDefault();
                              } else {
                                handleOpenContentType(index)
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
                      )
                    })}
                  </ul>
                </div>
                : <div className='no-content'>No Content Types Found.</div>
              }
            </div>

            {/* Content Type Fields */}
            <div className="content-types-fields-wrapper">
              <div className="table-wrapper" ref={tableWrapperRef}>
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
                  searchPlaceholder={tableSearchPlaceholder}
                  fetchTableData={fetchData}
                  loadMoreItems={loadMoreItems}
                  tableHeight={tableHeight}
                  equalWidthColumns={true}
                  columnSelector={false}
                  initialRowSelectedData={initialRowSelectedData}
                  initialSelectedRowIds={rowIds}
                  itemSize={80}
                  withExportCta={{
                    component: (
                      <div className='d-flex align-items-center'>
                        {!isNewStack && (
                          <>
                            <div className="d-flex justify-content-end ml-8">
                              <Select
                                value={otherContentType}
                                onChange={handleDropDownChange}
                                options={adjustedOption}
                                width="440px"
                                maxWidth="440px"
                                placeholder={otherContentType?.label}
                                isSearchable
                                version="v2"
                                isDisabled={newMigrationData?.project_current_step > 4}
                              />
                            </div>

                            <Tooltip content={'Fetch content types from destination stack'} position="top">
                              <Button className='icon-padding' buttonType="light" icon={onlyIcon ? "v2-FetchTemplate" : ''}
                                version="v2" onlyIcon={true} onlyIconHoverColor={'primary'}
                                size='small' onClick={handleFetchContentType} disabled={isResetFetch}>
                              </Button>
                            </Tooltip>
                          </>
                        )}

                        <Tooltip content={'Reset to system mapping'} position="top">
                          <Button className='icon-padding' buttonType="light" icon={onlyIcon ? "v2-ResetReverse" : ''}
                            version="v2" onlyIcon={true} onlyIconHoverColor={'primary'}
                            size='small' onClick={handleResetContentType} disabled={isResetFetch}></Button>
                        </Tooltip>
                      </div>
                    ),
                    showExportCta: true
                  }}
                  getSelectedRow={handleSelectedEntries}
                  rowSelectCheckboxProp={{ key: '_canSelect', value: true }}
                  name={{
                    singular: '',
                    plural: `${totalCounts === 0 ? 'Count' : ''}`
                  }}
                />
                <div className="mapper-footer">
                  <div>Total Fields: <strong>{totalCounts}</strong></div>
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
                    }
                    dispatch(updateNewMigrationData(newMigrationDataObj));
                    handleStepChange(0);
                    const url = `/projects/${projectId}/migration/steps/1`;
                    navigate(url, { replace: true });
                  }}
                  className='ml-10'>Go to Legacy CMS</Button>
            }
            version="v2"
            testId="no-results-found-page"
          />}

      </div>

  );
});

ContentMapper.displayName = 'ContentMapper';
export default ContentMapper;