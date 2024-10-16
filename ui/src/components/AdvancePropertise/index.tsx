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
  Button
} from '@contentstack/venus-components';

// Service
import { getContentTypes } from '../../services/api/migration.service';

// Interfaces
import { SchemaProps } from './advanceProperties.interface'; 
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
    embedAssests: true,
    multiple: props?.value?.Multiple,
    embedObjects: props?.value?.EmbedObjects,
    Default_value: props?.value?.Default_value,
    option: props?.value?.options
  });

  const embedObjects = props?.value?.EmbedObjects?.map((item: string) => ({
    label: item,
    value: item,
  }));
  // State for content types
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [ctValue, setCTValue] = useState<ContentTypeOption[] | null>(embedObjects);
  const [embedObjectslabels, setEmbedObjectsLabels] = useState<string[]>(props?.value?.EmbedObjects);
  const [showOptions, setShowOptions] = useState<Record<number, boolean>>({});
  const [showIcon, setShowIcon] = useState<number>();
  const filterRef = useRef<HTMLDivElement | null>(null);
  const [options, setOptions] = useState(props?.value?.options || []);
  const [draggedIndex, setDraggedIndex] = useState(null);
  
  useEffect(()=>{
    const defaultIndex = toggleStates?.option?.findIndex(
      (item: any) => toggleStates?.Default_value === item?.key
    );
  
    if (defaultIndex !== -1) {
      setShowIcon(defaultIndex);
    }

  },[]);
  useEffect(() => {
    fetchContentTypes('');
  }, [])
  /**
   * Fetches the content types list.
   * @param searchText - The search text.
   */
  const fetchContentTypes = async (searchText: string) => {
    try {
      const { data } = await getContentTypes(props?.projectId ?? '', 0, 10, searchText || ''); //org id will always present

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
  const handleOnChange = (field: string, event: React.ChangeEvent<HTMLInputElement>, checkBoxChanged: boolean) => {
    setToggleStates((prevStates) => ({
      ...prevStates,
      [field]: (event.target as HTMLInputElement)?.value
    }));

    const currentToggleStates = {
      ...toggleStates,
      [field]: (event.target as HTMLInputElement)?.value,
    };

    props?.updateFieldSettings(
      props?.rowId,
      {
        ...props?.value,
        [field?.charAt(0)?.toUpperCase() + field?.slice(1)]: (event.target as HTMLInputElement)?.value,
        validationRegex: '',
        MinChars: currentToggleStates?.minChars,
        MaxChars:currentToggleStates?.maxChars,
        Mandatory: currentToggleStates?.mandatory,
        Multiple: currentToggleStates?.multiple,
        Unique: false,
        NonLocalizable: currentToggleStates?.nonLocalizable,
        EmbedObject: currentToggleStates?.embedObject,
        EmbedObjects: embedObjectslabels,
        MinRange: currentToggleStates?.minRange,
        MaxRange: currentToggleStates?.maxRange,
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
      [field]: value,
    };
    
    props?.updateFieldSettings(
      props?.rowId,
      {
        [field?.charAt(0)?.toUpperCase() + field?.slice(1)]: value,
        validationRegex: '',
        Mandatory: currentToggleStates?.mandatory,
        Multiple: currentToggleStates?.multiple,
        Unique: false,
        NonLocalizable: currentToggleStates?.nonLocalizable,
        EmbedObject: currentToggleStates?.embedObject,
        EmbedObjects : embedObjectslabels
      },
      checkBoxChanged
    );
  };


  const handleRadioChange = (field: string,value:boolean) => {
    setToggleStates((prevStates) => ({
      ...prevStates,
      [field]: value
    }));
    const currentToggleStates = {
      ...toggleStates,
      [field]: value,
    };

    props?.updateFieldSettings(
      props?.rowId,
      {
        [field?.charAt(0)?.toUpperCase() + field?.slice(1)]: value,
        validationRegex: '',
        Mandatory: currentToggleStates?.mandatory,
        Multiple: currentToggleStates?.multiple,
        Unique: false,
        NonLocalizable: currentToggleStates?.nonLocalizable,
        EmbedObject: currentToggleStates?.embedObject,
        EmbedObjects : embedObjectslabels
      },
      true
    );
    
  };

  const stringToBoolean = (value:string) =>{
   
      if(value?.toLowerCase() === 'true'){
        return true
      }
      else{
        return false;
      }
  

  }

  const handleOnClick = ( index:number) =>{
    
    setShowOptions((prev) => ({
      
      [index]: !prev[index], 
    }));
  }
 
  const handleDefalutValue = (index:number, option:any) => {
    setShowIcon(index);
    setShowOptions((prev) => ({
        
      [index]: false, 
    }));
    setToggleStates((prevStates) => ({
      ...prevStates,
      ['Default_value']: option?.key
    }));
    const currentToggleStates = {
      ...toggleStates,
      ['Default_value']: option?.key
    };
    props?.updateFieldSettings(
      props?.rowId,
      {
        ['Default_value']: option?.key,
        validationRegex: '',
        Mandatory: currentToggleStates?.mandatory,
        Multiple: currentToggleStates?.multiple,
        Unique: false,
        NonLocalizable: currentToggleStates?.nonLocalizable,
        EmbedObject: currentToggleStates?.embedObject,
        EmbedObjects : embedObjectslabels,
        options:options
      },
      true
    );
  
  }
  const handleRemoveDefalutValue = (index:number, option:any)=>{
    setShowIcon(-1);
    setShowOptions((prev) => ({
        
      [index]: false, 
    }));
    setToggleStates((prevStates) => ({
      ...prevStates,
      ['Default_value']: ''
    }));
    const currentToggleStates = {
      ...toggleStates,
      ['Default_value']: ''
    };
    props?.updateFieldSettings(
      props?.rowId,
      {
        ['Default_value']: '',
        validationRegex: '',
        Mandatory: currentToggleStates?.mandatory,
        Multiple: currentToggleStates?.multiple,
        Unique: false,
        NonLocalizable: currentToggleStates?.nonLocalizable,
        EmbedObject: currentToggleStates?.embedObject,
        EmbedObjects : embedObjectslabels,
        options: options
      },
      true
    );
  }

  const handleDragStart = (index:any) => {
    setDraggedIndex(index);
    document.querySelectorAll('.element-wrapper').forEach((el, i) => {
      if (i === index) {
        el.classList.add('dragging'); 
      }
    });
  };

  const handleDragOver = (e:any, index:number) => {
    e.preventDefault(); 
    document.querySelectorAll('.element-wrapper').forEach((el, i) => {
      if (i === index) {
        el.classList.remove('dragging'); 
      } else {
        el.classList.remove('dragging'); 
      }
    });
  };

  const handleDrop = (index:any) => {
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
  const option = Array.isArray(contentTypes)
    ? contentTypes.map((option) => ({ label: option?.otherCmsTitle, value: option?.otherCmsTitle }))
    : [{ label: contentTypes, value: contentTypes }];

  return (
    <>
      <ModalHeader title={`${props?.fieldtype} properties`} closeModal={props?.closeModal} className="text-capitalize" />
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

          {(props?.fieldtype === 'Dropdown') && 
          <>
             <FieldLabel htmlFor="noOfCharacters" version="v2">
              Choice 
              
            </FieldLabel>
            <span className='read-only-text'>(read only)</span>
            <div className='dropdown-choices-wrapper'>
              {options?.map((option:any,index)=>(
              <>
                      <div className='element-wrapper' key={index} draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e)=> handleDragOver(e,index)}
                    onDrop={() => handleDrop(index)}>
                    <div 
                    
                    className='term-drag-icon'>
                        <Icon  icon="ActionBar" size='medium' version='v2' />
                    </div>
                    <TextInput version={"v2"} placeholder='Enter value here'
                    suffixVisible={true}
                    disabled={true}
                    value={option?.key}
                    suffix={
                    <>
                    {index === showIcon && <Icon icon={'CheckSquareOffset'}  version='v2' size='medium'/>}
                    
                    </>}></TextInput>
          
                    <Button buttonType="light" version={"v2"} onlyIcon={true} canCloseOnClickOutside={true}
                    size={'small'} icon={'v2-DotsThreeLargeVertical'}
                    onClick={()=>handleOnClick(index)}>
                    
                    </Button>

                    {showOptions[index]  && (
                    <div className='dropdown-filter-wrapper' ref={filterRef}>
                          {showIcon !== index ? 
                          <Button version={'v2'} buttonType="light" icon={'v2-CheckSquareOffset'} size={'small'}
                          onClick={()=>handleDefalutValue(index,option)} >Mark as Default</Button>
                          :
                          <Button version={'v2'} buttonType="light" icon={'v2-CheckSquareOffset'} size={'small'}
                          onClick={()=>handleRemoveDefalutValue(index,option)} >Remove as Default</Button>
                          
                          }
                                                  
                  
                    </div>
                  )}
                              
                    
                    
                  </div>
                 
              </>))}
              

            </div>
            
          
          </>
       
          }
      
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
                  value={toggleStates?.Default_value}
                  placeholder="Enter value"
                  version="v2"
                  onChange={handleOnChange && ((e: React.ChangeEvent<HTMLInputElement>) => handleOnChange('Default_value', e, true))}
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

          {props?.fieldtype === 'Boolean' && (
            <Field>
            <FieldLabel className="option-label" htmlFor="options" version="v2">
              Default Value
            </FieldLabel>
            <div className="Radio-class">
              <Radio
                label={'True'}
                checked={stringToBoolean(toggleStates?.Default_value || '') === true}
                onChange={() => handleRadioChange('Default_value',true)}>
              </Radio>
              <Radio
                label={'False'}
                checked={stringToBoolean(toggleStates?.Default_value || '') === false}
                onChange={() => handleRadioChange('Default_value',false)}>
              </Radio>

            </div>
            
            </Field>
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
                      value={ctValue}
                      isMulti={true}
                      onChange={(selectedOptions:any) => {
                        setCTValue(selectedOptions); 
                        const embedObject = selectedOptions.map((item: any) => item.label);// Update the state with the selected options
                        props?.updateFieldSettings(
                          props?.rowId,
                        {
                          validationRegex : toggleStates?.validationRegex || '',
                          EmbedObjects: embedObject
                        },
                        true,
                         ); 
                      }}
                      options={option}
                      placeholder="Select Content Types"
                      version='v2'
                      isSearchable={true}
                      isClearable={true}
                      width="350px"
                      // isSelectAll={true}
                    />
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
                    onChange={handleToggleChange && ((e: React.MouseEvent<HTMLElement>) => handleToggleChange('mandatory', (e.target as HTMLInputElement)?.checked, true))}
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
