// Libraries
import { useEffect, useState, useRef } from 'react';
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
  fetchExistingContentType
} from '../../services/api/migration.service';
import { getStackStatus } from '../../services/api/stacks.service';

// Redux
import { RootState } from '../../store';
import { updateMigrationData, updateNewMigrationData } from '../../store/slice/migrationDataSlice';

// Utilities
import { CS_ENTRIES, CONTENT_MAPPING_STATUS, STATUS_ICON_Mapping } from '../../utilities/constants';
import { validateArray } from '../../utilities/functions';

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
  optionsType,
  UidMap,
  ContentTypeMap,
  Advanced,
  SavedContentType
} from './contentMapper.interface';
import { ItemStatusMapProp } from '@contentstack/venus-components/build/components/Table/types';
import { ModalObj } from '../Modal/modal.interface';
import { UpdatedSettings } from '../AdvancePropertise/advanceProperties.interface';

// Components
import SchemaModal from '../SchemaModal';
import AdvanceSettings from '../AdvancePropertise';
import SaveChangesModal from '../Common/SaveChangesModal';

// Styles
import './index.scss';
const dummy_obj:any = {
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
      'JSON Rich Text Editor':'json'}
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
    options: {'File':'file'}
  },
  'number': { 
    label:'Number',
    options: {'Number':'number'}
  },
  'isodate': { label :'Date',
    options: {'Date':'isodate'}
  },
  'boolean': {
    label: 'Boolean',
    options: {'Boolean':'boolean'}
  },
  'link': {
    label:'Link',
    options: {'Link':'link'}
  },
  'reference':{
    label: 'Reference',
    options: {'Reference':'reference'}
  },
  'dropdown': {
    label:'Dropdown',
    options: {'Dropdown':'dropdown'}
  },
  'radio': {
    label :'Select',
    options: {'Select':'select'}
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

const ContentMapper = () => {
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
  const [itemStatusMap, updateItemStatusMap] = useState({});
  const [totalCounts, setTotalCounts] = useState<number>(tableData?.length);
  const [fieldValue, setFieldValue] = useState<FieldTypes>();

  const [searchText, setSearchText] = useState('');
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [otherCmsTitle, setOtherCmsTitle] = useState(contentTypes[0]?.otherCmsTitle);
  const [contentTypeUid, setContentTypeUid] = useState<string>('');
  const [contentTypesList, setContentTypesList] = useState<ContentTypeList[]>([]);
  const [IsEmptyStack, setIsEmptyStack] = useState(false);
  const [selectedContentType, setSelectedContentType] = useState<ContentType>();
  const [exstingField, setexsitingField] = useState<ExistingFieldType>({});
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isDropDownChanged, setisDropDownCHanged] = useState<boolean>(false);
  const [contentTypeMapped, setcontentTypeMapped] = useState<ContentTypeMap>(
    newMigrationData?.content_mapping?.content_type_mapping || {}
  );
  const [OtherContentType, setOtherContentType] = useState<FieldTypes>({
    label: contentTypeMapped?.[otherCmsTitle],
    value: contentTypeMapped?.[otherCmsTitle]
  });
  const [otherCmsUid, setotherCmsUid] = useState<string>(contentTypes[0]?.otherCmsUid);
  const [isContentTypeMapped, setisContentTypeMapped] = useState<boolean>(false);
  const [isContentTypeSaved, setisContentTypeSaved] = useState<boolean>(false);
  const [advancePropertise, setadvancePropertise] = useState({
    validationRegex: '',
    Mandatory: false,
    Multiple: false,
    Unique: false,
    NonLocalizable: false
  });
  const [isLocalised, setisLocalised] = useState<boolean>(
    newMigrationData?.destination_stack?.selectedStack?.locales?.length > 1 ? true : false
  );

  const [active, setActive] = useState<number>(null ?? 0);

  const [searchContentType, setSearchContentType] = useState('');

  const [rowIds, setRowIds] = useState({});
  const [selectedEntries, setSelectedEntries] = useState<FieldMapType[]>([]);
  const [contentTypeSchema, setContentTypeSchema] = useState<ContentTypesSchema[]>([]);
  const [showFilter, setShowFilter] = useState<boolean>(false);
  const [filteredContentTypes, setFilteredContentTypes] = useState<ContentType[]>([])
  const [count, setCount] = useState<number>(0);

  /** ALL HOOKS Here */
  const { projectId = '' } = useParams();

  const ref = useRef<HTMLDivElement | null>(null);

  /********** ALL USEEFFECT HERE *************/
  useEffect(() => {
    //check if offline CMS data field is set to true, if then read data from cms data file.
    getCMSDataFromFile(CS_ENTRIES.CONTENT_MAPPING)
      .then((data) => {
        //Check for null
        if (!data) {
          dispatch(updateMigrationData({ contentMappingData: DEFAULT_CONTENT_MAPPING_DATA }));
        }

        dispatch(updateMigrationData({ contentMappingData: data }));
      })
      .catch((err) => {
        console.error(err);
      });

    fetchExistingContentTypes();
    stackStatus();
  }, []);

  // Make title and url field non editable
  useEffect(() => {
    tableData?.forEach((field) => {
      if (field?.otherCmsField !== 'title' && field?.otherCmsField !== 'url') {
        field._canSelect = true;
      }
    });
  });

  useEffect(() => {
    if (contentTypeMapped && otherCmsTitle) {
      setOtherContentType({
        label: contentTypeMapped?.[otherCmsTitle] ?? 'Select content type from existing stack',
        value: contentTypeMapped?.[otherCmsTitle] ?? 'Select content type from existing stack'
      });
    }
  }, [contentTypeMapped, otherCmsTitle]);

  useEffect(() => {
    const updatedExstingField: ExistingFieldType = {};
    if (isContentTypeSaved) {
      tableData?.forEach((row) => {
        if (row?.contentstackField) {
          updatedExstingField[row?.uid] = {
            label: row?.contentstackField,
            value: row?.contentstackField
          };
        }
      });
      setexsitingField(updatedExstingField);
    }
  }, [tableData, isContentTypeSaved]);

  // To make all the fields checked
  useEffect(() => {
    const selectedId = tableData.reduce<UidMap>((acc, item) => {
      acc[item?.id] = true;
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
    setotherCmsUid(data?.contentTypes?.[0]?.otherCmsUid);
  };

  // Get the stack status if it is empty or not
  const stackStatus = async () => {
    const contentTypeCount = await getStackStatus(
      newMigrationData?.destination_stack?.selectedOrg?.value,
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
  };

  // Method to get fieldmapping
  const fetchFields = async (contentTypeId: string, searchText: string) => {
    const { data } = await getFieldMapping(contentTypeId || '', 0, 30, searchText || '');

    try {
      const itemStatusMap: ItemStatusMapProp = {};

      for (let index = 0; index <= 30; index++) {
        itemStatusMap[index] = 'loading';
      }

      updateItemStatusMap(itemStatusMap);

      setLoading(true);

      for (let index = 0; index <= 30; index++) {
        itemStatusMap[index] = 'loaded' ?? '';
      }

      updateItemStatusMap({ ...itemStatusMap });
      setLoading(false);
      
      const newTableData = data?.fieldMapping.filter((field: FieldMapType) => field !== null)
      
      setTableData(newTableData || []);
      setTotalCounts(data?.count);
    } catch (error) {
      console.error('fetchData -> error', error);
    }
  };

  // Fetch table data
  const fetchData = async ({ searchText }: TableTypes) => {
    setSearchText(searchText);
    fetchContentTypes(searchText || '');
  };

  // Method for Load more table data
  const loadMoreItems = async ({ searchText, skip, limit, startIndex, stopIndex }: TableTypes) => {
    try {
      const itemStatusMapCopy: ItemStatusMapProp = { ...itemStatusMap };

      for (let index = startIndex; index <= stopIndex; index++) {
        itemStatusMapCopy[index] = 'loading';
      }

      updateItemStatusMap({ ...itemStatusMapCopy });
      setLoading(true);

      const { data } = await getFieldMapping(contentTypeUid || '', skip, limit, searchText || '');

      const updateditemStatusMapCopy: ItemStatusMapProp = { ...itemStatusMap };

      for (let index = startIndex; index <= stopIndex; index++) {
        updateditemStatusMapCopy[index] = 'loaded';
      }

      updateItemStatusMap({ ...updateditemStatusMapCopy });
      setLoading(false);
      // eslint-disable-next-line no-unsafe-optional-chaining
      setTableData([...tableData, ...data?.fieldMapping]);
      setTotalCounts(data?.count);
    } catch (error) {
      console.log('loadMoreItems -> error', error);
    }
  };

  const [isModalOpen, setIsModalOpen] = useState(false);


  const [currentCt, setCurrentCt] = useState(contentTypes[0]?.otherCmsTitle);
  const [savedContentType, setSavedContentType] = useState<SavedContentType>({'col1': true, 'col2': false});
  console.log("savedContentType", savedContentType);
  


  // Method to change the content type
  const openContentType = (i: number) => {
    // console.log("savedContentType[i - 1]", i, savedContentType[i - 1]);
    
    if (i > -1 && 1 < filteredContentTypes?.length) {

      // filteredContentTypes?.forEach((ct: ContentType) => {
      //   ct.otherCmsTitle = true
      // })


    // setCurrentCt(otherTitle);
    const updatedCT = {}
    // updatedCT.contentTypes.[i].otherCmsTitle = true
    // contentTypes.[i].otherCmsTitle = true
    setSavedContentType(updatedCT)



    

    // console.log("isContentTypeSaved", savedContentType[i - 1]?.otherCmsTitle, savedContentType[i]?.otherCmsTitle);
    
      // savedCTArray.push({contentTypes?.[i]?.otherCmsTitle : true});
    }

    // console.log("savedCTArray", contentTypes?.[i]?.otherCmsTitle, i);
    if (isDropDownChanged) {
      console.log("otherCmsTitle", otherCmsTitle);
      
      setIsModalOpen(true);
      return cbModal({
        component: (props: ModalObj) => (
          <SaveChangesModal
          {...props}
          isopen={setIsModalOpen}
          otherCmsTitle={otherCmsTitle}
          />
        ),
        modalProps: {
          size: 'xsmall',
          shouldCloseOnOverlayClick: false
        }
      });
    } else {
      setActive(i);
      const otherTitle = contentTypes?.[i]?.otherCmsTitle;
      setOtherCmsTitle(otherTitle);
      const option = contentTypeMapped?.[otherTitle] ?? 'Select Content Type';
      setOtherContentType({ label: option, value: option });
  
      setContentTypeUid(contentTypes?.[i]?.id ?? '');
      fetchFields(contentTypes?.[i]?.id ?? '', searchText || '');
      setotherCmsUid(contentTypes?.[i]?.otherCmsUid);
      setSelectedContentType(contentTypes?.[i]);
    }
  };

  // Function to get exisiting content types list
  const fetchExistingContentTypes = async () => {
    const { data, status } = await getExistingContentTypes(projectId);
    if (status === 201) {
      setContentTypesList(data?.contentTypes);
    }
  };

  const updateFieldSettings = (rowId: string, updatedSettings: Advanced, checkBoxChanged: boolean) => {
    setisDropDownCHanged(checkBoxChanged);
    //setadvancePropertise(...updatedSettings);

    const newTableData = tableData?.map((row) => {
      if (row?.uid === rowId) {
        setadvancePropertise({ ...row?.advanced, ...updatedSettings });

        return { ...row, advanced: { ...row?.advanced, ...updatedSettings } };
      }
      return row;
    });

    setTableData(newTableData);
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

  // Function to handle selected fields
  const handleSelectedEntries = (singleSelectedRowIds: string[], selectedData: FieldMapType[]) => {
    const selectedObj: UidMap = {};

    singleSelectedRowIds.forEach((uid: string) => {
      selectedObj[uid] = true;
    });
    
    const uncheckedElements = findUncheckedElement(selectedData, tableData);
    uncheckedElements && validateArray(uncheckedElements) && uncheckedElements?.forEach((field) => {
      if (field?.otherCmsType === "Group") {
        const newEle = selectedData?.filter((entry) => entry?.uid?.startsWith(field?.uid + '.'))

        newEle && validateArray(newEle) && newEle.forEach((child) => {
          selectedObj[child?.id || ''] = false;
          selectedData?.splice(selectedData?.indexOf(child), 1);
        })
      }
    })

    setRowIds(selectedObj);
    setSelectedEntries(selectedData);
  };

  // Function to find unchecked field
  const findUncheckedElement = (selectedData: FieldMapType[], tableData: FieldMapType[]) => {
    return tableData.filter((mainField: FieldMapType) => 
      !selectedData.some((selectedField:FieldMapType) => selectedField?.otherCmsField === mainField?.otherCmsField)
    );
  }

  // Method for change select value
  const handleValueChange = (value: FieldTypes, rowIndex: string) => {
    console.log("setisDropDownCHanged", value, rowIndex);
    
    setisDropDownCHanged(true);
    setFieldValue(value);
    const updatedRows = tableData?.map((row) => {
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
    let option:any;
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
    }else{
      option = [{ label: OptionsForRow, value: OptionsForRow }]
    }

      const fieldLabel = data?.ContentstackFieldType === 'url' || data?.ContentstackFieldType === 'group'
        ? data?.ContentstackFieldType : option?.[0]?.label
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
              data?.ContentstackFieldType === 'group' ||
              data?.otherCmsField === 'title' ||
              data?.otherCmsField === 'url'
            }
          />
        </div>
        {data?.ContentstackFieldType !== 'group' &&
          data?.otherCmsField !== 'title' &&
          data?.otherCmsField !== 'url' &&
          <Tooltip 
            content="Advance propertise" 
            position="top"
            disabled={
              data?.otherCmsField === 'title' ||
              data?.otherCmsField === 'url'
            }
          >
            <Icon
              version="v2"
              icon="Setting"
              size="small"
              onClick={() =>
                handleAdvancedSetting(fieldLabel, advancePropertise, data?.uid, data)
              }
            />
          </Tooltip>
        }
      </div>
    );
  };

  const handleFieldChange = (selectedValue: FieldTypes, rowIndex: string) => {
    setisDropDownCHanged(true);
    setexsitingField((prevOptions) => ({
      ...prevOptions,
      [rowIndex]: { label: selectedValue?.label, value: selectedValue?.value }
    }));
    setadvancePropertise({
      validationRegex: selectedValue?.value?.format,
      Mandatory: selectedValue?.value?.mandatory,
      Multiple: selectedValue?.value?.multiple,
      Unique: selectedValue?.value?.unique,
      NonLocalizable: selectedValue?.value?.non_localizable
    });

    if (isDropDownChanged && isContentTypeSaved) {
      setSelectedOptions((prevSelected) => {
        const newValue = selectedValue?.label;
        return prevSelected?.includes(newValue) ? prevSelected : [...prevSelected, newValue];
      });
    }

    const updatedRows = tableData.map((row) => {
      if (row?.uid === rowIndex) {
        return {
          ...row,
          contentstackField: selectedValue?.label,
          advanced: {
            validationRegex: selectedValue?.value?.format,
            Mandatory: selectedValue?.value?.mandatory,
            Multiple: selectedValue?.value?.multiple,
            Unique: selectedValue?.value?.unique,
            NonLocalizable: selectedValue?.value?.non_localizable
          }
        };
      }
      return row;
    });

    setTableData(updatedRows as FieldMapType[]);
    setSelectedEntries(updatedRows as FieldMapType[]);
  };

  const SelectAccessorOfColumn = (data: FieldMapType) => {
    const fieldsOfContentstack: Mapping = {
      'Single Line Textbox': 'text',
      'Single-Line Text': 'text',
      'text': 'text',
      'Multi Line Textbox': 'multiline',
      'multiline': 'multiline',
      'HTML Rich text Editor': 'allow_rich_text',
      'JSON Rich Text Editor': 'json',
      'Rich Text':'json',
      'Group': 'Group',
      'URL': 'url',
      'file': 'file',
      'number': 'number',
      'Date': 'isodate',
      'boolean': 'boolean',
      'link': 'link',
      'reference': 'reference',
      'dropdown': 'enum',
      'radio': 'enum',
      'CheckBox': 'enum'
    };
    const OptionsForRow: optionsType[] = [];

    if (OtherContentType?.label && contentTypesList) {
      const ContentType: any = contentTypesList?.find(
        ({ title }) => title === OtherContentType?.label
      );
      setContentTypeSchema(ContentType?.schema)
    }
    
    if (contentTypeSchema && validateArray(contentTypeSchema)) {
      const fieldTypeToMatch = fieldsOfContentstack[data?.otherCmsType as keyof Mapping];
      
      contentTypeSchema.forEach((value) => {     
        switch (fieldTypeToMatch) {
          case 'text':
            if (
              value?.uid === 'title' &&
              !value?.field_metadata?.multiline &&
              !value?.enum &&
              !value?.field_metadata?.allow_rich_text &&
              !value?.field_metadata?.markdown
            ) {
              OptionsForRow.push({ label: value?.display_name, value: value, isDisabled: false });
            }
            break;
          case 'multiline':
            if (value?.field_metadata?.multiline === true) {
              OptionsForRow.push({ label: value?.display_name, value: value, isDisabled: false });
            }
            break;
          case 'url':
            if (value?.uid === 'url') {
              OptionsForRow.push({ label: value?.display_name, value: value, isDisabled: false });
            }
            break;
          case 'file':
            if (value?.data_type === 'file') {
              OptionsForRow.push({ label: value?.display_name, value: value, isDisabled: false });
            }
            break;
          case 'number':
            if (value?.data_type === 'number' && !value?.enum) {
              OptionsForRow.push({ label: value?.display_name, value: value, isDisabled: false });
            }
            break;
          case 'isodate':
            if (value?.data_type === 'isodate') {
              OptionsForRow.push({ label: value?.display_name, value: value, isDisabled: false });
            }
            break;
          case 'json':
            if (value?.data_type === 'json') {
              OptionsForRow.push({ label: value?.display_name, value: value, isDisabled: false });
            }
            break;
          case 'enum':
            if ('enum' in value) {
              OptionsForRow.push({ label: value?.display_name, value: value, isDisabled: false });
            }
            break;
          case 'allow_rich_text':
            if (value?.field_metadata?.allow_rich_text === true) {
              OptionsForRow.push({ label: value?.display_name, value: value, isDisabled: false });
            }
            break;
          case 'Group':
            if (value?.data_type === 'group') {
              OptionsForRow.push({ label: value?.display_name, value: value, isDisabled: false });
            }
            break;
          case 'reference':
            if (value?.data_type === 'reference') {
              OptionsForRow.push({ label: value?.display_name, value: value, isDisabled: false });
            }
            break;

          default:
            OptionsForRow.push({
              label: 'No matches found',
              value: { 'No matches found': '' },
              isDisabled: false
            });
            break;
        }
      });
    }

    const selectedOption = OptionsForRow?.length;

    const OptionValue: FieldTypes =
      OptionsForRow?.length === 0
        ? { 
          label: data?.ContentstackFieldType, 
          value: data?.ContentstackFieldType, 
          isDisabled: data?.ContentstackFieldType === 'group' ||
          data?.ContentstackFieldType === 'text' ||
          data?.ContentstackFieldType === 'url' 
        }
        : { label: `${selectedOption} matches`, value: `${selectedOption} matches` };

    const adjustedOptions = OptionsForRow.map((option: optionsType) => ({
      ...option,
      isDisabled: selectedOptions?.includes(option?.label ?? '')
    }));

    return (
      <div className="table-row">
        <div className="select">
          <Select
            value={exstingField[data?.uid] || OptionValue}
            onChange={(selectedOption: FieldTypes) => handleFieldChange(selectedOption, data?.uid)}
            placeholder="Select Field"
            version={'v2'}
            maxWidth="290px"
            isClearable={false}
            options={adjustedOptions}
            isDisabled={
              OptionValue?.isDisabled
            }
          />
        </div>
        {!OptionValue?.isDisabled && (
          <Icon
            version="v2"
            icon="Setting"
            size="small"
            onClick={() => {
              // const value = {
              //   ValidationRegex: data?.advanced?.ValidationRegex,
              //   Mandatory: data?.advanced?.mandatory,
              //   Multiple: data?.advanced?.multiple,
              //   Unique: data?.advanced?.unique,
              //   NonLocalizable: data?.advanced?.nonLocalizable
              // };
              handleAdvancedSetting(data?.ContentstackFieldType, advancePropertise, data?.uid, data);
            }}
          />
        )}
      </div>
    );
  };

  const handleSaveContentType = async () => {
    const orgId = selectedOrganisation?.uid;
    const projectID = projectId;

    if (
      selectedContentType &&
      OtherContentType &&
      selectedContentType?.otherCmsUid &&
      OtherContentType?.label
    ) {
      setcontentTypeMapped((prevSelected) => ({
        ...prevSelected,
        [otherCmsTitle]: OtherContentType?.label
      }));

      const newMigrationDataObj: INewMigration = {
        ...newMigrationData,
        content_mapping: {
          content_type_mapping: contentTypeMapped
        }
      };

      dispatch(updateNewMigrationData((newMigrationDataObj)));
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
      const { data, status } = await updateContentType(
        orgId,
        projectID,
        selectedContentType?.id ?? '',
        dataCs
      );

      if (status == 200) {
        Notification({
          notificationContent: { text: 'Content type saved successfully' },
          notificationProps: {
            position: 'bottom-center',
            hideProgressBar: false
          },
          type: 'success'
        });
        setisDropDownCHanged(false);
        setisContentTypeMapped(true);
        setisContentTypeSaved(true);

        // const savedCTArray: SavedContentType = {}
        // data.updatedContentType.otherCmsTitle = true
        // // savedCTArray = data?.updatedContentType;
        // setSavedContentType(data?.updatedContentType?.otherCmsTitle)

        setFilteredContentTypes(filteredContentTypes?.map(ct => 
          ct?.id === data?.updatedContentType?.id ? { ...ct, status: data?.updatedContentType?.status } : ct
        ))
      } else {
        Notification({
          notificationContent: { text: data?.error?.message },
          notificationProps: {
            position: 'bottom-center',
            hideProgressBar: false
          },
          type: 'error'
        });
      }
    }
  };

  const handleResetContentType = async () => {
    const orgId = newMigrationData?.destination_stack?.selectedOrg?.uid;
    const projectID = projectId;
    setisDropDownCHanged(false);

    const updatedRows = tableData.map((row) => {
      return { ...row, ContentstackFieldType: row.backupFieldType };
    });
    setTableData(updatedRows);
    const dataCs = {
      contentTypeData: {
        id: selectedContentType?.id,
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
        selectedContentType?.id || '',
        dataCs
      );
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
    if (OtherContentType?.label === "Select Content Type") {
      Notification({
        notificationContent: { text: "Please Select a Content Type to fetch." },
        notificationProps: {
          position: 'bottom-center',
          hideProgressBar: false
        },
        type: 'error'
      });
    } else {
      const { data } = await fetchExistingContentType(projectId, OtherContentType?.id || '');
      setContentTypeSchema(data?.schema)
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

  if (!IsEmptyStack) {
    columns?.push({
      disableSortBy: true,
      Header: `Contentstack: ${OtherContentType?.label ?? ''}`,
      // accessor: 'ct_field',
      accessor: SelectAccessorOfColumn,
      id: 'contentstack_field',
      default: false
    });
  } else {
    columns?.push({
      disableSortBy: true,
      Header: `Contentstack: ${IsEmptyStack ? otherCmsTitle : OtherContentType?.label ?? ''}`,
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
  const handleContentTypeFilter = (value: string, e: React.MouseEvent<HTMLElement>) => {
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
    if (!ref.current?.contains(evt.target as Node)) {
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
   
  return (
    <div className="step-container">
      <div className="d-flex flex-wrap table-container">
        {/* Content Types List */}
        <div className="content-types-list-wrapper">
          <div className="content-types-list-header d-flex align-items-center justify-content-between">
            {contentTypesHeading && <h2>{contentTypesHeading}</h2> }
            {contentTypes && validateArray(contentTypes) &&  count }
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
                <div className='filter-wrapper' ref={ref}> 
                  <ul>
                    {Object.keys(CONTENT_MAPPING_STATUS).map((key, keyInd) => (
                      <>
                      <li key={`${keyInd?.toString()}`} onClick={(e) => handleContentTypeFilter(CONTENT_MAPPING_STATUS[key], e)}>
                        {CONTENT_MAPPING_STATUS[key] && <span className='filter-status'>{CONTENT_MAPPING_STATUS[key]}</span> }
                        {STATUS_ICON_Mapping[key] && <Icon size="small" icon={STATUS_ICON_Mapping[key]} className={STATUS_ICON_Mapping[key] === 'CheckedCircle' ? 'mapped-icon' : ''} />}
                      </li>  
                      </>
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
                  
                  return (
                    <li
                      key={`${index.toString()}`}
                      className={`${active == index ? 'active-ct' : ''}`}
                      onClick={() => openContentType(index)}
                      onKeyDown={() => openContentType(index)}
                    >
                      <div className='cms-title'>
                        <Tooltip content={content?.type} position="bottom">
                          {content?.type === "content_type" 
                            ? <Icon icon={active == index ? "ContentModelsMediumActive" : "ContentModelsMedium"} size="small"  />
                            : <Icon icon={active == index ? "GlobalFieldsMediumActive" : "GlobalFieldsMedium"} size="small" />
                          }
                        </Tooltip>
                        {content?.otherCmsTitle && <span>{content?.otherCmsTitle}</span> }
                      </div>
                      
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
                            <Icon icon="LivePreview" version="v2" onClick={() => handleSchemaPreview(content?.otherCmsTitle)} />
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
              uniqueKey={'id' || ''}
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
              initialRowSelectedData={tableData}
              initialSelectedRowIds={rowIds}
              itemSize={80}
              withExportCta={{
                component: (
                  <div className='d-flex align-items-center' style={{ gap: '8px' }}>
                    {!IsEmptyStack && (
                      <Tooltip content={'fetch the content type'} position="left">
                        <Icon icon="FetchTemplate" size="small" version="v2" onClick={handleFetchContentType} />
                      </Tooltip>
                    )}

                    <Tooltip content={'Reset to intial mapping'} position="left">
                      <Icon
                        icon="ResetReverse"
                        size="small"
                        version="v2"
                        onClick={handleResetContentType}
                      />
                    </Tooltip>

                    {!IsEmptyStack && (
                      <div className="d-flex justify-content-end">
                        <Select
                          value={OtherContentType}
                          onChange={handleDropDownChange}
                          options={adjustedOption}
                          width="440px"
                          maxWidth="440px"
                          placeholder={OtherContentType && 'Select content type from existing stack'}
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
};

export default ContentMapper;
