import {
  ModalBody,
  ModalHeader,
  FieldLabel,
  TextInput,
  ToggleSwitch
} from '@contentstack/venus-components';

import './index.scss';

export interface SchemaProps {
  fieldtype: string;
  value: any;
  rowId: string;
  closeModal: () => void;
}
const AdvancePropertise = (props: SchemaProps) => {
  return (
    <>
      <ModalHeader title={`${props.fieldtype} propertise`} closeModal={props.closeModal} />
      <ModalBody>
        <FieldLabel htmlFor="someInput" version="v2">
          Validation (Regex)
        </FieldLabel>
        <TextInput
          className="validation-input"
          type="text"
          placeholder="Enter value"
          version="v2"
        />
        <FieldLabel className="option-label" htmlFor="someInput" version="v2">
          Options
        </FieldLabel>
        <div className="options-class">
          <ToggleSwitch
            label="Mandatory"
            labelColor="primary"
            labelPosition="right"
            checked={props?.value?.mandatory}
          />
          <ToggleSwitch
            label="Multiple"
            labelColor="primary"
            labelPosition="right"
            checked={props?.value?.multiple}
          />
          <ToggleSwitch
            label="Unique"
            labelColor="primary"
            labelPosition="right"
            checked={props?.value?.unique}
          />
          <ToggleSwitch
            label="Non-localizable"
            labelColor="primary"
            labelPosition="right"
            checked={props?.value?.non_localizable}
          />
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
