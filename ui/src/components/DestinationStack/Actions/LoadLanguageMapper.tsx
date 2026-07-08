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
  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);
  const dispatch = useDispatch();
  // Seed from the saved localeMapping in Redux so the component doesn't wipe the existing
  // mapping on mount. Critical for the restart flow — without this the previous run's locale
  // mapping disappears the moment the user lands on Step 2 again.
  const [selectedMappings, setSelectedMappings] = useState<{ [key: string]: string }>(
    () => ({ ...(newMigrationData?.destination_stack?.localeMapping || {}) }),
  );
  // If Redux's localeMapping arrives *after* mount (e.g., fetchData dispatches it post-render),
  // top up selectedMappings with any keys it has that we don't, so the master/additional rows
  // keep their saved source values. Existing keys in selectedMappings (user-edited or seeded)
  // are not overwritten.
  useEffect(() => {
    const fromRedux = newMigrationData?.destination_stack?.localeMapping || {};
    setSelectedMappings((prev) => {
      let next = prev;
      for (const [k, v] of Object.entries(fromRedux)) {
        if (v && (!(k in prev) || !prev[k])) {
          if (next === prev) next = { ...prev };
          next[k] = v as string;
        }
      }
      return next;
    });
  }, [newMigrationData?.destination_stack?.localeMapping]);
  const [existingField, setExistingField] = useState<ExistingFieldType>({});
  const [existingLocale, setexistingLocale] = useState<ExistingFieldType>({});
  const [selectedCsOptions, setselectedCsOption] = useState<string[]>([]);
  const [selectedSourceOption, setselectedSourceOption] = useState<string[]>([]);
  const [csOptions, setcsOptions] = useState(options);
  const [sourceoptions, setsourceoptions] = useState(sourceOptions);
  const [selectedStack, setSelectedStack] = useState<IDropDown>();
  const [placeholder] = useState<string>('Select language');
  // Guards the dispatch effect below from wiping a non-empty Redux localeMapping with an
  // empty selectedMappings on the very first render (which happens when fetchData hasn't
  // populated localeMapping yet at the moment of mount).
  const hasDispatchedOnceRef = useRef(false);

  useEffect(()=>{
    setSelectedStack(stack);
  },[]);

  useEffect(() => {
    if (
      !hasDispatchedOnceRef.current &&
      Object.keys(selectedMappings || {}).length === 0
    ) {
      // First render and we have nothing to dispatch — skip so the sync-from-Redux effect
      // above can seed selectedMappings without our empty value wiping Redux first.
      return;
    }
    hasDispatchedOnceRef.current = true;
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
        !selectedCsOptions?.some((selected: string) => selected === item?.value) &&
        !cmsLocaleOptions?.some(
          (locale: { label: string; value: string }) => locale?.label === item?.value
        )
    );

    // Also exclude source locales already consumed by a saved mapping (delta-restart case):
    // selectedSourceOption only tracks in-session picks, so on restart the previous run's
    // source values (e.g. the master row's "en") don't appear there and would otherwise show
    // up again as selectable in a newly-added row's source dropdown.
    const mappedSourceValues = new Set(
      Object.values(selectedMappings || {}).filter(
        (v): v is string => typeof v === 'string' && v.length > 0
      )
    );
    const adjustedOptions = sourceOptions?.filter(
      (item: { label: string; value: string }) =>
        !selectedSourceOption?.some((selected: string) => selected === item?.label) &&
        !mappedSourceValues.has(item?.label)
    );
    setcsOptions(formattedoptions);
    setsourceoptions(adjustedOptions);
    // sourceOptions must be in deps: on restart iteration the parent's sourceLocales arrives
    // asynchronously from Redux *after* mount. Without this, sourceoptions stays stale ([]) and
    // the Select language dropdown renders empty until Add Language forces unrelated re-renders.
    // cmsLocaleOptions must be in deps too: on restart iteration it's rehydrated with the
    // previous run's saved mappings *after* mount, so without it this filter never re-runs and
    // already-mapped languages keep showing up as selectable options in a newly-added row.
    // selectedMappings must be in deps so a source locale saved in Redux gets excluded from
    // the source dropdown on restart (in-session picks alone can miss the rehydrated master row).
  }, [
    selectedCsOptions,
    selectedSourceOption,
    options,
    sourceOptions,
    cmsLocaleOptions,
    selectedMappings
  ]);

  useEffect(() => {
    const updatedExistingField = { ...existingField };
    const updatedExistingLocale = { ...existingLocale };

    // const validLabels = cmsLocaleOptions?.map((item)=> item?.label);

    const existingMasterID = Object?.keys?.(selectedMappings || {})?.find((key) =>
      key?.includes('-master_locale')
    );

    const recentMasterLocale = cmsLocaleOptions?.find(
      (item) => item?.value === 'master_locale'
    )?.label;
    const presentLocale = `${recentMasterLocale}-master_locale`;

    Object.keys(updatedExistingField || {})?.forEach((key) => {
      if (existingMasterID !== presentLocale || isStackChanged) {
        delete updatedExistingField[key];
      }
    });

    Object.keys(updatedExistingLocale || {})?.forEach((key) => {
      if (existingMasterID !== presentLocale || isStackChanged) {
        delete updatedExistingLocale[key];
      }
    });
    if (existingMasterID !== presentLocale || isStackChanged) {
      setselectedCsOption([]);
      setselectedSourceOption([]);
    }

    setexistingLocale(updatedExistingLocale);

    cmsLocaleOptions?.map((locale, index) => {
      const existingLabel = existingMasterID;
      const expectedLabel = `${locale?.label}-master_locale`;

      const isLabelMismatch = existingLabel && existingLabel?.localeCompare(expectedLabel) !== 0;
      if (locale?.value === 'master_locale') {
        if (!updatedExistingField?.[index]) {
          updatedExistingField[index] = {
            label: `${locale?.label}`,
            value: `${locale?.label}-master_locale`
          };
        }
        // Reflect the saved master source locale in the row UI (the master row reads its
        // source value from existingLocale[label], not from `locale.value`). Without this
        // the source dropdown looks blank on restart even though Redux has the value.
        const savedMasterSource = selectedMappings?.[`${locale?.label}-master_locale`];
        if (savedMasterSource && !updatedExistingLocale?.[locale?.label]) {
          updatedExistingLocale[locale?.label] = {
            label: savedMasterSource,
            value: savedMasterSource
          };
        }

        if (isLabelMismatch || isStackChanged) {
          setselectedCsOption([]);
          setselectedSourceOption([]);
          setexistingLocale({});
          setExistingField({});

          // 🔧 FIX: Merge with existing mappings instead of replacing
          setSelectedMappings((prev) => ({
            ...prev,
            [`${locale?.label}-master_locale`]: ''
          }));
        } else if (!isLabelMismatch && !isStackChanged) {
          const key = `${locale?.label}-master_locale`;
          // 🔧 FIX: Merge with existing mappings instead of replacing
          setSelectedMappings((prev) => ({
            ...prev,
            [key]: prev?.[key] ? prev?.[key] : ''
          }));
        }
      }
    });

    setExistingField(updatedExistingField);
  }, [cmsLocaleOptions]);

  // On a delta-migration restart, `selectedMappings` can hydrate from Redux *after* the
  // effect above has already run (which is what reflects the saved master-locale source into
  // existingLocale). That effect only depends on cmsLocaleOptions, so it won't re-run when
  // selectedMappings arrives later, leaving the master row's source dropdown blank on first
  // load. Re-sync it here instead of adding selectedMappings to the effect above, since that
  // effect also writes to selectedMappings and would loop.
  //
  // We also fall back to reading the saved master source directly from Redux's localeMapping
  // when selectedMappings is empty for the master key. During the mount race on restart, the
  // effect above can dispatch an empty master mapping to Redux (via its else-if branch when
  // `prev[key]` is undefined at effect time) before the sync-from-Redux effect at the top of
  // the component has caught up. Reading Redux directly here keeps the master source visible
  // in that transient state.
  const reduxLocaleMapping = newMigrationData?.destination_stack?.localeMapping;
  useEffect(() => {
    const masterLocale = cmsLocaleOptions?.find((item) => item?.value === 'master_locale');
    if (!masterLocale) return;

    const key = `${masterLocale.label}-master_locale`;
    const savedMasterSource =
      selectedMappings?.[key] || reduxLocaleMapping?.[key];
    if (!savedMasterSource) return;

    setexistingLocale((prev) => {
      if (prev?.[masterLocale.label]?.label === savedMasterSource) return prev;
      return {
        ...prev,
        [masterLocale.label]: { label: savedMasterSource, value: savedMasterSource }
      };
    });
  }, [selectedMappings, cmsLocaleOptions, reduxLocaleMapping]);


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
        } else {
          // Look up the row's PRIOR CS destination via existingField (captured into
          // `existingLabel` above), not by position. The previous logic used
          // `Object.keys(mappings)[index - 1]`, which for index=1 grabbed the MASTER row's
          // key and deleted it — corrupting localeMapping to a state with no `-master_locale`
          // entry. That in turn crashed the CLI audit ("Master locale undefined ...") and
          // wedged the Execute step in a "started, never completed" state on delta iterations.
          const oldKey = existingLabel?.value;
          // Never delete the master row's key from this handler: the master Select is
          // disabled in the UI, but a defensive guard keeps a future refactor from re-opening
          // the corruption path.
          const isMasterKey =
            typeof oldKey === 'string' && oldKey.endsWith('-master_locale');
          // Preserve any source already mapped to this row's previous destination so the
          // user doesn't lose their pick when they change the CS destination.
          const preservedSource =
            oldKey && !isMasterKey ? updatedMappings?.[oldKey] : undefined;
          if (oldKey && !isMasterKey && oldKey !== selectedLocaleKey) {
            delete updatedMappings?.[oldKey];
          }
          updatedMappings[selectedLocaleKey] =
            (preservedSource && preservedSource.length > 0
              ? preservedSource
              : existingLocale?.[index]?.label) || '';
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
        // Only persist if a CS locale has already been selected for this row.
        // If the user picks source before CS, existingLabel is unset and writing
        // to a fallback key (source locale lowercased) would inflate filledMappingCount
        // and incorrectly re-enable Add Language for an incomplete row.
        const mappingKey = existingLabel?.value || existingLabel?.label;
        if (mappingKey) {
          updatedMappings[mappingKey] = selectedValue?.label ? selectedValue?.label : '';
        }
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
        cmsLocaleOptions?.map((locale: {label:string, value: string}, index: number) => {
          // Identify master rows defensively: usually the `value` marker is `'master_locale'`,
          // but some rehydration paths in this file historically wrote the raw source string
          // (e.g. `'en'`) into `value` for master keys, which dropped the row into the
          // editable non-master render branch. Falling back to a label match against the
          // stack's master locale keeps the master row locked even if that ever regresses.
          const isMasterRow =
            locale?.value === 'master_locale' ||
            (stack?.master_locale != null &&
              locale?.label === stack?.master_locale);
          // Lock rows only when the parent flag is set (step > 2 or iteration > 1) AND
          // the row has a rebuilt value from a prior iteration. Rebuilt rows always have
          // locale.value set; newly-added rows keep value='' so they stay editable until
          // the user advances, letting them correct a wrong selection before saving.
          const isRowLocked = isDisabled && !!locale?.value;
          return (
          <div key={locale.label} className="lang-container">

            {isMasterRow ? (
              <Tooltip
                content="This is the default locale of above selected stacks and cannot be changed. Please select a corresponding language to map."
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
                // Row lock: rebuilt rows (have a `value` from the prior mapping) or rows whose
                // mapping is already saved to Redux stay locked. Newly-added rows have an empty
                // value and no Redux entry, so they remain editable for the user to fill in.
                isDisabled={isRowLocked}
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
                // Row lock: rebuilt rows (have a `value` from the prior mapping) or rows whose
                // mapping is already saved to Redux stay locked. Newly-added rows have an empty
                // value and no Redux entry, so they remain editable for the user to fill in.
                isDisabled={isRowLocked}
                //className="select-container"
                menuPlacement="auto"
              />
            }
            <div className={'delete-icon'}>
              {!isMasterRow && !isRowLocked && (
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
  // Use a specific selector for sourceLocale to help with reactivity
  const reduxSourceLocale = useSelector((state: RootState) => state?.migration?.newMigrationData?.destination_stack?.sourceLocale);
  
  const [options, setoptions] = useState<{ label: string; value: string }[]>([]);
  const [cmsLocaleOptions, setcmsLocaleOptions] = useState<{ label: string; value: string }[]>([]);
  const [sourceLocales, setsourceLocales] = useState<{ label: string; value: string }[]>([]);
  const [isLoading, setisLoading] = useState<boolean>(true);
  const [currentStack, setCurrentStack] = useState<IDropDown>(stack);
  const [previousStack, setPreviousStack] = useState<IDropDown>();
  const [isStackChanged, setisStackChanged] = useState<boolean>(false);

  const prevStackRef:any = useRef(null);

  useEffect(() => {
    if (prevStackRef?.current && stack && stack?.uid !== prevStackRef?.current?.uid) {
      setisStackChanged(true);
      setCurrentStack(stack);
      setPreviousStack(prevStackRef?.current);
    }
    
    prevStackRef.current = stack;
  }, [stack]);

  // Separate useEffect to update sourceLocales when Redux state changes
  useEffect(() => {
    
    if (reduxSourceLocale && Array.isArray(reduxSourceLocale) && reduxSourceLocale.length > 0) {
      const mappedLocales = reduxSourceLocale.map((item: string) => ({
        label: item,
        value: item
      }));
      setsourceLocales(mappedLocales);
    }
  }, [reduxSourceLocale]);

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
        const sourceLocale = newMigrationData?.destination_stack?.sourceLocale?.map((item: string) => ({
          label: item,
          value: item
        }));

        // Guard against clobbering a populated sourceLocales with `undefined` when fetchData
        // runs before Redux's sourceLocale has hydrated on a restarted iteration. A legitimately
        // empty array IS a valid state (e.g. a source with no locales yet), so only skip when
        // the value isn't an array at all.
        if (Array.isArray(sourceLocale)) {
          setsourceLocales(sourceLocale);
        }
        setoptions(allLocales);
        const keys = Object?.keys(newMigrationData?.destination_stack?.localeMapping || {})?.find( key => key === `${newMigrationData?.destination_stack?.selectedStack?.master_locale}-master_locale`);
        const isRestartIteration = (newMigrationData?.iteration ?? 1) > 1;

        // RESTART (iteration > 1): rebuild the table directly from the saved localeMapping so
        // each entry becomes exactly one row — the master row keyed `<code>-master_locale`
        // renders with value='master_locale' (locked); additional rows render with their
        // source locale value. No master-logic branch and no separate rehydration block, so
        // the two can't collide and produce phantom duplicates.
        if (isRestartIteration) {
          const savedMapping = newMigrationData?.destination_stack?.localeMapping || {};
          const rebuilt = Object?.entries(savedMapping)?.map(([key, value]) => {
            const isMasterKey = key?.endsWith('-master_locale');
            return isMasterKey
              ? { label: key.replace(/-master_locale$/, ''), value: 'master_locale' }
              : { label: key, value: String(value) };
          });
          // Preserve any pending newly-added empty rows the user is filling out.
          setcmsLocaleOptions((prevList) => {
            const pendingNewRows = (prevList ?? []).filter((r) => !r?.value);
            return [...rebuilt, ...pendingNewRows];
          });
        } else {
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
          // Re-hydrate the saved locale mapping into the table when the user has progressed past
          // Step 2 in a normal (non-restart) flow.
          if (newMigrationData?.project_current_step > 2) {
            Object?.entries(newMigrationData?.destination_stack?.localeMapping || {})?.forEach(
              ([key, value]) => {
                setcmsLocaleOptions((prevList) => {
                  // Master-key entries (`<code>-master_locale`) must rebuild with
                  // value='master_locale' — the marker string the render layer keys off to
                  // hardcode the CS Select as disabled and mark this row as master. Using
                  // the raw source value here (e.g. 'en') would drop the master row into the
                  // normal-row render branch, which is editable when the parent isDisabled
                  // prop isn't set (a race window during the Step 1 → Step 2 navigation on
                  // an iteration-1 revisit). Keep master rows locked by preserving the marker.
                  const isMasterKey = typeof key === 'string' && key.endsWith('-master_locale');
                  const labelKey = key?.replace(/-master_locale$/, '');
                  const exists = prevList?.some((item) => item?.label === labelKey);
                  if (!exists) {
                    return [
                      ...prevList,
                      {
                        label: labelKey,
                        value: isMasterKey ? 'master_locale' : String(value)
                      }
                    ];
                  }
                  return prevList;
                });
              }
            );
          }
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
                isDisabled={newMigrationData?.project_current_step > 2 || (newMigrationData?.iteration ?? 1) > 1}
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
            disabled={(() => {
              const isRestartIteration = (newMigrationData?.iteration ?? 1) > 1;
              // Non-restart: lock Add Language past Step 2, and prevent adding more rows than
              // there are source locales (1:1 mapping is required for first-time migration).
              if (!isRestartIteration) {
                return (
                  Object.keys(newMigrationData?.destination_stack?.localeMapping || {})?.length ===
                    newMigrationData?.destination_stack?.sourceLocale?.length ||
                  cmsLocaleOptions?.length ===
                    newMigrationData?.destination_stack?.sourceLocale?.length ||
                  newMigrationData?.project_current_step > 2
                );
              }
              // Restart iteration: button must remain available so users can add a new
              // destination locale before the delta run. Block when (a) there's already an
              // in-progress row not yet backed by a completed mapping (avoid stacking empties)
              // OR (b) every available source locale is already mapped — otherwise clicking
              // Add Language would surface a row whose source dropdown has no unmapped option
              // to pick (e.g. a single-locale source where `en` is already in use).
              //
              // Row-completeness derives from Redux (`localeMapping`) rather than
              // `cmsLocaleOptions[i].value`, because the row-object's `value` field is only
              // populated on rebuild — the per-row handlers (handleSelectedCsLocale /
              // handleSelectedSourceLocale) update `selectedMappings` → Redux but never write
              // back into `cmsLocaleOptions`, so a freshly-filled row would otherwise still
              // read as "empty" here and lock Add Language forever after one add.
              //
              // Treat the master row as always-filled: its value is auto-managed by the
              // parent (stack master locale), and on a delta-restart race the source can be
              // momentarily blank in Redux before the sync-from-Redux effect merges it back.
              // Counting master as filled prevents that transient state from disabling the
              // button on the very first render after restart.
              const savedMapping = newMigrationData?.destination_stack?.localeMapping || {};
              const filledMappingCount = Object.entries(savedMapping).filter(([k, v]) => {
                const isMasterKey = typeof k === 'string' && k.endsWith('-master_locale');
                return isMasterKey || (typeof v === 'string' && v.length > 0);
              }).length;
              const hasIncompleteRow = (cmsLocaleOptions?.length ?? 0) > filledMappingCount;
              const mappedSources = new Set(
                Object.values(savedMapping).filter(
                  (v): v is string => typeof v === 'string' && v?.length > 0
                )
              );
              // Drive the count from the hydrated `sourceLocales` state (not directly from
              // Redux), so during the async-hydration window — when Redux's sourceLocale is
              // still undefined/empty — the button stays disabled instead of letting users
              // add a row whose source dropdown has nothing to pick from yet.
              const totalSources = sourceLocales?.length ?? 0;
              const sourcesNotReady = totalSources === 0;
              const allSourcesMapped = totalSources > 0 && mappedSources.size >= totalSources;
              return hasIncompleteRow || sourcesNotReady || allSourcesMapped;
            })()}
          >
            Add Language
          </Button>
        </>
      )}
    </div>
  );
};

export default LanguageMapper;
