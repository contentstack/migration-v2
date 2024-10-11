import { forwardRef, useEffect, useRef, useState , useImperativeHandle} from 'react';
import { useDispatch,useSelector } from 'react-redux';
import AutoVerticalStepper from '../Stepper/VerticalStepper/AutoVerticalStepper';
import { getLegacyCMSSteps } from './StepperSteps';
import { CircularLoader } from '@contentstack/venus-components';
// import { getEntries } from '../../services/contentstackSDK';
import { CS_ENTRIES } from '../../utilities/constants';

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
import { getCMSDataFromFile } from '../../cmsData/cmsSelector';
import { RootState } from '../../store';
import {  updateMigrationData, updateNewMigrationData } from '../../store/slice/migrationDataSlice';

interface AwsDetails{
  awsRegion:string;
  bucketName:string;
  buketKey:string
}
interface LegacyCmsData {
  affix?:string;
  affix_confirmation?: boolean;
  awsDetails?: AwsDetails;
  cms?:string;
  file_format?:string;
  file_format_confirmation?:boolean;
  file_path?:string;
  is_fileValid?:boolean;
  is_localPath?:boolean
}
type LegacyCMSComponentProps = {
  legacyCMSData: LegacyCmsData;
  isCompleted: boolean
  handleStepChange: (currentStep: number) => void;
  handleOnAllStepsComplete:(flag : boolean)=>void;
};

interface AutoVerticalStepperRef {
  handleDynamicStepChange: (stepIndex: number, isLastStep?: boolean) => void;
}


const LegacyCMSComponent = forwardRef(({ legacyCMSData, isCompleted, handleOnAllStepsComplete, }: LegacyCMSComponentProps, ref) => {
  //react-redux apis
  const migrationData = useSelector((state:RootState)=>state?.migration?.migrationData);
  const  newMigrationData = useSelector((state:RootState)=>state?.migration?.newMigrationData);
  const dispatch = useDispatch();


  /** ALL HOOKS HERE */
  const [isMigrationLocked, setIsMigrationLocked] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(newMigrationData?.isprojectMapped);
  const [internalActiveStepIndex, setInternalActiveStepIndex] = useState<number>(-1);
  const [stepperKey] = useState<string>('legacy-Vertical-stepper');

  const [isValidated, setisValidated] = useState<boolean>(
    newMigrationData?.legacy_cms?.uploadedFile?.isValidated || false
  );
  const [isAllStepsCompleted, setIsAllStepsCompleted] = useState(false);
  const autoVerticalStepper = useRef<AutoVerticalStepperRef>(null);


  //Handle on all steps are completed
  const handleAllStepsComplete = (flag = false) => {
    handleOnAllStepsComplete(flag);
  };

  useImperativeHandle(ref, () => ({
    getInternalActiveStepIndex: () => internalActiveStepIndex
  }));
  


  //handle on delete click
  const handleOnClickDeleteUploadedFile = (e: MouseEvent) => {
    e.preventDefault();
    console.warn(' handleOnClickDeleteUploadedFile CLICKED');
    // setIsCompleted(false)
  };

  /********** ALL USEEFFECT HERE *************/

  useEffect(() => {
    const fetchCMSData = async () => {
      //setIsLoading(true);
  
      //check if offline CMS data field is set to true, if then read data from cms data file.
      const data = await getCMSDataFromFile(CS_ENTRIES.LEGACY_CMS);
  
      //fetch Legacy CMS Component Data from Contentstack CMS
      //const data = await getEntries({ contentType: CS_ENTRIES.LEGACY_CMS })
  
      //Check for null
      if (!data) {
        dispatch(updateMigrationData({ legacyCMSData: DEFAULT_LEGACY_CMS_DATA }));
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
          if (!isEmptyString(cms?.parent)) {
            const filterObject = cmsFilterList?.find(
              (obj: IFilterType) => obj?.value === cms?.parent
            );
  
            if (!filterObject) {
              cmsFilterList?.push({
                value: cms?.parent,
                label: cms?.parent,
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
  
      dispatch(updateMigrationData({ legacyCMSData: legacyCMSDataMapped }));
  
      //Update New Migration data; 
      const selectedCmsData: ICMSType = validateArray(data.all_cms)
        ? data.all_cms?.find((cms: ICMSType) => {     
          return cms?.cms_id === legacyCMSData?.cms})
        : DEFAULT_CMS_TYPE;

      const selectedFileFormatData: ICardType | undefined = validateArray(
        selectedCmsData?.allowed_file_formats
      )
        ? selectedCmsData.allowed_file_formats?.find(
            (cms: ICardType) => cms?.fileformat_id === legacyCMSData?.file_format
          )
        : defaultCardType;
    
      //Make Step 1 Complete
      if (!isEmptyString(selectedCmsData?.cms_id || newMigrationData?.legacy_cms?.selectedCms?.cms_id)) {    
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
      dispatch(updateNewMigrationData({
        ...newMigrationData,
        legacy_cms: {
          currentStep: internalActiveStepIndex,
          selectedCms: selectedCmsData,
          selectedFileFormat: selectedFileFormatData,
          uploadedFile: {
            file_details:{
              localPath: legacyCMSData?.file_path,
              awsData: legacyCMSData?.awsDetails,
              isLocalPath: legacyCMSData?.is_localPath
            },
            isValidated: legacyCMSData?.is_fileValid ,
          }, //need to add backend data once endpoint exposed.
          affix: legacyCMSData?.affix || '',
          isFileFormatCheckboxChecked: true, //need to add backend data once endpoint exposed.
          isRestictedKeywordCheckboxChecked: true //need to add backend data once endpoint exposed.
        }
      }))
      setIsLoading(false);          
  
      //Check for migration Status and lock.
      // Status where Migration is to be Locked:
      setIsMigrationLocked(newMigrationData?.legacy_cms?.projectStatus === 2 || newMigrationData?.legacy_cms?.projectStatus  === 5);
    };
   

    fetchCMSData();
  }, []);

  useEffect(() => {

    setisValidated(newMigrationData?.legacy_cms?.uploadedFile?.isValidated || false);
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

    dispatch(updateNewMigrationData(
      {
      ...newMigrationData,
      legacy_cms: {
        ...newMigrationData?.legacy_cms,
        currentStep: internalActiveStepIndex || 0
      }
      
      }));
    
    
  }, [internalActiveStepIndex]);  
  
  useEffect(()=>{
    if (!isEmptyString(newMigrationData?.legacy_cms?.selectedCms?.cms_id)) {    
      setInternalActiveStepIndex(0);
    }

    //Make Step 2 complete
    if (!isEmptyString(newMigrationData?.legacy_cms?.selectedCms?.cms_id) && !isEmptyString(newMigrationData?.legacy_cms?.affix)) {
      setInternalActiveStepIndex(1);
    }

    if(!isEmptyString(newMigrationData?.legacy_cms?.selectedCms?.cms_id) && !isEmptyString(newMigrationData?.legacy_cms?.affix) && newMigrationData?.legacy_cms?.uploadedFile?.isValidated){
      setInternalActiveStepIndex(3);
    }

  },[newMigrationData]);
  
  useEffect(()=>{
   if(! isEmptyString(newMigrationData?.legacy_cms?.affix) 
      && !isEmptyString(newMigrationData?.legacy_cms?.selectedFileFormat?.title) &&
    ! isEmptyString(newMigrationData?.legacy_cms?.selectedCms?.title) && 
    newMigrationData?.legacy_cms?.uploadedFile?.isValidated){
      setIsAllStepsCompleted(true);
      handleAllStepsComplete(true);
    }
    else{
      setIsAllStepsCompleted(false);
      handleAllStepsComplete(false);

    }
  },[newMigrationData,isAllStepsCompleted])
  return (
    <>
      {isLoading || newMigrationData?.isprojectMapped ? (
        <div className="loader-container">
          <CircularLoader />
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
                  migrationData?.legacyCMSData?.all_steps
                )}
                isEdit={!isMigrationLocked}
                isRequired={true}
                handleOnAllStepsComplete={handleAllStepsComplete}
                stepComponentProps={{
                  handleDeleteFile: handleOnClickDeleteUploadedFile
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
});
LegacyCMSComponent.displayName = 'LegacyCMSComponent';
export default LegacyCMSComponent;
