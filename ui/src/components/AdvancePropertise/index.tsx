// Libraries
import { useEffect, useState } from 'react';
import {
  ModalBody,
  ModalHeader,
  Field,
  FieldLabel,
  TextInput,
  ToggleSwitch,
  Tooltip,
  Icon,
  Select
} from '@contentstack/venus-components';

// Service
import { getContentTypes } from '../../services/api/migration.service';

// Interfaces
import { SchemaProps } from './advanceProperties.interface'; 
import { ContentType } from '../ContentMapper/contentMapper.interface';

// Styles
import './index.scss';

const AdvancePropertise = (props: SchemaProps) => {
  const [toggleStates, setToggleStates] = useState({
    minChars: props?.value?.MinChars,
    maxChars: props?.value?.MaxChars,
    minRange: props?.value?.MinRange,
    maxRange: props?.value?.MaxRange,
    minSize: props?.value?.minSize,
    maxSize: props?.value?.maxSize,
    defaultValue: props?.value?.DefaultValue,
    validationRegex: props?.value?.ValidationRegex,
    title: props?.value?.title,
    url: props?.value?.url,
    mandatory: props?.value?.Mandatory,
    allowImagesOnly: props?.value?.AllowImagesOnly,
    nonLocalizable: props?.value?.NonLocalizable,
    embedObject: true,
    embedAssests: true
  });

  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [CTValue, setCTValue] = useState(null);

  useEffect(() => {
    fetchContentTypes('');
  }, [])

  // Fetch content types list
  const fetchContentTypes = async (searchText: string) => {
    const { data } = await getContentTypes(props?.projectId || '', 0, 10, searchText || ''); //org id will always present

    setContentTypes(data?.contentTypes);
  };

  const handleOnChange = (field: string, event: React.ChangeEvent<HTMLInputElement>, checkBoxChanged: boolean) => {
    setToggleStates((prevStates) => ({
      ...prevStates,
      [field]: (event.target as HTMLInputElement)?.value
    }));

    props?.updateFieldSettings(
      props?.rowId,
      { [field?.charAt(0)?.toUpperCase() + field?.slice(1)]: (event.target as HTMLInputElement)?.value },
      checkBoxChanged
    );
  };

  const handleToggleChange = (field: string, value: boolean, checkBoxChanged: boolean) => {
    setToggleStates((prevStates) => ({
      ...prevStates,
      [field]: value
    }));

    props?.updateFieldSettings(
      props?.rowId,
      { [field?.charAt(0)?.toUpperCase() + field?.slice(1)]: value },
      checkBoxChanged
    );
  };

  const option = Array.isArray(contentTypes)
    ? contentTypes.map((option) => ({ label: option?.otherCmsTitle, value: option?.otherCmsTitle }))
    : [{ label: contentTypes, value: contentTypes }];

  return (
    <>
      <ModalHeader title={`${props?.fieldtype} propertise`} closeModal={props?.closeModal} className="text-capitalize" />
      <ModalBody>
        <div className='modal-data'>
          {(props?.fieldtype === 'Single Line Textbox' || props?.fieldtype === 'Multi Line Textbox') && (
            <Field>
              <FieldLabel htmlFor="noOfCharacters" version="v2">
                Number of Characters
              </FieldLabel>
              <div className='d-flex align-items-center'>
                <TextInput
                  type="number"
                  value={toggleStates?.minChars}
                  placeholder="Min"
                  version="v2"
                  onChange={handleOnChange && ((e: React.ChangeEvent<HTMLInputElement>) => handleOnChange('minChars', e, true))}
                />
                <span className='fields-group-separator'>to</span>
                <TextInput
                  type="number"
                  value={toggleStates?.maxChars}
                  placeholder="Max"
                  version="v2"
                  onChange={handleOnChange && ((e: React.ChangeEvent<HTMLInputElement>) => handleOnChange('maxChars', e, true))}
                />
              </div>
            </Field>
          )}
      
          {(props?.fieldtype === 'Single Line Textbox' || props?.fieldtype === 'Multi Line Textbox') && (
            <>
              <Field>
                <FieldLabel htmlFor="validation" version="v2">
                  Default Value
                </FieldLabel>
                <Tooltip content={'Set a default field value for this field. The value will appear by default while creating an entry for this content type.'} position="right">
                  <Icon
                    icon="Question"
                    size="small"
                    version="v2"
                    className='Help'
                  />
                </Tooltip>
                <TextInput
                  type="text"
                  value={toggleStates?.defaultValue}
                  placeholder="Enter value"
                  version="v2"
                  onChange={handleOnChange && ((e: React.ChangeEvent<HTMLInputElement>) => handleOnChange('defaultValue', e, true))}
                />
              </Field>
          
              <Field>
                <FieldLabel htmlFor="validation" version="v2">
                  Validation (Regex)
                </FieldLabel>
                <Tooltip content={'Define the validation for the field.'} position="right">
                  <Icon
                    icon="Question"
                    size="small"
                    version="v2"
                    className='Help'
                  />
                </Tooltip>
                <TextInput
                  type="text"
                  value={toggleStates?.validationRegex}
                  placeholder="Enter value"
                  version="v2"
                  onChange={handleOnChange && ((e: React.ChangeEvent<HTMLInputElement>) => handleOnChange('validationRegex', e, true))}
                />
              </Field>
            </>
          )}

          {props?.fieldtype === 'Number' && (
            <Field>
            <FieldLabel htmlFor="range" version="v2">
              Range
            </FieldLabel>
            <div className='d-flex align-items-center'>
              <TextInput
                type="number"
                value={toggleStates?.minRange}
                placeholder="Min"
                version="v2"
                onChange={handleOnChange && ((e: React.ChangeEvent<HTMLInputElement>) => handleOnChange('minRange', e, true))}
              />
              <span className='fields-group-separator'>to</span>
              <TextInput
                type="number"
                value={toggleStates?.maxRange}
                placeholder="Max"
                version="v2"
                onChange={handleOnChange && ((e: React.ChangeEvent<HTMLInputElement>) => handleOnChange('maxRange', e, true))}
              />
            </div>
          </Field>
          )}

          {props?.fieldtype === 'File' && (
            <Field>
              <FieldLabel htmlFor="fileSize" version="v2">
                File Size Limit (MB)
              </FieldLabel>
              <Tooltip content={'min and max size (in MB) of file that the user will be allowed o upload.'} position="right">
                <Icon
                  icon="Question"
                  size="small"
                  version="v2"
                  className='Help'
                />
              </Tooltip>
              <div className='d-flex align-items-center'>
                <TextInput
                  type="number"
                  value={toggleStates?.minSize}
                  placeholder="Min"
                  version="v2"
                  onChange={handleOnChange && ((e: React.ChangeEvent<HTMLInputElement>) => handleOnChange('minSize', e, true))}
                />
                <span className='fields-group-separator'>to</span>
                <TextInput
                  type="number"
                  value={toggleStates?.maxSize}
                  placeholder="Max"
                  version="v2"
                  onChange={handleOnChange && ((e: React.ChangeEvent<HTMLInputElement>) => handleOnChange('maxSize', e, true))}
                />
              </div>
            </Field>
          )}

          {props?.fieldtype === 'Link' && (
            <>
            <div className='mb-3'>
              <FieldLabel htmlFor="defaultValue" version="v2">
                Default Value
              </FieldLabel>
              <Tooltip content={'Set a default field value for this field. The value will appear by default while creating an entry for this content type.'} position="right">
                <Icon
                  icon="Question"
                  size="small"
                  version="v2"
                  className='Help'
                />
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
                  onChange={handleOnChange && ((e: React.ChangeEvent<HTMLInputElement>) => handleOnChange('title', e, true))}
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
                  onChange={handleOnChange && ((e: React.ChangeEvent<HTMLInputElement>) => handleOnChange('url', e, true))}
                />
              </Field>
              </>
          )}

          <Field>
            <FieldLabel className="option-label" htmlFor="options" version="v2">
              Other Options
            </FieldLabel>
            <div className="options-class">
              {(props?.fieldtype === 'HTML Rich text Editor' || props?.fieldtype === 'JSON Rich Text Editor') && (
                <>
                  <div className='ToggleWrap'>
                    <ToggleSwitch
                      label="Embed Object(s)"
                      labelColor="primary"
                      labelPosition="right"
                      checked={toggleStates?.embedObject}
                      onChange={handleToggleChange && ((e: React.MouseEvent<HTMLElement>) => handleToggleChange('embedObject', (e.target as HTMLInputElement)?.checked, true))}
                    />
                  </div>
  
                  {toggleStates?.embedObject && (
                    <Select
                      value={CTValue}
                      isMulti={true}
                      onChange={setCTValue}
                      options={option}
                      placeholder="Select Content Types"
                      version='v2'
                      isSearchable={true}
                      isClearable={true}
                      width="350px"
                      // isSelectAll={true}
                    />
                  )}

                  <div className='ToggleWrap'>
                    <ToggleSwitch
                      label="Embed Asset(s)"
                      labelColor="primary"
                      labelPosition="right"
                      checked={toggleStates?.embedAssests}
                      disabled={toggleStates?.embedAssests}
                      onChange={handleToggleChange && ((e: React.MouseEvent<HTMLElement>) => handleToggleChange('embedAssests', (e.target as HTMLInputElement)?.checked, true))}
                    />
                  </div>
                </>
              )}
              {props?.fieldtype !== 'Global' && (
                <div className='ToggleWrap'>
                  <ToggleSwitch
                    label="Mandatory"
                    labelColor="primary"
                    labelPosition="right"
                    checked={toggleStates?.mandatory}
                    onChange={handleToggleChange && ((e: React.MouseEvent<HTMLElement>) => handleToggleChange('mandatory', (e.target as HTMLInputElement)?.checked, true))}
                  />
                </div>
              )}
              
              {props?.fieldtype === 'File' && (
                <div className='ToggleWrap'>
                  <ToggleSwitch
                    label="Allow Images Only"
                    labelColor="primary"
                    labelPosition="right"
                    checked={toggleStates?.allowImagesOnly}
                    onChange={handleToggleChange && ((e: React.MouseEvent<HTMLElement>) => handleToggleChange('allowImagesOnly', (e.target as HTMLInputElement)?.checked, true))}
                  />
                </div>
              )}

              <div className='ToggleWrap'>
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
                    onChange={handleToggleChange && ((e: React.MouseEvent<HTMLElement>) => handleToggleChange('nonLocalizable', (e.target as HTMLInputElement)?.checked, true))}
                  />
                </Tooltip>
              </div>
              <p className="nl-note">
                If enabled, editing this field is restricted in localized entries. The field will use
                the value of the master-language entry in all localized entries.
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
