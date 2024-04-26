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
  InstructionText
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
  createTestStack
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
  optionsType
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
  'Multi Line Textbox': ['Multi Line Textbox', 'HTML Rich text Editor', 'JSON Rich Text Editor'],
  'HTML Rich text Editor': 'JSON Rich Text Editor',
  'JSON Rich Text Editor': 'JSON Rich Text Editor',
  URL: 'URL',
  file: 'File',
  number: 'Number',
  Date: 'Date',
  boolean: 'Boolean',
  link: 'Link',
  reference: 'Reference',
  dropdown: 'Select',
  radio: 'Select',
  CheckBox: 'Select'
};

const ContentMapper = () => {
  /** ALL CONTEXT HERE */
  const { migrationData, updateMigrationData, newMigrationData, updateNewMigrationData } =
    useContext(AppContext);

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
  const [OtherContentType, setOtherContentType] = useState<FieldTypes>();
  const [exstingField, setexsitingField] = useState<ExistingFieldType>({});
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isButtonLoading, setisButtonLoading] = useState(false);

  const [active, setActive] = useState<number>(null ?? 0);

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

    tableData?.forEach((field) => {
      if (field?.otherCmsField === 'title' || field?.otherCmsField === 'url') {
        field._invalid = true;
      }
    });
  }, []);

  // Method to fetch content types
  const fetchContentTypes = async (searchText: string) => {
    const { data } = await getContentTypes(projectId || '', 0, 10, ''); //org id will always present

    setContentTypes(data?.contentTypes);
    setSelectedContentType(data?.contentTypes?.[0]);
    setTotalCounts(data?.contentTypes?.[0]?.fieldMapping?.length);
    setOtherCmsTitle(data?.contentTypes?.[0]?.otherCmsTitle);
    setContentTypeUid(data?.contentTypes?.[0]?.id);
    fetchFields(data?.contentTypes?.[0]?.id, searchText);
  };
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
  const handleSearch = async (search: string) => {
    setSearchText(search);
    const { data } = await getContentTypes(projectId, 0, 5, search); //org id will always present
    setContentTypes(data?.contentTypes);
    setContentTypeUid(data?.contentTypes[0]?.id);
    fetchFields(data?.contentTypes[0]?.id, searchText);
  };

  // Method to get fieldmapping
  const fetchFields = async (contentTypeId: string, searchText: string) => {
    const { data } = await getFieldMapping(contentTypeId, 0, 30, searchText);

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
    fetchContentTypes(searchText);
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
    setOtherCmsTitle(contentTypes?.[i]?.otherCmsTitle);
    setContentTypeUid(contentTypes?.[i]?.id);
    setCurrentIndex(i);
    fetchFields(contentTypes?.[i]?.id, searchText);
  };

  //function to handle previous content type navigation
  const handlePrevClick = (e: React.MouseEvent<HTMLElement>) => {
    const newIndex = currentIndex > 0 ? currentIndex - 1 : 0;
    setCurrentIndex(newIndex);
    openContentType(e, newIndex);
    document.querySelectorAll('.ct-list li').forEach((ctLi, ind) => {
      if (newIndex === ind) {
        ctLi?.classList?.add('active-ct');
      }
    });
  };

  // function to handle next content type navigation
  const handleNextClick = (e: React.MouseEvent<HTMLElement>) => {
    if (currentIndex < contentTypes?.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      openContentType(e, newIndex);
      document.querySelectorAll('.ct-list li').forEach((ctLi, ind) => {
        if (newIndex === ind) {
          ctLi?.classList?.add('active-ct');
        }
      });
    }
  };

  // Function to get exisiting content types list
  const fetchExistingContentTypes = async () => {
    const { data, status } = await getExistingContentTypes(projectId);
    if (status === 201) {
      setContentTypesList(data?.contentTypes);
    }
  };

  // const handleDropDownChange = (value: ContentType) => {
  //   setSelectedContentType(value);
  // };

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
        <div className='cms-field'>{data?.otherCmsField}</div>
        <InstructionText>
          Other CMS Type: {data?.otherCmsType}<br />
          UID: {data?.uid} 
        </InstructionText>
      </div>
    )
  };
  interface UidMap {
    [key: string]: boolean;
  }
  const rowIds = tableData.reduce<UidMap>((acc, item) => {
    acc[item.id] = true;
    return acc;
  }, {});

  // Method for change select value
  const handleValueChange = (value: FieldTypes, rowIndex: string) => {
    setFieldValue(value);
    const updatedRows = tableData.map((row) => {
      if (row.uid === rowIndex) {
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

  const handleAdvancedSetting = (fieldtype: string) => {
    return cbModal({
      component: (props: ModalObj) => <AdvanceSettings fieldtype={fieldtype} {...props} />,
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
      master_locale: newMigrationData?.destination_stack?.selectedStack?.locale
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
          />
        </div>
        <Icon
          version="v2"
          icon="Setting"
          size="small"
          onClick={() => handleAdvancedSetting(data?.ContentstackFieldType)}
        />
      </div>
    );
  };

  const handleFieldChange = (selectedValue: FieldTypes, rowIndex: string) => {
    setexsitingField((prevOptions) => ({
      ...prevOptions,
      [rowIndex]: { label: selectedValue?.label, value: selectedValue?.value }
    }));

    setSelectedOptions((prevSelected) => {
      const newValue = selectedValue?.label;
      return prevSelected.includes(newValue) ? prevSelected : [...prevSelected, newValue];
    });

    const updatedRows = tableData.map((row) => {
      if (row.uid === rowIndex) {
        return { ...row, contentstackField: selectedValue?.label };
      }
      return row;
    });
    setTableData(updatedRows);
  };

  const SelectAccessorOfColumn = (data: FieldMapType) => {
    const fieldsOfContentstack: Mapping = {
      'Single Line Textbox': 'text',
      'Multi Line Textbox': 'multiline',
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
    let ContentTypeSchema: ContentTypesSchema | undefined;

    if (OtherContentType?.label && contentTypesList) {
      const ContentType: any = contentTypesList?.find(
        ({ title }) => title === OtherContentType?.label
      );

      ContentTypeSchema = ContentType?.schema;
    }
    if (ContentTypeSchema && typeof ContentTypeSchema === 'object') {
      const fieldTypeToMatch = fieldsOfContentstack[data?.backupFieldType as keyof Mapping];
      Object.entries(ContentTypeSchema).forEach(([key, value]) => {
        switch (fieldTypeToMatch) {
          case 'text':
            if (
              value?.uid === 'title' &&
              !value?.field_metadata?.multiline &&
              !value?.enum &&
              !value?.field_metadata?.allow_rich_text &&
              !value?.field_metadata?.markdown
            ) {
              OptionsForRow.push({ label: value?.display_name, value: key, isDisabled: false });
            }
            break;
          case 'multiline':
            if (value?.field_metadata?.multiline === true) {
              OptionsForRow.push({ label: value?.display_name, value: key, isDisabled: false });
            }
            break;
          case 'url':
            if (value?.uid === 'url') {
              OptionsForRow.push({ label: value?.display_name, value: key, isDisabled: false });
            }
            break;
          case 'file':
            if (value?.data_type === 'file') {
              OptionsForRow.push({ label: value?.display_name, value: key, isDisabled: false });
            }
            break;
          case 'number':
            if (value?.data_type === 'number' && !value?.enum) {
              OptionsForRow.push({ label: value?.display_name, value: key, isDisabled: false });
            }
            break;
          case 'isodate':
            if (value?.data_type === 'isodate') {
              OptionsForRow.push({ label: value?.display_name, value: key, isDisabled: false });
            }
            break;
          case 'json':
            if (value?.data_type === 'json') {
              OptionsForRow.push({ label: value?.display_name, value: key, isDisabled: false });
            }
            break;
          case 'enum':
            if ('enum' in value) {
              OptionsForRow.push({ label: value?.display_name, value: key, isDisabled: false });
            }
            break;
          case 'allow_rich_text':
            if (value?.field_metadata?.allow_rich_text === true) {
              OptionsForRow.push({ label: value?.display_name, value: key, isDisabled: false });
            }
            break;
          default:
            OptionsForRow.push({
              label: 'No matches found',
              value: 'No matches found',
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
    );
  };
  const handleSaveContentType = async () => {
    const orgId = newMigrationData?.destination_stack?.selectedOrg?.uid;
    const projectID = projectId;

    if (orgId && contentTypeUid && selectedContentType) {
      const dataCs = {
        contentTypeData: {
          id: selectedContentType?.id,
          otherCmsTitle: 'Blog',
          otherCmsUid: 'blog',
          isUpdated: true,
          updateAt: new Date(),
          contentstackTitle: contentTypeUid,
          contentstackUid: contentTypeUid,
          fieldMapping: tableData
        }
      };

      const { status } = await updateContentType(orgId, projectID, selectedContentType.id, dataCs);
      if (status == 200) {
        Notification({
          notificationContent: { text: 'Content type saved successfully' },
          notificationProps: {
            position: 'bottom-center',
            hideProgressBar: false
          },
          type: 'success'
        });
      }
    }
  };

  const handleResetContentType = async () => {
    const orgId = newMigrationData?.destination_stack?.selectedOrg?.uid;
    const projectID = projectId;

    const updatedRows = tableData.map((row) => {
      return { ...row, ContentstackFieldType: row.backupFieldType };
    });
    setTableData(updatedRows);
    const dataCs = {
      contentTypeData: {
        id: selectedContentType?.id,
        otherCmsTitle: 'Blog',
        otherCmsUid: 'blog',
        isUpdated: true,
        updateAt: new Date(),
        contentstackTitle: contentTypeUid,
        contentstackUid: contentTypeUid,
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
      Header: `Contentstack: ${newMigrationData?.destination_stack?.selectedStack?.label}`,
      // accessor: 'ct_field',
      accessor: SelectAccessorOfColumn,
      id: 'contentstack_field',
      default: false
    });
  } else {
    columns?.push({
      disableSortBy: true,
      Header: `Contentstack: ${
        IsEmptyStack ? otherCmsTitle : OtherContentType?.label ?? ''
      }`,
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
    value: item?.title
  }));

  // console.log("==============", contentTypesList);

  return (
    <div className="step-container">
      <div className="d-flex flex-wrap table-container">
        {/* Content Types List */}
        <div className="content-types-list-wrapper">
          <div className="content-types-list-header">
            <Heading tagName="h6" text={contentTypesHeading} />
            {/* <Paragraph text={parseDescription} tagName='div' /> */}
            <p>{parseDescription}</p>

            <Search
              placeholder={searchPlaceholder}
              type="secondary"
              version="v2"
              onChange={(search: string) => handleSearch(search)}
              onClear={true}
              value={searchText}
              debounceSearch={true}
            />
          </div>

          {contentTypes && validateArray(contentTypes) && (
            <ul className="ct-list">
              {contentTypes?.map((content: ContentType, index: number) => (
                <li
                  key={`${index.toString()}`}
                  // className={index === 0 ? 'active-ct' : ''}
                  className={`${active == index && 'active-ct'}`}
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
                options={options}
                width="345px"
                maxWidth="345px"
                placeholder="Select Contentstack Content Type"
                version="v2"
              />
            </div>
          )}

          <div className="table-wrapper">
            <InfiniteScrollTable
              loading={loading}
              canSearch={true}
              data={tableData}
              columns={columns}
              uniqueKey={'id'}
              isRowSelect={true}
              itemStatusMap={itemStatusMap}
              totalCounts={totalCounts}
              searchPlaceholder={searchPlaceholder}
              fetchTableData={fetchData}
              loadMoreItems={loadMoreItems}
              tableHeight={485}
              equalWidthColumns={true}
              columnSelector={false}
              initialRowSelectedData={tableData}
              initialSelectedRowIds={rowIds}
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
                        <Icon icon="FetchTemplate" size="small" version="v2" />
                      </Tooltip>
                    )}
                  </div>
                ),
                showExportCta: true
              }}
              rowDisableProp={{
                key: '_invalid',
                value: true
              }}
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
