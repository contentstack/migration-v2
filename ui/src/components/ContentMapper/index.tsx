// Libraries
import { useEffect, useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
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
} from '@contentstack/venus-components';

// Services
import { getCMSDataFromFile } from '../../cmsData/cmsSelector';
import {
  getContentTypes,
  getFieldMapping,
  getExistingContentTypes,
  updateContentType,
  resetToInitialMapping,
  fetchExistingContentType,
  updateContentMapper
} from '../../services/api/migration.service';
import { getStackStatus } from '../../services/api/stacks.service';

// Redux
import { RootState } from '../../store';
import { updateMigrationData, updateNewMigrationData } from '../../store/slice/migrationDataSlice';

// Utilities
import { CS_ENTRIES, CONTENT_MAPPING_STATUS, STATUS_ICON_Mapping } from '../../utilities/constants';
import { validateArray } from '../../utilities/functions';
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
  MappingFields
} from './contentMapper.interface';
import { ItemStatusMapProp } from '@contentstack/venus-components/build/components/Table/types';
import { ModalObj } from '../Modal/modal.interface';
import { UpdatedSettings } from '../AdvancePropertise/advanceProperties.interface';
import { MigrationResponse } from '../../services/api/service.interface';

// Components
import SchemaModal from '../SchemaModal';
import AdvanceSettings from '../AdvancePropertise';
import SaveChangesModal from '../Common/SaveChangesModal';

// Styles
import './index.scss';
import { SCHEMA_PREVIEW } from '../../common/assets';

const dummy_obj:MappingFields = {
  'single_line_text':{
    label : 'Single Line Textbox',
    options : {
      'Single Line Textbox':'single_line_text',
      'Multi Line Textbox':'multi_line_text',
      'HTML Rich text Editor':'html',
      'JSON Rich Text Editor':'json'}
  },
  'multi_line_text':{
    label : 'Multi Line Textbox',
    options : {
      'HTML Rich text Editor': 'html',
      'JSON Rich Text Editor':'json'}
  },
  'json':{
    label:'JSON Rich Text Editor',
    options : {
      'JSON Rich Text Editor':'json',
      'HTML Rich text Editor': 'html'
    }
  },
  'html':{
    label : 'HTML Rich text Editor',
    options : {
      'HTML Rich text Editor': 'html',
      'JSON Rich Text Editor':'json'}

  },
  'text':{
    label : 'Single Line Textbox',
    options: {'Single Line Textbox':'single_line_text'}
  },
  'url': {
    label: 'URL',
    options:{'URL':'url'}
  },
  'file': {
    label:'File',
    options: {
      'File':'file'
    }
  },
  'number': { 
    label:'Number',
    options: {
      'Number':'number'
    }
  },
  'isodate': { label :'Date',
    options: {
      'Date':'isodate'
    }
  },
  'boolean': {
    label: 'Boolean',
    options: {
      'Boolean':'boolean'
    }
  },
  'link': {
    label:'Link',
    options: {
      'Link':'link'
    }
  },
  'reference':{
    label: 'Reference',
    options: {
      'Reference':'reference'
    }
  },
  'dropdown': {
    label:'Dropdown',
    options: {
      'Dropdown':'dropdown'
    }
  },
  'radio': {
    label :'Select',
    options: {
      'Select':'select'
    }
  },
  'CheckBox': {
    label:'Select',
    options: {'Select':'checkbox'}
  },
  'global_field':{
    label : 'Global',
    options: {'Global':'global_field'}},
  'group': {
    label: 'Group',
    options: {'Group':'group'}
  }

}

const Fields: Mapping = {
  'Single Line Textbox': [
    'Single Line Textbox',
    'Multi Line Textbox',
    'HTML Rich text Editor',
    'JSON Rich Text Editor'
  ],
  text: [
    'Single Line Textbox',
    'Multi Line Textbox',
    'HTML Rich text Editor',
    'JSON Rich Text Editor'
  ],
  'single_line_text': [
    'Single Line Textbox',
    'Multi Line Textbox',
    'HTML Rich text Editor',
    'JSON Rich Text Editor'
  ],
  'Multi Line Textbox': ['Multi Line Textbox', 'HTML Rich text Editor', 'JSON Rich Text Editor'],
  multi_line_text:  ['Multi Line Textbox', 'HTML Rich text Editor', 'JSON Rich Text Editor'],
  'HTML Rich text Editor': 'JSON Rich Text Editor',
  'JSON Rich Text Editor': 'JSON Rich Text Editor',
  // 'Multi line': 
  json: ['HTML Rich text Editor', 'JSON Rich Text Editor'],
  URL: 'URL',
  file: 'File',
  number: 'Number',
  Date: 'Date',
  boolean: 'Boolean',
  link: 'Link',
  reference: 'Reference',
  dropdown: 'dropdown',
  radio: 'Select',
  CheckBox: 'Select',
  global_field: 'Global'
};

type ContentMapperComponentProps = {
  projectData: MigrationResponse;
};

const ContentMapper = forwardRef(({projectData}: ContentMapperComponentProps, ref: React.ForwardedRef<ContentTypeSaveHandles>) => {
  /** ALL CONTEXT HERE */

  const migrationData = useSelector((state:RootState)=>state?.migration?.migrationData);
  const newMigrationData = useSelector((state:RootState)=>state?.migration?.newMigrationData);
  const selectedOrganisation = useSelector((state:RootState)=>state?.authentication?.selectedOrganisation);

  const dispatch = useDispatch();

  const {
    contentMappingData: {
      content_types_heading: contentTypesHeading,
      search_placeholder: searchPlaceholder,
      table_search_placeholder: tableSearchPlaceholder
    }= {}
  } = migrationData;

  const [tableData, setTableData] = useState<FieldMapType[]>([]);
  const [loading, setLoading] = useState(false);
  const [itemStatusMap, setItemStatusMap] = useState({});
  const [totalCounts, setTotalCounts] = useState<number>(tableData?.length);
  const [fieldValue, setFieldValue] = useState<FieldTypes>();

  const [searchText, setSearchText] = useState('');
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [otherCmsTitle, setOtherCmsTitle] = useState(contentTypes[0]?.otherCmsTitle);
  const [contentTypeUid, setContentTypeUid] = useState<string>('');
  const [contentTypesList, setContentTypesList] = useState<ContentTypeList[]>([]);
  const [isEmptyStack, setIsEmptyStack] = useState(false);
  const [selectedContentType, setSelectedContentType] = useState<ContentType>();
  const [existingField, setExistingField] = useState<ExistingFieldType>({});
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isDropDownChanged, setIsDropDownChanged] = useState<boolean>(false);
  const [contentTypeMapped, setContentTypeMapped] = useState<ContentTypeMap>(
    newMigrationData?.content_mapping?.content_type_mapping?.[0] || {}
  );
  const [otherContentType, setOtherContentType] = useState<FieldTypes>({
    label: newMigrationData?.content_mapping?.content_type_mapping?.[0]?.[otherCmsTitle],
    value: newMigrationData?.content_mapping?.content_type_mapping?.[0]?.[otherCmsTitle],
  });
  const [otherCmsUid, setOtherCmsUid] = useState<string>(contentTypes[0]?.otherCmsUid);
  const [isContentTypeMapped, setIsContentTypeMapped] = useState<boolean>(false);
  const [isContentTypeSaved, setIsContentTypeSaved] = useState<boolean>(false);
  const [advancePropertise, setAdvancePropertise] = useState<Advanced>({
    validationRegex: '',
    Mandatory: false,
    Multiple: false,
    Unique: false,
    NonLocalizable: false
  });
  const [isLocalised, setIsLocalised] = useState<boolean>(
    newMigrationData?.destination_stack?.selectedStack?.locales?.length > 1
  );

  const [active, setActive] = useState<number>(0);

  const [searchContentType, setSearchContentType] = useState('');

  const [rowIds, setRowIds] = useState({});
  const [selectedEntries, setSelectedEntries] = useState<FieldMapType[]>([]);
  const [contentTypeSchema, setContentTypeSchema] = useState<ContentTypesSchema[] | undefined>([]);
  const [showFilter, setShowFilter] = useState<boolean>(false);
  const [filteredContentTypes, setFilteredContentTypes] = useState<ContentType[]>([])
  const [count, setCount] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [nestedList, setNestedList] = useState<FieldMapType[]>([]);
  const [disabledOptions, setDisabledOptions] = useState<Set<string>>(new Set());
  const [isUpdated, setIsUpdated] = useState(false);
  let updatedRows: FieldMapType[] = tableData;
  let updatedExstingField: ExistingFieldType = existingField;
  const updatedSelectedOptions: string[] = selectedOptions; 
  const [initialRowSelectedData, setInitialRowSelectedData] = useState();
  const selectedTableData: string[] = [];

  /** ALL HOOKS Here */
  const { projectId = '' } = useParams();

  const filterRef = useRef<HTMLDivElement | null>(null);

  /********** ALL USEEFFECT HERE *************/
  useEffect(() => {
    //check if offline CMS data field is set to true, if then read data from cms data file.
    getCMSDataFromFile(CS_ENTRIES.CONTENT_MAPPING)
      .then((data) => {
        //Check for null
        if (!data) {
          dispatch(updateMigrationData({ contentMappingData: DEFAULT_CONTENT_MAPPING_DATA }));
        }

        dispatch(updateMigrationData({ contentMappingData: data}));
      })
      .catch((err) => {
        console.error(err);
      });

    fetchExistingContentTypes();
    fetchContentTypes(searchText || '');
  }, []);

  useEffect(() => {
    if (newMigrationData?.destination_stack?.selectedStack?.value) {
      stackStatus();
    }
  }, [newMigrationData?.destination_stack?.selectedStack?.value])

  // Make title and url field non editable
  useEffect(() => {
    tableData?.forEach((field) => {
      if (field?.otherCmsField !== 'title' && field?.otherCmsField !== 'url') {
        field._canSelect = true;
      }
    });
  },[tableData]);

  console.log("newMigrationData", newMigrationData, newMigrationData?.mapperKeys?.[0], otherCmsTitle, contentTypes);

  // useEffect(() => {
  //   if (otherCmsTitle) {
  //     setOtherContentType({
  //       label: contentTypeMapped?.[otherCmsTitle] ?? 'Select content type from existing stack',
  //       value: contentTypeMapped?.[otherCmsTitle] ?? 'Select content type from existing stack'
  //     });
  //   }
  // }, [otherCmsTitle]);



  // useEffect(() => {
  //   if(otherCmsTitle) {
  //     setOtherContentType({
  //       label: newMigrationData?.content_mapping?.content_type_mapping[0]?.[otherCmsTitle],
  //       value: newMigrationData?.content_mapping?.content_type_mapping[0]?.[otherCmsTitle]
  //     })
  //   }
  // }, [otherCmsTitle])
  

  // useEffect(() => {
  //   if (contentTypeMapped && otherCmsTitle) {
  //     console.log("inside if ==========", contentTypeMapped, otherCmsTitle, newMigrationData?.content_mapping?.content_type_mapping[0]);
      
  //     setOtherContentType({
  //       label: contentTypeMapped?.[otherCmsTitle] ?? 'Select content type from existing stack',
  //       value: contentTypeMapped?.[otherCmsTitle] ?? 'Select content type from existing stack'
  //     });
  //   }
  // }, [contentTypeMapped, otherCmsTitle]);

  // useEffect(() => {
  //      if (contentTypeMapped && otherCmsTitle) {
  // //       console.log("inside if ==========", contentTypeMapped, otherCmsTitle, newMigrationData?.content_mapping?.content_type_mapping[0]);
        
  //       setOtherContentType({
  //         label: contentTypeMapped?.[otherCmsTitle] ?? 'Select content type from existing stack',
  //         value: contentTypeMapped?.[otherCmsTitle] ?? 'Select content type from existing stack'
  //       });

  //       //  newMigrationData?.content_mapping?.content_type_mapping?.map((ctMapped) => {
  //       //    console.log("ctMapped:::::::::::::::::", ctMapped, ctMapped?.[otherCmsTitle]);
          
  //       //    setOtherContentType({
  //       //      label: ctMapped?.[otherCmsTitle],
  //       //      value: ctMapped?.[otherCmsTitle]
  //       //    });

  //       //   //  setContentTypeMapped(ctMapped)
  //       //  })        
  //      }
  //   }, [contentTypeMapped, otherCmsTitle]);

  useEffect(() => {
    const checkKey = Object.keys(contentTypeMapped).find(key => contentTypeMapped[key] === contentTypeMapped[otherCmsTitle]);
    
    if (checkKey === otherCmsTitle) {
      tableData?.forEach((row) => {
        contentTypeSchema?.forEach((schema) => {
          
          if (row?.contentstackField === schema?.display_name) {
            updatedExstingField[row?.uid] = {
              label: schema?.display_name,
              value: schema
            };
          }

          if(schema?.schema) {
            schema?.schema?.forEach((childSchema) => {
              if(row?.contentstackField === `${schema?.display_name} > ${childSchema?.display_name}`){
                
                updatedExstingField[row?.uid] = {
                  label: `${schema?.display_name} > ${childSchema?.display_name}`,
                  value: childSchema
                }
              }
            })
          }
        });
      });
      
      setExistingField(updatedExstingField);
    }
  }, [tableData, otherCmsTitle]);

  useEffect(() => {
    if (isUpdated) {     
      setTableData(updatedRows);
      setExistingField(updatedExstingField);
      setSelectedOptions(updatedSelectedOptions);
      setSelectedEntries(updatedRows);
      setIsUpdated(false);
    }
    else{
      setExistingField({});
      setSelectedOptions([]);

    }
  }, [isUpdated, otherContentType]);

  // To make all the fields checked
  useEffect(() => {
    const selectedId = tableData.reduce<UidMap>((acc, item) => {
      if(! item?.isDeleted){
        acc[item?.id] = true;

      }
      return acc;
    }, {});
    
    setRowIds(selectedId);
  }, [tableData]);

  // To close the filter panel on outside click
  useEffect(() => {
    document.addEventListener('click', handleClickOutside, true);

    return () => {
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, []);

  // if exsting content type is changed in contentstack, reflect those changes for 
  // maaped fields
  useEffect(()=>{

    if (existingField) {
      contentTypeSchema?.forEach((item) => {
        for (const [key, value] of Object.entries(existingField)) {
          if (value?.label === item?.display_name) {

            setExistingField((prevOptions: any) => ({
              ...prevOptions,
              [key]: { label: value?.label, value: item },
            }));

          }
        }})
     
    }

  },[contentTypeSchema]);

  // To dispatch the changed dropdown state
  // useEffect(() => {
  //   console.log("============", contentTypeMapped, {[otherCmsTitle]: contentTypeMapped?.[otherCmsTitle]});
    
  //   const newMigrationDataObj: INewMigration = {
  //     ...newMigrationData,
  //     content_mapping: {
  //       ...newMigrationData?.content_mapping,
  //       isDropDownChanged: isDropDownChanged,
  //       content_type_mapping: [
  //         ...newMigrationData?.content_mapping?.content_type_mapping ?? [],
  //         {[otherCmsTitle]: contentTypeMapped?.[otherCmsTitle]}
  //       ]
  //     }
  //   };

  //   dispatch(updateNewMigrationData((newMigrationDataObj)));
  // }, [isDropDownChanged, contentTypeMapped, otherCmsTitle]);


  useBlockNavigation(isModalOpen);
  // Method to fetch content types
  const fetchContentTypes = async (searchText: string) => {
    const { data } = await getContentTypes(projectId || '', 0, 5000, searchContentType || ''); //org id will always present
    
    setContentTypes(data?.contentTypes);
    setCount(data?.contentTypes?.length);
    setFilteredContentTypes(data?.contentTypes);
    setSelectedContentType(data?.contentTypes?.[0]);
    setTotalCounts(data?.contentTypes?.[0]?.fieldMapping?.length);
    setOtherCmsTitle(data?.contentTypes?.[0]?.otherCmsTitle);
    setContentTypeUid(data?.contentTypes?.[0]?.id);
    fetchFields(data?.contentTypes?.[0]?.id, searchText || '');
    setOtherCmsUid(data?.contentTypes?.[0]?.otherCmsUid);
  };

  // Get the stack status if it is empty or not
  const stackStatus = async () => {
    const contentTypeCount = await getStackStatus(
      selectedOrganisation?.value,
      newMigrationData?.destination_stack?.selectedStack?.value
    );

    if (contentTypeCount?.data?.contenttype_count > 0) {
      setIsEmptyStack(false);
    } else {
      setIsEmptyStack(true);
    }
  };

  // Method to search content types
  const handleSearch = async (searchCT: string) => {
    setSearchContentType(searchCT);

    const { data } = await getContentTypes(projectId, 0, 1000, searchCT || ''); //org id will always present

    setContentTypes(data?.contentTypes);
    setFilteredContentTypes(data?.contentTypes);
    setCount(data?.contentTypes?.length);
  };

  // Method to get fieldmapping
  const fetchFields = async (contentTypeId: string, searchText: string) => {
    const { data } = await getFieldMapping(contentTypeId || '', 0, 30, searchText || '', projectId);

    try {
      const itemStatusMap: ItemStatusMapProp = {};

      for (let index = 0; index <= 30; index++) {
        itemStatusMap[index] = 'loading';
      }

      setItemStatusMap(itemStatusMap);

      setLoading(true);

      for (let index = 0; index <= 30; index++) {
        itemStatusMap[index] = 'loaded';
      }

      setItemStatusMap({ ...itemStatusMap });
      setLoading(false);
      
      const newTableData = data?.fieldMapping.filter((field: FieldMapType) => field !== null)
      
      setTableData(newTableData || []);
      setTotalCounts(data?.count);
      setInitialRowSelectedData(newTableData.filter((item:any) => !item.isDeleted))
      
      generateSourceGroupSchema(data?.fieldMapping);
    } catch (error) {
      console.error('fetchData -> error', error);
    }
  };

  // Fetch table data
  const fetchData = async ({ searchText }: TableTypes) => {
    setSearchText(searchText)
    fetchFields(contentTypeUid, searchText);
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
      // eslint-disable-next-line no-unsafe-optional-chaining
      setTableData([...tableData, ...data?.fieldMapping ?? tableData]);
      setTotalCounts(data?.count);
    } catch (error) {
      console.log('loadMoreItems -> error', error);
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
    setActive(i);
    const otherTitle = contentTypes?.[i]?.otherCmsTitle;
    setOtherCmsTitle(otherTitle);
    // const option = contentTypeMapped?.[otherTitle] ?? 'Select Content Type';
    // const option: FieldTypes;
    // newMigrationData?.content_mapping?.content_type_mapping?.map((otherCT: any) => {
    // //   if (otherTitle === otherCmsTitle) {
    //   console.log("otherCT==================", otherCT?.[contentTypes?.[i]?.otherCmsTitle], contentTypeMapped[contentTypes?.[i]?.otherCmsTitle]);

    // //   // setContentTypeMapped(otherCT);
    //   option = { label: otherCT?.[contentTypes?.[i]?.otherCmsTitle], value: otherCT?.[contentTypes?.[i]?.otherCmsTitle] }
    // //   }
    // setOtherContentType({ label: otherCT?.[contentTypes?.[i]?.otherCmsTitle], value: otherCT?.[contentTypes?.[i]?.otherCmsTitle] });


    // })

      // const newOpt = newMigrationData?.content_mapping?.content_type_mapping.find((otherCT) => {
        console.log("!!!!!!!!!!!!!!!", newMigrationData?.content_mapping?.content_type_mapping?.[i]?.[otherTitle]);
        
      //   otherCT[otherCmsTitle] === otherCmsTitle
      // } )
      // const option = {label: newMigrationData?.content_mapping?.content_type_mapping[i], value: otherCT[contentTypes?.[i]?.otherCmsTitle]}
      // console.log("newOpt", newOpt);
      
    setOtherContentType({ label: newMigrationData?.content_mapping?.content_type_mapping?.[i]?.[otherTitle], value: newMigrationData?.content_mapping?.content_type_mapping?.[i]?.[otherTitle] });

    // })
    // const option = newMigrationData?.content_mapping?.content_type_mapping[otherTitle]


    setContentTypeUid(contentTypes?.[i]?.id ?? '');
    fetchFields(contentTypes?.[i]?.id ?? '', searchText || '');
    setOtherCmsUid(contentTypes?.[i]?.otherCmsUid);
    setSelectedContentType(contentTypes?.[i]);
  }

  // Function to get exisiting content types list
  const fetchExistingContentTypes = async () => {
    const { data, status } = await getExistingContentTypes(projectId);
    if (status === 201) {
      setContentTypesList(data?.contentTypes);
    }
  };

  const updateFieldSettings = (rowId: string, updatedSettings: Advanced, checkBoxChanged: boolean) => {
    setIsDropDownChanged(checkBoxChanged);
    
    const newTableData = tableData?.map((row) => {
      if (row?.uid === rowId) {
        setAdvancePropertise({ ...row?.advanced, ...updatedSettings });

        return { ...row, advanced: { ...row?.advanced, ...updatedSettings } };
      }
      return row;
    });
    setTableData(newTableData);
    setSelectedEntries(newTableData);
  };

  const handleSchemaPreview = (title: string) => {
    return cbModal({
      component: (props: ModalObj) => (
        <SchemaModal
          schemaData={tableData}
          contentType={title}
          {...props}
        />
      ),
      modalProps: {
        shouldCloseOnOverlayClick: true
      }
    });
  };

  const accessorCall = (data: FieldMapType) => {
    return (
      <div>
        <div className="cms-field">{data?.otherCmsField}</div>
        <InstructionText>
          Type: {data?.otherCmsType}
          <br />
          UID: {data?.uid}
        </InstructionText>
      </div>
    );
  };

  const handleSelectedEntries = (singleSelectedRowIds: string[], selectedData: FieldMapType[]) => {
    const selectedObj: UidMap = {};
    let Ischild = false;
  
    singleSelectedRowIds.forEach((uid: string) => {
      const isId = selectedData?.some((item) => item?.id === uid);
      if (isId) {
        selectedObj[uid] = true;
      }
    });
  
    // Iterate over each item in selectedData to handle group and child selection logic
    selectedData?.forEach((item) => {

      // Extract the group UID if item is child of any group
      const uidBeforeDot = item?.uid?.split('.')[0];
      const groupItem = tableData?.find((entry) => entry?.uid === uidBeforeDot);
  
      if (groupItem) {
        // Mark the group item as selected if any child of group is selected
        selectedObj[groupItem?.id] = true;
      }
  
      // If the item is a group, handle its child items
      if (item?.otherCmsType === 'Group') {

        // Get all child items of the group
        const newEle = tableData?.filter((entry) => entry?.uid?.startsWith(item?.uid + '.'));
  
        if (newEle && validateArray(newEle)) {
          
          const allChildrenNotSelected = newEle.every(child => !selectedObj[child?.id || '']);
          if (allChildrenNotSelected) {
            
            //if none of the child of group is selected then mark the child items as selected
            newEle.forEach((child) => {
              Ischild = true;
              selectedObj[child?.id || ''] = true;
            });
          }
        }
      } 
      else {
        // If the item is not a group, mark it as selected in selectedObj
        selectedObj[item?.id] = true;
      }
    });
  
    const uncheckedElements = findUncheckedElement(selectedData, tableData);
 
    uncheckedElements && validateArray(uncheckedElements) && uncheckedElements?.forEach((field) => {
      if (field?.otherCmsType === "Group") {

        // Get all child items of the unchecked group
        const childItems = tableData?.filter((entry) => entry?.uid?.startsWith(field?.uid + '.'));
  
        if (childItems && validateArray(childItems)) {

          // Check if all children are selected
          const allChildrenSelected = childItems.every(child => selectedObj[child?.id || '']);
          
          if (allChildrenSelected) {
            childItems.forEach((child) => {

              // Remove each child item from selected
              delete selectedObj[child?.id || ''];
              
            });
            delete selectedObj[field?.id || ''];
          }
        }
      } 
      else {

        // Extract the group UID if item is child of any group
        const uidBeforeDot = field?.uid?.split('.')[0];
        const groupItem = selectedData?.find((entry) => entry?.uid === uidBeforeDot);
        const childItems = tableData?.filter((entry) => entry?.uid?.startsWith(groupItem?.uid + '.'));

        if (childItems && validateArray(childItems)) {

          // Check if all children are not selected of group
          const allChildrenSelected = childItems.every(child => !selectedObj[child?.id || '']);
          
          if (allChildrenSelected) {
            
            childItems.forEach((child) => {
              delete selectedObj[child?.id || ''];
              
            });
            delete selectedObj[groupItem?.id || ''];
          }
        }
  
        if (!Ischild) {

          delete selectedObj[field?.id || ''];
        }
      }
    });
    const updatedTableData = tableData.map((tableItem) => {
      const found = selectedData.some((selectedItem) => selectedItem.uid === tableItem.uid);
      
      // Mark the item as deleted if not found in selectedData
      return {
        ...tableItem,
        isDeleted: !found ? true : false,
      };
    });
  

    setRowIds(selectedObj);
    setSelectedEntries(updatedTableData);
  };
  
 
  // Function to find unchecked field
  const findUncheckedElement = (selectedData: FieldMapType[], tableData: FieldMapType[]) => {
    return tableData.filter((mainField: FieldMapType) => 
      !selectedData.some((selectedField:FieldMapType) => selectedField?.otherCmsField === mainField?.otherCmsField)
    );
  }

  // Method for change select value
  const handleValueChange = (value: FieldTypes, rowIndex: string) => {
    setIsDropDownChanged(true);
    setFieldValue(value);
    const updatedRows: FieldMapType[] = tableData?.map((row) => {
      if (row?.uid === rowIndex) {
        return { ...row, ContentstackFieldType: value?.value };
      }
      return row;
    });
    setTableData(updatedRows);
    setSelectedEntries(updatedRows);
  };

  const handleDropDownChange = (value: FieldTypes) => {
    setOtherContentType(value);
  };

  const handleAdvancedSetting = (fieldtype: string, fieldvalue: UpdatedSettings, rowId: string, data: FieldMapType) => {
    return cbModal({
      component: (props: ModalObj) => (
        <AdvanceSettings
          rowId={rowId}
          value={fieldvalue}
          fieldtype={fieldtype}
          isLocalised={isLocalised}
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
    //const OptionsForRow = Fields[data?.backupFieldType as keyof Mapping];
    const OptionsForRow = dummy_obj?.[data?.backupFieldType]?.options ;
    const initialOption = {
      label: dummy_obj?.[data?.ContentstackFieldType]?.label,
      value: dummy_obj?.[data?.ContentstackFieldType]?.label,
    };
    let option: FieldTypes[];
    if (Array.isArray(OptionsForRow)) {
       option = OptionsForRow.map((option) => ({
        label: option,
        value: option,
      }));
    } else if (typeof OptionsForRow === 'object') {
      option = Object.entries(OptionsForRow).map(([label, value]) => ({
        label,
        value,
      }));

      if (option?.length === 1 && option?.[0]?.label === initialOption?.label) {
        option = [];
      }
      
    } else {
      option = [{ label: OptionsForRow, value: OptionsForRow }]
    }

    const fieldLabel = data?.ContentstackFieldType === 'url' || data?.ContentstackFieldType === 'group'
      ? data?.ContentstackFieldType : initialOption?.label
    
    return (
      <div className="table-row">
        <div className="select">
          <Select
            id={data?.uid}
            value={initialOption || fieldValue}
            onChange={(selectedOption: FieldTypes) => handleValueChange(selectedOption, data?.uid)}
            placeholder="Select Field"
            version={'v2'}
            maxWidth="290px"
            isClearable={false}
            options={option}
            isDisabled={
              data?.otherCmsType === "Group" ||
              data?.otherCmsField === 'title' ||
              data?.otherCmsField === 'url' ||
              data?.otherCmsType === "reference"
            }
          />
        </div>
        {data?.otherCmsType !== 'Group' &&
          data?.otherCmsField !== 'title' &&
          data?.otherCmsField !== 'url' &&
          data?.otherCmsType !== 'reference' &&
          <Tooltip 
            content="Advanced properties" 
            position="top"
            disabled={
              data?.otherCmsField === 'title' ||
              data?.otherCmsField === 'url'
            }
          >
            <Icon
              version="v2"
              icon="Sliders"
              size="small"
              onClick={() =>
                handleAdvancedSetting(fieldLabel, data?.advanced || {}, data?.uid, data)
              }
            />
          </Tooltip>
        }
      </div>
    );
  };

  const handleFieldChange = (selectedValue: FieldTypes, rowIndex: string) => {
    setIsDropDownChanged(true);
    const previousSelectedValue = existingField[rowIndex]?.label;
    const groupArray = nestedList.filter(item => 
      item?.child?.some(e => e?.id)
    )
    if(groupArray[0].child && previousSelectedValue !== selectedValue?.label && groupArray[0]?.uid === rowIndex){
       for(const item of groupArray[0].child){
        delete existingField[item?.uid]
       }
    }

    
    setExistingField((prevOptions: any) => ({
      ...prevOptions,
      [rowIndex]: { label: selectedValue?.label, value: selectedValue?.value }
    }));
    
    setAdvancePropertise({
      validationRegex: selectedValue?.value?.format,
      Mandatory: selectedValue?.value?.mandatory,
      Multiple: selectedValue?.value?.multiple,
      Unique: selectedValue?.value?.unique,
      NonLocalizable: selectedValue?.value?.non_localizable
    });

    setDisabledOptions((prevDisabledOptions) => {
      const newDisabledOptions = new Set(prevDisabledOptions);
      newDisabledOptions.add(selectedValue?.label);
      return newDisabledOptions;
    });

    //add selected option to array if it is not mapped to any other field
    setSelectedOptions((prevSelected) => {
      const newSelectedOptions = prevSelected.filter(
        (item) => item !== previousSelectedValue
      );
      const newValue = selectedValue?.label;
      if (!newSelectedOptions.includes(newValue)) {
        newSelectedOptions.push(newValue);
      }
      return newSelectedOptions;
    });
  

    const updatedRows: FieldMapType[] = tableData.map((row) => {
      if (row?.uid === rowIndex) {
        return {
          ...row,
          contentstackField: selectedValue?.label,
          contentstackFieldUid: selectedValue?.value?.uid,
          advanced: {
            validationRegex: selectedValue?.value?.format,
            Mandatory: selectedValue?.value?.mandatory,
            Multiple: selectedValue?.value?.multiple,
            Unique: selectedValue?.value?.unique,
            NonLocalizable: selectedValue?.value?.non_localizable,
            MinChars: selectedValue?.value?.max,
            MaxChars: selectedValue?.value?.min
          }
        };
      }
      return row;
    });    

    setTableData(updatedRows);
    setSelectedEntries(updatedRows);
  };

  //function to generate group schema structure of source cms 
  const generateSourceGroupSchema = ( schema: FieldMapType[]) =>{
    
    let groupId = '';
    const data: FieldMapType[] = [];
    schema?.forEach((field: FieldMapType) => {
      if (field?.ContentstackFieldType === 'group') {
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
  function getMatchingOption(value: ContentTypesSchema, matchFound: boolean, label: string) {
    return matchFound ? { label, value, isDisabled: selectedOptions.includes(label) } : {}
  }
  
  //utility function to map the source cms field type to content type field type
  function checkConditions(fieldTypeToMatch: string | string[], value: ContentTypesSchema, data: FieldMapType) {
    const fieldTypes = new Set(['number', 'isodate', 'file', 'reference', 'boolean', 'group', 'link','global_field']);  
    switch (fieldTypeToMatch) {
      case 'text':
        return (
          (value?.uid  !== 'title' && 
          data?.uid !== 'title') &&
          (value?.uid !== 'url' && 
          data?.uid !== 'url') &&
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
        return value?.data_type === 'json';
      case 'enum':
        return 'enum' in value;
      case 'allow_rich_text':
        return value?.field_metadata?.allow_rich_text === true;
      case 'Group':      
        return value?.data_type === 'group';
      case 'reference':
        return value?.data_type === 'reference';
      case 'boolean':
        return value?.data_type === 'boolean';
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
    currentDisplayName = ''
  ) => {
    // Update the current display name with the current value's display name
    const updatedDisplayName = currentDisplayName ? `${currentDisplayName} > ${value?.display_name}` : value?.display_name;
  
    if (value?.data_type === 'group') {

      // Check and process the group itself
      if (data?.otherCmsType === 'Group' && checkConditions('Group', value, data)) {
        OptionsForRow.push(getMatchingOption(value, true, updatedDisplayName));
      }

      const existingLabel = existingField[groupArray[0]?.uid]?.label ?? '';
      const lastLabelSegment = existingLabel.includes('>')
        ? existingLabel?.split('>')?.pop()?.trim()
        : existingLabel;

      if(value.display_name === lastLabelSegment)
      {
          // Process nested schemas within the current group
          for (const item of array) {
            const fieldTypeToMatch = fieldsOfContentstack[item?.otherCmsType as keyof Mapping];
            if (item.id === data?.id) {
              for (const key of existingField[groupArray[0]?.uid]?.value?.schema || []) {
                 
                if (checkConditions(fieldTypeToMatch, key, item)) {                            
                  OptionsForRow.push(getMatchingOption(key, true, `${updatedDisplayName} > ${key.display_name}` || ''));
                }
      
                // Recursively process nested groups
                if (key?.data_type === 'group') {                  
                  processSchema(key, data, array, groupArray, OptionsForRow, fieldsOfContentstack, updatedDisplayName);
                }
              }
            }
          }

      }
      else{
        for (const key of value.schema || []) {
          if (key?.data_type === 'group') {
            processSchema(key, data, array, groupArray, OptionsForRow, fieldsOfContentstack, updatedDisplayName);
          }
        } 
      }
    } 
   else {
 
      const fieldTypeToMatch = fieldsOfContentstack[data?.otherCmsType as keyof Mapping];
      if (!array.some((item : FieldMapType) => item?.id === data?.id) && checkConditions(fieldTypeToMatch, value, data)) {
        OptionsForRow.push(getMatchingOption(value, true, updatedDisplayName || ''));
      }
  
      // Process nested schemas if value is not a group
      for (const item of array) {
        if (item.id === data?.id) {
          for (const key of value.schema || []) {
            if (checkConditions(fieldTypeToMatch, key, item)) {
              OptionsForRow.push(getMatchingOption(key, true, `${updatedDisplayName} > ${key.display_name}` || ''));
            }
  
            // Recursively process nested groups
            if (key?.data_type === 'group') {
              processSchema(key, data, array,groupArray, OptionsForRow, fieldsOfContentstack, updatedDisplayName);
            }
          }
        }
      }
    }
  
    return OptionsForRow;
  };

  const SelectAccessorOfColumn = (data: FieldMapType) => {
    // Fetch options for the current row from dummy_obj based on backupFieldType( empty stack options)
    const OptionsForEachRow = dummy_obj?.[data?.backupFieldType]?.options;

    const initialOption = {
      label: dummy_obj?.[data?.ContentstackFieldType]?.label,
      value: dummy_obj?.[data?.ContentstackFieldType]?.label,
    };
  
    const fieldsOfContentstack: Mapping = {
      'Single Line Textbox': 'text',
      'Single-Line Text': 'text',
      'text': 'text',
      'Multi-Line Text': 'multiline',
      'multiline': 'multiline',
      'HTML Rich text Editor': 'allow_rich_text',
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
      'Droplist': 'enum',
      'radio': 'enum'
    };
  
    const OptionsForRow: OptionsType[] = [];
  
    // If OtherContentType label and contentTypesList are present, set the contentTypeSchema
    if (otherContentType?.label && contentTypesList) {
      const ContentType: ContentTypeList | undefined = contentTypesList?.find(
        ({ title }) => title === otherContentType?.label
      );
      setContentTypeSchema(ContentType?.schema);
    }
  
    if (contentTypeSchema && validateArray(contentTypeSchema)) {
      const fieldTypeToMatch = fieldsOfContentstack[data?.otherCmsType as keyof Mapping];
       
      //check if UID of souce field is matching to exsting content type field UID
      for (const value of contentTypeSchema) {
        if (data?.uid === value?.uid || (data?.uid === value?.uid && data?.otherCmsType === value?.data_type)) {
          OptionsForRow.push({ label: value?.display_name, value, isDisabled: false });
          break;
        }
      }
  
      if (OptionsForRow.length === 0) {
        for (const value of contentTypeSchema) {

          const groupArray = nestedList.filter(item => 
            item?.child?.some(e => e?.id === data?.id)
          );
          
          const array = groupArray[0]?.child || []

          if(value.data_type === 'group'){
            processSchema(value, data, array,groupArray, OptionsForRow, fieldsOfContentstack)
          }
          else if (!array.some(item => item.id === data?.id) && checkConditions(fieldTypeToMatch, value, data)) {
            
            OptionsForRow.push(getMatchingOption(value, true, value?.display_name || ''));
            
          }
        }
      }
    }
  
    const selectedOption = OptionsForRow.length;

    // Handle case where there is exactly one match and it is auto-mapped
    if(OptionsForRow.length === 1 &&
      (OptionsForRow[0]?.value?.uid === 'url' || OptionsForRow[0]?.value?.uid === 'title' || OptionsForRow[0]?.value?.data_type === 'group' || OptionsForRow[0]?.value?.data_type === 'reference'))
      {
        updatedRows = updatedRows.map((row: FieldMapType) => {
          if (row?.uid === data?.uid) {
            return {
              ...row,
              contentstackField: OptionsForRow[0]?.value?.display_name ?? '',
              contentstackFieldUid: OptionsForRow[0]?.value?.uid ?? '',
              advanced: {
                validationRegex: OptionsForRow[0]?.value?.format ?? '',
                Mandatory: OptionsForRow[0]?.value?.mandatory,
                Multiple: OptionsForRow[0]?.value?.multiple,
                Unique: OptionsForRow[0]?.value?.unique,
                NonLocalizable: OptionsForRow[0]?.value?.non_localizable,
              },
            };
          }
          return row;
        });        

        // Disable option if it's not already in existingField
        if (!existingField[data?.uid] && OptionsForRow[0]) {         
          OptionsForRow[0].isDisabled = true;
        }
        const newLabel = OptionsForRow[0]?.value?.display_name;
        const newvalue = OptionsForRow[0]?.value;
    
        // Check if there's already a matching entry in updatedExstingField
        const hasMatchingEntry = Object.values(updatedExstingField).some(         
          (entry) =>{ 
            return entry?.label === newLabel 
          }
        );
        
        if (!hasMatchingEntry) {
          updatedExstingField = {
            ...updatedExstingField,
            [data?.uid]: { label: newLabel, value: newvalue }
          };
        }

        const newValue: string = OptionsForRow[0]?.value?.display_name;
        if (!updatedSelectedOptions.includes(newValue)) {
          updatedSelectedOptions.push(newValue);  
        }
        setIsUpdated(true);   
      }
    
    let option: any;
    if (Array.isArray(OptionsForEachRow)) {
      option = OptionsForEachRow.map((option) => ({
        label: option,
        value: option,
      }));
    } else if (typeof OptionsForEachRow === 'object') {
      option = Object.entries(OptionsForEachRow).map(([label, value]) => ({
        label,
        value,
      }));

      if (option?.length === 1 && option?.[0]?.label === initialOption?.label) {
        option = [];
      }
    } else {
      option = [{ label: OptionsForEachRow, value: OptionsForEachRow }];
    }
   
    const OptionValue: any =
      OptionsForRow.length === 1 && (existingField[data?.uid] ||  updatedExstingField[data?.uid] ) &&
      (OptionsForRow[0]?.value?.uid === 'url' || OptionsForRow[0]?.value?.uid === 'title' || OptionsForRow[0]?.value?.data_type === 'group' || OptionsForRow[0]?.value?.data_type === 'reference')
        ? {
          label: OptionsForRow[0]?.value?.display_name,
          value: OptionsForRow[0]?.value,
          isDisabled: true
        }
        : (OptionsForRow.length === 0 || (OptionsForRow.length > 0 && OptionsForRow.every((item)=>item.isDisabled) 
          && (!existingField[data?.uid] || ! updatedExstingField[data?.uid] ) ))
          ? {
            label: dummy_obj[data?.ContentstackFieldType]?.label,
            value: dummy_obj[data?.ContentstackFieldType]?.label,
            isDisabled: data?.ContentstackFieldType === 'text' ||
              data?.ContentstackFieldType === 'group' ||
              data?.ContentstackFieldType === 'url' ||
              data?.otherCmsType === "reference"
          }
          : {
          label: `${selectedOption} matches`,
          value: `${selectedOption} matches`,
          isDisabled: false
        };
    
    const adjustedOptions = (OptionsForRow.length === 0 && !contentTypeSchema) ? option :
      (OptionsForRow.length > 0 && OptionsForRow.every((item)=>item.isDisabled) && OptionValue.label === dummy_obj[data?.ContentstackFieldType]?.label) ? []
      : OptionsForRow.map((option: OptionsType) => ({
        ...option,
        isDisabled: selectedOptions.includes(option?.label ?? '')
      }));

    return (
      <div className="table-row">
        <div className="select">
          <Select
            value={(OptionsForRow.length === 0 || existingField?.[data?.uid]?.label === undefined) ? OptionValue : existingField[data?.uid]}
            onChange={(selectedOption: FieldTypes) => {
              if (OptionsForRow.length === 0) {
                handleValueChange(selectedOption, data?.uid)
              } else {
                handleFieldChange(selectedOption, data?.uid)
              }
            }}
            placeholder="Select Field"
            version={'v2'}
            maxWidth="290px"
            isClearable={selectedOptions?.includes(existingField?.[data?.uid]?.label ?? '')}
            options={adjustedOptions}
            isDisabled={OptionValue?.isDisabled}
          />
        </div>
        {!OptionValue?.isDisabled && (
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
          disabled={contentTypeSchema && existingField[data?.uid] ? true : false}>
          <Icon
            version={'v2'}
            icon="Sliders"
            size="small"
            onClick={() => {
              handleAdvancedSetting(initialOption?.label, data?.advanced || {}, data?.uid, data);
            }}
          />

          </Button>
          
          </Tooltip>
          
        )}
      </div>
    );
  };


  
 
  const handleSaveContentType = async () => {
    const orgId = selectedOrganisation?.uid;
    const projectID = projectId;

    if (
      selectedContentType &&
      otherContentType &&
      selectedContentType?.otherCmsUid &&
      otherContentType?.label
    ) {
      setContentTypeMapped((prevState: ContentTypeMap) => ({
        ...prevState,
        [otherCmsTitle]: otherContentType?.label
      }));

      // const newMigrationDataObj: INewMigration = {
      //   ...newMigrationData,
      //   content_mapping: {
      //     ...newMigrationData?.content_mapping,
      //     content_type_mapping: [
            
      //       ...newMigrationData?.content_mapping?.content_type_mapping ?? [],
      //       {[otherCmsTitle]: otherContentType?.label}
      //     ] 
      //   }
      // };

      // // console.log("newMigrationDataObj", contentTypeMapped, newMigrationDataObj);
      

      // dispatch(updateNewMigrationData((newMigrationDataObj)));
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
     
      const { data } = await updateContentType(
        orgId,
        projectID,
        selectedContentType?.id ?? '',
        dataCs
      );

      if (data?.status == 200) {
        Notification({
          notificationContent: { text: 'Content type saved successfully' },
          notificationProps: {
            position: 'bottom-center',
            hideProgressBar: true
          },
          type: 'success'
        });
        setIsDropDownChanged(false);
        setIsContentTypeMapped(true);
        setIsContentTypeSaved(true);

        const newMigrationDataObj: INewMigration = {
          ...newMigrationData,
          content_mapping: { ...newMigrationData?.content_mapping, isDropDownChanged: false }
        };
       
       
        dispatch(updateNewMigrationData((newMigrationDataObj)));
      
        const savedCT = filteredContentTypes?.map(ct => 
          ct?.id === data?.data?.updatedContentType?.id ? { ...ct, status: data?.data?.updatedContentType?.status } : ct
        );

        setFilteredContentTypes(savedCT);
        setContentTypes(savedCT);
        await updateContentMapper(orgId, projectID, [contentTypeMapped,{[otherCmsTitle]: otherContentType?.label}]);

      } else {
        Notification({
          notificationContent: { text: data?.message },
          notificationProps: {
            position: 'bottom-center',
            hideProgressBar: true
          },
          type: 'error'
        });
      }
    }
  }

  const handleDropdownState = () => {
    setIsDropDownChanged(false);
  }

  useImperativeHandle(ref, () => ({
    handleSaveContentType,
    handleDropdownState
  }));

  const handleResetContentType = async () => {
    const orgId = selectedOrganisation?.value;
    const projectID = projectId;
    setIsDropDownChanged(false);
   
    const updatedRows: FieldMapType[] = tableData.map((row) => {
      return { ...row, ContentstackFieldType: row.backupFieldType };
    });
    setTableData(updatedRows);

    const dataCs = {
      contentTypeData: {
        status:selectedContentType?.status,
        id: selectedContentType?.id,
        projectId:projectId,
        otherCmsTitle: otherCmsTitle,
        otherCmsUid: selectedContentType?.otherCmsUid,
        isUpdated: true,
        updateAt: new Date(),
        contentstackTitle: selectedContentType?.contentstackTitle,
        contentstackUid: selectedContentType?.contentstackUid,
        fieldMapping: updatedRows
      }
    };
    if (orgId && selectedContentType) {
      const { status } = await resetToInitialMapping(
        orgId,
        projectID,
        selectedContentType?.id ?? '',
        dataCs
      );
      setExistingField({});
      setContentTypeSchema([]);
      setContentTypeMapped({});
      if (status == 200) {
        Notification({
          notificationContent: { text: 'Content type reset successfully' },
          notificationProps: {
            position: 'bottom-center',
            hideProgressBar: false
          },
          type: 'success'
        });
      }
    }
  };

  // Function to fetch single content type
  const handleFetchContentType = async () => {
    if (otherContentType?.label === "Select Content Type") {
      Notification({
        notificationContent: { text: "Please Select a Content Type to fetch." },
        notificationProps: {
          position: 'bottom-center',
          hideProgressBar: false
        },
        type: 'error'
      });
    } else {
      const { data , status} = await fetchExistingContentType(projectId, otherContentType?.id ?? '');

      const index = contentTypesList.findIndex(ct => ct?.uid === data?.uid);

      const contentTypesArr: ContentTypeList[] = contentTypesList;
      
      if(index != -1) {      
        contentTypesArr[index] = data;
      }
      
      setContentTypesList(contentTypesArr);
      setContentTypeSchema(data?.schema);
      if (status == 201) {
        Notification({
          notificationContent: { text: 'Content type fetched successfully' },
          notificationProps: {
            position: 'bottom-center',
            hideProgressBar: false
          },
          type: 'success'
        });
      }
      
    }
  }

  const columns = [
    {
      disableSortBy: true,
      Header: `${newMigrationData?.legacy_cms?.selectedCms?.title}: ${otherCmsTitle}`,
      accessor: accessorCall,
      // accessor: 'otherCmsField',
      default: false,
      id: 'uuid'
    }
  ];

  if (!isEmptyStack) {
    columns?.push({
      disableSortBy: true,
      Header: `Contentstack: ${otherContentType?.label ?? ''}`,
      // accessor: 'ct_field',
      accessor: SelectAccessorOfColumn,
      id: 'contentstack_field',
      default: false
    });
  } else {
    columns?.push({
      disableSortBy: true,
      Header: `Contentstack: ${isEmptyStack ? otherCmsTitle : otherContentType?.label ?? ''}`,
      accessor: SelectAccessor,
      id: 'contentstack_cms_field',
      default: false
    });
  }

  const options = contentTypesList?.map((item) => ({
    label: item?.title,
    value: item?.title,
    id: item?.uid,
    isDisabled: false
  }));

  const adjustedOption = options?.map((option) => ({
    ...option,
    isDisabled: contentTypeMapped && Object.values(contentTypeMapped).includes(option?.label)
  }));

  // Function to toggle filter panel
  const handleFilter = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation(); 
    setShowFilter(!showFilter)
  }

  // Function to filter content types as per the status
  const handleContentTypeFilter = (value: string, e: MouseOrKeyboardEvent) => {
    const li_list = document.querySelectorAll('.filter-wrapper li');
    if(li_list) {
      li_list.forEach((ele) => {
        ele?.classList?.remove('active-filter');
      })
    }
    
    (e?.target as HTMLElement)?.closest('li')?.classList?.add('active-filter');
    
    const filteredCT = contentTypes?.filter((ct) => {return CONTENT_MAPPING_STATUS[ct?.status] === value});
    if (value !== 'All') {
      setFilteredContentTypes(filteredCT);
      setCount(filteredCT?.length);
    } else {
      setFilteredContentTypes(contentTypes);
      setCount(contentTypes?.length);
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
  const onlyIcon= true;

  console.log("otherContentType", otherContentType, contentTypeMapped, newMigrationData);
  

  return (
    <div className="step-container">
      <div className="d-flex flex-wrap table-container">
        {/* Content Types List */}
        <div className="content-types-list-wrapper">
          <div className="content-types-list-header d-flex align-items-center justify-content-between">
            {contentTypesHeading && <h2>{contentTypesHeading}</h2> }
            {contentTypes &&  count }
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
                    {Object.keys(CONTENT_MAPPING_STATUS).map((key, keyInd) => (
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
                          {CONTENT_MAPPING_STATUS[key] && <span className='filter-status'>{CONTENT_MAPPING_STATUS[key]}</span> }
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
                {filteredContentTypes?.map((content: ContentType, index: number) => {
                  const icon = STATUS_ICON_Mapping[content?.status] || '';

                  const format = (str: string) => {
                    const frags = str.split('_');
                    for (let i = 0; i < frags?.length; i++) {
                      frags[i] = frags[i].charAt(0).toUpperCase() + frags[i].slice(1);
                    }
                    return frags.join(' ');
                  }
                  return (
                    <li key={`${index.toString()}`} className={`${active == index ? 'active-ct' : ''}`}>
                      <button
                        type='button'
                        className='list-button ct-names'
                        onClick={() => handleOpenContentType(index)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleOpenContentType(index);
                          }
                        }}
                      >
                        <div className='cms-title'>
                          <Tooltip content={format(content?.type)} position="bottom">
                            {content?.type === "content_type" 
                              ? <Icon icon={active == index ? "ContentModelsMediumActive" : "ContentModelsMedium"} size="small"  />
                              : <Icon icon={active == index ? "GlobalFieldsMediumActive" : "GlobalFieldsMedium"} size="small" />
                            }
                          </Tooltip>
                          {content?.otherCmsTitle && <span title={content?.otherCmsTitle}>{content?.otherCmsTitle}</span> }
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
                              <button className='list-button schema-preview' onClick={() => handleSchemaPreview(content?.otherCmsTitle)}>{SCHEMA_PREVIEW}</button>
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
          <div className="table-wrapper">
            <InfiniteScrollTable
              loading={loading}
              canSearch={true}
              data={tableData?.length ? [...tableData] : []}
              columns={columns}
              uniqueKey={'id'}
              isRowSelect
              // fullRowSelect
              itemStatusMap={itemStatusMap}
              totalCounts={totalCounts}
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
                    {!isEmptyStack && (
                      <Tooltip content={'fetch the content type'} position="left">
                        <Button buttonType="light" icon={onlyIcon ? "v2-FetchTemplate" : ''}
                         version="v2" onlyIcon={true} onlyIconHoverColor={'primary'} 
                         size='small' onClick={handleFetchContentType}>
                        </Button>
                        
                      </Tooltip>
                    )}

                    <Tooltip content={'Reset to intial mapping'} position="left">
                       <Button buttonType="light" icon={onlyIcon ? "v2-Restore" : ''} 
                       version="v2" onlyIcon={true} onlyIconHoverColor={'primary'} 
                       size='small' onClick={handleResetContentType}></Button>
                    </Tooltip>

                    {!isEmptyStack && (
                      <div className="d-flex justify-content-end ml-8">
                        <Select
                          value={otherContentType}
                          onChange={handleDropDownChange}
                          options={adjustedOption}
                          width="440px"
                          maxWidth="440px"
                          placeholder={otherContentType && 'Select content type from existing stack'}
                          version="v2"
                        />
                      </div>
                    )}
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
            <div className='text-end my-3 mx-3 px-1'>
              <Button
                  className="saveButton"
                  onClick={handleSaveContentType}
                  version="v2"
                >
                Save
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

ContentMapper.displayName = 'ContentMapper';
export default ContentMapper;
