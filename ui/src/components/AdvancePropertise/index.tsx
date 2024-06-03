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
  Icon
} from '@contentstack/venus-components';

// Interface
import { SchemaProps } from './advanceProperties.interface'; 


// Styles
import './index.scss';

// const getAdvanceProperties = (props: SchemaProps, setToggleStates: StateType, handleOnChange: (field: string, event: any, checkBoxChanged: boolean) => void, handleToggleChange: (field: string, value: boolean, checkBoxChanged: boolean) => void) => {
//   console.log("in function prop", props);
  
//     switch (props?.fieldtype) {
//       case 'Single Line Textbox': 
//       case 'Multi Line Textbox':
//       case 'Number':
//       case 'HTML Rich text Editor':
//       case 'JSON Rich Text Editor':
//       case 'Global':
//       case 'Select':
//       case 'File':
//       case 'Link':
//       case 'Boolean':
//         return <SingleLineProperties data={props} states={setToggleStates} handleChange={handleOnChange} handleToggle={handleToggleChange} />

//       // case 'HTML Rich text Editor':
//       //   return <RTEProperties data={props} states={setToggleStates} handleToggle={handleToggleChange} />

//       // case 'JSON Rich Text Editor':
//       //   return <RTEProperties data={props} states={setToggleStates} handleToggle={handleToggleChange} />
    
//       default:
//         break;
//     }
// }

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
    // basic: props?.value?.Basic,
    // advanced: true || props?.value?.Advanced,
    // custom: props?.value?.Custom,
    mandatory: props?.value?.Mandatory,
    allowImagesOnly: props?.value?.AllowImagesOnly,
    nonLocalizable: props?.value?.NonLocalizable,
    embedObject: true
  });


  useEffect(() => {
    // setToggleStates((prevStates) => ({
    //   ...prevStates,
    //   [field]: props?.fieldtype
    // }));
  })

  console.log("props", props);
  

  const handleOnChange = (field: string, event: any, checkBoxChanged: boolean) => {
    setToggleStates((prevStates) => ({
      ...prevStates,
      [field]: event?.target?.value
    }));

    props?.updateFieldSettings(
      props?.rowId,
      { [field?.charAt(0)?.toUpperCase() + field?.slice(1)]: event?.target?.value },
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


  // const handleRadioChange = (field: string, event: any, checkBoxChanged: boolean) => {
  //   setToggleStates((prevStates) => ({
  //     ...prevStates,
  //     [field]: event
  //   }));

  //   props?.updateFieldSettings(
  //     props?.rowId,
  //     { [field?.charAt(0)?.toUpperCase() + field?.slice(1)]: event },
  //     checkBoxChanged
  //   );
  // };

  

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
                  onChange={handleOnChange && ((e: any) => handleOnChange('minChars', e, true))}
                />
                <span className='fields-group-separator'>to</span>
                <TextInput
                  type="number"
                  value={toggleStates?.maxChars}
                  placeholder="Max"
                  version="v2"
                  onChange={handleOnChange && ((e: any) => handleOnChange('maxChars', e, true))}
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
                  onChange={handleOnChange && ((e: any) => handleOnChange('defaultValue', e, true))}
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
                  onChange={handleOnChange && ((e: any) => handleOnChange('validationRegex', e, true))}
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
                onChange={handleOnChange && ((e: any) => handleOnChange('minRange', e, true))}
              />
              <span className='fields-group-separator'>to</span>
              <TextInput
                type="number"
                value={toggleStates?.maxRange}
                placeholder="Max"
                version="v2"
                onChange={handleOnChange && ((e: any) => handleOnChange('maxRange', e, true))}
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
                  onChange={handleOnChange && ((e: any) => handleOnChange('minSize', e, true))}
                />
                <span className='fields-group-separator'>to</span>
                <TextInput
                  type="number"
                  value={toggleStates?.maxSize}
                  placeholder="Max"
                  version="v2"
                  onChange={handleOnChange && ((e: any) => handleOnChange('maxSize', e, true))}
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
                  onChange={handleOnChange && ((e: any) => handleOnChange('title', e, true))}
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
                  onChange={handleOnChange && ((e: any) => handleOnChange('url', e, true))}
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
                      onChange={handleToggleChange && ((e: any) => handleToggleChange('embedObject', e?.target?.checked, true))}
                    />
                  </div>
                  {toggleStates?.embedObject && (
                    <></>
                  )}
                </>
              )}
              {props?.fieldtype !== 'Global' && (
                <div className='ToggleWrap'>
                  <ToggleSwitch
                    label="Mandatory"
                    labelColor="primary"
                    labelPosition="right"
                    checked={toggleStates?.mandatory}
                    onChange={handleToggleChange && ((e: any) => handleToggleChange('mandatory', e?.target?.checked, true))}
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
                    onChange={handleToggleChange && ((e: any) => handleToggleChange('allowImagesOnly', e?.target?.checked, true))}
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
                    onChange={handleToggleChange && ((e: any) => handleToggleChange('nonLocalizable', e?.target?.checked, true))}
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
