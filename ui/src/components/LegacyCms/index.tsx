import { useContext, useEffect, useRef, useState } from 'react';
import AutoVerticalStepper from '../Stepper/VerticalStepper/AutoVerticalStepper';
import { getLegacyCMSSteps } from './StepperSteps';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, CircularLoader } from '@contentstack/venus-components';
// import { getEntries } from '../../services/contentstackSDK';
import { CS_ENTRIES, PROJECT_STATUS } from '../../utilities/constants';
import { AppContext } from '../../context/app/app.context';
import {
  DEFAULT_CMS_TYPE,
  DEFAULT_LEGACY_CMS_DATA,
  ICMSType,
  ILegacyCMSComponent
} from '../../context/app/app.interface';

import { isEmptyString, validateArray } from '../../utilities/functions';
import { ICardType, defaultCardType } from '../Common/Card/card.interface';
import './legacyCms.scss';
import { IFilterType } from '../Common/Modal/FilterModal/filterModal.interface';
import { updateCurrentStepData } from '../../services/api/migration.service';
import { MigrationResponse } from '../../services/api/service.interface';
import { getCMSDataFromFile } from '../../cmsData/cmsSelector';

type LegacyCMSComponentProps = {
  legacyCMSData: any;
  projectData: MigrationResponse;
};

const LegacyCMSComponent = ({ legacyCMSData, projectData }: LegacyCMSComponentProps) => {
  /** ALL CONTEXT HERE */
  const {
    migrationData,
    updateMigrationData,
    updateNewMigrationData,
    newMigrationData,
    selectedOrganisation
  } = useContext(AppContext);

  /** ALL HOOKS HERE */
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isMigrationLocked, setIsMigrationLocked] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [internalActiveStepIndex, setInternalActiveStepIndex] = useState<number>(-1);
  const [stepperKey, setStepperKey] = useState<string>('v-mig-step');
  const { projectId = '' } = useParams();

  const navigate = useNavigate();
  const autoVerticalStepper = useRef<any>(null);

  //Handle on all steps are completed
  const handleOnAllStepsComplete = (flag = false) => {
    setIsCompleted(flag);
  };

  // handle on proceed to destination stack
  const handleOnClick = async (event: MouseEvent) => {
    event.preventDefault();

    //Update Data in backend
    const res = await updateCurrentStepData(selectedOrganisation.value, projectId);
    if (res) {
      const url = `/projects/${projectId}/migration/steps/2`;
      navigate(url, { replace: true });
    }
  };

  //handle on delete click
  const handleOnClickDeleteUploadedFile = (e: MouseEvent) => {
    e.preventDefault();
    console.warn(' handleOnClickDeleteUploadedFile CLICKED');
    // setIsCompleted(false)
  };

  /********** ALL USEEFFECT HERE *************/
  useEffect(() => {
    const fetchCMSData = async () => {
      setIsLoading(true);

      //check if offline CMS data field is set to true, if then read data from cms data file.
      const data = await getCMSDataFromFile(CS_ENTRIES.LEGACY_CMS);

      //fetch Legacy CMS Component Data from Contentstack CMS
      //const data = await getEntries({ contentType: CS_ENTRIES.LEGACY_CMS })

      //Check for null
      if (!data) {
        updateMigrationData({ legacyCMSData: DEFAULT_LEGACY_CMS_DATA });
        setIsLoading(false);
        return;
      }

      //Generate CMS Filter List
      const cmsFilterList: IFilterType[] = [];

      //Step1: traverse on all cms and check for parent ,
      //Step2: if exist and not yet added in CMS filter list then push to array.
      //Step 3: Update it in APP context for later use
      validateArray(data?.all_cms) &&
        data?.all_cms?.forEach((cms: ICMSType) => {
          if (!isEmptyString(cms.parent)) {
            const filterObject = cmsFilterList?.find(
              (obj: IFilterType) => obj.value === cms.parent
            );

            if (!filterObject) {
              cmsFilterList.push({
                value: cms.parent,
                label: cms.parent,
                isChecked: false
              });
            }
          }
        });

      const legacyCMSDataMapped: ILegacyCMSComponent = {
        ...data,
        all_steps: getLegacyCMSSteps(isCompleted, isMigrationLocked, data?.all_steps),
        cmsFilterList: cmsFilterList
      };

      updateMigrationData({ legacyCMSData: legacyCMSDataMapped });

      //Update New Migration data

      const selectedCmsData: ICMSType = validateArray(data.all_cms)
        ? data.all_cms?.find((cms: ICMSType) => cms?.cms_id === legacyCMSData?.cms) ||
          DEFAULT_CMS_TYPE
        : DEFAULT_CMS_TYPE;

      const selectedFileFormatData: ICardType | undefined = validateArray(
        selectedCmsData?.allowed_file_formats
      )
        ? selectedCmsData.allowed_file_formats?.find(
            (cms: ICardType) => cms?.fileformat_id === legacyCMSData?.file_format
          )
        : defaultCardType;

      //Make Step 1 Complete
      if (!isEmptyString(selectedCmsData?.cms_id)) {
        setInternalActiveStepIndex(0);
      }

      //Make Step 2 complete
      if (!isEmptyString(selectedCmsData?.cms_id) && !isEmptyString(legacyCMSData?.affix)) {
        setInternalActiveStepIndex(1);
      }

      //Make Step 3 complete
      if (
        !isEmptyString(selectedCmsData?.cms_id) &&
        !isEmptyString(legacyCMSData?.affix) &&
        !isEmptyString(selectedFileFormatData?.fileformat_id)
      ) {
        setInternalActiveStepIndex(2);
      }

      updateNewMigrationData({
        ...newMigrationData,
        legacy_cms: {
          selectedCms: selectedCmsData,
          selectedFileFormat: selectedFileFormatData || defaultCardType,
          uploadedFile: newMigrationData?.legacy_cms?.uploadedFile, //need to add backend data once endpoint exposed.
          affix: legacyCMSData?.affix || newMigrationData?.legacy_cms?.affix || '',
          isFileFormatCheckboxChecked: false, //need to add backend data once endpoint exposed.
          isRestictedKeywordCheckboxChecked: false //need to add backend data once endpoint exposed.
        }
      });

      setIsLoading(false);

      //Check for migration Status and lock.
      // Status where Migration is to be Locked:
      setIsMigrationLocked(
        projectData.status === PROJECT_STATUS.INPROGRESS ||
          projectData.status === PROJECT_STATUS.SUCCESS
      );
    };

    fetchCMSData();
  }, []);

  useEffect(() => {
    setStepperKey('legacy-Vertical-stepper');
  }, [isLoading]);

  useEffect(() => {
    if (autoVerticalStepper?.current) {
      if (internalActiveStepIndex > -1) {
        autoVerticalStepper.current.handleDynamicStepChange(internalActiveStepIndex);
      }

      if (
        internalActiveStepIndex > -1 &&
        internalActiveStepIndex === migrationData?.legacyCMSData?.all_steps?.length - 1
      ) {
        autoVerticalStepper.current.handleDynamicStepChange(internalActiveStepIndex, true);
      }
    }
  }, [internalActiveStepIndex]);

  return (
    <>
      {isLoading ? (
        <div className="row">
          <div className="col-12 text-center center-align">
            <CircularLoader />
          </div>
        </div>
      ) : (
        <div className="legacy-cms-container">
          <div className="row">
            <div className="col-12">
              <AutoVerticalStepper
                ref={autoVerticalStepper}
                key={stepperKey}
                steps={getLegacyCMSSteps(
                  isCompleted,
                  isMigrationLocked,
                  migrationData.legacyCMSData.all_steps
                )}
                isEdit={!isMigrationLocked}
                handleOnAllStepsComplete={handleOnAllStepsComplete}
                stepComponentProps={{
                  handleDeleteFile: handleOnClickDeleteUploadedFile
                }}
              />
            </div>
            {isCompleted && !isMigrationLocked ? (
              <div className="col-12">
                <div className="pl-40">
                  <Button version="v2" onClick={handleOnClick}>
                    {migrationData?.legacyCMSData?.cta}
                  </Button>
                </div>
              </div>
            ) : (
              <></>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default LegacyCMSComponent;
