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
}: {
  key: string;
  uid:string;
  cmsLocaleOptions: Array<{ label: string; value: string }>;
  handleLangugeDelete: (index: number, locale: { label: string; value: string }) => void;
  options: Array<{ label: string; value: string }>;
  sourceOptions: Array<{ label: string; value: string }>;
  isDisabled: boolean;
  isStackChanged: boolean;
  stack: IDropDown
}) => {
  const [selectedMappings, setSelectedMappings] = useState<{ [key: string]: string }>({});
  const [existingField, setExistingField] = useState<ExistingFieldType>({});
  const [existingLocale, setexistingLocale] = useState<ExistingFieldType>({});
  const [selectedCsOptions, setselectedCsOption] = useState<string[]>([]);
  const [selectedSourceOption, setselectedSourceOption] = useState<string[]>([]);
  const [csOptions, setcsOptions] = useState(options);
  const [sourceoptions, setsourceoptions] = useState(sourceOptions);
  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);
  const dispatch = useDispatch();
  const [selectedStack, setSelectedStack] = useState<IDropDown>();
  const [placeholder] = useState<string>('Select language');

  useEffect(()=>{
    setSelectedStack(stack);
  },[]);

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
    const csLocaleKey = existingField?.[index]?.value;
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
        entries?.map(([_, value], index) => [index, value])
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
      {cmsLocaleOptions?.length > 0  ? (
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
                  menuPortal: (base: any) => ({ ...base, zIndex: 9999 })
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
  const [options, setoptions] = useState<{ label: string; value: string }[]>([]);
  const [cmsLocaleOptions, setcmsLocaleOptions] = useState<{ label: string; value: string }[]>([]);
  const [sourceLocales, setsourceLocales] = useState<{ label: string; value: string }[]>([]);
  const [isLoading, setisLoading] = useState<boolean>(true);
  const [currentStack, setCurrentStack] = useState<IDropDown>(stack);
  const [previousStack, setPreviousStack] = useState<IDropDown>();
  const [isStackChanged, setisStackChanged] = useState<boolean>(false);
  const [stackValue, setStackValue] = useState<string>(stack?.value)

  const prevStackRef:any = useRef(null);

  useEffect(() => {
    if (prevStackRef?.current && stack && stack?.uid !== prevStackRef?.current?.uid) {
      setisStackChanged(true);
      setCurrentStack(stack);
      setPreviousStack(prevStackRef?.current);
    }
    
    prevStackRef.current = stack;
  }, [stack]);

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
  const addRowComp = () => {
    setisStackChanged(false);
    setcmsLocaleOptions((prevList: { label: string; value: string }[]) => [
      ...prevList, // Keep existing elements
      {
        label: `${prevList.length}`, // Generate new label
        value: ''
      }
    ]);
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
              Object.keys(newMigrationData?.destination_stack?.localeMapping || {})?.length ===
                newMigrationData?.destination_stack?.sourceLocale?.length ||
              cmsLocaleOptions?.length ===
                newMigrationData?.destination_stack?.sourceLocale?.length ||
              newMigrationData?.project_current_step > 2
            }
          >
            Add Language
          </Button>
        </>
      )}
    </div>
  );
};

export default LanguageMapper;
