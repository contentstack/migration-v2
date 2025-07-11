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
import { IDropDown, INewMigration } from '../../../context/app/app.interface';

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
  stack,
  cmsLocaleOptions,
  handleLangugeDelete,
  options,
  sourceOptions,
  isDisabled,
  localeChanged,
}: {
  cmsLocaleOptions: Array<{ label: string; value: string }>;
  handleLangugeDelete: (index: number, locale: { label: string; value: string }) => void;
  options: Array<{ label: string; value: string }>;
  sourceOptions: Array<{ label: string; value: string }>;
  isDisabled: boolean;
  localeChanged: boolean,
  stack: IDropDown,
  key: string,
}) => {
  const [selectedMappings, setSelectedMappings] = useState<{ [key: string]: string }>({});
  const [existingField, setExistingField] = useState<ExistingFieldType>({});
  const [existingLocale, setexistingLocale] = useState<ExistingFieldType>({});
  const [selectedCsOptions, setselectedCsOption] = useState<string[]>([]);
  const [selectedSourceOption, setselectedSourceOption] = useState<string[]>([]);
  const [csOptions, setcsOptions] = useState(options);
  const [sourceoptions, setsourceoptions] = useState(sourceOptions);
  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);
  const [selectedStack,setSelectedStack] = useState<IDropDown>();
  const dispatch = useDispatch();
  const [placeholder] = useState<string>('Select language');

  useEffect(()=>{
    setSelectedStack(stack)
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

    const validLabels = cmsLocaleOptions?.map((item)=> item?.label);

    const existingMasterKey = Object?.keys(selectedMappings || {})?.find((key) =>
      key?.includes('-master_locale')
    );

    const recentMsterLocale = cmsLocaleOptions?.find((item)=>{item?.value === 'master_locale'})

    Object.keys(updatedExistingField || {})?.forEach((key) => {
      if (!validLabels?.includes(updatedExistingField?.[key]?.label) || existingMasterKey !== `${recentMsterLocale}-master_locale`) {
        delete updatedExistingField?.[key];
      }
    });

    Object.keys(updatedExistingLocale || {})?.forEach((key) => {
      
      if ((!validLabels?.includes(updatedExistingLocale?.[key]?.label) && Object?.entries(updatedExistingField)?.length === 0) || existingMasterKey !== `${recentMsterLocale}-master_locale`) {
        delete updatedExistingLocale?.[key];
      }
    });

    cmsLocaleOptions?.map((locale, index)=>{
      if(locale?.value === 'master_locale'){
        if (!updatedExistingField?.[index]) {
          updatedExistingField[index] = {
            label: `${locale?.label}`,
            value: `${locale?.label}-master_locale`,
          };
        }

  
        if ( existingMasterKey !== `${locale?.label}-master_locale`) {
          setselectedCsOption([]);
          setselectedSourceOption([]);
          updatedSelectedMappings = {
            [`${locale?.label}-master_locale`]: '',
          };
          
        }
      }        
    })

    setExistingField(updatedExistingField);
    setexistingLocale(updatedExistingLocale);
    setSelectedMappings(updatedSelectedMappings);
  
   
   }, [cmsLocaleOptions]);
  

  // function for change select value
  const handleSelectedCsLocale = (
    selectedValue: { label: string; value: string },
    index: number,
    type: 'csLocale' | 'sourceLocale'
  ) => {
    const selectedLocaleKey = selectedValue?.value;

    if (!selectedValue?.label) {
      setselectedCsOption((prevSelected) =>
        prevSelected?.filter((item) => item !== existingField?.[index]?.label)
      );
    }
  

    setExistingField((prevOptions: ExistingFieldType) => {
      const updatedOptions = {
        ...prevOptions,
        [index]: { label: selectedValue?.label || null, value: selectedValue?.label }
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
        delete updatedMappings[existingField[index]?.value];
      }
      else if (type === 'csLocale' && selectedLocaleKey) {
        updatedMappings[selectedLocaleKey] = existingLocale[index]?.label
          ? existingLocale[index]?.label
          : '';
      }

      return updatedMappings;
    });
  };
  const handleSelectedSourceLocale = (
    selectedValue: { label: string; value: string },
    index: number,
    type: 'csLocale' | 'sourceLocale',
    label: any
  ) => {
    const csLocaleKey = existingField?.[index]?.value;

    //const selectedLocaleKey = selectedMappings[index];

    if (!selectedValue?.label) {
      setselectedSourceOption((prevSelected) =>
        prevSelected?.filter((item) => item !== existingField?.[index]?.label)
      );
    }
    setexistingLocale((prevOptions: ExistingFieldType) => {
      const updatedOptions: ExistingFieldType = {
        ...prevOptions,
        [index]: { label: selectedValue?.label || null, value: selectedValue?.label }
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

    csLocaleKey &&
      setSelectedMappings((prev) => ({
        ...prev,
        [csLocaleKey]: selectedValue?.label || ''
      }));
  };
  const handleLanguageDeletaion = (index: number, locale: { label: string; value: string }) => {
    // Remove item at index from existingField
    let csLocale = '';

    setExistingField(
      (prevOptions: Record<number, { label: string; value: string }> | undefined) => {
        if (!prevOptions) return {}; // Ensure it's an object

        const updatedOptions = { ...prevOptions }; // Create a shallow copy
        csLocale = updatedOptions[index]?.label;
        setselectedCsOption((prevSelected) => {
          const newSelectedOptions: string[] = prevSelected?.filter(
            (item) => item !== csLocale // Remove the item equal to csLocale
          );
          return newSelectedOptions;
        });
        
        delete updatedOptions[index]; // Remove the key

        return updatedOptions;
      }
    );

    // Remove item at index from existingLocale
    setexistingLocale((prevLocales: ExistingFieldType) => {
      if (!prevLocales) return {};
      const updatedOptions = { ...prevLocales }; // Create a shallow copy;
      const locale = updatedOptions[index]?.label
      setselectedSourceOption((prevSelected) => {
        const newSelectedOptions: string[] = prevSelected?.filter(
          (item) => item !== locale // Remove the item equal to locale
        );
        return newSelectedOptions;
      });
      delete updatedOptions[index]; // Remove the key
      return updatedOptions;
    });

    setSelectedMappings((prev) => {
      const updatedMappings = { ...prev };

      delete updatedMappings[csLocale];

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
                    className="select-container"
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
                className="select-container"
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
                  handleSelectedSourceLocale(data, index, 'sourceLocale', locale)
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
                className="select-container"
                menuPlacement="auto"
              />
            }
            <div className={''}>
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

const LanguageMapper = ({stack, uid } :{ stack : IDropDown, uid: string}) => {
  
  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);
  const [options, setoptions] = useState<{ label: string; value: string }[]>([]);
  const [cmsLocaleOptions, setcmsLocaleOptions] = useState<{ label: string; value: string }[]>([]);
  const [sourceLocales, setsourceLocales] = useState<{ label: string; value: string }[]>([]);
  const [isLoading, setisLoading] = useState<boolean>(false);
  const [localeChanged, setlocaleChanged] = useState<boolean>(false);
  const [currentStack, setCurrentStack] = useState<IDropDown>();
  const [previousStack, setPreviousStack] = useState<IDropDown>();
  const [isStackChanged, setisStackChanged] = useState<boolean>(false);

  const prevStackRef:any = useRef(null);

  useEffect(() => {
    if (prevStackRef.current && stack?.uid !== prevStackRef.current?.uid) {
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
         setcmsLocaleOptions((prevList: { label: string; value: string }[]) => {
          const newLabel = stack?.master_locale;
    
            const isPresent = prevList?.filter(
              (item: { label: string; value: string }) => (item?.value === 'master_locale')
            );
            if(isPresent?.[0]?.label !== newLabel || currentStack?.uid !== previousStack?.uid || isStackChanged){
              setisStackChanged(false);
              setlocaleChanged(true);
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
    setlocaleChanged(false);
    setcmsLocaleOptions((prevList: { label: string; value: string }[]) => [
      ...prevList, // Keep existing elements
      {
        label: `${prevList.length}`, // Generate new label
        value: ''
      }
    ]);
  };

  const handleDeleteLocale = (id: number, locale: { label: string; value: string }) => {
    setcmsLocaleOptions((prevList) => {
      return prevList?.filter(
        (item: { label: string; value: string }) => item?.label !== locale?.label
      );
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
                key={stack?.value}
                stack={stack}
                localeChanged={localeChanged}
                options={options}
                cmsLocaleOptions={cmsLocaleOptions}
                handleLangugeDelete={handleDeleteLocale}
                sourceOptions={sourceLocales}
                isDisabled={newMigrationData?.project_current_step > 2}
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
