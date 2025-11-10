// Import library
import {
  Button,
  CircularLoader,
  Icon,
  Info,
  MiniScrollableTable,
  Select,
  Tooltip
} from '@contentstack/venus-components';
import { useEffect, useRef, useState, useCallback } from 'react';
import TableHeader from './tableHeader'
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { updateNewMigrationData } from '../../../store/slice/migrationDataSlice';
import { DEFAULT_DROPDOWN, IDropDown, INewMigration } from '../../../context/app/app.interface';
import {CS_ENTRIES} from '../../../utilities/constants';
import { updateLocaleMapper } from '../../../services/api/migration.service';
import { useParams } from 'react-router';

export type ExistingFieldType = {
  [key: string]: { label: string; value: string };
};

/**
 * A functional component that displays selection for language mapping.
 *
 * @param {Array<{ label: string; value: string }>} cmsLocaleOptions - An array to dispaly number of locales select.
 * @param {Function} handleLangugeDelete - a function to delete the mapping.
 * @param {Array<{ label: string; value: string }>} options - option array of contentstack locales.
 * @param {Array<{ label: string; value: string }>} sourceOptions - option array of source locales.
 * @returns {JSX.Element | null} - Returns a JSX element if empty, otherwise null.
 */
const Mapper = ({
  uid,
  cmsLocaleOptions,
  handleLangugeDelete,
  options,
  sourceOptions,
  isDisabled,
  isStackChanged,
  stack,
  autoSelectedSourceLocale,
  onLocaleStateUpdate,
  parentLocaleState,
}: {
  key: string;
  uid:string;
  cmsLocaleOptions: Array<{ label: string; value: string }>;
  handleLangugeDelete: (index: number, locale: { label: string; value: string }) => void;
  options: Array<{ label: string; value: string }>;
  sourceOptions: Array<{ label: string; value: string }>;
  isDisabled: boolean;
  isStackChanged: boolean;
  stack: IDropDown;
  autoSelectedSourceLocale?: { label: string; value: string } | null;
  onLocaleStateUpdate?: (updater: (prev: ExistingFieldType) => ExistingFieldType) => void;
  parentLocaleState?: ExistingFieldType;
}) => {
  const { projectId = '' } = useParams();
  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);
  const dispatch = useDispatch();
  
  const [selectedMappings, setSelectedMappings] = useState<{ [key: string]: string }>({});
  const [existingField, setExistingField] = useState<ExistingFieldType>({});
  const [existingLocale, setexistingLocale] = useState<ExistingFieldType>({});
  const [selectedCsOptions, setselectedCsOption] = useState<string[]>([]);
  const [selectedSourceOption, setselectedSourceOption] = useState<string[]>([]);
  const [csOptions, setcsOptions] = useState(options);
  const [sourceoptions, setsourceoptions] = useState(sourceOptions);
  const [placeholder] = useState<string>('Select language');
  const previousSelectedMappingsRef = useRef<{ [key: string]: string }>({});
  const lastProcessedLocaleMappingRef = useRef<string>('');
  const isMapperProcessingRef = useRef<boolean>(false);
  
  // 🔍 DEBUG: Log state on every render
  console.info('🔍 [Mapper Render]', {
    autoSelectedSourceLocale,
    existingLocale,
    existingLocale_keys: Object.keys(existingLocale),
    cmsLocaleOptions_first: cmsLocaleOptions[0],
    cmsLocaleOptions_length: cmsLocaleOptions?.length,
    parentLocaleState,
    parentLocaleState_keys: Object.keys(parentLocaleState || {})
  });
  
  // 🔧 FIX: Initialize selectedMappings from existing localeMapping on mount
  useEffect(() => {
    const localeMapping = newMigrationData?.destination_stack?.localeMapping || {};
    if (Object.keys(localeMapping).length > 0 && Object.keys(selectedMappings).length === 0) {
      const initialMappings: { [key: string]: string } = {};
      Object.entries(localeMapping).forEach(([key, value]) => {
        // Store both master and regular locale mappings
        // Key format: for 'en-master_locale': 'en', we want selectedMappings['en-master_locale'] = 'en'
        initialMappings[key] = value as string;
      });
      setSelectedMappings(initialMappings);
      
      // Also set existingLocale to show the source values in the dropdowns
      const localeValues: ExistingFieldType = {};
      Object.entries(localeMapping).forEach(([key, value]) => {
        const label = key.replace('-master_locale', '');
        localeValues[label] = { label: value as string, value: value as string };
      });
      setexistingLocale(localeValues);
    }
  }, [newMigrationData?.destination_stack?.localeMapping]);

  // 🚀 PHASE 1: Helper function to save locale mapping to backend immediately
  const saveLocaleMappingToBackend = useCallback(async (localeMapping: Record<string, string>) => {
    try {
      // Parse master_locale and locales from the mapping
      // 🔧 CRITICAL: Always convert to lowercase for consistent mapping across all CMS types
      const master_locale: Record<string, string> = {};
      const locales: Record<string, string> = {};

      Object.entries(localeMapping).forEach(([key, value]) => {
        // Convert both key and value to lowercase
        const normalizedKey = key.toLowerCase();
        const normalizedValue = (value || '').toLowerCase();
        
        if (key.includes('master_locale')) {
          const sourceKey = normalizedKey.replace('-master_locale', '');
          master_locale[sourceKey] = normalizedValue;
        } else {
          locales[normalizedKey] = normalizedValue;
        }
      });

      // Call API to save
      const response = await updateLocaleMapper(projectId, { 
        master_locale, 
        locales 
      });

      return response;
    } catch (error: unknown) {
      console.error('❌ Phase 1: Error saving locale mapping:', error);
      throw error;
    }
  }, [projectId]);

  // 🔥 CRITICAL: Apply parentLocaleState with highest priority - runs IMMEDIATELY
  useEffect(() => {
    if (parentLocaleState && Object.keys(parentLocaleState).length > 0) {
      console.info('🔍 [Mapper] Applying parentLocaleState immediately:', {
        parentLocaleState,
        parentLocaleState_keys: Object.keys(parentLocaleState),
        currentExistingLocale: existingLocale
      });
      
      // Apply immediately, don't wait for other effects
      setexistingLocale(prev => {
        const updated = {
          ...prev,
          ...parentLocaleState
        };
        console.info('🔍 [Mapper] Updated existingLocale from parentLocaleState:', {
          previous: prev,
          updated,
          updated_keys: Object.keys(updated)
        });
        return updated;
      });
    }
  }, [parentLocaleState]);

  // useEffect(()=>{
  //   setSelectedStack(stack);
  // },[]);

  useEffect(() => {
    // 🔧 CRITICAL: Prevent re-entry while processing
    if (isMapperProcessingRef.current) {
      return;
    }
    
    // 🔧 CRITICAL FIX: Only process if selectedMappings actually changed
    const selectedMappingsKey = JSON.stringify(selectedMappings);
    if (selectedMappingsKey === JSON.stringify(previousSelectedMappingsRef.current)) {
      return; // No change, skip processing
    }

    // 🔧 CRITICAL FIX: Merge selectedMappings with existing auto-mapping instead of overriding
    const existingMapping = newMigrationData?.destination_stack?.localeMapping || {};
    const mergedMapping = { ...existingMapping, ...selectedMappings };
    
    // Only update if there are actual changes to avoid infinite loops
    const mergedMappingKey = JSON.stringify(mergedMapping);
    if (mergedMappingKey === lastProcessedLocaleMappingRef.current) {
      // Already processed this exact mapping, skip
      previousSelectedMappingsRef.current = { ...selectedMappings };
      return;
    }
    
    // Mark as processing
    isMapperProcessingRef.current = true;
    
    if (Object.keys(selectedMappings).length > 0) {
      
      // 🔧 CRITICAL CHECK: Don't override with empty values
      const hasEmptyValues = Object.values(selectedMappings).some(value => value === '');
      if (hasEmptyValues) {
        previousSelectedMappingsRef.current = { ...selectedMappings };
        return;
      }
      
      // 🔧 CRITICAL CHECK: Don't save if selectedMappings would OVERWRITE better auto-mapping
      // This happens when parent auto-maps but child still has stale state
      const wouldDowngrade = Object.entries(selectedMappings).some(([key, value]) => {
        const existingValue = existingMapping[key];
        // If Redux has a better mapping (not "en" → "en"), don't overwrite with worse mapping
        return existingValue && existingValue !== value && value === key.replace('-master_locale', '');
      });
      
      if (wouldDowngrade) {
        previousSelectedMappingsRef.current = { ...selectedMappings };
        return;
      }
      
      const newMigrationDataObj: INewMigration = {
        ...newMigrationData,
        destination_stack: {
          ...newMigrationData?.destination_stack,
          localeMapping: mergedMapping
        }
      };

      // Mark as processed before dispatch to prevent infinite loop
      lastProcessedLocaleMappingRef.current = mergedMappingKey;
      previousSelectedMappingsRef.current = { ...selectedMappings };

      dispatch(updateNewMigrationData(newMigrationDataObj));
      
      // 🚀 PHASE 1: Save to backend immediately after user selects a locale
      saveLocaleMappingToBackend(mergedMapping).catch((error: unknown) => {
        console.error('❌ Phase 1: Failed to save locale mapping:', error);
      });
      
      // Reset processing flag after dispatch completes
      setTimeout(() => {
        isMapperProcessingRef.current = false;
      }, 0);
    } else {
      // No updates needed, reset flag
      isMapperProcessingRef.current = false;
    }
  // Note: newMigrationData is intentionally excluded from deps to prevent infinite loop.
  // The refs (previousSelectedMappingsRef, lastProcessedLocaleMappingRef) prevent re-processing.
  // Only selectedMappings changes trigger this effect, not Redux state updates.
  }, [selectedMappings, saveLocaleMappingToBackend, dispatch]);

  useEffect(() => {
    if (selectedCsOptions?.length === 0) {
      setcsOptions(options);
    }

  }, [options]);

  useEffect(() => {
    if (selectedSourceOption?.length === 0) {
      setsourceoptions(sourceOptions);
    }
  }, [sourceOptions]);


  useEffect(() => {
    const formattedoptions = options?.filter(
      (item: { label: string; value: string }) =>
        !selectedCsOptions?.some((selected: string) => selected === item?.value) && !cmsLocaleOptions?.some((locale: {label: string, value: string}) => locale?.label === item?.value)
    );

    const adjustedOptions = sourceOptions?.filter(
      (item: { label: string; value: string }) =>
        !selectedSourceOption?.some((selected: string) => selected === item?.label)
    );
    setcsOptions(formattedoptions);
    setsourceoptions(adjustedOptions);
  }, [selectedCsOptions, selectedSourceOption, options]);

  useEffect(() => {
    const updatedExistingField = {...existingField};
    const updatedExistingLocale = {...existingLocale};

    // const validLabels = cmsLocaleOptions?.map((item)=> item?.label);

    const existingMasterID = Object?.keys?.(selectedMappings || {})?.find((key) =>
      key?.includes('-master_locale')
    );

    // 🔧 Master locale is always the first element in cmsLocaleOptions
    const recentMsterLocale = cmsLocaleOptions?.[0]?.label;
    const presentLocale = `${recentMsterLocale}-master_locale`;

    Object.keys(updatedExistingField || {})?.forEach((key) => {
      if ((existingMasterID !== presentLocale) || isStackChanged) {
        delete updatedExistingField[key];
      }
    });

    Object.keys(updatedExistingLocale || {})?.forEach((key) => {
      if ((existingMasterID !== presentLocale) || isStackChanged) {
        delete updatedExistingLocale[key];
      }
    });
    
    if ( (existingMasterID !== presentLocale) || isStackChanged) {
      setselectedCsOption([]);
      setselectedSourceOption([]);
    }

    // 🔥 CRITICAL FIX: Preserve auto-selected locale from parent BEFORE applying updates
    const preservedAutoSelection = autoSelectedSourceLocale && recentMsterLocale ? {
      [recentMsterLocale]: autoSelectedSourceLocale
    } : {};

    setexistingLocale(updatedExistingLocale);

    cmsLocaleOptions?.map((locale, index)=>{
      const existingLabel = existingMasterID;
      const expectedLabel = `${locale?.label}-master_locale`;

      const isLabelMismatch = existingLabel && existingLabel?.localeCompare(expectedLabel) !== 0;
      // 🔧 Master locale is the first element (index 0)
      if(index === 0){
        if (!updatedExistingField?.[index]) {
          updatedExistingField[index] = {
            label: `${locale?.label}`,
            value: `${locale?.label}-master_locale`,
          };
        }

  
        if (isLabelMismatch || isStackChanged) {
          setselectedCsOption([]);
          setselectedSourceOption([]);
          
          // 🔥 FIX: Apply preserved auto-selection IMMEDIATELY after clearing
          if (Object.keys(preservedAutoSelection).length > 0) {
            setexistingLocale(preservedAutoSelection);
          } else if (!autoSelectedSourceLocale) {
            setexistingLocale({});
          } else {
            // Preserve auto-mapping from parentLocaleState
            setexistingLocale(() => ({
              ...parentLocaleState,
              [locale?.label]: autoSelectedSourceLocale
            }));
          }
          setExistingField({});

          // 🔧 CRITICAL FIX: Merge with existing mappings and preserve auto-mapping values
          // Check if auto-mapping already exists for this locale
          const existingAutoMapping = newMigrationData?.destination_stack?.localeMapping?.[`${locale?.label}-master_locale`];
          const mappingKey = `${locale?.label}-master_locale`;
          
          // Only update if the value is different to prevent infinite loops
          setSelectedMappings(prev => {
            if (prev[mappingKey] === existingAutoMapping || (!existingAutoMapping && !prev[mappingKey])) {
              return prev; // No change, return same reference
            }
            return {
              ...prev,
              [mappingKey]: existingAutoMapping || '',
            };
          });
          
        }
        else if ( !isLabelMismatch && !isStackChanged ) {
          const key = `${locale?.label}-master_locale`
          // 🔧 CRITICAL FIX: Merge with existing mappings and preserve auto-mapping values
          const existingAutoMapping = newMigrationData?.destination_stack?.localeMapping?.[key];
          
          // Only update if the value would actually change
          setSelectedMappings(prev => {
            const currentValue = prev?.[key];
            const newValue = currentValue || existingAutoMapping || '';
            if (currentValue === newValue) {
              return prev; // No change, return same reference
            }
            return {
              ...prev,
              [key]: newValue,
            };
          });
        }
      }        
    })
  
    setExistingField(updatedExistingField);
  
   
   }, [cmsLocaleOptions, autoSelectedSourceLocale, parentLocaleState]);

  // 🚀 Auto-select single source locale in the master locale row
  // This runs after the clearing logic to ensure auto-selection persists
  useEffect(() => {
    if (autoSelectedSourceLocale && cmsLocaleOptions?.length > 0) {
      // 🔧 Master locale is the first element
      const masterLocaleRow = cmsLocaleOptions[0];
      if (masterLocaleRow) {
        console.info('🔍 [Mapper] Auto-selecting source locale:', {
          masterLocaleRow,
          autoSelectedSourceLocale,
          key_to_use: masterLocaleRow.label,
          isStackChanged
        });
        
        // 🔥 FIX: Use IMMEDIATE state update, not setTimeout
        // The key MUST be masterLocaleRow.label (e.g., "en-us") to match the dropdown's lookup
        const updater = (prev: ExistingFieldType) => {
          const updated = {
            ...prev,
            [masterLocaleRow.label]: autoSelectedSourceLocale  // ✅ Use locale.label as key
          };
          console.info('🔍 [Mapper] Applied auto-selection to existingLocale:', {
            key: masterLocaleRow.label,
            value: autoSelectedSourceLocale,
            previousState: prev,
            updatedState: updated
          });
          return updated;
        };
        
        setexistingLocale(updater);
        onLocaleStateUpdate?.(updater);
      }
    }
  }, [autoSelectedSourceLocale, cmsLocaleOptions, isStackChanged, onLocaleStateUpdate]);

  // function for change select value
  const handleSelectedCsLocale = (
    selectedValue: { label: string; value: string },
    index: number,
    type: 'csLocale' | 'sourceLocale'
  ) => {
    const selectedLocaleKey = selectedValue?.value;

    let existingLabel = existingField?.[index];
    if (!selectedValue?.label) {
      setselectedCsOption((prevSelected) =>
        prevSelected?.filter((item) => item !== existingField?.[index]?.label)
      );
    }
  

    setExistingField((prevOptions: ExistingFieldType) => {
      existingLabel = prevOptions[index];
      const updatedOptions = {
        ...prevOptions,
        [index]: selectedValue?.label ? { label: selectedValue?.label || null, value: selectedValue?.label } : null
      };
      //   setselectedOption((prevSelected) =>
      //     prevSelected.filter((item) =>
      //       Object.values(updatedOptions).some((opt: any) => opt.label === item)
      //     )
      //   );

      return updatedOptions;
    });
    setselectedCsOption((prevSelected) => {
      const newSelectedOptions: string[] = prevSelected?.filter(
        (item) => item !== selectedValue?.label
      );
      const newValue: string = selectedValue?.label;
      if (!newSelectedOptions?.includes(newValue)) {
        newSelectedOptions?.push(newValue);
      }
      return newSelectedOptions;
    });

    setSelectedMappings((prev) => {
      const updatedMappings = { ...prev };

      if (!selectedValue) {
        //const valueToKeep = updatedMappings[existingLabel?.value];
        delete updatedMappings[existingLabel?.value];
        //updatedMappings[""] = valueToKeep;
      }
      else if (type === 'csLocale' && selectedLocaleKey) {
    
        // 🔧 CRITICAL: Always use .value (not .label) and convert to lowercase
        const sourceLocaleValue = (existingLocale?.[index]?.value || existingLocale?.[index]?.label || '').toLowerCase();
        const normalizedSelectedKey = selectedLocaleKey.toLowerCase();
        
        if(updatedMappings?.[CS_ENTRIES?.UNMAPPED_LOCALE_KEY] === sourceLocaleValue){
          updatedMappings[normalizedSelectedKey] = sourceLocaleValue;
          delete updatedMappings?.[CS_ENTRIES?.UNMAPPED_LOCALE_KEY];  
        }else{
           const oldlabel = Object?.keys?.(updatedMappings)?.[index - 1];
           
           // Delete old key and assign to new key
          delete updatedMappings?.[oldlabel];
          updatedMappings[normalizedSelectedKey] = sourceLocaleValue;
        }
      }

      return updatedMappings;
    });
  };
  const handleSelectedSourceLocale = (
    selectedValue: { label: string; value: string },
    index: number,
  ) => {
    // const csLocaleKey = existingField?.[index]?.value;
    const selectedLocaleKey = selectedValue?.value;
    const existingLabel = existingField?.[index];
    //const selectedLocaleKey = selectedMappings[index];

    if (!selectedValue?.label) {
      setselectedSourceOption((prevSelected) =>
        prevSelected?.filter((item) => item !== existingField?.[index]?.label)
      );
    }
    setexistingLocale((prevOptions: ExistingFieldType) => {
      const updatedOptions: ExistingFieldType = {
        ...prevOptions,
        [index]: selectedValue?.label ? { label: selectedValue?.label, value: selectedValue?.label } : null
      };
      // Ensure selectedOption only contains values that exist in updatedOptions
      setselectedSourceOption((prevSelected) =>
        prevSelected?.filter((item) =>
          Object.values(updatedOptions)?.some(
            (opt: { label: string; value: string }) => opt?.label === item
          )
        )
      );

      return updatedOptions;
    });

    setselectedSourceOption((prevSelected) => {
      const newSelectedOptions = prevSelected?.filter((item) => item !== selectedValue?.label);
      const newValue: string = selectedValue?.label;
      if (!newSelectedOptions?.includes(newValue)) {
        newSelectedOptions?.push(newValue);
      }
      return newSelectedOptions;
    });

    setSelectedMappings((prev) => {
      const updatedMappings = { ...prev };

      if (!selectedValue && !existingLabel?.value?.includes?.('-master_locale')) {
        delete updatedMappings?.[existingLabel?.value];
        //updatedMappings[""] = valueToKeep;
      }
      else if (!selectedValue && existingLabel?.value?.includes?.('-master_locale')){
        updatedMappings[existingLabel?.value] = ''
      }
      else if (selectedLocaleKey) {
        // 🔧 CRITICAL: Always use .value (not .label) and convert to lowercase
        const mappingKey = (existingLabel?.value || existingLabel?.label || '').toLowerCase();
        const sourceLocaleValue = (selectedValue?.value || selectedValue?.label || '').toLowerCase();
        
        updatedMappings[mappingKey] = sourceLocaleValue;
      }

      return updatedMappings;
    });

  };
  const handleLanguageDeletaion = async (index: number, locale: { label: string; value: string }) => {
    // Remove item at index from existingField
    const csLocale = existingField?.[index]?.label ?? '';
    const sourceLocale = existingLocale?.[index]?.label ?? '';

    setExistingField((prevOptions) => {
      const updatedOptions: Record<number, { label: string; value: string }> = {};
      const prev = prevOptions ?? {};
  
      setselectedCsOption((prevSelected) =>
        prevSelected?.filter((item) => item !== csLocale)
      );
  
      for (let i = 0; i < Object?.keys(prev)?.length; i++) {
        if (i < index) {
          updatedOptions[i] = prev?.[i];
        } else if (i > index) {
          updatedOptions[i - 1] = prev?.[i];
        }
      }
  
      return updatedOptions;
    });
  

    // Remove item at index from existingLocale
    setexistingLocale((prevLocales: ExistingFieldType) => {
      if (!prevLocales) return {};
      //const updatedOptions = { ...prevLocales }; // Create a shallow copy;
      
       const entries = Object?.entries?.(prevLocales);

      // Remove the given index
      entries?.splice?.(index, 1);

      // Rebuild object with new sequential keys
      const updatedOptions = Object?.fromEntries(
        entries?.map(([, value], newIndex) => [newIndex, value])
      );

      //sourceLocale = updatedOptions[index]?.label;
      setselectedSourceOption((prevSelected) => {
        const newSelectedOptions: string[] = prevSelected?.filter(
          (item) => item !== sourceLocale // Remove the item equal to locale
        );
        return newSelectedOptions;
      });

      return updatedOptions;
      
    });

    setSelectedMappings((prev) => {
      const updatedMappings = { ...prev };
      if(!csLocale){
        for (const key in updatedMappings) {
          if (Object?.prototype?.hasOwnProperty?.call(updatedMappings, key)) {
            const value = updatedMappings?.[key];
            if (value === sourceLocale) {
              delete updatedMappings?.[key];
            }
          }
        }
      }else{
        delete updatedMappings[csLocale];
      }
      return updatedMappings;
    });

    handleLangugeDelete(index, locale);
  };

  return (
    <>
      {/* 🔧 TC-11: Enhanced empty source locales handling */}
      {!sourceOptions || sourceOptions.length === 0 ? (
        <Info
          className="info-tag"
          icon={<Icon icon="Warning" version="v2" size="small"></Icon>}
          content="No source locales found. Please check your source configuration."
          type="warning"
        />
      ) : sourceOptions?.length === 0 && newMigrationData?.project_current_step === 1 ? (
        <Info
          className="info-tag"
          icon={<Icon icon="Information" version="v2" size="small"></Icon>}
          content="Please complete Step 1 (Legacy CMS) to extract source locales from your uploaded file."
          type="light"
        />
      ) : (sourceOptions?.length > 0 && cmsLocaleOptions?.length > 0) ? (
        cmsLocaleOptions?.map((locale: {label:string, value: string}, index: number) => (
          
          <div key={locale.label} className="lang-container">
         
            {/* 🔧 Master locale is the first element (index 0) */}
            {cmsLocaleOptions.indexOf(locale) === 0 ? (
              <Tooltip
                content="This is the default locale of above selected stacks and cannot be changed. Please select a corresponding language to map."
                position="top"
              >
                <div>
                  <Select
                    value={cmsLocaleOptions.indexOf(locale) === 0 ? locale : existingField[locale?.label]}
                    onChange={(key: { label: string; value: string }) =>
                      handleSelectedCsLocale(key, index, 'csLocale')
                    }
                    options={csOptions}
                    placeholder={placeholder}
                    isSearchable
                    maxMenuHeight={150}
                    multiDisplayLimit={5}
                    menuPortalTarget={document.querySelector('.language-mapper')}
                    width="270px"
                    version="v2"
                    hideSelectedOptions={true}
                    isClearable={true}
                    isDisabled={true} // Ensure it's disabled
                    //className="select-container"
                    noOptionsMessage={() => ''}
                    menuPlacement="auto"
                  />
                </div>
              </Tooltip>
            ) : (
              <Select
                value={locale?.value ? locale : existingField[locale?.label]}
                onChange={(key: { label: string; value: string }) => {
                  handleSelectedCsLocale(key, index, 'csLocale');
                }}
                options={csOptions}
                placeholder={placeholder}
                isSearchable
                maxMenuHeight={150}
                multiDisplayLimit={5}
                menuPortalTarget={document.querySelector('.language-mapper')}
                width="270px"
                version="v2"
                hideSelectedOptions={true}
                isClearable={true}
                isDisabled={isDisabled}
                //className="select-container"
                menuPlacement="auto"
              />
            )}
            <span className="span">-</span>
            {
              /* <Select
              value={!isEmptyString(existingLocale[index]?.label) ? existingLocale[index] : null}
              onChange={(data: any) =>
                handleSelectedSourceLocale(data, index, 'sourceLocale', locale)
              }
              options={sourceOptions}
              placeholder={placeholder}
              isSearchable
              //menuShouldScrollIntoView
              multiDisplayLimit={5}
              //menuPortalTarget={document.querySelector(".config-wrapper")}
              menuPortalTarget={document.querySelector('.language-mapper')}
              width="270px"
              maxMenuHeight={150}
              version="v2"
              hideSelectedOptions={true}
              isClearable={true}
              className="select-container"
            /> */
              <Select
                value={(() => {
                  // For master locale row (index 0), ALWAYS read from existingLocale
                  const isMasterRow = cmsLocaleOptions.indexOf(locale) === 0;
                  
                  if (isMasterRow) {
                    // 🔥 CRITICAL: Use locale.label as key to lookup in existingLocale
                    const lookupKey = locale?.label;
                    const value = existingLocale[lookupKey];
                    
                    console.info(`🔍 [Mapper Dropdown] Master row value lookup:`, {
                      locale_label: locale?.label,
                      lookupKey,
                      existingLocale_all_keys: Object.keys(existingLocale),
                      found_value: value,
                      existingLocale_full: existingLocale,
                      autoSelectedSourceLocale,
                      parentLocaleState
                    });
                    
                    return value || null;
                  }
                  
                  // For non-master rows, use locale.value
                  const nonMasterValue = locale?.value ? { label: locale?.value, value: locale?.value } : null;
                  
                  console.info(`🔍 [Mapper Dropdown] Non-master row value:`, {
                    locale_label: locale?.label,
                    locale_value: locale?.value,
                    returning: nonMasterValue
                  });
                  
                  return nonMasterValue;
                })()}
                onChange={(data: { label: string; value: string }) =>
                  handleSelectedSourceLocale(data, index)
                }
                styles={{
                  menuPortal: (base: Record<string, unknown>) => ({ ...base, zIndex: 9999 })
                }}
                options={sourceoptions}
                placeholder={placeholder}
                isSearchable
                maxMenuHeight={100}
                multiDisplayLimit={5}
                //menuPortalTarget={document.querySelector('.mini-table')}
                menuShouldScrollIntoView={true}
                width="270px"
                version="v2"
                hideSelectedOptions={true}
                isClearable={true}
                isDisabled={isDisabled}
                //className="select-container"
                menuPlacement="auto"
              />
            }
            <div className={'delete-icon'}>
              {/* Only allow delete for non-master locales (not index 0) */}
              {cmsLocaleOptions.indexOf(locale) !== 0 && !isDisabled && (
                <Tooltip content={'Delete'} position="top" showArrow={false}>
                  <Icon
                    icon="Trash"
                    size="mini"
                    className="contentTypeRows__icon"
                    onClick={() => {
                      handleLanguageDeletaion(index, locale);
                    }}
                    hover
                    hoverType="secondary"
                    shadow="medium"
                    disabled={isDisabled}
                  />
                </Tooltip>
              )}
            </div>
          </div>
        ))
      ) : (
        <Info
          className="info-tag"
          icon={<Icon icon="Information" version="v2" size="small"></Icon>}
          //version="v2"
          content={newMigrationData?.project_current_step === 1 
            ? "Please complete Step 1 (Legacy CMS) to extract source locales from your uploaded file." 
            : "No languages configured. Please complete Step 1 first to extract source locales."}
          type="light"
        />
      )}
    </>
  );
};

const LanguageMapper = ({stack, uid} :{ stack : IDropDown, uid : string}) => {

  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);
  const dispatch = useDispatch();
  const { projectId = '' } = useParams();
  const [options, setoptions] = useState<{ label: string; value: string }[]>([]);
  const [cmsLocaleOptions, setcmsLocaleOptions] = useState<{ label: string; value: string }[]>([]);
  const [sourceLocales, setsourceLocales] = useState<{ label: string; value: string }[]>([]);
  const [isLoading, setisLoading] = useState<boolean>(true);
  const [currentStack, setCurrentStack] = useState<IDropDown>(stack);
  const [previousStack, setPreviousStack] = useState<IDropDown>();
  const [isStackChanged, setisStackChanged] = useState<boolean>(false);
  // const [stackValue, setStackValue] = useState<string>(stack?.value)
  const [autoSelectedSourceLocale, setAutoSelectedSourceLocale] = useState<{ label: string; value: string } | null>(null);
  const [mapperLocaleState, setMapperLocaleState] = useState<ExistingFieldType>({});

  const prevStackRef: React.MutableRefObject<IDropDown | null> = useRef(null);
  const lastAutoMappingRef = useRef<string>('');
  const localeMappingRef = useRef<Record<string, string>>({});
  const lastInputDataRef = useRef<string>('');
  const isProcessingRef = useRef<boolean>(false);

  // 🚀 PHASE 1: Helper function to save locale mapping to backend immediately
  const saveLocaleMappingToBackend = useCallback(async (localeMapping: Record<string, string>) => {
    try {
     
      // Parse master_locale and locales from the mapping
      // 🔧 CRITICAL: Always convert to lowercase for consistent mapping across all CMS types
      const master_locale: Record<string, string> = {};
      const locales: Record<string, string> = {};

      Object.entries(localeMapping).forEach(([key, value]) => {
        // Convert both key and value to lowercase
        const normalizedKey = key.toLowerCase();
        const normalizedValue = (value || '').toLowerCase();
        
        if (key.includes('master_locale')) {
          const sourceKey = normalizedKey.replace('-master_locale', '');
          master_locale[sourceKey] = normalizedValue;
        } else {
          locales[normalizedKey] = normalizedValue;
        }
      });

      // Call API to save
      const response = await updateLocaleMapper(projectId, { 
        master_locale, 
        locales 
      });

      return response;
    } catch (error: unknown) {
      console.error('❌ Phase 1: Error saving locale mapping:', error);
      throw error;
    }
  }, [projectId]);

  useEffect(() => {
    if (prevStackRef?.current && stack && stack?.uid !== prevStackRef?.current?.uid) {
      setisStackChanged(true);
      setCurrentStack(stack);
      setPreviousStack(prevStackRef?.current);
    }
    
    prevStackRef.current = stack;
  }, [stack]);

  // Smart locale mapping function - works for all CMS platforms
  const getSmartLocaleMapping = (sourceLocaleCode: string, availableContentstackLocales: { label: string; value: string }[]): string => {
    // First, try direct match
    const directMatch = availableContentstackLocales.find(locale => locale.value === sourceLocaleCode);
    if (directMatch) {
      return sourceLocaleCode;
    }

    // Smart mapping for common locale patterns
    const commonMappings: { [key: string]: string[] } = {
      'en': ['en-us', 'en-gb', 'en-au', 'en-ca'],
      'es': ['es-es', 'es-mx', 'es-ar', 'es-co'],
      'fr': ['fr-fr', 'fr-ca', 'fr-be', 'fr-ch'],
      'de': ['de-de', 'de-at', 'de-ch'],
      'it': ['it-it'],
      'pt': ['pt-pt', 'pt-br'],
      'ja': ['ja-jp'],
      'zh': ['zh-cn', 'zh-tw', 'zh-hk'],
      'ar': ['ar-ae', 'ar-sa', 'ar-eg', 'ar-ma'],
      'hi': ['hi-in'],
      'ru': ['ru-ru'],
      'ko': ['ko-kr'],
      'nl': ['nl-nl', 'nl-be'],
      'sv': ['sv-se'],
      'no': ['nb-no', 'nn-no'],
      'da': ['da-dk'],
      'fi': ['fi-fi'],
      'pl': ['pl-pl'],
      'tr': ['tr-tr'],
      'th': ['th-th'],
      'vi': ['vi-vn'],
      'uk': ['uk-ua'],
      'cs': ['cs-cz'],
      'hu': ['hu-hu'],
      'ro': ['ro-ro'],
      'bg': ['bg-bg'],
      'hr': ['hr-hr'],
      'sk': ['sk-sk'],
      'sl': ['sl-si'],
      'et': ['et-ee'],
      'lv': ['lv-lv'],
      'lt': ['lt-lt'],
      'eg': ['ar-eg', 'en-eg', 'ar-ae'] // Egyptian - prefer Arabic Egypt
    };

    const possibleMappings = commonMappings[sourceLocaleCode] || [];
    
    // Find the first available mapping
    for (const candidate of possibleMappings) {
      const match = availableContentstackLocales.find(locale => locale.value === candidate);
      if (match) {
        return candidate;
      }
    }

    // Fallback to en-us if available, otherwise first available locale
    const fallback = availableContentstackLocales.find(locale => locale.value === 'en-us');
    return fallback ? 'en-us' : availableContentstackLocales[0]?.value || sourceLocaleCode;
  };

  // 🆕 Helper function to get next unmapped source locale for Add Language functionality
  const getNextUnmappedSourceLocale = (): { label: string; value: string } | null => {
    if (!sourceLocales || sourceLocales.length === 0) return null;
    
    // 🔧 CRITICAL FIX: Get currently mapped source locales from KEYS of localeMapping, not values
    const localeMapping = newMigrationData?.destination_stack?.localeMapping || {};
    const mappedSourceLocales = Object.keys(localeMapping)
      .filter(key => !key.includes('-master_locale')) // Exclude master locale entries
      .filter(key => localeMapping[key] !== '' && localeMapping[key] !== null && localeMapping[key] !== undefined); // Only count valid mappings
    
    // Find first unmapped source locale
    const unmappedLocale = sourceLocales.find(source => 
      !mappedSourceLocales.includes(source.value)
    );
    
    return unmappedLocale || null;
  };

  // 🆕 Helper function to check if source locale exists in destination
  // Enhanced to handle duplicate/ambiguous locales with exact match preference
  const findDestinationMatch = (sourceLocale: string): { label: string; value: string } | null => {
    // 🆕 STEP 1: Try exact match (case-insensitive) - HIGHEST PRIORITY
    const exactMatch = options.find(dest => 
      dest.value.toLowerCase() === sourceLocale.toLowerCase()
    );
    
    if (exactMatch) {
      return exactMatch;
    }
    
    // 🆕 STEP 2: Try smart mapping only if no exact match
    // This handles cases like 'en' -> 'en-us' but prefers exact matches
    const smartMatch = getSmartLocaleMapping(sourceLocale, options);
    const smartMatchObj = options.find(dest => dest.value === smartMatch);
    
    return smartMatchObj || null;
  };
  
  // 🆕 Helper function to get unmapped destination locales for display
  const getUnmappedDestinationLocales = (): { label: string; value: string }[] => {
    const mappedDestinations = Object.keys(newMigrationData?.destination_stack?.localeMapping || {})
      .filter(key => !key.includes('-master_locale')); // Exclude master locale keys
    
    return options.filter(dest => 
      !mappedDestinations.includes(dest.value) &&
      dest.value !== stack?.master_locale // Don't include master locale
    );
  };

  // 🚀 UNIVERSAL LOCALE AUTO-MAPPING (All CMS platforms) 
  // Handles both single and multiple locale scenarios
  useEffect(() => {
    // 🔧 CRITICAL: Prevent re-entry while processing
    if (isProcessingRef.current) {
      return;
    }
    
    // 🔧 CRITICAL FIX: Track input data to prevent infinite loops
    const sourceLocaleArray = newMigrationData?.destination_stack?.sourceLocale || [];
    const csLocaleObj = newMigrationData?.destination_stack?.csLocale || {};
    const currentStep = newMigrationData?.project_current_step;
    const masterLocale = stack?.master_locale;
    const stackUid = currentStack?.uid;
    
    // Create a key from input data (not from output localeMapping)
    // NOTE: cmsLocaleOptions excluded because this effect updates it, causing loops
    const inputDataKey = JSON.stringify({
      sourceLocale: sourceLocaleArray,
      csLocale: Object.keys(csLocaleObj),
      currentStep,
      masterLocale,
      stackUid,
      isStackChanged
    });
    
    // Skip if we already processed this exact input data
    if (inputDataKey === lastInputDataRef.current) {
      return;
    }
    
    // Also check if current mapping matches what we last created (handles race conditions)
    const currentLocaleMapping = newMigrationData?.destination_stack?.localeMapping || {};
    const currentLocaleMappingKey = JSON.stringify(currentLocaleMapping);
    if (currentLocaleMappingKey === lastAutoMappingRef.current && lastInputDataRef.current !== '') {
      return;
    }
    
    // Mark as processing
    isProcessingRef.current = true;

    // 🔍 DEBUGGING: Log at the start of auto-mapping effect
    console.info('🔍 [Auto-mapping Effect] Starting:', {
      sourceLocale_length: sourceLocaleArray?.length,
      sourceLocale_values: sourceLocaleArray,
      csLocale_keys: Object.keys(csLocaleObj),
      allLocales_length: Object.keys(csLocaleObj)?.length,
      currentStep,
      stack_master_locale: stack?.master_locale,
      cmsLocaleOptions_length: cmsLocaleOptions?.length,
      cmsLocaleOptions_first: cmsLocaleOptions[0],
      currentLocaleMapping,
      isProcessing: isProcessingRef.current,
      lastInputDataRef: lastInputDataRef.current,
      inputDataKey,
      isStackChanged
    });

    let sourceLocale = sourceLocaleArray.map((item) => ({
      label: item,
      value: item
    }));
    
    const allLocales: { label: string; value: string }[] = Object?.entries(
      newMigrationData?.destination_stack?.csLocale ?? {}
    ).map(([key]) => ({
      label: key,
      value: key
    }));

    // 🔄 Improved stack change detection
    const stackHasChanged = currentStack?.uid !== previousStack?.uid || 
                           isStackChanged || 
                           previousStack === undefined; // Also trigger when no previous stack

    // ✅ Declare keys before using it
    const keys = Object?.keys(currentLocaleMapping)?.find( key => key === `${newMigrationData?.destination_stack?.selectedStack?.master_locale}-master_locale`);
    
    // 🔧 TC-11: Handle empty source locales - but check Redux first
    if (!sourceLocale || sourceLocale.length === 0) {
      // Try to get from Redux as fallback
      const reduxSourceLocale = newMigrationData?.destination_stack?.sourceLocale;
      if (reduxSourceLocale && reduxSourceLocale.length > 0) {
        sourceLocale = reduxSourceLocale.map((item: string) => ({ label: item, value: item }));
      } else {
        console.warn('❌ No source locales found - exiting auto-mapping');
        return; // Exit early - will show "No languages configured" message
      }
    }
    
    // 🔧 TC-12: Handle empty destination locales (ensure master locale exists)
    if (!allLocales || allLocales.length === 0) {
      const masterLocaleObj = { label: stack?.master_locale || 'en-us', value: stack?.master_locale || 'en-us' };
      setoptions([masterLocaleObj]);
      return; // Will re-trigger this effect with master locale added
    }
    
    // ✅ EXISTING: Single locale auto-mapping (ENHANCED for TC-02)
    const shouldAutoMapSingle = (Object?.entries(currentLocaleMapping)?.length === 0 || 
                                !keys || 
                                stackHasChanged);
    
    // 🔥 CRITICAL FIX: Check if all source locales are mapped (for multi-locale auto-mapping condition)
    const mappedSourceLocales = Object.keys(currentLocaleMapping).filter(key => 
      !key.includes('-master_locale') && currentLocaleMapping[key] !== '' && currentLocaleMapping[key] !== null
    );
    const allSourceLocalesMapped = sourceLocale.every(source => {
      const sourceValue = (source.value || source.label || '').toLowerCase();
      return mappedSourceLocales.includes(sourceValue) || 
             currentLocaleMapping[`${sourceValue}-master_locale`] !== undefined;
    });
    
    // 🔥 CRITICAL FIX: Populate cmsLocaleOptions if empty, but DON'T return early
    // We need to populate it AND continue with auto-mapping in the same effect run
    if (cmsLocaleOptions?.length === 0 && allLocales?.length > 0) {
      console.info('🔥 [Auto-mapping] cmsLocaleOptions is empty, populating with master locale');
      
      // First element is always the master locale
      const masterLocale = (stack?.master_locale || 'en-us').toLowerCase();
      const mappedOptions: { label: string; value: string }[] = [];
      
      // Add ONLY the master locale
      mappedOptions.push({
        label: masterLocale,
        value: masterLocale
      });
      
      setcmsLocaleOptions(mappedOptions);
      
      // ✅ DON'T return - continue with auto-mapping using the master locale we just set
      console.info('🔥 [Auto-mapping] Set cmsLocaleOptions to:', mappedOptions);
    }
    
    // Clear existing mappings when stack changes to allow fresh auto-mapping
    if (stackHasChanged && Object?.entries(currentLocaleMapping)?.length > 0) {
      const emptyMapping = {};
      const clearMappingKey = JSON.stringify(emptyMapping);
      lastAutoMappingRef.current = clearMappingKey;
      localeMappingRef.current = emptyMapping;
      lastInputDataRef.current = inputDataKey; // Mark as processed
      
      const newMigrationDataObj: INewMigration = {
        ...newMigrationData,
        destination_stack: {
          ...newMigrationData?.destination_stack,
          localeMapping: emptyMapping // Clear existing mappings for fresh auto-mapping
        }
      };
      dispatch(updateNewMigrationData(newMigrationDataObj));
      
      // Reset processing flag after a delay to allow Redux to settle
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 0);
      return; // Exit early to let the cleared state trigger auto-mapping in next render
    }
    
    if (sourceLocale?.length === 1 && 
        allLocales?.length > 0 && 
        shouldAutoMapSingle && 
        newMigrationData?.project_current_step <= 2) {
      
      const singleSourceLocale = sourceLocale[0];
      
      // 🔧 CRITICAL FIX: Check if user has already manually mapped this locale
      const existingMapping = currentLocaleMapping;
      const hasManualMapping = Object.keys(existingMapping).some(key => 
        existingMapping[key] === singleSourceLocale.value && !key.includes('master_locale')
      );
      
      if (hasManualMapping) {
        // Reset stack changed flag but don't override manual mapping
        if (isStackChanged) {
          setisStackChanged(false);
        }
        isProcessingRef.current = false;
        return; // Exit early, don't auto-map
      }
      
      // 🔥 NEW LOGIC: For single source locale, map to destination master locale ALWAYS
      // Don't check if values match - just map them because there's no other choice
      const sourceLocaleValue = (singleSourceLocale.value || singleSourceLocale.label || '').toLowerCase();
      const destinationLocale = (stack?.master_locale || 'en-us').toLowerCase();
      
      console.info('🔥 [Single Locale Auto-Map] Mapping single source to destination master:', {
        source: sourceLocaleValue,
        destination: destinationLocale,
        source_locale_object: singleSourceLocale,
        stack_master_locale: stack?.master_locale,
        reason: 'Single source locale - no other choice'
      });
      
      // 🔥 CRITICAL FIX: For single locale, ONLY create master_locale entry
      // Map: destination-master_locale -> source
      const autoMapping = {
        [`${destinationLocale}-master_locale`]: sourceLocaleValue
      };
      
      const autoMappingKey = JSON.stringify(autoMapping);
      lastAutoMappingRef.current = autoMappingKey;
      localeMappingRef.current = { ...autoMapping };
      lastInputDataRef.current = inputDataKey;
      
      // 🔥 CRITICAL FIX: Set auto-selected source locale with proper value
      const normalizedValue = sourceLocaleValue;
      setAutoSelectedSourceLocale({
        label: normalizedValue,
        value: normalizedValue
      });
      
      console.info('🔥 [Single Locale] Set autoSelectedSourceLocale:', {
        label: normalizedValue,
        value: normalizedValue
      });
      
      // 🔥 CRITICAL FIX: Update mapperLocaleState SYNCHRONOUSLY
      // Use destination locale (master) as key - this is what Mapper expects
      const masterLocaleKey = destinationLocale;  // ✅ This must match cmsLocaleOptions[0].label
      
      const updatedMapperState: ExistingFieldType = {
        [masterLocaleKey]: {
          label: normalizedValue,
          value: normalizedValue
        }
      };
      
      console.info('🔥 [Single Locale] Setting mapperLocaleState:', {
        key: masterLocaleKey,
        value: { label: normalizedValue, value: normalizedValue },
        updatedMapperState
      });
      
      setMapperLocaleState(updatedMapperState);
      
      // 🔥 CRITICAL: Make sure cmsLocaleOptions has the master locale row
      if (cmsLocaleOptions?.length === 0) {
        console.info('🔥 [Single Locale] cmsLocaleOptions was empty, ensuring it has master locale');
        setcmsLocaleOptions([{
          label: masterLocaleKey,
          value: masterLocaleKey
        }]);
      } else {
        const masterExists = cmsLocaleOptions.some(item => 
          item.label.toLowerCase() === masterLocaleKey.toLowerCase()
        );
        
        if (!masterExists) {
          console.info('🔥 [Single Locale] Adding master locale to cmsLocaleOptions:', {
            masterLocaleKey
          });
          setcmsLocaleOptions(prevList => [
            {
              label: masterLocaleKey,
              value: masterLocaleKey
            },
            ...prevList
          ]);
        } else {
          console.info('🔥 [Single Locale] Master locale already exists in cmsLocaleOptions');
        }
      }
      
      const newMigrationDataObj: INewMigration = {
        ...newMigrationData,
        destination_stack: {
          ...newMigrationData?.destination_stack,
          localeMapping: autoMapping
        }
      };
      
      console.info('🔥 [Single Locale] Dispatching Redux update:', {
        autoMapping,
        destination_stack: newMigrationDataObj.destination_stack
      });
      
      dispatch(updateNewMigrationData(newMigrationDataObj));
      
      // 🚀 PHASE 2: Save auto-mapping to backend immediately when stack is selected
      saveLocaleMappingToBackend(autoMapping).catch((error: unknown) => {
        console.error('❌ Phase 2: Failed to save auto-mapping:', error);
      });
      
      // Log completion
      console.info('✅ [Auto-mapping Complete] Single Locale:', {
        autoMapping,
        autoSelectedSourceLocale: { label: normalizedValue, value: normalizedValue },
        mapperLocaleState: updatedMapperState,
        cmsLocaleOptions
      });
      
      // Reset stack changed flag after auto-mapping
      if (isStackChanged) {
        setisStackChanged(false);
      }
      
      // Reset processing flag
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 0);
    } 
    // 🆕 NEW: Enhanced multi-locale auto-mapping
    // Enhanced condition: Also trigger on stack changes for existing templates
    // 🔥 CRITICAL FIX: Also trigger if not all source locales are mapped yet
    else if (sourceLocale?.length > 1 && 
             allLocales?.length > 0 && 
             cmsLocaleOptions?.length > 0 && // ✅ CRITICAL: Wait for cmsLocaleOptions to be ready
             !allSourceLocalesMapped && // 🔥 CRITICAL: Run if not all source locales are mapped
             (Object?.entries(currentLocaleMapping)?.length === 0 || 
              !keys || 
              stackHasChanged ||
              !allSourceLocalesMapped) && // 🔥 Also trigger if not all mapped
             newMigrationData?.project_current_step <= 2) {
      
      // 🔧 CRITICAL FIX: Check if user has already manually mapped any locales
      const existingMapping = currentLocaleMapping;
      const hasManualMappings = Object.keys(existingMapping).filter(key => !key.includes('master_locale')).length > 0;
      
      if (hasManualMappings && stackHasChanged) {
        // Reset stack changed flag but don't override manual mappings
        if (isStackChanged) {
          setisStackChanged(false);
        }
        return; // Exit early, don't auto-map
      }
      
      // 🆕 CONDITION 2: Enhanced multi-locale logic with master locale priority
      
      // First, check if master locale from source matches destination (PRIORITY)
      // 🔧 CRITICAL: Always use .value and convert to lowercase
      const normalizedStackMaster = (stack?.master_locale || 'en-us').toLowerCase();
      const masterLocaleFromSource = sourceLocale.find(source => {
        const sourceValue = (source.value || source.label || '').toLowerCase();
        return sourceValue === normalizedStackMaster;
      });
      
      let hasAnyMatches = false;
      
      // Build auto-mapping for exact matches (case-insensitive)
      // 🔧 CRITICAL: Always convert to lowercase
      const autoMapping: Record<string, string> = {
        [`${normalizedStackMaster}-master_locale`]: normalizedStackMaster
      };
      
      // 🆕 STEP 1: Handle master locale priority first
      if (masterLocaleFromSource) {
        const sourceValue = (masterLocaleFromSource.value || masterLocaleFromSource.label || '').toLowerCase();
        const masterDestMatch = allLocales.find(dest => {
          const destValue = (dest.value || dest.label || '').toLowerCase();
          return destValue === sourceValue;
        });
        if (masterDestMatch) {
          const destValue = (masterDestMatch.value || masterDestMatch.label || '').toLowerCase();
          // 🔧 CRITICAL FIX: Create both master locale entry AND regular mapping entry
          autoMapping[`${sourceValue}-master_locale`] = destValue; // For validation
          autoMapping[sourceValue] = destValue; // For regular mapping
          hasAnyMatches = true;
          
          // 🔥 CRITICAL FIX: Update mapperLocaleState to populate the dropdown immediately
          // The key must match locale.label from cmsLocaleOptions (which is the master locale value)
          const updatedExistingLocale: ExistingFieldType = {};
          if (cmsLocaleOptions?.length > 0) {
            const masterRow = cmsLocaleOptions[0];
            if (masterRow) {
              // 🔥 CRITICAL: Use masterRow.label as key (matches what source dropdown expects: existingLocale[locale.label])
              updatedExistingLocale[masterRow.label] = {
                label: sourceValue,
                value: sourceValue
              };
              console.info(`✅ [Auto-mapping] Setting mapperLocaleState for master locale (${masterRow.label}):`, {
                key: masterRow.label,
                value: { label: sourceValue, value: sourceValue },
                masterRow,
                updatedState: updatedExistingLocale
              });
              setMapperLocaleState(prev => ({ ...prev, ...updatedExistingLocale }));
            } else {
              console.warn('⚠️ [Auto-mapping] Master row not found in cmsLocaleOptions');
            }
          } else {
            console.warn('⚠️ [Auto-mapping] cmsLocaleOptions is empty, cannot set master locale mapping');
          }
        }
      }
      
      // 🔥 CRITICAL FIX: Find and add rows for other source locales that match destination locales
      // Only add rows for source locales that have matches, not all 269 destination locales!
      sourceLocale.forEach(source => {
        const sourceValue = (source.value || source.label || '').toLowerCase();
        
        // Skip if already processed as master locale
        if (sourceValue === normalizedStackMaster) {
          return;
        }
        
        // Find matching destination locale
        const destMatch = allLocales.find(dest => {
          const destValue = (dest.value || dest.label || '').toLowerCase();
          return destValue === sourceValue;
        });
        
        if (destMatch) {
          const destValue = (destMatch.value || destMatch.label || '').toLowerCase();
          
          // Add to auto-mapping
          autoMapping[sourceValue] = destValue;
          hasAnyMatches = true;
          
          // Add row to cmsLocaleOptions ONLY if it doesn't already exist
          // 🔥 CRITICAL FIX: Also update mapperLocaleState when adding the row
          setcmsLocaleOptions(prevList => {
            const exists = prevList.some(item => item.value === destValue || item.label === destValue);
            if (!exists) {
              const newList = [
                ...prevList,
                {
                  label: destValue,  // This will be the key in existingLocale
                  value: destValue
                }
              ];
              
              // 🔥 CRITICAL: Update mapperLocaleState using destValue as key (matches locale.label)
              // The source dropdown uses existingLocale[locale.label], so key must be destValue
              setMapperLocaleState(prev => {
                const updated = {
                  ...prev,
                  [destValue]: {  // Key must match locale.label from cmsLocaleOptions
                    label: sourceValue,
                    value: sourceValue
                  }
                };
                console.info(`✅ [Auto-mapping] Setting mapperLocaleState for ${destValue}:`, {
                  key: destValue,
                  value: { label: sourceValue, value: sourceValue },
                  fullState: updated
                });
                return updated;
              });
              
              return newList;
            }
            return prevList;
          });
        } else {
          console.info(`❌ [Multi-locale auto-mapping] No match found for: ${sourceValue}`);
        }
      });
      
      // 🔧 TC-04 & TC-08: Enhanced no-match logic with master locale default
      if (!hasAnyMatches) {
        
        // Auto-select destination master locale for first source locale as per TC-04/TC-08
        // 🔧 CRITICAL: Always use .value and convert to lowercase
        const firstSourceLocale = sourceLocale[0];
        const firstSourceValue = (firstSourceLocale.value || firstSourceLocale.label || '').toLowerCase();
        const masterLocaleMapping = {
          [`${normalizedStackMaster}-master_locale`]: normalizedStackMaster,
          [normalizedStackMaster]: firstSourceValue // Map destination master to first source
        };
        
        const masterLocaleMappingKey = JSON.stringify(masterLocaleMapping);
        lastAutoMappingRef.current = masterLocaleMappingKey;
        localeMappingRef.current = { ...masterLocaleMapping };
        lastInputDataRef.current = inputDataKey; // Mark as processed
        
        const newMigrationDataObj: INewMigration = {
          ...newMigrationData,
          destination_stack: {
            ...newMigrationData?.destination_stack,
            localeMapping: masterLocaleMapping
          }
        };
        dispatch(updateNewMigrationData(newMigrationDataObj));
        
        // Update the existingLocale state to show the mapping in UI
        const updatedExistingLocale: ExistingFieldType = {};
        if (cmsLocaleOptions?.length > 0) {
          // 🔧 Master locale is the first element
          const masterRow = cmsLocaleOptions[0];
          if (masterRow) {
            // 🔧 CRITICAL: Always use .value and convert to lowercase
            const normalizedValue = (firstSourceLocale.value || firstSourceLocale.label || '').toLowerCase();
            updatedExistingLocale[masterRow.label] = {
              label: normalizedValue,
              value: normalizedValue
            };
          }
        }
        setMapperLocaleState(prev => ({ ...prev, ...updatedExistingLocale }));
        
        
        // Reset stack changed flag
        if (isStackChanged) {
          setisStackChanged(false);
        }
        return; // Exit early
      }
      
      // 🔧 REMOVED: TC-03 auto-mapping of remaining locales
      // This was causing all locales to be mapped at once, disabling "Add Language" button
      // Now remaining locales will be handled by "Add Language" functionality
      
      // 🔧 CRITICAL: Always use .value and convert to lowercase for comparison
      const unmappedSources = sourceLocale.filter(source => {
        const sourceValue = (source.value || source.label || '').toLowerCase();
        return !autoMapping[sourceValue];
      });
      
      const autoMappingKey = JSON.stringify(autoMapping);
      lastAutoMappingRef.current = autoMappingKey;
      localeMappingRef.current = { ...autoMapping };
      lastInputDataRef.current = inputDataKey; // Mark as processed
      
      // Update Redux state with auto-mappings
      const newMigrationDataObj: INewMigration = {
        ...newMigrationData,
        destination_stack: {
          ...newMigrationData?.destination_stack,
          localeMapping: autoMapping
        }
      };
      dispatch(updateNewMigrationData(newMigrationDataObj));
      
      // 🚀 PHASE 2: Save multi-locale auto-mapping to backend immediately when stack is selected
      saveLocaleMappingToBackend(autoMapping).catch((error: unknown) => {
        console.error('❌ Phase 2: Failed to save multi-locale auto-mapping:', error);
      });
      
      // Log completion
      console.info('✅ [Auto-mapping Complete] Multi-Locale:', {
        autoMapping,
        mappedSourceLocales: sourceLocale.filter(s => autoMapping[(s.value || s.label || '').toLowerCase()]),
        unmappedSourceLocales: sourceLocale.filter(s => !autoMapping[(s.value || s.label || '').toLowerCase()]),
        cmsLocaleOptions
      });
      
      // 🔥 CRITICAL FIX: Update existingLocale state for dropdown display
      // The dropdown reads from existingLocale, not from Redux localeMapping
      // Use a callback to read the current state of cmsLocaleOptions (which might have been updated asynchronously)
      setMapperLocaleState(prev => {
        const updatedExistingLocale: ExistingFieldType = { ...prev };
        
        console.info('🔍 [Auto-mapping] Final mapperLocaleState update:', {
          previousState: prev,
          autoMapping,
          sourceLocale: sourceLocale.map(s => s.value || s.label)
        });
        
        // Map each auto-mapped source locale to the dropdown state
        // 🔧 CRITICAL: Always use .value and convert to lowercase
        sourceLocale.forEach(source => {
          const sourceValue = (source.value || source.label || '').toLowerCase();
          if (autoMapping[sourceValue]) {
            // Get current cmsLocaleOptions from state (might have been updated asynchronously)
            // We need to find the row that matches this source locale
            const destValue = autoMapping[sourceValue];
            
            // 🔥 CRITICAL: Use destValue as the key (which matches locale.label in cmsLocaleOptions)
            // The source dropdown uses existingLocale[locale.label], so key must be destValue
            updatedExistingLocale[destValue] = {
              label: sourceValue,
              value: sourceValue
            };
            
            console.info(`✅ [Auto-mapping] Final update - Setting ${destValue} = ${sourceValue}`);
          }
        });
        
        console.info('🔍 [Auto-mapping] Final updatedExistingLocale:', updatedExistingLocale);
        return updatedExistingLocale;
      });
      
      // Clear auto-selected source locale for multi-locale scenario
      setAutoSelectedSourceLocale(null);
      
      // Reset stack changed flag after auto-mapping
      if (isStackChanged) {
        setisStackChanged(false);
      }
    } 
    else {
      setAutoSelectedSourceLocale(null);
    }
    
    // Reset processing flag after all updates are queued
    setTimeout(() => {
      isProcessingRef.current = false;
    }, 0);
  // Note: Intentionally using minimal deps to prevent infinite loops. 
  // We track input changes via inputDataKey and only run when inputs truly change
  // cmsLocaleOptions excluded because this effect updates it
  }, [newMigrationData?.destination_stack?.sourceLocale, newMigrationData?.destination_stack?.csLocale, newMigrationData?.project_current_step, stack?.master_locale, isStackChanged, currentStack?.uid, previousStack?.uid, stack?.value, dispatch]);

  // 🔥 FALLBACK EFFECT: Triggers auto-mapping when cmsLocaleOptions is populated
  // This runs AFTER cmsLocaleOptions changes from empty to populated
  useEffect(() => {
    // This effect runs when cmsLocaleOptions changes from empty to populated
    // and triggers auto-mapping if needed
    
    if (cmsLocaleOptions?.length > 0 && 
        autoSelectedSourceLocale === null && 
        newMigrationData?.destination_stack?.sourceLocale?.length === 1) {
      
      const sourceLocaleArray = newMigrationData?.destination_stack?.sourceLocale;
      const currentLocaleMapping = newMigrationData?.destination_stack?.localeMapping || {};
      
      // Check if already mapped
      if (Object.keys(currentLocaleMapping).length > 0) {
        return; // Already mapped
      }
      
      console.info('🔥 [Fallback Auto-mapping] cmsLocaleOptions populated, triggering auto-mapping');
      
      const singleSourceLocale = { label: sourceLocaleArray[0], value: sourceLocaleArray[0] };
      const sourceLocaleValue = singleSourceLocale.value.toLowerCase();
      const destinationLocale = (stack?.master_locale || 'en-us').toLowerCase();
      
      const autoMapping = {
        [`${destinationLocale}-master_locale`]: sourceLocaleValue
      };
      
      setAutoSelectedSourceLocale({
        label: sourceLocaleValue,
        value: sourceLocaleValue
      });
      
      setMapperLocaleState({
        [destinationLocale]: {
          label: sourceLocaleValue,
          value: sourceLocaleValue
        }
      });
      
      const newMigrationDataObj: INewMigration = {
        ...newMigrationData,
        destination_stack: {
          ...newMigrationData?.destination_stack,
          localeMapping: autoMapping
        }
      };
      
      dispatch(updateNewMigrationData(newMigrationDataObj));
      
      saveLocaleMappingToBackend(autoMapping).catch((error: unknown) => {
        console.error('❌ Fallback: Failed to save auto-mapping:', error);
      });
      
      console.info('✅ [Fallback Auto-mapping] Complete:', { autoMapping });
    }
  }, [cmsLocaleOptions?.length, autoSelectedSourceLocale, newMigrationData?.destination_stack?.sourceLocale, newMigrationData?.destination_stack?.localeMapping, stack?.master_locale, dispatch, saveLocaleMappingToBackend]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setisLoading(true);
        
        const destStack = newMigrationData?.destination_stack;
        
        const allLocales: { label: string; value: string }[] = Object?.entries(
          newMigrationData?.destination_stack?.csLocale ?? {}
        ).map(([key]) => ({
          label: key,
          value: key
        }));
        
        // 🔧 FIX: On page refresh, if sourceLocale is empty, extract from localeMapping
        const rawSourceLocale = newMigrationData?.destination_stack?.sourceLocale;
        
        let sourceLocale: { label: string; value: string }[] = Array.isArray(rawSourceLocale) && rawSourceLocale.length > 0
          ? rawSourceLocale.map((item) => ({
              label: item,
              value: item
            }))
          : [];
        
        if (!sourceLocale || sourceLocale.length === 0) {
          // Extract source locales from existing locale mapping (values are source locales)
          const localeMapping = newMigrationData?.destination_stack?.localeMapping || {};
          
          const extractedSourceLocales = new Set<string>();
          
          Object.values(localeMapping).forEach((value: any) => {
            if (value && typeof value === 'string') {
              extractedSourceLocales.add(value);
            }
          });
          
          if (extractedSourceLocales.size > 0) {
            sourceLocale = Array.from(extractedSourceLocales).map(item => ({
              label: item,
              value: item
            }));
          } else {
            console.info('❌ No source locales could be extracted from locale mapping');
          }
        }
        
        setsourceLocales(sourceLocale);
        setoptions(allLocales);
        
        // Original logic for multiple locales or existing mappings
        const keys = Object?.keys(newMigrationData?.destination_stack?.localeMapping || {})?.find( key => key === `${newMigrationData?.destination_stack?.selectedStack?.master_locale}-master_locale`);
        
        // 🔧 FIX: On page refresh with existing mapping, populate cmsLocaleOptions from localeMapping
        const localeMapping = newMigrationData?.destination_stack?.localeMapping || {};
        const localeMappingEntries = Object?.entries(localeMapping);
        
        if (localeMappingEntries?.length > 0 && cmsLocaleOptions?.length === 0) {
          const mappedOptions: { label: string; value: string }[] = [];
          const processedDestLocales = new Set<string>();
          
          // Process master locales first (they take priority)
          localeMappingEntries.forEach(([key, value]) => {
            if (key.includes('-master_locale')) {
              const sourceLocaleValue = value as string; // The actual source locale, e.g., "en-us"
              const destLocale = (key.replace('-master_locale', '') || '').toLowerCase(); // Destination locale
              
              processedDestLocales.add(destLocale.toLowerCase()); // Add lowercase dest locale to set
              
              // 🔧 CRITICAL FIX: Both label AND value should be the destination locale
              // The UI will identify master locale by checking if it's the first element or by the -master_locale key in mapping
              mappedOptions.push({
                label: destLocale, // Destination locale (Contentstack master locale)
                value: destLocale  // ✅ Use actual locale value, not 'master_locale' flag
              });
            }
          });
          
          // Then process regular locales, skipping ones already processed as master
          localeMappingEntries.forEach(([key, value]) => {
            const normalizedKey = (key || '').toLowerCase();
            if (!key.includes('-master_locale') && !processedDestLocales.has(normalizedKey)) {
              const sourceLocaleValue = (value as string || '').toLowerCase();
              const destLocaleKey = normalizedKey; // Destination locale
              
              processedDestLocales.add(normalizedKey);
              
              // 🔧 CRITICAL FIX: label should be DESTINATION locale (the Contentstack locale)
              // value should be SOURCE locale (what it's mapped to from legacy CMS)
              mappedOptions.push({
                label: destLocaleKey,  // Destination locale (Contentstack)
                value: sourceLocaleValue   // Source locale (Legacy CMS)
              });
            } else {
              console.info('🔍 [LoadLanguageMapper] Skipping regular locale (already processed as master):', {
                key: normalizedKey,
                inProcessedSet: processedDestLocales.has(normalizedKey),
                processedDestLocales: Array.from(processedDestLocales)
              });
            }
          });
          
          setcmsLocaleOptions(mappedOptions);
        }
        
        if((Object?.entries(newMigrationData?.destination_stack?.localeMapping)?.length === 0 || 
        !keys || 
        currentStack?.uid !== previousStack?.uid || isStackChanged) &&
        newMigrationData?.project_current_step <= 2)
        {
         setcmsLocaleOptions((prevList: { label: string ; value: string }[]) => {
          const newLabel = stack?.master_locale ?? '';
    
            // 🔧 Check if master locale (first element) already exists
            const isPresent = prevList?.filter(
              (item: { label: string; value: string }) => (item?.label === newLabel)
            );
            if(isPresent?.[0]?.label !== newLabel || currentStack?.uid !== previousStack?.uid || isStackChanged){
              //setisStackChanged(false);
              return [
                ...prevList?.filter(item => (item?.value !== newLabel && item?.value !== '')) ?? [],
                {
                  label: newLabel,
                  value: newLabel,  // ✅ Use actual locale value
                }
              ];
            }
            if (isPresent?.length <= 0 ) {
              return [
                ...prevList,
                {
                  label: newLabel,
                  value: newLabel  // ✅ Use actual locale value
                }
              ];
            }

            return prevList;
          });}
        if (newMigrationData?.project_current_step > 2) {
          Object?.entries(newMigrationData?.destination_stack?.localeMapping || {})?.forEach(
            ([key, value]) => {
              setcmsLocaleOptions((prevList) => {
                const labelKey = key?.replace(/-master_locale$/, '');

                // Check if the key already exists in the list
                const exists = prevList?.some((item) => item?.label === labelKey);

                if (!exists) {
                  return [
                    ...prevList,
                    {
                      label: labelKey,
                      value: String(value)
                    }
                  ];
                }

                return prevList; // Return the same list if key exists
              });
            }
          );
        }
        setisLoading(false);
      } catch (error) {
        console.error('Error fetching locales:', error);
      }
    };

    fetchData();
  }, [newMigrationData?.destination_stack?.selectedStack, currentStack, newMigrationData?.destination_stack?.sourceLocale]);

  //   const fetchLocales = async () => {
  //     return await getStackLocales(newMigrationData?.destination_stack?.selectedOrg?.value);
  //   };
  
  // 🆕 CONDITION 3: Intelligent Add Language functionality with auto-suggestions
  const addRowComp = () => {
    setisStackChanged(false);
    
    // 🆕 STEP 1: Get next unmapped source locale
    const nextUnmappedSource = getNextUnmappedSourceLocale();
    
    if (!nextUnmappedSource) {
      // Fallback: No more unmapped source locales available
      setcmsLocaleOptions((prevList: { label: string; value: string }[]) => [
        ...prevList,
        {
          label: '', // 🔧 CRITICAL FIX: Empty label for manual selection
          value: ''  // Empty value for manual mapping
        }
      ]);
      return;
    }
    
    
    // 🆕 STEP 2: Check if source locale exists in destination
    const destinationMatch = findDestinationMatch(nextUnmappedSource.value);
    
    // 🆕 STEP 3 & 4: Auto-map if exists, leave empty if not
    const newRowValue = destinationMatch ? destinationMatch.value : '';
    
    // Add new row with intelligent defaults
    setcmsLocaleOptions((prevList: { label: string; value: string }[]) => [
      ...prevList,
      {
        label: nextUnmappedSource.value, // 🔧 CRITICAL FIX: Use actual source locale, not numeric index
        value: newRowValue // Auto-map or leave empty based on match
      }
    ]);
    
    // 🆕 STEP 5: Auto-select the source locale in the dropdown
    // Update the mapping state to pre-select the source locale
    setTimeout(() => {
      const newRowIndex = cmsLocaleOptions.length; // This will be the index of the new row
      
      // Update existingLocale state to pre-select the source locale
      setMapperLocaleState(prev => ({
        ...prev,
        [`${newRowIndex}`]: {
          label: nextUnmappedSource.value,
          value: nextUnmappedSource.value
        }
      }));
      
      // If there's a destination match, also update the mapping
      if (destinationMatch) {
        const updatedMapping = {
          ...newMigrationData?.destination_stack?.localeMapping,
          [destinationMatch.value]: nextUnmappedSource.value
        };
        
        const newMigrationDataObj: INewMigration = {
          ...newMigrationData,
          destination_stack: {
            ...newMigrationData?.destination_stack,
            localeMapping: updatedMapping
          }
        };
        dispatch(updateNewMigrationData(newMigrationDataObj));
        
        // 🚀 PHASE 2: Save auto-mapping to backend immediately when "Add Language" is clicked
        saveLocaleMappingToBackend(updatedMapping).catch((error: unknown) => {
          console.error('❌ Phase 2: Failed to save Add Language auto-mapping:', error);
        });
      }
    }, 100); // Small delay to ensure state updates properly
  };

  const handleDeleteLocale = (id: number, locale: { label: string; value: string }) => {
    setisStackChanged(false);
    setcmsLocaleOptions((prevList) => {
      return prevList?.filter(
        (item: { label: string; value: string }) => item?.label !== locale?.label
      )?.map((item, index) => ({
      ...item,
      label: ! item?.value ? `${index}` : item?.label, // Update label to be the index if value is empty
    }));
    });
  };
  
  return (
    <div>
      {isLoading ? (
        <CircularLoader size="small"></CircularLoader>
      ) : (
        <>
          <MiniScrollableTable
            width={'600px'}
            headerComponent={
              <TableHeader cms={newMigrationData?.legacy_cms?.selectedCms?.title} />
            }
            rowComponent={
              <Mapper
                key={uid}
                uid={stack?.value}
                options={options}
                cmsLocaleOptions={cmsLocaleOptions}
                handleLangugeDelete={handleDeleteLocale}
                sourceOptions={sourceLocales}
                isDisabled={newMigrationData?.project_current_step > 2}
                isStackChanged={isStackChanged}
                stack={stack ?? DEFAULT_DROPDOWN}
                autoSelectedSourceLocale={autoSelectedSourceLocale}
                onLocaleStateUpdate={setMapperLocaleState}
                parentLocaleState={mapperLocaleState}
              />
            }
            type="Secondary"
          />
          {/* 🔥 Only show "Add Language" button when there are unmapped source locales */}
          {(() => {
            const totalSourceLocales = newMigrationData?.destination_stack?.sourceLocale?.length || 0;
            const localeMapping = newMigrationData?.destination_stack?.localeMapping || {};
            const visibleRowsCount = cmsLocaleOptions?.length || 0;
            const isProjectCompleted = newMigrationData?.project_current_step > 2;
            
            // Hide button for single locale - nothing more to add
            if (totalSourceLocales <= 1) {
              return null;
            }
            
            // 🔥 NEW: Count only actual source locale mappings, not master locale entries
            const actualMappedSourceLocales = Object.keys(localeMapping).filter(key => 
              !key.includes('-master_locale') && // Exclude master locale entries
              localeMapping[key] !== '' && // Exclude empty mappings
              localeMapping[key] !== null && // Exclude null mappings
              localeMapping[key] !== undefined // Exclude undefined mappings
            ).length;
            
            // 🔥 NEW: Hide button when all source locales are already mapped OR all have visible rows
            if (actualMappedSourceLocales >= totalSourceLocales || 
                visibleRowsCount >= totalSourceLocales ||
                isProjectCompleted) {
              return null;
            }
            
            // Show button if there are still unmapped source locales
            return (
              <Button
                buttonType="secondary"
                aria-label="add language"
                version={'v2'}
                icon="AddPlus"
                onClick={addRowComp}
                size="small"
                disabled={false} // Always enabled when visible
              >
                Add Language
              </Button>
            );
          })()}
          
          {/* 🆕 ADDITIONAL SCENARIO: Display unmapped destination locales */}
          {(() => {
            const unmappedDestinations = getUnmappedDestinationLocales();
            
            if (unmappedDestinations.length > 0 && newMigrationData?.project_current_step <= 2) {
              return (
               <></>
              );
            }
            return null;
          })()}
        </>
      )}
    </div>
  );
};

export default LanguageMapper;
