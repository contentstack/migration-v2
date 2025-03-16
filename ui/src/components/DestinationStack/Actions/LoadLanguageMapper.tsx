import {
  Button,
  CircularLoader,
  Icon,
  Info,
  MiniScrollableTable,
  Select,
  Tooltip
} from '@contentstack/venus-components';
import { useEffect, useState } from 'react';
import TableHeader from './tableHeader';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { updateNewMigrationData } from '../../../store/slice/migrationDataSlice';
import { INewMigration } from '../../../context/app/app.interface';

const Mapper = ({
  cmsLocaleOptions,
  handleLangugeDelete,
  options,
  masterLocale,
  sourceOptions
}: {
  cmsLocaleOptions: Array<any>;
  handleLangugeDelete: any;
  options: any;
  masterLocale: string;
  sourceOptions: any;
}) => {
  const [selectedMappings, setSelectedMappings] = useState<{ [key: string]: string }>({});
  const [existingField, setExistingField] = useState<any>({});
  const [existingLocale, setexistingLocale] = useState<any>({});
  const [selectedCsOptions, setselectedCsOption] = useState([]);
  const [selectedSourceOption, setselectedSourceOption] = useState([]);
  const [csOptions, setcsOptions] = useState(options);
  const [sourceoptions, setsourceoptions] = useState(sourceOptions);
  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);
  const dispatch = useDispatch();
  const [placeholder] = useState<string>('Select language');

  useEffect(() => {
    const newMigrationDataObj: INewMigration = {
      ...newMigrationData,
      destination_stack: {
        ...newMigrationData.destination_stack,
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
      (item: any) => !selectedCsOptions?.some((selected: any) => selected?.value === item.value)
    );
    const adjustedOptions = sourceOptions?.filter(
      (item: any) => !selectedSourceOption?.some((selected: any) => selected === item?.label)
    );
    setcsOptions(formattedoptions);
    setsourceoptions(adjustedOptions);
  }, [selectedCsOptions, selectedSourceOption]);

  useEffect(() => {
    setExistingField((prevExisting: any) => {
      const updatedExisting = { ...prevExisting };

      cmsLocaleOptions.forEach((locale: any, index: number) => {
        if (locale.value === 'master_locale' && !updatedExisting[index]) {
          setSelectedMappings((prev) => ({
            ...prev,
            [`${locale?.label}-master_locale`]: ''
          }));
          updatedExisting[index] = { label: locale.label, value: `${locale?.label}-master_locale` };
        }
      });

      return updatedExisting;
    });
  }, [cmsLocaleOptions]);

  const handleSelectedCsLocale = (
    selectedValue: any,
    index: number,
    type: 'csLocale' | 'sourceLocale'
  ) => {
    const selectedLocaleKey = selectedValue?.value;
    if (!selectedLocaleKey) return;

    setExistingField((prevOptions: any) => {
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
      const newSelectedOptions: any = prevSelected?.filter((item) => item !== selectedValue?.label);
      const newValue: any = selectedValue?.label;
      if (!newSelectedOptions?.includes(newValue)) {
        newSelectedOptions.push(newValue);
      }
      return newSelectedOptions;
    });

    setSelectedMappings((prev) => {
      const updatedMappings = { ...prev };

      if (type === 'csLocale') {
        updatedMappings[selectedLocaleKey] = existingLocale[index]?.label
          ? existingLocale[index]?.label
          : '';
      }

      return updatedMappings;
    });
  };
  const handleSelectedSourceLocale = (
    selectedValue: any,
    index: number,
    type: 'csLocale' | 'sourceLocale',
    label: any
  ) => {
    const csLocaleKey = existingField[index]?.value;

    //const selectedLocaleKey = selectedMappings[index];

    if (!selectedValue?.label) {
      setselectedSourceOption((prevSelected) =>
        prevSelected.filter((item) => item !== existingField[index]?.label)
      );
    }
    setexistingLocale((prevOptions: any) => {
      const updatedOptions = {
        ...prevOptions,
        [index]: { label: selectedValue?.label || null, value: selectedValue?.label }
      };

      // Ensure selectedOption only contains values that exist in updatedOptions
      setselectedSourceOption((prevSelected) =>
        prevSelected.filter((item) =>
          Object.values(updatedOptions).some((opt: any) => opt.label === item)
        )
      );

      return updatedOptions;
    });

    setselectedSourceOption((prevSelected) => {
      const newSelectedOptions: any = prevSelected?.filter((item) => item !== selectedValue?.label);
      const newValue: any = selectedValue?.label;
      if (!newSelectedOptions?.includes(newValue)) {
        newSelectedOptions.push(newValue);
      }
      return newSelectedOptions;
    });

    csLocaleKey &&
      setSelectedMappings((prev) => ({
        ...prev,
        [csLocaleKey]: selectedValue?.label || ''
      }));
  };
  const handleLanguageDeletaion = (index: number, locale: any) => {
    // Remove item at index from existingField
    let csLocale = '';

    setExistingField(
      (prevOptions: Record<number, { label: string; value: string }> | undefined) => {
        if (!prevOptions) return {}; // Ensure it's an object

        const updatedOptions = { ...prevOptions }; // Create a shallow copy
        csLocale = updatedOptions[index]?.label;
        delete updatedOptions[index]; // Remove the key

        return updatedOptions;
      }
    );

    // Remove item at index from existingLocale
    setexistingLocale((prevLocales: any) => {
      if (!prevLocales) return {};
      const updatedOptions = { ...prevLocales }; // Create a shallow copy
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
  console.log(
    'Updated Mappings:',
    existingField,
    existingLocale,
    selectedMappings,
    selectedCsOptions
  );

  return (
    <>
      {cmsLocaleOptions?.length > 0 ? (
        cmsLocaleOptions?.map((locale: any, index: any) => (
          <div key={index} className="lang-container">
            {locale?.value === 'master_locale' ? (
              <Tooltip
                content="This is the master locale of above selected stacks and cannot be changed. Please select a corresponding language to map."
                position="top">
                <div>
                  <Select
                    value={locale?.value === 'master_locale' ? locale : existingField[locale]}
                    onChange={(key: any) => handleSelectedCsLocale(key, index, 'csLocale')}
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
                  />
                </div>
              </Tooltip>
            ) : (
              <Select
                value={existingField[locale]}
                onChange={(key: any) => {
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
                isDisabled={false}
                className="select-container"
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
                value={existingLocale[locale]}
                onChange={(data: any) =>
                  handleSelectedSourceLocale(data, index, 'sourceLocale', locale)
                }
                options={sourceoptions}
                placeholder={placeholder}
                isSearchable
                maxMenuHeight={150}
                multiDisplayLimit={5}
                menuPortalTarget={document.querySelector('.language-mapper')}
                width="270px"
                version="v2"
                hideSelectedOptions={true}
                isClearable={true}
                isDisabled={false}
                className="select-container"
              />
            }
            <div className={''}>
              {locale?.value !== 'master_locale' && (
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

const LanguageMapper = () => {
  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);
  const [newEntry, setnewEntry] = useState<boolean>(false);
  const [options, setoptions] = useState([]);
  const [cmsLocaleOptions, setcmsLocaleOptions] = useState<{ label: string; value: string }[]>([]);
  const [sourceLocales, setsourceLocales] = useState<any>([]);

  const selectedOrganisation = useSelector(
    (state: RootState) => state?.authentication?.selectedOrganisation
  );
  const [isLoading, setisLoading] = useState<boolean>(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setisLoading(true);
        const allLocales: any = Object.keys(
          newMigrationData?.destination_stack?.csLocale || {}
        ).map((key) => ({
          label: key,
          value: key
        }));
        const sourceLocale = newMigrationData?.destination_stack?.sourceLocale?.map((item) => ({
          label: item,
          value: item
        }));
        setsourceLocales(sourceLocale);

        setoptions(allLocales);
        setcmsLocaleOptions((prevList: any) => {
          const newLabel = newMigrationData?.destination_stack?.selectedStack?.master_locale;

          const isPresent = prevList.some((item: any) => item.value === 'master_locale');

          if (!isPresent) {
            return [
              ...prevList,
              {
                label: newLabel,
                value: 'master_locale'
              }
            ];
          }

          return prevList;
        });
        setisLoading(false);
      } catch (error) {
        console.error('Error fetching locales:', error);
      }
    };

    fetchData();
  }, []);

  //   const fetchLocales = async () => {
  //     return await getStackLocales(newMigrationData?.destination_stack?.selectedOrg?.value);
  //   };
  const addRowComp = () => {
    setnewEntry(true);
    setcmsLocaleOptions((prevList: any) => [
      ...prevList, // Keep existing elements
      {
        label: `${prevList.length + 1}`, // Generate new label
        value: ''
      }
    ]);
  };

  const handleDeleteLocale = (id: number, locale: any) => {
    setcmsLocaleOptions((prevList) => {
      return prevList.filter((item: any) => item.label !== locale.label);
    });
  };

  return (
    <div className="mini-table">
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
                masterLocale={newMigrationData?.destination_stack?.selectedStack?.master_locale}
                options={options}
                cmsLocaleOptions={cmsLocaleOptions}
                handleLangugeDelete={handleDeleteLocale}
                sourceOptions={sourceLocales}
              />
            }
            //  footerComponent={
            //      <Button className="ml-10 mt-10 mb-10"
            //      buttonType="secondary"
            //      version={'v2'}
            //      icon="AddPlus"
            //      onClick={addRowComp}
            //      size='small'>
            //          Add Language
            //      </Button>

            //  }
            type="Secondary"
          />
          <Button
            className="ml-10 mt-10 mb-10"
            buttonType="secondary"
            aria-label="add language"
            version={'v2'}
            icon="AddPlus"
            onClick={addRowComp}
            size="small"
            disabled={
              Object.keys(newMigrationData?.destination_stack?.localeMapping || {})?.length ===
                newMigrationData?.destination_stack?.sourceLocale?.length ||
              cmsLocaleOptions?.length === newMigrationData?.destination_stack?.sourceLocale?.length
            }>
            Add Language
          </Button>
        </>
      )}
    </div>
  );
};

export default LanguageMapper;
