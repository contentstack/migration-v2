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
import { useEffect, useRef, useState } from 'react';
import TableHeader from './tableHeader'
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { updateNewMigrationData } from '../../../store/slice/migrationDataSlice';
import { DEFAULT_DROPDOWN, IDropDown, INewMigration } from '../../../context/app/app.interface';
import {CS_ENTRIES} from '../../../utilities/constants';

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
  key,
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
  const [selectedMappings, setSelectedMappings] = useState<{ [key: string]: string }>({});
  const [existingField, setExistingField] = useState<ExistingFieldType>({});
  const [existingLocale, setexistingLocale] = useState<ExistingFieldType>({});

  // 🔥 Sync with parent state when auto-mapping occurs
  useEffect(() => {
    if (parentLocaleState && Object.keys(parentLocaleState).length > 0) {
      console.info('🔄 Syncing child existingLocale with parent state:', parentLocaleState);
      setexistingLocale(prev => ({
        ...prev,
        ...parentLocaleState
      }));
    }
  }, [parentLocaleState]);
  const [selectedCsOptions, setselectedCsOption] = useState<string[]>([]);
  const [selectedSourceOption, setselectedSourceOption] = useState<string[]>([]);
  const [csOptions, setcsOptions] = useState(options);
  const [sourceoptions, setsourceoptions] = useState(sourceOptions);
  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);
  const dispatch = useDispatch();
  // const [selectedStack, setSelectedStack] = useState<IDropDown>();
  const [placeholder] = useState<string>('Select language');

  // useEffect(()=>{
  //   setSelectedStack(stack);
  // },[]);

  useEffect(() => {
    const newMigrationDataObj: INewMigration = {
      ...newMigrationData,
      destination_stack: {
        ...newMigrationData?.destination_stack,
        localeMapping: selectedMappings
      }
    };

    dispatch(updateNewMigrationData(newMigrationDataObj));
  }, [selectedMappings]);

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
    let updatedSelectedMappings = { ...selectedMappings };

    // const validLabels = cmsLocaleOptions?.map((item)=> item?.label);

    const existingMasterID = Object?.keys?.(selectedMappings || {})?.find((key) =>
      key?.includes('-master_locale')
    );

    const recentMsterLocale = cmsLocaleOptions?.find((item) => item?.value === 'master_locale')?.label;
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

    setexistingLocale(updatedExistingLocale);

    cmsLocaleOptions?.map((locale, index)=>{
      const existingLabel = existingMasterID;
      const expectedLabel = `${locale?.label}-master_locale`;

      const isLabelMismatch = existingLabel && existingLabel?.localeCompare(expectedLabel) !== 0;
      if(locale?.value === 'master_locale'){
        if (!updatedExistingField?.[index]) {
          updatedExistingField[index] = {
            label: `${locale?.label}`,
            value: `${locale?.label}-master_locale`,
          };
        }

  
        if (isLabelMismatch || isStackChanged) {
          setselectedCsOption([]);
          setselectedSourceOption([]);
          setexistingLocale({});
          setExistingField({});

          updatedSelectedMappings = {
            [`${locale?.label}-master_locale`]: '',
          };
          setSelectedMappings(updatedSelectedMappings);
          
        }
        else if ( !isLabelMismatch && !isStackChanged ) {
          const key = `${locale?.label}-master_locale`
            updatedSelectedMappings = {
            [key]: updatedSelectedMappings?.[`${locale?.label}-master_locale`] ? updatedSelectedMappings?.[`${locale?.label}-master_locale`] : '',
          };
          setSelectedMappings(updatedSelectedMappings);
        }
      }        
    })
  
    setExistingField(updatedExistingField);
  
   
   }, [cmsLocaleOptions]);

  // 🚀 Auto-select single source locale in the master locale row
  // This runs after the clearing logic to ensure auto-selection persists
  useEffect(() => {
    if (autoSelectedSourceLocale && cmsLocaleOptions?.length > 0) {
      const masterLocaleRow = cmsLocaleOptions.find(locale => locale.value === 'master_locale');
      if (masterLocaleRow) {
        // Use setTimeout to ensure this runs after other state updates
        setTimeout(() => {
          const updater = (prev: ExistingFieldType) => ({
            ...prev,
            [masterLocaleRow.label]: autoSelectedSourceLocale
          });
          setexistingLocale(updater);
          onLocaleStateUpdate?.(updater);
        }, 0);
      }
    }
  }, [autoSelectedSourceLocale, cmsLocaleOptions, isStackChanged]);

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
    
        if(updatedMappings?.[CS_ENTRIES?.UNMAPPED_LOCALE_KEY] === existingLocale?.[index]?.label){
          updatedMappings[selectedLocaleKey] = existingLocale?.[index]?.label;
          delete updatedMappings?.[CS_ENTRIES?.UNMAPPED_LOCALE_KEY];  
        }else{
           const oldlabel = Object?.keys?.(updatedMappings)?.[index - 1];
           
           // Delete old key and assign to new key
          delete updatedMappings?.[oldlabel];
          updatedMappings[selectedLocaleKey] = existingLocale?.[index]?.label
            ? existingLocale?.[index]?.label
            : '';
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

        updatedMappings[existingLabel?.value ?? index] = selectedValue?.label
          ? selectedValue?.label
          : '';
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
      ) : cmsLocaleOptions?.length > 0  ? (
        cmsLocaleOptions?.map((locale: {label:string, value: string}, index: number) => (
          
          <div key={locale.label} className="lang-container">
         
            {locale?.value === 'master_locale' ? (
              <Tooltip
                content="This is the master locale of above selected stacks and cannot be changed. Please select a corresponding language to map."
                position="top"
              >
                <div>
                  <Select
                    value={locale?.value === 'master_locale' ? locale : existingField[locale?.label]}
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
                value={
                  locale?.value && locale?.value !== 'master_locale'
                    ? { label: locale?.value, value: locale?.value }
                    : existingLocale[locale?.label]
                }
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
              {locale?.value !== 'master_locale' && !isDisabled && (
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
          content="No langauges configured"
          type="light"
        />
      )}
    </>
  );
};

const LanguageMapper = ({stack, uid} :{ stack : IDropDown, uid : string}) => {

  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);
  const dispatch = useDispatch();
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
    
    // Get currently mapped source locales (values from localeMapping)
    const mappedSourceLocales = Object.values(newMigrationData?.destination_stack?.localeMapping || {})
      .filter(Boolean) // Remove empty strings
      .filter(locale => locale !== stack?.master_locale); // Exclude master locale
    
    // Find first unmapped source locale
    const unmappedLocale = sourceLocales.find(source => 
      !mappedSourceLocales.includes(source.value) && 
      source.value !== stack?.master_locale // Don't suggest master locale again
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
      console.info(`🎯 Exact match found for ${sourceLocale}: ${exactMatch.value}`);
      return exactMatch;
    }
    
    // 🆕 STEP 2: Try smart mapping only if no exact match
    // This handles cases like 'en' -> 'en-us' but prefers exact matches
    const smartMatch = getSmartLocaleMapping(sourceLocale, options);
    const smartMatchObj = options.find(dest => dest.value === smartMatch);
    
    if (smartMatchObj && smartMatchObj.value !== sourceLocale) {
      console.info(`🧠 Smart match found for ${sourceLocale}: ${smartMatchObj.value}`);
    }
    
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
    const sourceLocale = newMigrationData?.destination_stack?.sourceLocale?.map((item) => ({
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
    const keys = Object?.keys(newMigrationData?.destination_stack?.localeMapping || {})?.find( key => key === `${newMigrationData?.destination_stack?.selectedStack?.master_locale}-master_locale`);

    // 🔍 Debug logging to understand what's happening
    if (sourceLocale && allLocales) {
      console.info('🔍 Auto-mapping Debug Info:');
      console.info('   Source Locales:', sourceLocale);
      console.info('   Destination Locales:', allLocales);
      console.info('   Current Stack:', currentStack?.uid);
      console.info('   Previous Stack:', previousStack?.uid);
      console.info('   Is Stack Changed:', isStackChanged);
      console.info('   Stack Has Changed (Improved):', stackHasChanged);
      console.info('   Locale Mapping:', newMigrationData?.destination_stack?.localeMapping);
      console.info('   Project Step:', newMigrationData?.project_current_step);
      console.info('   Master Locale:', stack?.master_locale);
      console.info('   Keys Found:', keys);
      
      // Check which condition will be met
      const isSingleLocale = sourceLocale?.length === 1;
      const isMultiLocale = sourceLocale?.length > 1;
      const hasAllLocales = allLocales?.length > 0;
      const hasCmsLocaleOptions = cmsLocaleOptions?.length > 0;
      const shouldAutoMap = (Object?.entries(newMigrationData?.destination_stack?.localeMapping || {})?.length === 0 || 
                            !keys || 
                            stackHasChanged);
      const isCorrectStep = newMigrationData?.project_current_step <= 2;
      
      console.info('🔍 Condition Check:');
      console.info('   Is Single Locale:', isSingleLocale);
      console.info('   Is Multi Locale:', isMultiLocale);
      console.info('   Has All Locales:', hasAllLocales);
      console.info('   Has CMS Locale Options:', hasCmsLocaleOptions);
      console.info('   Should Auto Map:', shouldAutoMap);
      console.info('   Is Correct Step:', isCorrectStep);
    }
    
    // 🔧 TC-11: Handle empty source locales
    if (!sourceLocale || sourceLocale.length === 0) {
      console.warn('⚠️ No source locales found - cannot proceed with mapping');
      return; // Exit early - will show "No languages configured" message
    }
    
    // 🔧 TC-12: Handle empty destination locales (ensure master locale exists)
    if (!allLocales || allLocales.length === 0) {
      console.warn('⚠️ No destination locales found - adding master locale as fallback');
      const masterLocaleObj = { label: stack?.master_locale || 'en-us', value: stack?.master_locale || 'en-us' };
      setoptions([masterLocaleObj]);
      return; // Will re-trigger this effect with master locale added
    }
    
    // ✅ EXISTING: Single locale auto-mapping (ENHANCED for TC-02)
    const shouldAutoMapSingle = (Object?.entries(newMigrationData?.destination_stack?.localeMapping || {})?.length === 0 || 
                                !keys || 
                                stackHasChanged);
    
    // Clear existing mappings when stack changes to allow fresh auto-mapping
    if (stackHasChanged && Object?.entries(newMigrationData?.destination_stack?.localeMapping || {})?.length > 0) {
      const newMigrationDataObj: INewMigration = {
        ...newMigrationData,
        destination_stack: {
          ...newMigrationData?.destination_stack,
          localeMapping: {} // Clear existing mappings for fresh auto-mapping
        }
      };
      dispatch(updateNewMigrationData(newMigrationDataObj));
      return; // Exit early to let the cleared state trigger auto-mapping in next render
    }
    
    if (sourceLocale?.length === 1 && 
        allLocales?.length > 0 && 
        shouldAutoMapSingle && 
        newMigrationData?.project_current_step <= 2) {
      
      const singleSourceLocale = sourceLocale[0];
      
      // 🔧 TC-02: Check for exact match first, only use smart mapping if exact match exists
      const exactMatch = allLocales.find(dest => 
        dest.value.toLowerCase() === singleSourceLocale.value.toLowerCase()
      );
      
      let destinationLocale = '';
      if (exactMatch) {
        destinationLocale = exactMatch.value;
        console.info(`✅ TC-02: Exact match found for single locale: ${singleSourceLocale.value} -> ${destinationLocale}`);
      } else {
        console.info(`📝 TC-02: No exact match for ${singleSourceLocale.value} - leaving destination empty for manual selection`);
        // Leave destinationLocale empty as per TC-02 requirement
      }
      
      // Set the auto-selected source locale for the Mapper component
      setAutoSelectedSourceLocale({
        label: singleSourceLocale.value,
        value: singleSourceLocale.value
      });
      
      // Set the mapping in Redux state
      const autoMapping = {
        [`${stack?.master_locale}-master_locale`]: stack?.master_locale,
        ...(destinationLocale ? { [destinationLocale]: singleSourceLocale.value } : {})
      };
      
      const newMigrationDataObj: INewMigration = {
        ...newMigrationData,
        destination_stack: {
          ...newMigrationData?.destination_stack,
          localeMapping: autoMapping
        }
      };
      dispatch(updateNewMigrationData(newMigrationDataObj));
      
      // Reset stack changed flag after auto-mapping
      if (isStackChanged) {
        setisStackChanged(false);
      }
    } 
    // 🆕 NEW: Enhanced multi-locale auto-mapping
    // Enhanced condition: Also trigger on stack changes for existing templates
    else if (sourceLocale?.length > 1 && 
             allLocales?.length > 0 && 
             cmsLocaleOptions?.length > 0 && // ✅ CRITICAL: Wait for cmsLocaleOptions to be ready
             (Object?.entries(newMigrationData?.destination_stack?.localeMapping || {})?.length === 0 || 
              !keys || 
              stackHasChanged) && 
             newMigrationData?.project_current_step <= 2) {
      
      console.info('🚀 EXECUTING Multi-locale auto-mapping...');
      console.info('   Source Locales for matching:', sourceLocale);
      console.info('   Available Destination Locales:', allLocales.slice(0, 10));
      
      // 🆕 CONDITION 2: Enhanced multi-locale logic with master locale priority
      
      // First, check if master locale from source matches destination (PRIORITY)
      const masterLocaleFromSource = sourceLocale.find(source => 
        source.value.toLowerCase() === stack?.master_locale?.toLowerCase()
      );
      
      let hasAnyMatches = false;
      
      // Build auto-mapping for exact matches (case-insensitive)
      const autoMapping: Record<string, string> = {
        [`${stack?.master_locale}-master_locale`]: stack?.master_locale
      };
      
      // 🆕 STEP 1: Handle master locale priority first
      if (masterLocaleFromSource) {
        const masterDestMatch = allLocales.find(dest => 
          dest.value.toLowerCase() === masterLocaleFromSource.value.toLowerCase()
        );
        if (masterDestMatch) {
          autoMapping[masterLocaleFromSource.value] = masterDestMatch.value;
          hasAnyMatches = true;
          console.info(`🏆 Master locale priority mapping: ${masterLocaleFromSource.value} -> ${masterDestMatch.value}`);
        }
      }
      
      // 🆕 STEP 2: Handle other locales with enhanced duplicate/ambiguous logic
      sourceLocale.forEach(source => {
        // Skip if already mapped (master locale)
        if (autoMapping[source.value]) return;
        
        // 🆕 Enhanced matching: Prefer exact matches over partial/smart matches
        // First try exact match
        const exactMatch = allLocales.find(dest => 
          source.value.toLowerCase() === dest.value.toLowerCase()
        );
        
        if (exactMatch) {
          autoMapping[source.value] = exactMatch.value;
          hasAnyMatches = true;
          console.info(`🎯 Exact match: ${source.value} -> ${exactMatch.value}`);
        } else {
          // Only try smart matching if no exact match exists
          // This prevents 'en' from overriding 'en-us' -> 'en-us' mapping
          const hasExactMatchInSource = sourceLocale.some(otherSource => 
            otherSource.value !== source.value && 
            allLocales.some(dest => dest.value.toLowerCase() === otherSource.value.toLowerCase())
          );
          
          if (!hasExactMatchInSource) {
            // Use smart mapping as fallback
            const smartMatch = getSmartLocaleMapping(source.value, allLocales);
            const smartMatchObj = allLocales.find(dest => dest.value === smartMatch);
            
            if (smartMatchObj && smartMatchObj.value !== source.value) {
              autoMapping[source.value] = smartMatchObj.value;
              hasAnyMatches = true;
              console.info(`🧠 Smart match: ${source.value} -> ${smartMatchObj.value}`);
            } else {
              console.info(`❌ No match found for: ${source.value}`);
            }
          } else {
            console.info(`⏭️ Skipping smart match for ${source.value} - exact matches take priority`);
          }
        }
      });
      
      // 🔧 TC-04 & TC-08: Enhanced no-match logic with master locale default
      if (!hasAnyMatches) {
        console.info('⚠️ TC-04/TC-08: No matches found - setting up master locale default mapping');
        
        // Auto-select destination master locale for first source locale as per TC-04/TC-08
        const firstSourceLocale = sourceLocale[0];
        const masterLocaleMapping = {
          [`${stack?.master_locale}-master_locale`]: stack?.master_locale,
          [stack?.master_locale || 'en-us']: firstSourceLocale.value // Map destination master to first source
        };
        
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
          // Find the master locale row
          const masterRow = cmsLocaleOptions.find(locale => locale.value === 'master_locale');
          if (masterRow) {
            updatedExistingLocale[masterRow.label] = {
              label: firstSourceLocale.value,
              value: firstSourceLocale.value
            };
          }
        }
        setMapperLocaleState(prev => ({ ...prev, ...updatedExistingLocale }));
        
        console.info(`✅ TC-04/TC-08: Auto-selected master locale ${stack?.master_locale} for first source ${firstSourceLocale.value}`);
        
        // Reset stack changed flag
        if (isStackChanged) {
          setisStackChanged(false);
        }
        return; // Exit early
      }
      
      // 🔧 TC-03: Enhanced mapping for remaining locales
      // If we have some matches but not all, try to map remaining locales to remaining destinations
      const unmappedSources = sourceLocale.filter(source => !autoMapping[source.value]);
      const unmappedDestinations = allLocales.filter(dest => 
        !Object.keys(autoMapping).includes(dest.value) && 
        dest.value !== stack?.master_locale
      );
      
      if (unmappedSources.length > 0 && unmappedDestinations.length > 0) {
        console.info('🔧 TC-03: Mapping remaining locales to available destinations');
        
        unmappedSources.forEach((source, index) => {
          if (unmappedDestinations[index]) {
            autoMapping[unmappedDestinations[index].value] = source.value;
            console.info(`✅ TC-03: Mapped remaining ${source.value} -> ${unmappedDestinations[index].value}`);
          }
        });
      }
      
      console.info('🎯 Final Auto-mapping Result:', autoMapping);
      console.info(`✅ Found ${Object.keys(autoMapping).length - 1} locale matches out of ${sourceLocale.length} source locales`);
      
      // Update Redux state with auto-mappings
      const newMigrationDataObj: INewMigration = {
        ...newMigrationData,
        destination_stack: {
          ...newMigrationData?.destination_stack,
          localeMapping: autoMapping
        }
      };
      dispatch(updateNewMigrationData(newMigrationDataObj));
      
      console.info('✅ Redux state updated with auto-mapping');
      
      // 🔥 CRITICAL FIX: Update existingLocale state for dropdown display
      // The dropdown reads from existingLocale, not from Redux localeMapping
      const updatedExistingLocale: ExistingFieldType = {};
      
      // Map each auto-mapped source locale to the dropdown state
      sourceLocale.forEach(source => {
        if (autoMapping[source.value]) {
          // Find the corresponding cmsLocaleOptions index for this source locale
          const localeRow = cmsLocaleOptions?.find(locale => {
            const isDirectMatch = locale.value === source.value;
            const isMasterMatch = locale.value === 'master_locale' && source.value === 'en';
            return isDirectMatch || isMasterMatch;
          });
          
          if (localeRow) {
            updatedExistingLocale[localeRow.label] = {
              label: source.value,
              value: source.value
            };
          }
        }
      });
      
      // Update the existingLocale state
      setMapperLocaleState(prev => ({
        ...prev,
        ...updatedExistingLocale
      }));
      
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
  }, [newMigrationData?.destination_stack?.sourceLocale, newMigrationData?.destination_stack?.csLocale, newMigrationData?.project_current_step, stack?.master_locale, isStackChanged, currentStack?.uid, previousStack?.uid, newMigrationData?.destination_stack?.selectedStack, cmsLocaleOptions]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setisLoading(true);
        const allLocales: { label: string; value: string }[] = Object?.entries(
          newMigrationData?.destination_stack?.csLocale ?? {}
        ).map(([key]) => ({
          label: key,
          value: key
        }));
        const sourceLocale = newMigrationData?.destination_stack?.sourceLocale?.map((item) => ({
          label: item,
          value: item
        }));
        setsourceLocales(sourceLocale);
        setoptions(allLocales);
        
        // Original logic for multiple locales or existing mappings
        const keys = Object?.keys(newMigrationData?.destination_stack?.localeMapping || {})?.find( key => key === `${newMigrationData?.destination_stack?.selectedStack?.master_locale}-master_locale`);
        if((Object?.entries(newMigrationData?.destination_stack?.localeMapping)?.length === 0 || 
        !keys || 
        currentStack?.uid !== previousStack?.uid || isStackChanged) &&
        newMigrationData?.project_current_step <= 2)
        {
         setcmsLocaleOptions((prevList: { label: string ; value: string }[]) => {
          const newLabel = stack?.master_locale ?? '';
    
            const isPresent = prevList?.filter(
              (item: { label: string; value: string }) => (item?.value === 'master_locale')
            );
            if(isPresent?.[0]?.label !== newLabel || currentStack?.uid !== previousStack?.uid || isStackChanged){
              //setisStackChanged(false);
              return [
                ...prevList?.filter(item => (item?.value !== 'master_locale' && item?.value !== '')) ?? [],
                {
                  label: newLabel,
                  value: 'master_locale',
                }
              ];
            }
            if (isPresent?.length <= 0 ) {
              return [
                ...prevList,
                {
                  label: newLabel,
                  value: 'master_locale'
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
  }, [newMigrationData?.destination_stack?.selectedStack, currentStack]);

  //   const fetchLocales = async () => {
  //     return await getStackLocales(newMigrationData?.destination_stack?.selectedOrg?.value);
  //   };
  
  // 🆕 CONDITION 3: Intelligent Add Language functionality with auto-suggestions
  const addRowComp = () => {
    setisStackChanged(false);
    
    // 🆕 STEP 1: Get next unmapped source locale
    const nextUnmappedSource = getNextUnmappedSourceLocale();
    
    if (!nextUnmappedSource) {
      console.info('⚠️ No more unmapped source locales available');
      // Fallback to original behavior if no unmapped locales
      setcmsLocaleOptions((prevList: { label: string; value: string }[]) => [
        ...prevList,
        {
          label: `${prevList.length}`,
          value: ''
        }
      ]);
      return;
    }
    
    console.info(`🆕 Adding language row for next unmapped source locale: ${nextUnmappedSource.value}`);
    
    // 🆕 STEP 2: Check if source locale exists in destination
    const destinationMatch = findDestinationMatch(nextUnmappedSource.value);
    
    // 🆕 STEP 3 & 4: Auto-map if exists, leave empty if not
    const newRowValue = destinationMatch ? destinationMatch.value : '';
    
    console.info(`   Destination match for ${nextUnmappedSource.value}:`, destinationMatch?.value || 'No match - leaving empty');
    
    // Add new row with intelligent defaults
    setcmsLocaleOptions((prevList: { label: string; value: string }[]) => [
      ...prevList,
      {
        label: `${prevList.length}`,
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
        
        console.info(`✅ Auto-mapped: ${nextUnmappedSource.value} -> ${destinationMatch.value}`);
      } else {
        console.info(`📝 Left empty for manual selection: ${nextUnmappedSource.value}`);
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
              <TableHeader cms={newMigrationData?.legacy_cms?.selectedCms?.parent} />
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
          <Button
            buttonType="secondary"
            aria-label="add language"
            version={'v2'}
            icon="AddPlus"
            onClick={addRowComp}
            size="small"
            disabled={
              // 🆕 Enhanced disable logic: Check if all source locales are mapped or shown
              (() => {
                const totalSourceLocales = newMigrationData?.destination_stack?.sourceLocale?.length || 0;
                const mappedLocalesCount = Object.keys(newMigrationData?.destination_stack?.localeMapping || {})?.length;
                const visibleRowsCount = cmsLocaleOptions?.length || 0;
                const isProjectCompleted = newMigrationData?.project_current_step > 2;
                
                // Disable if: all source locales are mapped OR all source locales have rows OR project is completed
                const shouldDisable = mappedLocalesCount >= totalSourceLocales + 1 || // +1 for master locale
                                    visibleRowsCount >= totalSourceLocales + 1 || // +1 for master locale  
                                    isProjectCompleted;
                
                console.info('🔴 Add Language Button Status:', {
                  totalSourceLocales,
                  mappedLocalesCount,
                  visibleRowsCount,
                  isProjectCompleted,
                  shouldDisable
                });
                
                return shouldDisable;
              })()
            }
          >
            Add Language
          </Button>
          
          {/* 🆕 ADDITIONAL SCENARIO: Display unmapped destination locales */}
          {(() => {
            const unmappedDestinations = getUnmappedDestinationLocales();
            
            if (unmappedDestinations.length > 0 && newMigrationData?.project_current_step <= 2) {
              return (
                <div className="unmapped-destinations-info" style={{ marginTop: '16px' }}>
                  <Info
                    className="info-tag"
                    icon={<Icon icon="Information" version="v2" size="small"></Icon>}
                    content={
                      <div>
                        <strong>Available destination locales not yet mapped:</strong>
                        <br />
                        <span style={{ fontSize: '12px', color: '#666' }}>
                          {unmappedDestinations.map(locale => locale.value).join(', ')}
                        </span>
                        <br />
                        <em style={{ fontSize: '11px', color: '#888' }}>
                          You can manually connect these by clicking &ldquo;Add Language&rdquo; if needed.
                        </em>
                      </div>
                    }
                    type="light"
                  />
                </div>
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
