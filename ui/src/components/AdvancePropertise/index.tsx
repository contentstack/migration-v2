import {
  ModalBody,
  ModalHeader,
  FieldLabel,
  TextInput,
  ToggleSwitch,
  Tooltip
} from '@contentstack/venus-components';

import './index.scss';
import { useState } from 'react';

export interface SchemaProps {
  fieldtype: string;
  value: any;
  rowId: string;
  updateFieldSettings:(rowId:string, value:any, checkBoxChanged:boolean)=> void;
  isLocalised:boolean;
  closeModal: () => void;
  data:any
}
const AdvancePropertise = (props: SchemaProps) => { 
    
  
  const [toggleStates, setToggleStates] = useState({
    validationRegex: props?.value?.ValidationRegex,
    mandatory: props?.value?.Mandatory,
    multiple: props?.value?.Multiple,
    unique: props?.value?.Unique,
    nonLocalizable: props?.value?.NonLocalizable
  });

  const handleToggleChange = (field: string, value: boolean, checkBoxChanged: boolean) => {

    setToggleStates(prevStates => ({
      ...prevStates,
      [field]: value
  }));
    
    props?.updateFieldSettings(props?.rowId, {[field?.charAt(0)?.toUpperCase() + field?.slice(1)]: value}, checkBoxChanged);
};

 const handleOnChange = ( field: string, event: any, checkBoxChanged: boolean) => {
    setToggleStates(prevStates => ({
      ...prevStates,
      [field]: event?.target?.value
  }));

  props?.updateFieldSettings(props?.rowId, {[field?.charAt(0)?.toUpperCase() + field?.slice(1)]: event?.target?.value}, checkBoxChanged);

 }

  
  return (
    <>
      <ModalHeader title={`${props?.fieldtype} propertise`} closeModal={props?.closeModal} />
      <ModalBody>
        <FieldLabel htmlFor="someInput" version="v2">
          Validation (Regex)
        </FieldLabel>
        <TextInput
          className="validation-input"
          type="text"
          value={toggleStates?.validationRegex}
          placeholder="Enter value"
          version="v2"
          onChange={(e:any)=> handleOnChange("validationRegex",e, true)}
        />
        <FieldLabel className="option-label" htmlFor="someInput" version="v2">
          Options
        </FieldLabel>
        <div className="options-class">
          <ToggleSwitch
            label="Mandatory"
            labelColor="primary"
            labelPosition="right"
            checked={toggleStates?.mandatory}
            onChange={(e:any) => handleToggleChange("mandatory" , e?.target?.checked, true)}
          />
          <ToggleSwitch
            label="Multiple"
            labelColor="primary"
            labelPosition="right"
            checked={toggleStates?.multiple}
            onChange={(e:any) => handleToggleChange("multiple" ,e?.target?.checked, true)}
          />
          <ToggleSwitch
            label="Unique"
            labelColor="primary"
            labelPosition="right"
            checked={toggleStates?.unique}
            onChange={(e:any) => handleToggleChange("unique" , e?.target?.checked,true)}
          />
          <Tooltip content='Available only if there are multiple languages in your stack' position='top' disabled={props?.isLocalised}>
          <ToggleSwitch
            id="disabled"
            disabled={ ! props?.isLocalised}
            label="Non-localizable"
            labelColor="primary"
            labelPosition="right"
            checked={toggleStates?.nonLocalizable}
            onChange={(e:any) => handleToggleChange("nonLocalizable" , e?.target?.checked,true)}
          />

          </Tooltip>
          <p className="non-localizable-message">
            If enabled, editing this field is restricted in localized entries. The field will use
            the value of the master-language entry in all localized entries.
          </p>
        </div>
      </ModalBody>
    </>
  );
};

export default AdvancePropertise;
