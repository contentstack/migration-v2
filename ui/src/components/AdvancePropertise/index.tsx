// Libraries
import { useState } from 'react';
import {
  ModalBody,
  ModalHeader,
  FieldLabel,
  TextInput,
  ToggleSwitch,
  Tooltip,
  Radio,
  Info
} from '@contentstack/venus-components';

// Styles
import './index.scss';

interface SchemaProps {
  fieldtype: string;
  value: any;
  rowId: string;
  updateFieldSettings: (rowId: string, value: any, checkBoxChanged: boolean) => void;
  isLocalised: boolean;
  closeModal: () => void;
  data: any;
}
const AdvancePropertise = (props: SchemaProps) => {
  const [toggleStates, setToggleStates] = useState({
    validationRegex: props?.value?.ValidationRegex,
    basic: props?.value?.Basic,
    advanced: true || props?.value?.Advanced,
    custom: props?.value?.Custom,
    mandatory: props?.value?.Mandatory,
    multiple: props?.value?.Multiple,
    unique: props?.value?.Unique,
    nonLocalizable: props?.value?.NonLocalizable,
    embedObject: props?.value?.EmbedObject
  });

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

  const handleRadioChange = (field: string, event: any, checkBoxChanged: boolean) => {
    setToggleStates((prevStates) => ({
      ...prevStates,
      [field]: event
    }));

    props?.updateFieldSettings(
      props?.rowId,
      { [field?.charAt(0)?.toUpperCase() + field?.slice(1)]: event },
      checkBoxChanged
    );
  };

  return (
    <>
      <ModalHeader title={`${props?.fieldtype} propertise`} closeModal={props?.closeModal} className="text-capitalize" />
      <ModalBody>
        <div className='modal-data'>
          {props?.fieldtype === 'HTML Rich text Editor' || props?.fieldtype === 'JSON Rich Text Editor' && (
            <div>
              <FieldLabel htmlFor="editorType" version="v2" className='radio-field'>Editor Type</FieldLabel>
              <div
                className="Radio-wrapper FormFields__selection-wrapper--inline"
              >
                <Radio
                  checked={toggleStates?.basic}
                  id="basic"
                  label="Basic"
                  name="option"
                  radioDisplayType="inline-flex"
                  onChange={(e: any) => handleRadioChange('basic', e?.target?.checked, e?.target?.checked)}

                />
                <Radio
                  checked={toggleStates?.advanced}
                  id="advanced"
                  label="Advanced"
                  name="option"
                  radioDisplayType="inline-flex"
                  onChange={(e: any) => handleRadioChange('advanced', e?.target?.checked, e?.target?.checked)}
                />
                <Radio
                  checked={toggleStates?.custom}
                  id="custom"
                  label="Custom"
                  name="option"
                  radioDisplayType="inline-flex"
                  onChange={(e: any) => handleRadioChange('custom', e?.target?.checked, e?.target?.checked)}
                />
              </div>

              <Info
                content="Provides basic formatting tools as well as options to insert images, videos, tables, links, and custom class or ID."
                className='info-style'
                // type="default"
                version="v2"
                backgroundColor='#f5fdff'
                // borderColor='#0469e3'
              />

              <FieldLabel className="option-label" htmlFor="someInput" version="v2">
                Options
              </FieldLabel>
              <div className="options-class">
                <div className='ToggleWrap'>
                  <ToggleSwitch
                    label="Embed Object(s)"
                    labelColor="primary"
                    labelPosition="right"
                    checked={toggleStates?.embedObject}
                    onChange={(e: any) => handleToggleChange('embedObject', e?.target?.checked, true)}
                  />
                </div>
                <div className='ToggleWrap'>
                  <ToggleSwitch
                    label="Mandatory"
                    labelColor="primary"
                    labelPosition="right"
                    checked={toggleStates?.mandatory}
                    onChange={(e: any) => handleToggleChange('mandatory', e?.target?.checked, true)}
                  />
                </div>

                <div className='ToggleWrap'>
                  <ToggleSwitch
                    label="Multiple"
                    labelColor="primary"
                    labelPosition="right"
                    checked={toggleStates?.multiple}
                    onChange={(e: any) => handleToggleChange('multiple', e?.target?.checked, true)}
                  />
                </div>

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
                      onChange={(e: any) => handleToggleChange('nonLocalizable', e?.target?.checked, true)}
                    />
                  </Tooltip>
                </div>
                <div className="nl-note">
                  If enabled, editing this field is restricted in localized entries. The field will use
                  the value of the master-language entry in all localized entries.
                </div>
              </div>
            </div>
          )}

          {props?.fieldtype === 'text' || props?.fieldtype === 'Single Line Textbox' && (
            <div>
              <FieldLabel htmlFor="validation" version="v2">
                Validation (Regex)
              </FieldLabel>
              <TextInput
                className="validation-input"
                type="text"
                value={toggleStates?.validationRegex}
                placeholder="Enter value"
                version="v2"
                onChange={(e: any) => handleOnChange('validationRegex', e, true)}
              />
              <FieldLabel className="option-label" htmlFor="options" version="v2">
                Options
              </FieldLabel>
              <div className="options-class">
                <div className='ToggleWrap'>
                  <ToggleSwitch
                    label="Mandatory"
                    labelColor="primary"
                    labelPosition="right"
                    checked={toggleStates?.mandatory}
                    onChange={(e: any) => handleToggleChange('mandatory', e?.target?.checked, true)}
                  />
                </div>

                <div className='ToggleWrap'>
                  <ToggleSwitch
                    label="Multiple"
                    labelColor="primary"
                    labelPosition="right"
                    checked={toggleStates?.multiple}
                    onChange={(e: any) => handleToggleChange('multiple', e?.target?.checked, true)}
                  />
                </div>

                <div className='ToggleWrap'>
                  <ToggleSwitch
                    label="Unique"
                    labelColor="primary"
                    labelPosition="right"
                    checked={toggleStates?.unique}
                    onChange={(e: any) => handleToggleChange('unique', e?.target?.checked, true)}
                  />
                </div>

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
                      onChange={(e: any) => handleToggleChange('nonLocalizable', e?.target?.checked, true)}
                    />
                  </Tooltip>
                </div>
                <p className="nl-note">
                  If enabled, editing this field is restricted in localized entries. The field will use
                  the value of the master-language entry in all localized entries.
                </p>
              </div>
            </div>
          )}

          {props?.fieldtype === 'global_field' && (
            <div>
              <FieldLabel className="option-label" htmlFor="otherOptions" version="v2">
                Other Options
              </FieldLabel>
              <div className="options-class">
                <div className='ToggleWrap'>
                  <ToggleSwitch
                    label="Multiple"
                    labelColor="primary"
                    labelPosition="right"
                    checked={toggleStates?.multiple}
                    onChange={(e: any) => handleToggleChange('multiple', e?.target?.checked, true)}
                  />
                </div>

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
                      onChange={(e: any) => handleToggleChange('nonLocalizable', e?.target?.checked, true)}
                    />
                  </Tooltip>
                </div>
                <div className="nl-note">
                  If enabled, editing this field is restricted in localized entries. The field will use
                  the value of the master-language entry in all localized entries.
                </div>
              </div>
            </div>
          )}
        </div>
      </ModalBody>
    </>
  );
};

export default AdvancePropertise;
