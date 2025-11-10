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
  
  // 🔥 NEW: Also update when cmsLocaleOptions changes (to handle initial population)
  useEffect(() => {
    if (cmsLocaleOptions?.length > 0 && parentLocaleState && Object.keys(parentLocaleState).length > 0) {
      console.info('🔍 [Mapper] Re-syncing existingLocale when cmsLocaleOptions populated:', {
        cmsLocaleOptions_first: cmsLocaleOptions[0],
        parentLocaleState
      });
      
      setexistingLocale(prev => ({
        ...prev,
        ...parentLocaleState
      }));
    }
  }, [cmsLocaleOptions?.length, parentLocaleState]);

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
        isMapperProcessingRef.current = false;
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
        isMapperProcessingRef.current = false;
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
  }, [selectedMappings, saveLocaleMappingToBackend, dispatch, newMigrationData]);

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

    const selectedMappingKeys = Object.keys(selectedMappings || {});

    if (selectedMappingKeys.length === 0) {
      if (parentLocaleState && Object.keys(parentLocaleState).length > 0) {
        setexistingLocale(parentLocaleState);
      }
      setExistingField((prev) => prev);
      return;
    }

    const existingMasterID = selectedMappingKeys.find((key) =>
      key?.includes('-master_locale')
    );

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

    const preservedAutoSelection = autoSelectedSourceLocale && recentMsterLocale ? {
      [recentMsterLocale]: autoSelectedSourceLocale
    } : {};

    setexistingLocale(updatedExistingLocale);

    cmsLocaleOptions?.map((locale, index)=>{
      const existingLabel = existingMasterID;
      const expectedLabel = `${locale?.label}-master_locale`;

      const isLabelMismatch = existingLabel && existingLabel?.localeCompare(expectedLabel) !== 0;
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

          if (Object.keys(preservedAutoSelection).length > 0) {
            setexistingLocale(preservedAutoSelection);
          } else if (!autoSelectedSourceLocale) {
            setexistingLocale({});
          } else {
            setexistingLocale(() => ({
              ...parentLocaleState,
              [locale?.label]: autoSelectedSourceLocale
            }));
          }
          setExistingField({});

          const existingAutoMapping = newMigrationData?.destination_stack?.localeMapping?.[`${locale?.label}-master_locale`];
          const mappingKey = `${locale?.label}-master_locale`;

          setSelectedMappings(prev => {
            if (prev[mappingKey] === existingAutoMapping || (!existingAutoMapping && !prev[mappingKey])) {
              return prev;
            }
            return {
              ...prev,
              [mappingKey]: existingAutoMapping || '',
            };
          });

        }
        else if ( !isLabelMismatch && !isStackChanged ) {
          const key = `${locale?.label}-master_locale`
          const existingAutoMapping = newMigrationData?.destination_stack?.localeMapping?.[key];

          setSelectedMappings(prev => {
            const currentValue = prev?.[key];
            const newValue = currentValue || existingAutoMapping || '';
            if (currentValue === newValue) {
              return prev;
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


   }, [cmsLocaleOptions, autoSelectedSourceLocale, parentLocaleState, isStackChanged, newMigrationData?.destination_stack?.localeMapping, selectedMappings]);

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
        delete updatedMappings[existingLabel?.value];
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
    const selectedLocaleKey = selectedValue?.value;
    const existingLabel = existingField?.[index];

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
  

    setexistingLocale((prevLocales: ExistingFieldType) => {
      if (!prevLocales) return {};
      
       const entries = Object?.entries?.(prevLocales);

      entries?.splice?.(index, 1);

      const updatedOptions = Object?.fromEntries(
        entries?.map(([, value], newIndex) => [newIndex, value])
      );

      setselectedSourceOption((prevSelected) => {
        const newSelectedOptions: string[] = prevSelected?.filter(
          (item) => item !== sourceLocale
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
        cmsLocaleOptions?.map((locale: {label:string, value: string}, index: number) => {
          // 🔥 CRITICAL FIX: Explicitly check if locale matches stack master, don't rely on indexOf
          const stackMasterLocale = (stack?.master_locale || 'en-us').toLowerCase();
          const isMasterLocale = locale?.label?.toLowerCase() === stackMasterLocale || index === 0;
          
          return (
          <div key={locale.label} className="lang-container">
         
            {isMasterLocale ? (
              <Tooltip
                content="This is the default locale of above selected stacks and cannot be changed. Please select a corresponding language to map."
                position="top"
              >
                <div>
                  <Select
                    value={isMasterLocale ? locale : existingField[locale?.label]}
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
                    isDisabled={true}
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
                menuPlacement="auto"
              />
            )}
            <span className="span">-</span>
            {
              <Select
                value={(() => {
                  // 🔥 CRITICAL: Use isMasterLocale defined above, not indexOf
                  if (isMasterLocale) {
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
                      parentLocaleState,
                      isMasterLocale,
                      stackMasterLocale
                    });
                    
                    return value || null;
                  }
                  
                  // For non-master rows, use locale.value
                  const nonMasterValue = locale?.value ? { label: locale?.value, value: locale?.value } : null;
                  
                  console.info(`🔍 [Mapper Dropdown] Non-master row value:`, {
                    locale_label: locale?.label,
                    locale_value: locale?.value,
                    returning: nonMasterValue,
                    isMasterLocale: false
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
                menuShouldScrollIntoView={true}
                width="270px"
                version="v2"
                hideSelectedOptions={true}
                isClearable={true}
                isDisabled={isDisabled}
                menuPlacement="auto"
              />
            }
            <div className={'delete-icon'}>
              {!isMasterLocale && !isDisabled && (
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
          );
        })
      ) : (
        <Info
          className="info-tag"
          icon={<Icon icon="Information" version="v2" size="small"></Icon>}
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
  const [autoSelectedSourceLocale, setAutoSelectedSourceLocale] = useState<{ label: string; value: string } | null>(null);
  const [mapperLocaleState, setMapperLocaleState] = useState<ExistingFieldType>({});

  const prevStackRef: React.MutableRefObject<IDropDown | null> = useRef(null);
  const lastAutoMappingRef = useRef<string>('');
  const localeMappingRef = useRef<Record<string, string>>({});
  const lastInputDataRef = useRef<string>('');
  const isProcessingRef = useRef<boolean>(false);
  const prevCmsLocaleOptionsRef = useRef<{ label: string; value: string }[]>([]);

  // 🔥 DEBUG: Log whenever cmsLocaleOptions changes to catch reordering
  useEffect(() => {
    if (cmsLocaleOptions?.length > 0) {
      const currentFirst = cmsLocaleOptions[0];
      const prevFirst = prevCmsLocaleOptionsRef.current[0];
      
      if (prevFirst && currentFirst?.label !== prevFirst?.label) {
        console.warn('⚠️ [LanguageMapper] cmsLocaleOptions ORDER CHANGED!', {
          previous_first: prevFirst,
          current_first: currentFirst,
          previous_full: prevCmsLocaleOptionsRef.current,
          current_full: cmsLocaleOptions,
          stack_master_locale: stack?.master_locale
        });
      }
      
      prevCmsLocaleOptionsRef.current = [...cmsLocaleOptions];
    }
  }, [cmsLocaleOptions, stack?.master_locale]);

  // 🚀 PHASE 1: Helper function to save locale mapping to backend immediately
  const saveLocaleMappingToBackend = useCallback(async (localeMapping: Record<string, string>) => {
    try {
      const master_locale: Record<string, string> = {};
      const locales: Record<string, string> = {};

      Object.entries(localeMapping).forEach(([key, value]) => {
        const normalizedKey = key.toLowerCase();
        const normalizedValue = (value || '').toLowerCase();
        
        if (key.includes('master_locale')) {
          const sourceKey = normalizedKey.replace('-master_locale', '');
          master_locale[sourceKey] = normalizedValue;
        } else {
          locales[normalizedKey] = normalizedValue;
        }
      });

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
    const directMatch = availableContentstackLocales.find(locale => locale.value === sourceLocaleCode);
    if (directMatch) {
      return sourceLocaleCode;
    }

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
      'eg': ['ar-eg', 'en-eg', 'ar-ae']
    };

    const possibleMappings = commonMappings[sourceLocaleCode] || [];
    
    for (const candidate of possibleMappings) {
      const match = availableContentstackLocales.find(locale => locale.value === candidate);
      if (match) {
        return candidate;
      }
    }

    const fallback = availableContentstackLocales.find(locale => locale.value === 'en-us');
    return fallback ? 'en-us' : availableContentstackLocales[0]?.value || sourceLocaleCode;
  };

  const getNextUnmappedSourceLocale = (): { label: string; value: string } | null => {
    if (!sourceLocales || sourceLocales.length === 0) return null;
    
    const localeMapping = newMigrationData?.destination_stack?.localeMapping || {};
    const mappedSourceLocales = Object.keys(localeMapping)
      .filter(key => !key.includes('-master_locale'))
      .filter(key => localeMapping[key] !== '' && localeMapping[key] !== null && localeMapping[key] !== undefined);
    
    const unmappedLocale = sourceLocales.find(source => 
      !mappedSourceLocales.includes(source.value)
    );
    
    return unmappedLocale || null;
  };

  const findDestinationMatch = (sourceLocale: string): { label: string; value: string } | null => {
    const exactMatch = options.find(dest => 
      dest.value.toLowerCase() === sourceLocale.toLowerCase()
    );
    
    if (exactMatch) {
      return exactMatch;
    }
    
    const smartMatch = getSmartLocaleMapping(sourceLocale, options);
    const smartMatchObj = options.find(dest => dest.value === smartMatch);
    
    return smartMatchObj || null;
  };
  
  const getUnmappedDestinationLocales = (): { label: string; value: string }[] => {
    const mappedDestinations = Object.keys(newMigrationData?.destination_stack?.localeMapping || {})
      .filter(key => !key.includes('-master_locale'));
    
    return options.filter(dest => 
      !mappedDestinations.includes(dest.value) &&
      dest.value !== stack?.master_locale
    );
  };

  // 🚀 UNIVERSAL LOCALE AUTO-MAPPING (All CMS platforms) 
  useEffect(() => {
    if (isProcessingRef.current) {
      return;
    }
    
    const sourceLocaleArray = newMigrationData?.destination_stack?.sourceLocale || [];
    const csLocaleObj = newMigrationData?.destination_stack?.csLocale || {};
    const currentStep = newMigrationData?.project_current_step;
    const masterLocale = stack?.master_locale;
    const stackUid = currentStack?.uid;
    
    const inputDataKey = JSON.stringify({
      sourceLocale: sourceLocaleArray,
      csLocale: Object.keys(csLocaleObj),
      currentStep,
      masterLocale,
      stackUid,
      isStackChanged
    });
    
    if (inputDataKey === lastInputDataRef.current) {
      return;
    }
    
    const currentLocaleMapping = newMigrationData?.destination_stack?.localeMapping || {};
    const currentLocaleMappingKey = JSON.stringify(currentLocaleMapping);
    if (currentLocaleMappingKey === lastAutoMappingRef.current && lastInputDataRef.current !== '') {
      return;
    }
    
    isProcessingRef.current = true;

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

    const stackHasChanged = currentStack?.uid !== previousStack?.uid || 
                           isStackChanged || 
                           previousStack === undefined;

    const keys = Object?.keys(currentLocaleMapping)?.find( key => key === `${newMigrationData?.destination_stack?.selectedStack?.master_locale}-master_locale`);
    
    if (!sourceLocale || sourceLocale.length === 0) {
      const reduxSourceLocale = newMigrationData?.destination_stack?.sourceLocale;
      if (reduxSourceLocale && reduxSourceLocale.length > 0) {
        sourceLocale = reduxSourceLocale.map((item: string) => ({ label: item, value: item }));
      } else {
        console.warn('❌ No source locales found - exiting auto-mapping');
        isProcessingRef.current = false;
        return;
      }
    }
    
    if (!allLocales || allLocales.length === 0) {
      const masterLocaleObj = { label: stack?.master_locale || 'en-us', value: stack?.master_locale || 'en-us' };
      setoptions([masterLocaleObj]);
      isProcessingRef.current = false;
      return;
    }
    
    const shouldAutoMapSingle = (Object?.entries(currentLocaleMapping)?.length === 0 || 
                                !keys || 
                                stackHasChanged);
    
    if (cmsLocaleOptions?.length === 0 && allLocales?.length > 0) {
      console.info('🔥 [Auto-mapping] cmsLocaleOptions is empty, populating with master locale');
      
      const masterLocale = (stack?.master_locale || 'en-us').toLowerCase();
      const mappedOptions: { label: string; value: string }[] = [];
      
      mappedOptions.push({
        label: masterLocale,
        value: masterLocale
      });
      
      setcmsLocaleOptions(mappedOptions);
      
      console.info('🔥 [Auto-mapping] Set cmsLocaleOptions to:', mappedOptions);
    }
    
    if (stackHasChanged && Object?.entries(currentLocaleMapping)?.length > 0) {
      const emptyMapping = {};
      const clearMappingKey = JSON.stringify(emptyMapping);
      lastAutoMappingRef.current = clearMappingKey;
      localeMappingRef.current = emptyMapping;
      lastInputDataRef.current = inputDataKey;
      
      const newMigrationDataObj: INewMigration = {
        ...newMigrationData,
        destination_stack: {
          ...newMigrationData?.destination_stack,
          localeMapping: emptyMapping
        }
      };
      dispatch(updateNewMigrationData(newMigrationDataObj));
      
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 0);
      return;
    }
    
    if (sourceLocale?.length === 1 && 
        allLocales?.length > 0 && 
        shouldAutoMapSingle && 
        newMigrationData?.project_current_step <= 2) {
      
      const singleSourceLocale = sourceLocale[0];
      
      const existingMapping = currentLocaleMapping;
      const hasManualMapping = Object.keys(existingMapping).some(key => 
        existingMapping[key] === singleSourceLocale.value && !key.includes('master_locale')
      );
      
      if (hasManualMapping) {
        if (isStackChanged) {
          setisStackChanged(false);
        }
        isProcessingRef.current = false;
        return;
      }
      
      const sourceLocaleValue = (singleSourceLocale.value || singleSourceLocale.label || '').toLowerCase();
      const destinationLocale = (stack?.master_locale || 'en-us').toLowerCase();
      
      const hasExactDestination = allLocales.some(dest => {
        const destValue = (dest.value || dest.label || '').toLowerCase();
        return destValue === sourceLocaleValue;
      });
      
      if (!hasExactDestination && sourceLocaleValue !== destinationLocale) {
        console.info('⚠️ [Single Locale] No exact destination match found. Leaving master locale unmapped.', {
          sourceLocaleValue,
          destinationLocale,
          allLocales: allLocales.map(dest => dest.value || dest.label)
        });
        
        if (cmsLocaleOptions?.length === 0) {
          setcmsLocaleOptions([{
            label: destinationLocale,
            value: destinationLocale
          }]);
        }
        
        setAutoSelectedSourceLocale(null);
        setMapperLocaleState({});
        if (isStackChanged) {
          setisStackChanged(false);
        }
        setTimeout(() => {
          isProcessingRef.current = false;
        }, 0);
        return;
      }
      
      console.info('🔥 [Single Locale Auto-Map] Mapping single source to destination master:', {
        source: sourceLocaleValue,
        destination: destinationLocale,
        source_locale_object: singleSourceLocale,
        stack_master_locale: stack?.master_locale,
        reason: hasExactDestination ? 'Exact destination match found' : 'Source equals master locale'
      });
      
      const autoMapping = {
        [`${destinationLocale}-master_locale`]: sourceLocaleValue
      };
      
      const autoMappingKey = JSON.stringify(autoMapping);
      lastAutoMappingRef.current = autoMappingKey;
      localeMappingRef.current = { ...autoMapping };
      lastInputDataRef.current = inputDataKey;
      
      const normalizedValue = sourceLocaleValue;
      setAutoSelectedSourceLocale({
        label: normalizedValue,
        value: normalizedValue
      });
      
      console.info('🔥 [Single Locale] Set autoSelectedSourceLocale:', {
        label: normalizedValue,
        value: normalizedValue
      });
      
      const masterLocaleKey = destinationLocale;
      
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
      
      saveLocaleMappingToBackend(autoMapping).catch((error: unknown) => {
        console.error('❌ Phase 2: Failed to save auto-mapping:', error);
      });
      
      console.info('✅ [Auto-mapping Complete] Single Locale:', {
        autoMapping,
        autoSelectedSourceLocale: { label: normalizedValue, value: normalizedValue },
        mapperLocaleState: updatedMapperState,
        cmsLocaleOptions
      });
      
      if (isStackChanged) {
        setisStackChanged(false);
      }
      
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 0);
    } 
    else if (sourceLocale?.length > 1 && 
             allLocales?.length > 0 && 
             newMigrationData?.project_current_step <= 2) {
      
      console.info('🔥 [Multi-locale Auto-Map] Starting multi-locale logic:', {
        sourceLocales: sourceLocale.map(s => s.value),
        destinationMasterLocale: stack?.master_locale,
        currentMapping: currentLocaleMapping,
        cmsLocaleOptions_length: cmsLocaleOptions?.length,
        cmsLocaleOptions_first: cmsLocaleOptions[0]
      });
      
      const existingMapping = currentLocaleMapping;
      const hasManualMappings = Object.keys(existingMapping).filter(key => !key.includes('master_locale')).length > 0;
      
      if (hasManualMappings && stackHasChanged) {
        console.info('⚠️ [TC-10] User has manual mappings, preserving them');
        if (isStackChanged) {
          setisStackChanged(false);
        }
        setTimeout(() => {
          isProcessingRef.current = false;
        }, 0);
        return;
      }
      
      const mappedSourceLocales = Object.keys(existingMapping).filter(key => 
        !key.includes('-master_locale') && existingMapping[key] !== '' && existingMapping[key] !== null
      );
      
      const allSourcesAlreadyMapped = sourceLocale.every(source => {
        const sourceValue = (source.value || source.label || '').toLowerCase();
        return mappedSourceLocales.includes(sourceValue) || 
               existingMapping[`${sourceValue}-master_locale`] !== undefined;
      });
      
      if (allSourcesAlreadyMapped && !stackHasChanged) {
        console.info('✅ All source locales already mapped, skipping auto-mapping');
        setTimeout(() => {
          isProcessingRef.current = false;
        }, 0);
        return;
      }
      
      const normalizedStackMaster = (stack?.master_locale || 'en-us').toLowerCase();
      
      const exactMatches: Array<{ source: string; dest: string }> = [];
      const unmatchedSources: string[] = [];
      
      sourceLocale.forEach(source => {
        const sourceValue = (source.value || source.label || '').toLowerCase();
        
        const destMatch = allLocales.find(dest => {
          const destValue = (dest.value || dest.label || '').toLowerCase();
          return destValue === sourceValue;
        });
        
        if (destMatch) {
          const destValue = (destMatch.value || destMatch.label || '').toLowerCase();
          exactMatches.push({ source: sourceValue, dest: destValue });
          console.info(`✅ [TC-01/TC-03/TC-05/TC-07] Exact match found: ${sourceValue} -> ${destValue}`);
        } else {
          unmatchedSources.push(sourceValue);
          console.info(`❌ [TC-04/TC-06/TC-08] No match for source: ${sourceValue}`);
        }
      });
      
      const autoMapping: Record<string, string> = {};
      
      const masterLocaleMatch = exactMatches.find(match => match.source === normalizedStackMaster);
      
      if (masterLocaleMatch) {
        console.info(`🎯 [TC-03/TC-07] Master locale match: ${masterLocaleMatch.source} -> ${masterLocaleMatch.dest}`);
        autoMapping[`${masterLocaleMatch.dest}-master_locale`] = masterLocaleMatch.source;
        autoMapping[masterLocaleMatch.source] = masterLocaleMatch.dest;
      } else {
        const firstSource = sourceLocale[0];
        const firstSourceValue = (firstSource.value || firstSource.label || '').toLowerCase();
        console.info(`🎯 [TC-04/TC-08] No master match, mapping first source to master: ${firstSourceValue} -> ${normalizedStackMaster}`);
        autoMapping[`${normalizedStackMaster}-master_locale`] = firstSourceValue;
      }
      
      exactMatches.forEach(match => {
        if (match.source === normalizedStackMaster && masterLocaleMatch) {
          return;
        }
        
        console.info(`➕ [TC-03/TC-05/TC-07] Adding exact match: ${match.source} -> ${match.dest}`);
        autoMapping[match.source] = match.dest;
      });
      
      const leftoverAssignments: Array<{ source: string; dest: string }> = [];
      const assignedDestinations = new Set<string>();
      if (masterLocaleMatch) {
        assignedDestinations.add(masterLocaleMatch.dest);
      }
      exactMatches.forEach(match => {
        if (!(match.source === normalizedStackMaster && masterLocaleMatch)) {
          assignedDestinations.add(match.dest);
        }
      });
      assignedDestinations.add(normalizedStackMaster);
      
      const availableDestLocales = allLocales
        .map(dest => (dest.value || dest.label || '').toLowerCase())
        .filter(dest => dest && dest !== normalizedStackMaster && !assignedDestinations.has(dest));
      
      unmatchedSources.forEach((sourceValue, idx) => {
        const candidateDest = availableDestLocales[idx];
        if (!candidateDest) {
          console.info('⚠️ [TC-03/TC-08] No available destination locale to assign for:', { sourceValue });
          return;
        }
        console.info('🎯 [TC-03] Assigning unmatched source to remaining destination:', {
          sourceValue,
          candidateDest
        });
        autoMapping[sourceValue] = candidateDest;
        leftoverAssignments.push({ source: sourceValue, dest: candidateDest });
        assignedDestinations.add(candidateDest);
      });
      
      const destinationLocalesInMapping = new Set<string>();
      destinationLocalesInMapping.add(normalizedStackMaster);
      exactMatches.forEach(match => {
        destinationLocalesInMapping.add(match.dest);
      });
      leftoverAssignments.forEach(assign => {
        destinationLocalesInMapping.add(assign.dest);
      });
      
      setcmsLocaleOptions(() => {
        const newList: { label: string; value: string }[] = [];
        const processedLocales = new Set<string>();
        
        if (!processedLocales.has(normalizedStackMaster)) {
          newList.push({
            label: normalizedStackMaster,
            value: normalizedStackMaster
          });
          processedLocales.add(normalizedStackMaster);
        }
        
        destinationLocalesInMapping.forEach(destLocale => {
          if (!processedLocales.has(destLocale)) {
            newList.push({
              label: destLocale,
              value: destLocale
            });
            processedLocales.add(destLocale);
          }
        });
        
        console.info('🔥 [Multi-locale] Updated cmsLocaleOptions (master GUARANTEED first):', {
          newList,
          first: newList[0],
          second: newList[1],
          length: newList.length,
          orderedDestLocales: Array.from(destinationLocalesInMapping),
          VERIFY_MASTER_IS_FIRST: newList[0]?.label === normalizedStackMaster
        });
        return newList;
      });
      
      const updatedMapperState: ExistingFieldType = {};
      
      if (masterLocaleMatch) {
        updatedMapperState[normalizedStackMaster] = {
          label: masterLocaleMatch.source,
          value: masterLocaleMatch.source
        };
        console.info('🔥 [Multi-locale] Set master row:', {
          key: normalizedStackMaster,
          value: masterLocaleMatch.source,
          full_object: updatedMapperState[normalizedStackMaster]
        });
      } else {
        const firstSourceValue = (sourceLocale[0].value || sourceLocale[0].label || '').toLowerCase();
        updatedMapperState[normalizedStackMaster] = {
          label: firstSourceValue,
          value: firstSourceValue
        };
        console.info('🔥 [Multi-locale] Set master row (no match):', {
          key: normalizedStackMaster,
          value: firstSourceValue,
          full_object: updatedMapperState[normalizedStackMaster]
        });
      }
      
      exactMatches.forEach(match => {
        if (match.dest === normalizedStackMaster) {
          console.info('🔥 [Multi-locale] Skipping duplicate master:', {
            match_dest: match.dest,
            normalizedStackMaster
          });
          return;
        }
        
        updatedMapperState[match.dest] = {
          label: match.source,
          value: match.source
        };
        console.info('🔥 [Multi-locale] Set non-master row:', {
          key: match.dest,
          value: match.source,
          full_object: updatedMapperState[match.dest]
        });
      });
      
      leftoverAssignments.forEach(assign => {
        updatedMapperState[assign.dest] = {
          label: assign.source,
          value: assign.source
        };
        console.info('🔥 [Multi-locale] Set leftover row:', {
          key: assign.dest,
          value: assign.source,
          full_object: updatedMapperState[assign.dest]
        });
      });
      
      console.info('🔥 [Multi-locale] Final mapperLocaleState:', {
        updatedMapperState,
        keys: Object.keys(updatedMapperState),
        first_key: Object.keys(updatedMapperState)[0],
        first_value: Object.values(updatedMapperState)[0]
      });
      setMapperLocaleState(updatedMapperState);
      
      const autoMappingKey = JSON.stringify(autoMapping);
      lastAutoMappingRef.current = autoMappingKey;
      localeMappingRef.current = { ...autoMapping };
      lastInputDataRef.current = inputDataKey;
      
      const newMigrationDataObj: INewMigration = {
        ...newMigrationData,
        destination_stack: {
          ...newMigrationData?.destination_stack,
          localeMapping: autoMapping
        }
      };
      dispatch(updateNewMigrationData(newMigrationDataObj));
      
      saveLocaleMappingToBackend(autoMapping).catch((error: unknown) => {
        console.error('❌ Failed to save multi-locale auto-mapping:', error);
      });
      
      console.info('✅ [Multi-locale Auto-mapping Complete]:', {
        autoMapping,
        exactMatches,
        unmatchedSources,
        updatedMapperState,
        cmsLocaleOptions_set: Array.from(destinationLocalesInMapping)
      });
      
      setAutoSelectedSourceLocale(null);
      
      if (isStackChanged) {
        setisStackChanged(false);
      }
      
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 0);
    } 
    else {
      setAutoSelectedSourceLocale(null);
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 0);
    }
  }, [newMigrationData?.destination_stack?.sourceLocale, newMigrationData?.destination_stack?.csLocale, newMigrationData?.project_current_step, stack?.master_locale, isStackChanged, currentStack?.uid, previousStack?.uid, stack?.value, dispatch, cmsLocaleOptions?.length, saveLocaleMappingToBackend, newMigrationData, currentStack, previousStack]);

  useEffect(() => {
    if (cmsLocaleOptions?.length > 0 && 
        autoSelectedSourceLocale === null && 
        newMigrationData?.destination_stack?.sourceLocale?.length === 1) {
      
      const sourceLocaleArray = newMigrationData?.destination_stack?.sourceLocale;
      const currentLocaleMapping = newMigrationData?.destination_stack?.localeMapping || {};
      
      if (Object.keys(currentLocaleMapping).length > 0) {
        return;
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
  }, [cmsLocaleOptions?.length, autoSelectedSourceLocale, newMigrationData?.destination_stack?.sourceLocale, newMigrationData?.destination_stack?.localeMapping, stack?.master_locale, dispatch, saveLocaleMappingToBackend, newMigrationData]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setisLoading(true);
        
        const rawSourceLocale = newMigrationData?.destination_stack?.sourceLocale;
        
        let sourceLocale: { label: string; value: string }[] = Array.isArray(rawSourceLocale) && rawSourceLocale.length > 0
          ? rawSourceLocale.map((item) => ({
              label: item,
              value: item
            }))
          : [];
        
        if (!sourceLocale || sourceLocale.length === 0) {
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
        
        const allLocales: { label: string; value: string }[] = Object?.entries(
          newMigrationData?.destination_stack?.csLocale ?? {}
        ).map(([key]) => ({
          label: key,
          value: key
        }));
        
        setsourceLocales(sourceLocale);
        setoptions(allLocales);
        
        const keys = Object?.keys(newMigrationData?.destination_stack?.localeMapping || {})?.find( key => key === `${newMigrationData?.destination_stack?.selectedStack?.master_locale}-master_locale`);
        
        const localeMapping = newMigrationData?.destination_stack?.localeMapping || {};
        const localeMappingEntries = Object?.entries(localeMapping);
        
        if (localeMappingEntries?.length > 0 && cmsLocaleOptions?.length === 0) {
          const mappedOptions: { label: string; value: string }[] = [];
          const processedDestLocales = new Set<string>();
          const initialMapperState: ExistingFieldType = {};
          
          // 🔥 CRITICAL FIX: ALWAYS use stack.master_locale as the FIRST element
          const stackMasterLocale = (stack?.master_locale || 'en-us').toLowerCase();
          
          // ✅ STEP 1: Add stack master locale FIRST (guaranteed)
          mappedOptions.push({
            label: stackMasterLocale,
            value: stackMasterLocale
          });
          processedDestLocales.add(stackMasterLocale);
          
          // Also populate mapperState for master locale
          const masterMappingEntry = localeMappingEntries.find(([key]) => 
            key.includes('-master_locale') && key.replace('-master_locale', '').toLowerCase() === stackMasterLocale
          );
          
          if (masterMappingEntry) {
            const [, sourceValue] = masterMappingEntry;
            const normalizedSourceValue = (sourceValue as string || '').toLowerCase();
            initialMapperState[stackMasterLocale] = {
              label: normalizedSourceValue,
              value: normalizedSourceValue
            };
            
            console.info('🔥 [LoadLanguageMapper] Set master locale mapping:', {
              dest_key: stackMasterLocale,
              source_value: normalizedSourceValue
            });
          }
          
          console.info('🔥 [LoadLanguageMapper] Added STACK MASTER locale first:', {
            label: stackMasterLocale,
            value: stackMasterLocale,
            from: 'stack.master_locale',
            stack_master_locale: stack?.master_locale
          });
          
          // ✅ STEP 2: Add any OTHER destination locales from the mapping (excluding master)
          localeMappingEntries.forEach(([key, value]) => {
            const normalizedKey = (key || '').toLowerCase().replace('-master_locale', '');
            
            // Skip if already processed (master) or if it's the same as stack master
            if (processedDestLocales.has(normalizedKey)) {
              console.info('🔍 [LoadLanguageMapper] Skipping already processed locale:', {
                normalizedKey,
                stackMasterLocale,
                isStackMaster: normalizedKey === stackMasterLocale
              });
              return;
            }
            
            // Skip master_locale keys (we only want regular mappings here)
            if (key.includes('-master_locale')) {
              return;
            }
            
            // Only add unique destination locales
            processedDestLocales.add(normalizedKey);
            mappedOptions.push({
              label: normalizedKey,
              value: normalizedKey
            });
            
            // Also populate mapperState for this locale
            const normalizedSourceValue = (value as string || '').toLowerCase();
            initialMapperState[normalizedKey] = {
              label: normalizedSourceValue,
              value: normalizedSourceValue
            };
            
            console.info('✅ [LoadLanguageMapper] Added additional destination locale:', {
              label: normalizedKey,
              value: normalizedKey,
              source_value: normalizedSourceValue,
              from: key
            });
          });
          
          console.info('🔥 [LoadLanguageMapper] Final cmsLocaleOptions order:', {
            mappedOptions,
            first: mappedOptions[0],
            second: mappedOptions[1],
            length: mappedOptions.length,
            VERIFY_MASTER_FIRST: mappedOptions[0]?.label === stackMasterLocale
          });
          
          console.info('🔥 [LoadLanguageMapper] Setting initial mapperLocaleState:', {
            initialMapperState,
            keys: Object.keys(initialMapperState),
            first_key: Object.keys(initialMapperState)[0],
            first_value: Object.values(initialMapperState)[0]
          });
          
          setcmsLocaleOptions(mappedOptions);
          setMapperLocaleState(initialMapperState);
        }
        
        if((Object?.entries(newMigrationData?.destination_stack?.localeMapping)?.length === 0 || 
        !keys || 
        currentStack?.uid !== previousStack?.uid || isStackChanged) &&
        newMigrationData?.project_current_step <= 2)
        {
        setcmsLocaleOptions((prevList: { label: string; value: string }[] = []) => {
          const normalizedMaster = (stack?.master_locale || 'en-us').toLowerCase();

          const cleanedPrev = prevList.filter(
            (item) => item?.label && item?.label.trim() !== ''
          );

          const existingMaster = cleanedPrev.find(
            (item) => item?.label?.toLowerCase() === normalizedMaster
          );

          const masterEntry = existingMaster || {
            label: normalizedMaster,
            value: normalizedMaster
          };

          const rest = cleanedPrev.filter(
            (item) => item?.label?.toLowerCase() !== normalizedMaster
          );

          const reorderedList = [masterEntry, ...rest];

          console.info('🔥 [LoadLanguageMapper] Normalized cmsLocaleOptions (master first):', {
            previous: prevList,
            reorderedList,
            masterEntry,
            normalizedMaster
          });

          return reorderedList;
        });}
        if (newMigrationData?.project_current_step > 2) {
          Object?.entries(newMigrationData?.destination_stack?.localeMapping || {})?.forEach(
            ([key, value]) => {
              setcmsLocaleOptions((prevList) => {
                const labelKey = key?.replace(/-master_locale$/, '');

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

                return prevList;
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
  }, [newMigrationData?.destination_stack?.selectedStack, currentStack, newMigrationData?.destination_stack?.sourceLocale, cmsLocaleOptions?.length, isStackChanged, previousStack?.uid, stack?.master_locale, newMigrationData?.destination_stack?.localeMapping, newMigrationData?.project_current_step]);

  const addRowComp = () => {
    setisStackChanged(false);
    
    const nextUnmappedSource = getNextUnmappedSourceLocale();
    
    if (!nextUnmappedSource) {
      setcmsLocaleOptions((prevList: { label: string; value: string }[]) => [
        ...prevList,
        {
          label: '',
          value: ''
        }
      ]);
      return;
    }
    
    const destinationMatch = findDestinationMatch(nextUnmappedSource.value);
    
    const newRowValue = destinationMatch ? destinationMatch.value : '';
    
    setcmsLocaleOptions((prevList: { label: string; value: string }[]) => [
      ...prevList,
      {
        label: nextUnmappedSource.value,
        value: newRowValue
      }
    ]);
    
    setTimeout(() => {
      const newRowIndex = cmsLocaleOptions.length;
      
      setMapperLocaleState(prev => ({
        ...prev,
        [`${newRowIndex}`]: {
          label: nextUnmappedSource.value,
          value: nextUnmappedSource.value
        }
      }));
      
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
        
        saveLocaleMappingToBackend(updatedMapping).catch((error: unknown) => {
          console.error('❌ Phase 2: Failed to save Add Language auto-mapping:', error);
        });
      }
    }, 100);
  };

  const handleDeleteLocale = (id: number, locale: { label: string; value: string }) => {
    setisStackChanged(false);
    setcmsLocaleOptions((prevList) => {
      return prevList?.filter(
        (item: { label: string; value: string }) => item?.label !== locale?.label
      )?.map((item, index) => ({
      ...item,
      label: ! item?.value ? `${index}` : item?.label,
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
          {(() => {
            const totalSourceLocales = newMigrationData?.destination_stack?.sourceLocale?.length || 0;
            const localeMapping = newMigrationData?.destination_stack?.localeMapping || {};
            const visibleRowsCount = cmsLocaleOptions?.length || 0;
            const isProjectCompleted = newMigrationData?.project_current_step > 2;
            
            if (totalSourceLocales <= 1) {
              return null;
            }
            
            const actualMappedSourceLocales = Object.keys(localeMapping).filter(key => 
              !key.includes('-master_locale') &&
              localeMapping[key] !== '' &&
              localeMapping[key] !== null &&
              localeMapping[key] !== undefined
            ).length;
            
            if (actualMappedSourceLocales >= totalSourceLocales || 
                visibleRowsCount >= totalSourceLocales ||
                isProjectCompleted) {
              return null;
            }
            
            return (
              <Button
                buttonType="secondary"
                aria-label="add language"
                version={'v2'}
                icon="AddPlus"
                onClick={addRowComp}
                size="small"
                disabled={false}
              >
                Add Language
              </Button>
            );
          })()}
          
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