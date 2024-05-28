// Libraries
import { useEffect, useState, useContext } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Heading,
  InfiniteScrollTable,
  Select,
  ButtonGroup,
  Button,
  Search,
  Icon,
  Tooltip,
  Notification,
  cbModal,
  InstructionText,
  ModalHeader,
  ModalBody,
  ModalFooter
} from '@contentstack/venus-components';
import { jsonToHtml } from '@contentstack/json-rte-serializer';
import HTMLReactParser from 'html-react-parser';

// Services
import { getCMSDataFromFile } from '../../cmsData/cmsSelector';
import {
  getContentTypes,
  getFieldMapping,
  getExistingContentTypes,
  updateContentType,
  resetToInitialMapping,
  createTestStack,
  fetchExistingContentType
} from '../../services/api/migration.service';
import { getStackStatus } from '../../services/api/stacks.service';

// Utilities
import { CS_ENTRIES } from '../../utilities/constants';
import { validateArray } from '../../utilities/functions';

// Context
import { AppContext } from '../../context/app/app.context';

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
  Advanced
} from './contentMapper.interface';
import { ItemStatusMapProp } from '@contentstack/venus-components/build/components/Table/types';
import { ModalObj } from '../Modal/modal.interface';

// Components
import SchemaModal from '../SchemaModal';
import AdvanceSettings from '../AdvancePropertise';

// Styles
import './index.scss';

const Fields: Mapping = {
  'Single Line Textbox': [
    'Single Line Textbox',
    'Multi Line Textbox',
    'HTML Rich text Editor',
    'JSON Rich Text Editor'
  ],
  'text': [
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
  'HTML Rich text Editor': 'JSON Rich Text Editor',
  'JSON Rich Text Editor': 'JSON Rich Text Editor',
  json: 'JSON Rich Text Editor',
  URL: 'URL',
  file: 'File',
  number: 'Number',
  Date: 'Date',
  boolean: 'Boolean',
  link: 'Link',
  reference: 'Reference',
  dropdown: 'Select',
  radio: 'Select',
  CheckBox: 'Select',
  global_field: 'Global'
};

interface ModalProps {
  e: React.MouseEvent<HTMLElement>;
  newIndex: number;
  closeModal: () => void;
}
const ContentMapper = () => {
  /** ALL CONTEXT HERE */
  const {
    migrationData,
    updateMigrationData,
    newMigrationData,
    updateNewMigrationData,
    selectedOrganisation
  } = useContext(AppContext);

  const {
    contentMappingData: {
      content_types_heading: contentTypesHeading,
      description,
      action_cta: actionCta,
      cta,
      search_placeholder: searchPlaceholder
    }
  } = migrationData;

  const parseDescription = HTMLReactParser(jsonToHtml(description ?? {}));

  const [tableData, setTableData] = useState<FieldMapType[]>([]);
  const [loading, setLoading] = useState(false);
  const [itemStatusMap, updateItemStatusMap] = useState({});
  const [totalCounts, setTotalCounts] = useState<number>(tableData?.length);
  const [fieldValue, setFieldValue] = useState<FieldTypes>();
  const [currentIndex, setCurrentIndex] = useState(0);

  const [searchText, setSearchText] = useState('');
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [otherCmsTitle, setOtherCmsTitle] = useState(contentTypes[0]?.otherCmsTitle);
  const [contentTypeUid, setContentTypeUid] = useState<string>('');
  const [contentTypesList, setContentTypesList] = useState<ContentTypeList[]>([]);
  const [IsEmptyStack, setIsEmptyStack] = useState(false);
  const [selectedContentType, setSelectedContentType] = useState<ContentType>();
  const [exstingField, setexsitingField] = useState<ExistingFieldType>({});
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isButtonLoading, setisButtonLoading] = useState(false);
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

  /** ALL HOOKS Here */
  const { projectId = '' } = useParams();
  const navigate = useNavigate();

  /********** ALL USEEFFECT HERE *************/
  useEffect(() => {
    //check if offline CMS data field is set to true, if then read data from cms data file.
    getCMSDataFromFile(CS_ENTRIES.CONTENT_MAPPING)
      .then((data) => {
        //Check for null
        if (!data) {
          updateMigrationData({ contentMappingData: DEFAULT_CONTENT_MAPPING_DATA });
        }

        updateMigrationData({ contentMappingData: data });
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
        label: contentTypeMapped?.[otherCmsTitle] ?? 'Select Content Type',
        value: contentTypeMapped?.[otherCmsTitle] ?? 'Select Content Type'
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

  // Method to fetch content types
  const fetchContentTypes = async (searchText: string) => {
    const { data } = await getContentTypes(projectId || '', 0, 10, searchContentType || ''); //org id will always present

    setContentTypes(data?.contentTypes);
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

    const { data } = await getContentTypes(projectId, 0, 5, searchCT || ''); //org id will always present

    setContentTypes(data?.contentTypes);
    setSelectedContentType(data?.contentTypes?.[0]);
    setTotalCounts(data?.contentTypes?.[0]?.fieldMapping?.length);
    setOtherCmsTitle(data?.contentTypes?.[0]?.otherCmsTitle);
    setContentTypeUid(data?.contentTypes?.[0]?.id);
    fetchFields(data?.contentTypes[0]?.id, searchText || '');
  };

  // Method to get fieldmapping
  const fetchFields = async (contentTypeId: string, searchText: string) => {
    const { data } = await getFieldMapping(contentTypeId, 0, 30, searchText || '');

    try {
      const itemStatusMap: ItemStatusMapProp = {};

      for (let index = 0; index <= 30; index++) {
        itemStatusMap[index] = 'loading';
      }

      updateItemStatusMap(itemStatusMap);

      setLoading(true);

      for (let index = 0; index <= 30; index++) {
        itemStatusMap[index] = 'loaded';
      }

      updateItemStatusMap({ ...itemStatusMap });
      setLoading(false);
      setTableData(data?.fieldMapping || []);
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

      const { data } = await getFieldMapping(contentTypeUid, skip, limit, searchText || '');

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

  // Method to change the content type
  const openContentType = (e: React.MouseEvent<HTMLElement>, i: number) => {
    setActive(i);

    const otherTitle = contentTypes?.[i]?.otherCmsTitle;
    setOtherCmsTitle(otherTitle);
    const option = contentTypeMapped?.[otherTitle] ?? 'Select Content Type';
    setOtherContentType({ label: option, value: option });

    setContentTypeUid(contentTypes?.[i]?.id);
    setCurrentIndex(i);
    fetchFields(contentTypes?.[i]?.id, searchText || '');
    setotherCmsUid(contentTypes?.[i]?.otherCmsUid);
    setSelectedContentType(contentTypes?.[i]);
  };

  //function to handle previous content type navigation
  const handlePrevClick = (e: React.MouseEvent<HTMLElement>) => {
    const newIndex = currentIndex > 0 ? currentIndex - 1 : 0;
    if (isDropDownChanged) {
      handleSaveContentTypeModal(e, newIndex);
    } else {
      setCurrentIndex(newIndex);
      openContentType(e, newIndex);
      document.querySelectorAll('.ct-list li').forEach((ctLi, ind) => {
        if (newIndex === ind) {
          ctLi?.classList?.add('active-ct');
        }
      });
    }
  };

  // function to handle next content type navigation
  const handleNextClick = (e: React.MouseEvent<HTMLElement>) => {
    if (currentIndex < contentTypes?.length - 1) {
      const newIndex = currentIndex + 1;

      if (isDropDownChanged) {
        handleSaveContentTypeModal(e, newIndex);
      } else {
        setCurrentIndex(newIndex);
        openContentType(e, newIndex);
        document.querySelectorAll('.ct-list li').forEach((ctLi, ind) => {
          if (newIndex === ind) {
            ctLi?.classList?.add('active-ct');
          }
        });
      }
    }
  };
  const SaveContentType = (props: ModalProps) => {
    return (
      <>
        <ModalHeader title={'Save changes'} closeModal={props?.closeModal} />
        <ModalBody>
          <p>Hey there! You have unsaved changes on this page.</p>
        </ModalBody>
        <ModalFooter>
          <ButtonGroup>
            <Button buttonType="light" onClick={() => props?.closeModal()}>
              Cancel
            </Button>
            <Button
              buttonType="secondary"
              onClick={() => {
                setCurrentIndex(props?.newIndex);
                setisDropDownCHanged(false);
                openContentType(props?.e, props?.newIndex);
                props?.closeModal();
                document.querySelectorAll('.ct-list li').forEach((ctLi, ind) => {
                  if (props.newIndex === ind) {
                    ctLi?.classList?.add('active-ct');
                  }
                });
              }}
            >
              Dont&apos;s Save
            </Button>
            <Button
              onClick={() => {
                handleSaveContentType();
                props?.closeModal();
              }}
            >
              Save
            </Button>
          </ButtonGroup>
        </ModalFooter>
      </>
    );
  };
  const handleSaveContentTypeModal = (e: any, newIndex: number) => {
    return cbModal({
      component: (props: ModalObj) => <SaveContentType e={e} newIndex={newIndex} {...props} />,
      modalProps: {
        shouldCloseOnOverlayClick: true,
        size: 'small'
      }
    });
  };

  // Function to get exisiting content types list
  const fetchExistingContentTypes = async () => {
    const { data, status } = await getExistingContentTypes(projectId);
    if (status === 201) {
      setContentTypesList(data?.contentTypes);
    }
  };

  const updateFieldSettings = (rowId: string, updatedSettings: any, checkBoxChanged: boolean) => {
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

  const handleOnClick = (title: string) => {
    return cbModal({
      component: (props: ModalObj) => (
        <SchemaModal
          schemaData={tableData}
          contentType={title}
          // closeModal={() => {
          //   return;
          // }}
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
          Other CMS Type: {data?.otherCmsType}
          <br />
          UID: {data?.uid}
        </InstructionText>
      </div>
    );
  };

  // Function to handle selected fields
  const handleSelectedEntries = (singleSelectedRowIds: UidMap[], selectedData: FieldMapType[]) => {
    const selectedObj: UidMap = {};

    singleSelectedRowIds.forEach((uid: any) => {
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
    setisDropDownCHanged(true);
    setFieldValue(value);
    const updatedRows = tableData?.map((row) => {
      if (row?.uid === rowIndex) {
        return { ...row, ContentstackFieldType: value?.value };
      }
      return row;
    });
    setTableData(updatedRows);
  };

  const handleDropDownChange = (value: FieldTypes) => {
    setOtherContentType(value);
    // fetchFields(contentTypes?.[i]?.id, searchText);
  };

  const handleAdvancedSetting = (fieldtype: string, fieldvalue: Advanced, rowId: string, data: FieldMapType) => {
    // console.log("fieldvalue", data);
    
    return cbModal({
      component: (props: ModalObj) => (
        <AdvanceSettings
          rowId={rowId}
          value={fieldvalue}
          fieldtype={fieldtype}
          isLocalised={isLocalised}
          updateFieldSettings={updateFieldSettings}
          data={data}
          {...props}
        />
      ),
      modalProps: {
        shouldCloseOnOverlayClick: true
      }
    });
  };

  const handleValidateOnClick = async () => {
    setisButtonLoading(true);
    const data = {
      name: newMigrationData?.destination_stack?.selectedStack?.label,
      description: 'test migration stack',
      master_locale: newMigrationData?.destination_stack?.selectedStack?.master_locale
    };
    const res = await createTestStack(
      newMigrationData?.destination_stack?.selectedOrg?.value,
      projectId,
      data
    );
    const newMigrationDataObj: INewMigration = {
      ...newMigrationData,
      test_migration: { stack_link: res?.data?.data?.url }
    };

    updateNewMigrationData(newMigrationDataObj);
    if (res?.status) {
      setisButtonLoading(false);
      const url = `/projects/${projectId}/migration/steps/4`;
      navigate(url, { replace: true });
    }
  };

  const SelectAccessor = (data: FieldMapType) => {
    const OptionsForRow = Fields[data?.backupFieldType as keyof Mapping];

    // console.log("OptionsForRow", OptionsForRow, Fields[data?.backupFieldType], data);
    

    const option = Array.isArray(OptionsForRow)
      ? OptionsForRow.map((option) => ({ label: option, value: option }))
      : [{ label: OptionsForRow, value: OptionsForRow }];

    return (
      <div className="table-row">
        <div className="select">
          <Select
            id={data?.uid}
            value={{ label: data?.ContentstackFieldType, value: fieldValue }}
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
                handleAdvancedSetting(data?.ContentstackFieldType, data?.advanced, data?.uid, data)
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
      URL: 'url',
      file: 'file',
      number: 'number',
      Date: 'isodate',
      boolean: 'boolean',
      link: 'link',
      reference: 'reference',
      dropdown: 'enum',
      radio: 'enum',
      CheckBox: 'enum'
    };
    const OptionsForRow: optionsType[] = [];
    // let ContentTypeSchema: ContentTypesSchema | undefined;

    if (OtherContentType?.label && contentTypesList) {
      const ContentType: any = contentTypesList?.find(
        ({ title }) => title === OtherContentType?.label
      );
      setContentTypeSchema(ContentType?.schema)
    }

    if (contentTypeSchema && validateArray(contentTypeSchema)) {
      const fieldTypeToMatch = fieldsOfContentstack[data?.otherCmsType as keyof Mapping];
      // console.log("fieldTypeToMatch", contentTypeSchema, fieldsOfContentstack, data?.backupFieldType);
      
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
          // case 'Group':
          //   if (value?.data_type === 'group') {
          //     OptionsForRow.push({ label: value?.display_name, value: value, isDisabled: false });
          //   }
          //   break;
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
        ? { label: 'No matches found', value: 'No matches found' }
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
          />
        </div>
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

      updateNewMigrationData(newMigrationDataObj);
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
          contentstackUid: selectedContentType?.contnetStackUid,
          fieldMapping: selectedEntries
        }
      };

      const { data, status } = await updateContentType(
        orgId,
        projectID,
        selectedContentType.id,
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
        contentstackUid: selectedContentType?.contnetStackUid,
        fieldMapping: updatedRows
      }
    };
    if (orgId && selectedContentType) {
      const { status } = await resetToInitialMapping(
        orgId,
        projectID,
        selectedContentType.id,
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
  const nextButtonLabel =
    currentIndex < contentTypes?.length - 1 ? contentTypes[currentIndex + 1]?.otherCmsTitle : '';

  const prevButtonLabel = currentIndex > 0 ? contentTypes[currentIndex - 1]?.otherCmsTitle : '';

  const options = contentTypesList?.map((item) => ({
    label: item?.title,
    value: item?.title,
    id: item?.uid,
    isDisabled: false
  }));

  const adjustedOption = options.map((option: any) => ({
    ...option,
    isDisabled: contentTypeMapped && Object.values(contentTypeMapped).includes(option?.label)
  }));

  // const itemSize = tableData?.forEach((data) => {
  //   return data?.uid?.length > 80 ? 130 : 90
  //   console.log("data?.uid", data?.uid?.length);
    
  // })

  // console.log("itemSize", itemSize);
  

  return (
    <div className="step-container">
      <div className="d-flex flex-wrap table-container">
        {/* Content Types List */}
        <div className="content-types-list-wrapper">
          <div className="content-types-list-header">
            <Heading tagName="h6" text={contentTypesHeading} />
            <p>{parseDescription}</p>

            <Search
              placeholder={searchPlaceholder}
              type="secondary"
              version="v2"
              onChange={(search: string) => handleSearch(search)}
              onClear={true}
              value={searchContentType}
              debounceSearch={true}
            />
          </div>

          {contentTypes && validateArray(contentTypes) && (
            <ul className="ct-list">
              {contentTypes?.map((content: ContentType, index: number) => (
                <li
                  key={`${index.toString()}`}
                  className={`${active == index ? 'active-ct' : ''}`}
                  onClick={(e) => openContentType(e, index)}
                >
                  <span>{content?.otherCmsTitle}</span>

                  {active == index && (
                    <span>
                      <Tooltip content={'Schema Preview'} position="left">
                        <Icon
                          icon="LivePreview"
                          size="small"
                          version="v2"
                          onClick={() => handleOnClick(content?.otherCmsTitle)}
                        />
                      </Tooltip>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Content Type Fields */}
        <div className="content-types-fields-wrapper">
          {!IsEmptyStack && (
            <div className="d-flex justify-content-end content-type-list">
              <Select
                value={OtherContentType}
                onChange={handleDropDownChange}
                options={adjustedOption}
                width="345px"
                maxWidth="345px"
                placeholder={OtherContentType && 'Select Contentstack Content Type'}
                version="v2"
              />
            </div>
          )}

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
              searchPlaceholder={searchPlaceholder}
              fetchTableData={fetchData}
              loadMoreItems={loadMoreItems}
              tableHeight={IsEmptyStack ? 495 : 465}
              equalWidthColumns={true}
              columnSelector={false}
              initialRowSelectedData={tableData}
              initialSelectedRowIds={rowIds}
              itemSize={130}
              withExportCta={{
                component: (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <Tooltip content={'Reset to intial mapping'} position="left">
                      <Icon
                        icon="ResetReverse"
                        size="small"
                        version="v2"
                        onClick={handleResetContentType}
                      />
                    </Tooltip>

                    {!IsEmptyStack && (
                      <Tooltip content={'fetch the content type'} position="left">
                        <Icon icon="FetchTemplate" size="small" version="v2" onClick={handleFetchContentType} />
                      </Tooltip>
                    )}
                  </div>
                ),
                showExportCta: true
              }}
              getSelectedRow={handleSelectedEntries}
              rowSelectCheckboxProp={{ key: '_canSelect', value: true }}
            />
          </div>

          {actionCta && validateArray(actionCta) && (
            <ButtonGroup className="action-btn-wrapper">
              <div
                className="IconStoriesWrapper"
                style={{
                  columns: '4'
                }}
              >
                <div className="flex pt-10 pb-10 hover:text-purple-400" style={{ columnGap: 20 }}>
                  {currentIndex > 0 && (
                    <span
                      onClick={handlePrevClick}
                      className="cursor-pointer"
                      title="Previous Content Type"
                    >
                      <Icon icon="Left" size="tiny" hover={true} />
                      {prevButtonLabel}
                    </span>
                  )}
                </div>
              </div>
              <div className="d-flex">
                <Button
                  className="saveButton"
                  size="medium"
                  buttonType="secondary"
                  onClick={handleSaveContentType}
                >
                  Save
                </Button>

                <div
                  className="IconStoriesWrapper"
                  style={{
                    columns: '4'
                  }}
                >
                  <div
                    className="justify-content-end flex pt-10 pb-10 hover:text-purple-400"
                    style={{ columnGap: 20 }}
                  >
                    {currentIndex < contentTypes.length - 1 && (
                      <span
                        onClick={handleNextClick}
                        className="cursor-pointer"
                        title="Next Content Type"
                      >
                        {nextButtonLabel}
                        <Icon icon="Right" size="tiny" hover={true} />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </ButtonGroup>
          )}
        </div>
      </div>

      {cta?.title && (
        <div className="cta-wrapper">
          <Button
            buttonType={cta?.theme}
            isLoading={isButtonLoading}
            disabled={isDropDownChanged}
            onClick={handleValidateOnClick}
          >
            {cta?.title}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ContentMapper;
