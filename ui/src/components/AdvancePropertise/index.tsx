// Libraries
import { useEffect, useRef, useState } from 'react';
import {
  ModalBody,
  ModalHeader,
  Field,
  FieldLabel,
  TextInput,
  ToggleSwitch,
  Tooltip,
  Icon,
  Select,
  Radio,
  Button,
  Tag
} from '@contentstack/venus-components';

// Service
import { getContentTypes } from '../../services/api/migration.service';

// Utilities
import { validateArray } from '../../utilities/functions';

// Interfaces
import { optionsType, SchemaProps } from './advanceProperties.interface';
import { ContentType } from '../ContentMapper/contentMapper.interface';

// Styles
import './index.scss';

interface ContentTypeOption {
  label: string;
  value: string;
}

/**
 * Component for displaying advanced properties.
 * @param props - The schema properties.
 * @returns The rendered component.
 */
const AdvancePropertise = (props: SchemaProps) => {
  // State for toggle states
  const [toggleStates, setToggleStates] = useState({
    minChars: props?.value?.minChars,
    maxChars: props?.value?.maxChars,
    minRange: props?.value?.minRange,
    maxRange: props?.value?.maxRange,
    minSize: props?.value?.minSize,
    maxSize: props?.value?.maxSize,
    defaultValue: props?.value?.defaultValue,
    validationRegex: props?.value?.validationRegex,
    title: props?.value?.title,
    url: props?.value?.url,
    mandatory: props?.value?.mandatory,
    allowImagesOnly: props?.value?.allowImagesOnly,
    nonLocalizable: props?.value?.nonLocalizable,
    embedObject: (props?.value?.embedObjects?.length ?? 0) > 0,
    embedAssests: true,
    multiple: props?.value?.multiple,
    embedObjects: props?.value?.embedObjects,
    default_value: props?.value?.default_value,
    option: props?.value?.options
  });

  const embedObjects = props?.value?.embedObjects?.map((item: string) => ({
    label: item,
    value: item
  }));
  // State for content types
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [ctValue, setCTValue] = useState<ContentTypeOption[] | null>(embedObjects);
  const [embedObjectsLabels, setEmbedObjectsLabels] = useState<string[]>(
    props?.value?.embedObjects
  );
  const [showOptions, setShowOptions] = useState<Record<number, boolean>>({});
  const [showIcon, setShowIcon] = useState<number>();
  const filterRef = useRef<HTMLDivElement | null>(null);
  const [options, setOptions] = useState(props?.value?.options || []);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    const defaultIndex = toggleStates?.option?.findIndex(
      (item: optionsType) => toggleStates?.default_value === item?.key
    );

    if (defaultIndex !== -1) {
      setShowIcon(defaultIndex);
    }
  }, []);
  useEffect(() => {
    fetchContentTypes('');
  }, []);
  /**
   * Fetches the content types list.
   * @param searchText - The search text.
   */
  const fetchContentTypes = async (searchText: string) => {
    try {
      const { data } = await getContentTypes(props?.projectId ?? '', 0, 5000, searchText || ''); //org id will always present

      setContentTypes(data?.contentTypes);
    } catch (error) {
      return error;
    }
  };

  /**
   * Handles the change event for input fields.
   * @param field - The field name.
   * @param event - The change event.
   * @param checkBoxChanged - Indicates if the checkbox was changed.
   */
  const handleOnChange = (
    field: string,
    event: React.ChangeEvent<HTMLInputElement>,
    checkBoxChanged: boolean
  ) => {
    setToggleStates((prevStates) => ({
      ...prevStates,
      [field]: (event.target as HTMLInputElement)?.value
    }));

    const currentToggleStates = {
      ...toggleStates,
      [field]: (event.target as HTMLInputElement)?.value
    };

    props?.updateFieldSettings(
      props?.rowId,
      {
        ...props?.value,
        [field]: (event.target as HTMLInputElement)?.value,
        default_value: currentToggleStates?.default_value,
        validationRegex: currentToggleStates?.validationRegex ?? '',
        minChars: currentToggleStates?.minChars,
        maxChars: currentToggleStates?.maxChars,
        mandatory: currentToggleStates?.mandatory,
        multiple: currentToggleStates?.multiple,
        unique: false,
        nonLocalizable: currentToggleStates?.nonLocalizable,
        embedObject: currentToggleStates?.embedObject,
        embedObjects: embedObjectsLabels,
        minRange: currentToggleStates?.minRange,
        maxRange: currentToggleStates?.maxRange,
        minSize: currentToggleStates?.minSize,
        maxSize: currentToggleStates?.maxSize,
        title: currentToggleStates?.title,
        url: currentToggleStates?.url
      },
      checkBoxChanged
    );
  };

  /**
   * Handles the toggle change event.
   * @param field - The field name.
   * @param value - The new value.
   * @param checkBoxChanged - Indicates if the checkbox was changed.
   */
  const handleToggleChange = (field: string, value: boolean, checkBoxChanged: boolean) => {
    setToggleStates((prevStates) => ({
      ...prevStates,
      [field]: value
    }));
    const currentToggleStates = {
      ...toggleStates,
      [field]: value
    };

    props?.updateFieldSettings(
      props?.rowId,
      {
        ...props?.value,
        [field]: value,
        validationRegex: currentToggleStates?.validationRegex ?? '',
        mandatory: currentToggleStates?.mandatory,
        multiple: currentToggleStates?.multiple,
        unique: false,
        nonLocalizable: currentToggleStates?.nonLocalizable,
        embedObject: currentToggleStates?.embedObject,
        embedObjects: embedObjectsLabels,
        default_value: currentToggleStates?.default_value,
        minChars: currentToggleStates?.minChars,
        maxChars: currentToggleStates?.maxChars,
        minRange: currentToggleStates?.minRange,
        maxRange: currentToggleStates?.maxRange,
        minSize: currentToggleStates?.minSize,
        maxSize: currentToggleStates?.maxSize,
        title: currentToggleStates?.title,
        url: currentToggleStates?.url
      },
      checkBoxChanged
    );
  };

  const handleRadioChange = (field: string, value: boolean) => {
    setToggleStates((prevStates) => ({
      ...prevStates,
      [field]: value
    }));
    const currentToggleStates = {
      ...toggleStates,
      [field]: value
    };

    props?.updateFieldSettings(
      props?.rowId,
      {
        [field]: value,
        validationRegex: currentToggleStates?.validationRegex ?? '',
        mandatory: currentToggleStates?.mandatory,
        multiple: currentToggleStates?.multiple,
        unique: false,
        nonLocalizable: currentToggleStates?.nonLocalizable,
        embedObject: currentToggleStates?.embedObject,
        embedObjects: embedObjectsLabels
      },
      true
    );
  };

  const handleOnClick = (index: number) => {
    setShowOptions((prev) => ({
      [index]: !prev[index]
    }));
  };

  const handleDefalutValue = (index: number, option: optionsType) => {
    setShowIcon(index);
    setShowOptions(() => ({
      [index]: false
    }));
    setToggleStates((prevStates) => ({
      ...prevStates,
      ['default_value']: option?.key
    }));
    const currentToggleStates = {
      ...toggleStates,
      ['default_value']: option?.key
    };
    props?.updateFieldSettings(
      props?.rowId,
      {
        ['default_value']: option?.key,
        validationRegex: currentToggleStates?.validationRegex ?? '',
        mandatory: currentToggleStates?.mandatory,
        multiple: currentToggleStates?.multiple,
        unique: false,
        nonLocalizable: currentToggleStates?.nonLocalizable,
        embedObject: currentToggleStates?.embedObject,
        embedObjects: embedObjectsLabels,
        options: options
      },
      true
    );
  };
  const handleRemoveDefalutValue = (index: number) => {
    setShowIcon(-1);
    setShowOptions(() => ({
      [index]: false
    }));
    setToggleStates((prevStates) => ({
      ...prevStates,
      ['default_value']: ''
    }));
    const currentToggleStates = {
      ...toggleStates,
      ['default_value']: ''
    };
    props?.updateFieldSettings(
      props?.rowId,
      {
        ['default_value']: '',
        validationRegex: currentToggleStates?.validationRegex ?? '',
        mandatory: currentToggleStates?.mandatory,
        multiple: currentToggleStates?.multiple,
        unique: false,
        nonLocalizable: currentToggleStates?.nonLocalizable,
        embedObject: currentToggleStates?.embedObject,
        embedObjects: embedObjectsLabels,
        options: options
      },
      true
    );
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
    document.querySelectorAll('.element-wrapper').forEach((el, i) => {
      if (i === index) {
        el.classList.add('dragging');
      }
    });
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    document.querySelectorAll('.element-wrapper').forEach((el, i) => {
      if (i === index) {
        el.classList.remove('dragging');
      }
    });
  };

  const handleDrop = (index: number) => {
    if (draggedIndex === null) return;

    const updatedOptions = [...options];
    const draggedItem = updatedOptions[draggedIndex];
    const targetItem = updatedOptions[index];

    updatedOptions[draggedIndex] = targetItem;
    updatedOptions[index] = draggedItem;

    setOptions(updatedOptions);
    setDraggedIndex(null);
  };

  useEffect(() => {
    if (ctValue && Array.isArray(ctValue)) {
      const labels = ctValue.map((item) => item.label);
      setEmbedObjectsLabels(labels);
    }
  }, [ctValue]);

  // Option for content types
  const contentTypesList = contentTypes?.filter((ct: ContentType) => ct?.type === 'content_type');

  const option = validateArray(contentTypesList)
    ? contentTypesList?.map((option: ContentType) => ({
        label: option?.contentstackTitle,
        value: option?.contentstackUid
      }))
    : [{ label: contentTypesList, value: contentTypesList }];

  return (
    <>
      <ModalHeader
        title={`${props?.fieldtype} properties`}
        closeModal={props?.closeModal}
        className="text-capitalize"
      />
      <ModalBody>
        <div className="modal-data">
          {props?.fieldtype === 'Dropdown' && (
            <>
              <FieldLabel htmlFor="noOfCharacters" version="v2">
                Choice
              </FieldLabel>
              <span className="read-only-text">(read only)</span>
              <div className="dropdown-choices-wrapper">
                {options?.map((option: optionsType, index) => (
                  <div
                    className="element-wrapper"
                    key={`${index?.toString()}`}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={() => handleDrop(index)}
                  >
                    <div className="term-drag-icon">
                      <Icon icon="ActionBar" size="medium" version="v2" />
                    </div>
                    <TextInput
                      version={'v2'}
                      placeholder="Enter value here"
                      suffixVisible={true}
                      disabled={true}
                      value={option?.key}
                      suffix={
                        index === showIcon && (
                          <Icon icon={'CheckSquareOffset'} version="v2" size="medium" />
                        )
                      }
                    ></TextInput>

                    <Button
                      buttonType="light"
                      version={'v2'}
                      onlyIcon={true}
                      canCloseOnClickOutside={true}
                      size={'small'}
                      icon={'v2-DotsThreeLargeVertical'}
                      onClick={() => handleOnClick(index)}
                    ></Button>

                    {showOptions[index] && (
                      <div className="dropdown-filter-wrapper" ref={filterRef}>
                        {showIcon !== index ? (
                          <Button
                            version={'v2'}
                            buttonType="light"
                            icon={'v2-CheckSquareOffset'}
                            size={'small'}
                            onClick={() => handleDefalutValue(index, option)}
                          >
                            Mark as Default
                          </Button>
                        ) : (
                          <Button
                            version={'v2'}
                            buttonType="light"
                            icon={'v2-CheckSquareOffset'}
                            size={'small'}
                            onClick={() => handleRemoveDefalutValue(index)}
                          >
                            Remove as Default
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {(props?.fieldtype === 'Single Line Textbox' ||
            props?.fieldtype === 'Multi Line Textbox') && (
            <>
              <Field>
                <FieldLabel htmlFor="validation" version="v2">
                  Default Value
                </FieldLabel>
                <Tooltip
                  content={
                    'Set a default field value for this field. The value will appear by default while creating an entry for this content type.'
                  }
                  position="right"
                >
                  <Icon icon="Question" size="small" version="v2" className="Help" />
                </Tooltip>
                <TextInput
                  type="text"
                  value={toggleStates?.default_value}
                  placeholder="Enter value"
                  version="v2"
                  onChange={
                    handleOnChange &&
                    ((e: React.ChangeEvent<HTMLInputElement>) =>
                      handleOnChange('default_value', e, true))
                  }
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="validation" version="v2">
                  Validation (Regex)
                </FieldLabel>
                <Tooltip content={'Define the validation for the field.'} position="right">
                  <Icon icon="Question" size="small" version="v2" className="Help" />
                </Tooltip>
                <TextInput
                  type="text"
                  value={toggleStates?.validationRegex}
                  placeholder="Enter value"
                  version="v2"
                  onChange={
                    handleOnChange &&
                    ((e: React.ChangeEvent<HTMLInputElement>) =>
                      handleOnChange('validationRegex', e, true))
                  }
                />
              </Field>
            </>
          )}

          {props?.fieldtype === 'Link' && (
            <>
              <div className="mb-3">
                <FieldLabel htmlFor="defaultValue" version="v2">
                  Default Value
                </FieldLabel>
                <Tooltip
                  content={
                    'Set a default field value for this field. The value will appear by default while creating an entry for this content type.'
                  }
                  position="right"
                >
                  <Icon icon="Question" size="small" version="v2" className="Help" />
                </Tooltip>
              </div>

              <Field>
                <FieldLabel htmlFor="defaultValue" version="v2">
                  Title:
                </FieldLabel>
                <TextInput
                  type="text"
                  value={toggleStates?.title}
                  placeholder="Enter value"
                  version="v2"
                  onChange={
                    handleOnChange &&
                    ((e: React.ChangeEvent<HTMLInputElement>) => handleOnChange('title', e, true))
                  }
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="url" version="v2">
                  Url:
                </FieldLabel>
                <TextInput
                  type="text"
                  value={toggleStates?.url}
                  placeholder="Enter value"
                  version="v2"
                  onChange={
                    handleOnChange &&
                    ((e: React.ChangeEvent<HTMLInputElement>) => handleOnChange('url', e, true))
                  }
                />
              </Field>
            </>
          )}

          {props?.fieldtype === 'Boolean' && (
            <Field>
              <FieldLabel className="option-label" htmlFor="options" version="v2">
                Default Value
              </FieldLabel>
              <div className="Radio-class">
                <Radio
                  label={'True'}
                  checked={toggleStates?.default_value === true}
                  onChange={() => handleRadioChange('default_value', true)}
                ></Radio>
                <Radio
                  label={'False'}
                  checked={toggleStates?.default_value === false}
                  onChange={() => handleRadioChange('default_value', false)}
                ></Radio>
              </div>
            </Field>
          )}

          {props?.fieldtype === 'Reference' && (
            <Field>
              <FieldLabel className="option-label" htmlFor="options" version="v2">
                Referenced Content Type
              </FieldLabel>
              <Tag tags={props?.data?.refrenceTo} isDisabled={true} version={'v2'} />
            </Field>
          )}

          <Field>
            <FieldLabel className="option-label" htmlFor="options" version="v2">
              Other Options
            </FieldLabel>
            <div className="options-class">
              {(props?.fieldtype === 'HTML Rich text Editor' ||
                props?.fieldtype === 'JSON Rich Text Editor') && (
                <>
                  <div className="ToggleWrap">
                    <ToggleSwitch
                      label="Embed Object(s)"
                      labelColor="primary"
                      labelPosition="right"
                      checked={(ctValue?.length ?? 0) > 0 || toggleStates?.embedObject}
                      onChange={
                        handleToggleChange &&
                        ((e: React.MouseEvent<HTMLElement>) =>
                          handleToggleChange(
                            'embedObject',
                            (e.target as HTMLInputElement)?.checked,
                            true
                          ))
                      }
                    />
                  </div>

                  {((ctValue && ctValue?.length > 0) || toggleStates?.embedObject) && (
                    <Select
                      value={ctValue}
                      isMulti={true}
                      onChange={(selectedOptions: ContentTypeOption[]) => {
                        setCTValue(selectedOptions);
                        const embedObject = selectedOptions.map((item: optionsType) => item?.value); // Update the state with the selected options
                        props?.updateFieldSettings(
                          props?.rowId,
                          {
                            validationRegex: toggleStates?.validationRegex ?? '',
                            embedObjects: embedObject
                          },
                          true
                        );
                      }}
                      options={option}
                      placeholder="Select Content Types"
                      version="v2"
                      isSearchable={true}
                      isClearable={true}
                      width="350px"
                      maxMenuHeight={200}
                      // isSelectAll={true}
                    />
                  )}
                </>
              )}
              {props?.fieldtype !== 'Global' && props?.fieldtype !== 'Boolean' && (
                <div className="ToggleWrap">
                  <ToggleSwitch
                    label="Mandatory"
                    labelColor="primary"
                    labelPosition="right"
                    checked={toggleStates?.mandatory}
                    onChange={
                      handleToggleChange &&
                      ((e: React.MouseEvent<HTMLElement>) =>
                        handleToggleChange(
                          'mandatory',
                          (e.target as HTMLInputElement)?.checked,
                          true
                        ))
                    }
                  />
                </div>
              )}

              <div className="ToggleWrap">
                <Tooltip
                  content="Available only if there are multiple languages in your stack"
                  position="top"
                  disabled={props?.isLocalised}
                >
                  <ToggleSwitch
                    id="disabled"
                    disabled={!props?.isLocalised}
                    label="Non-localizable"
                    labelColor="primary"
                    labelPosition="right"
                    checked={toggleStates?.nonLocalizable}
                    onChange={
                      handleToggleChange &&
                      ((e: React.MouseEvent<HTMLElement>) =>
                        handleToggleChange(
                          'nonLocalizable',
                          (e.target as HTMLInputElement)?.checked,
                          true
                        ))
                    }
                  />
                </Tooltip>
              </div>
              <p className="nl-note">
                If enabled, editing this field is restricted in localized entries. The field will
                use the value of the master-language entry in all localized entries.
              </p>
            </div>
          </Field>

          {/* <>{getAdvanceProperties(props, toggleStates, handleOnChange, handleToggleChange)}</> */}
        </div>
      </ModalBody>
    </>
  );
};

export default AdvancePropertise;
