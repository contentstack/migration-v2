// Libraries
import React, { useState, useImperativeHandle, forwardRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './HorizontalStepper.scss';
import { cbModal, Notification,Button } from '@contentstack/venus-components';

import { useSelector } from 'react-redux';

// Redux
import { RootState } from '../../../store';

// Interface
import { ModalObj } from '../../../components/Modal/modal.interface'; 

// Components
import SaveChangesModal from '../../../components/Common/SaveChangesModal';

// Hooks
import useBlockNavigation from '../../../hooks/userNavigation';

// CSS
import './HorizontalStepper.scss';


export enum StepStatus {
    ACTIVE = "ACTIVE",
    COMPLETED = "COMPLETED",
    DISABLED = "DISABLED"
}

export type stepsArray = {
    id: string;
    title?: JSX.Element | string;
    data?: React.ReactElement;
    status?: StepStatus;
};

export type stepperProps = {
    steps: Array<stepsArray>;
    className?: string;
    emptyStateMsg?: string | JSX.Element;
    hideTabView?: boolean;
    stepContentClassName?: string;
    stepTitleClassName?: string;
    testId?: string;
    handleSaveCT?: () => void;
    changeDropdownState: () => void;
};

export type HorizontalStepperHandles = {
    handleStepChange: (currentStep: number) => void;
};

const showNotification = (currentIndex:number) => {
    
    let result;
        switch (currentIndex ) {
          case 0:
            result = 'CMS';
            break;
          case 1:
            result = 'Enter Affix';
            break;
          case 2:
            result = 'Imported File';
            break;
            
        }    
    return(
        currentIndex !== 3 && currentIndex !== 4 &&
    Notification({
        notificationContent: { text: `Please complete ${result} step` },
        type: 'warning' 
    })

    )
}
const HorizontalStepper = forwardRef(
    (props: stepperProps, ref: React.ForwardedRef<HorizontalStepperHandles>) => {
        
        const { stepId } = useParams<{ stepId: string }>();
        const stepIndex = parseInt(stepId || '', 10) - 1;
        
        const { steps, className, emptyStateMsg, hideTabView, testId } = props;
        const [showStep, setShowStep] = useState(stepIndex);
        const [stepsCompleted, setStepsCompleted] = useState<number[]>([]);
        const [isModalOpen, setIsModalOpen] = useState(false);

        const navigate = useNavigate();
        const { projectId = '' } = useParams();

        const newMigrationData = useSelector((state:RootState)=> state?.migration?.newMigrationData);

        const handleSaveCT = props?.handleSaveCT
        const handleDropdownChange = props?.changeDropdownState;
        useBlockNavigation(isModalOpen);

        useEffect(() => {
            const stepIndex = parseInt(stepId || '', 10) - 1;
            
            if (!Number.isNaN(stepIndex) && stepIndex >= 0 && stepIndex < steps?.length) {
                setShowStep(stepIndex);
                setStepsCompleted(prev => {
                    const updatedStepsCompleted = [...prev];
                    for (let i = 0; i < stepIndex; i++) {
                        if (!updatedStepsCompleted?.includes(i)) {
                            updatedStepsCompleted?.push(i);
                        }
                    }
                    return updatedStepsCompleted;
                });
                
            }
        }, [stepId]);

        useImperativeHandle(ref, () => ({
            handleStepChange: (currentStep: number) => {
                setShowStep(currentStep+ 1);
                setStepsCompleted(prev => {
                    const updatedStepsCompleted = [...prev];
                    for (let i = 0; i <= currentStep; i++) {
                        if (!updatedStepsCompleted?.includes(i)) {
                            updatedStepsCompleted?.push(i);
                        }
                    }
                    return updatedStepsCompleted;
                });
            }
        }));

        const handleTabStep = (idx: number) => {
            if (newMigrationData?.content_mapping?.isDropDownChanged) {
                setIsModalOpen(true);
                return cbModal({
                    component: (props: ModalObj) => (
                    <SaveChangesModal
                        {...props}
                        isopen={setIsModalOpen}
                        otherCmsTitle={newMigrationData?.content_mapping?.otherCmsTitle}
                        saveContentType={handleSaveCT}
                        changeStep={() => setTabStep(idx)}
                        dropdownStateChange={handleDropdownChange}
                    />
                    ),
                    modalProps: {
                    size: 'xsmall',
                    shouldCloseOnOverlayClick: false
                    }
                });
            } 
            else if(-1 < newMigrationData?.legacy_cms?.currentStep  && 
                newMigrationData?.legacy_cms?.currentStep  < 2){
                showNotification(newMigrationData?.legacy_cms?.currentStep + 1);
            } 
            else if(newMigrationData?.destination_stack?.selectedStack === undefined 
                || newMigrationData?.destination_stack?.selectedStack === null || Object.keys(newMigrationData?.destination_stack?.selectedStack || {}).length === 0) {
                return Notification({
                    notificationContent: { text: `Please select a stack to proceed further` },
                    type: 'warning' 
                })
            } 
            else if (newMigrationData?.destination_stack?.selectedStack?.value !== newMigrationData?.stackDetails?.value) {
                return Notification({
                    notificationContent: { text: `Please save the stack to proceed further` },
                    type: 'warning' 
                })
            }
            else {
                setTabStep(idx);
            }
        };

        const setTabStep = (idx: number) => {
            if (stepsCompleted?.includes(idx) || stepsCompleted?.length === idx) {
                setShowStep(idx);
                const url = `/projects/${projectId}/migration/steps/${idx + 1}`;
                navigate(url, { replace: true });
            }
        }

        //variable for button component in table
        const onlyIcon= true;
        
        const StepsTitleCreator: React.FC = () => (
            <div className="stepper stepper-position">
                {steps?.map(({ id, title }, idx: number) => {
                    const completedClass = stepsCompleted?.includes(idx)  ? 'completed' : '';
                    const activeClass = idx === showStep  && !stepsCompleted?.includes(idx)? 'active' : '';           
                    const disableClass =
                        !stepsCompleted.includes(idx) && idx !== showStep && !stepsCompleted?.includes(idx - 1)
                            ? 'disableEvents'
                            : '';
                    const completeDisable = stepsCompleted?.includes(idx) && stepIndex === steps?.length - 1 ? 'completed disableEvents' : '';
                    return (
                        <React.Fragment key={id}>
                            <div className="stepWrapperContainer">
                                <div
                                    className={`stepWrapper ${completedClass} ${activeClass} ${disableClass} ${completeDisable}`}
                                    onClick={() => handleTabStep(idx)}
                                >
                                    <div className="circle-title-wrapper">
                                        <div className="badge">
                                            {completedClass ? (
                                                <div className="icon-flex">
                                                    {/* <Icon icon="v2-Check" version='v2' size="tiny" active={false} height="13px" width="19px" /> */}
                                                    <Button buttonType="light" icon={onlyIcon ? "v2-Check" : ''} version="v2" onlyIcon={true} className="iconClass"></Button>
                                                </div>
                                            ) : (
                                                <>{idx + 1}</>
                                            )}
                                        </div>
                                        <div className="stepper-title">{title}</div>
                                    </div>
                                </div>
                            </div>
                            {idx < steps?.length - 1 && <div className={completedClass ? "connector" : "disabled-connector"}></div>}
                        </React.Fragment>
                    );
                })}
            </div>
        );
   
        return (
            <div className={className} data-testid={testId}>
                {steps?.length ? (
                    <>
                        {!hideTabView && <StepsTitleCreator />}
                        <div className={`stepContent ${props.stepContentClassName}`}>
                            {steps[showStep]?.data}
                        </div>
                    </>
                ) : (
                    emptyStateMsg
                )}
            </div>
        );
    }
);

HorizontalStepper.displayName = 'HorizontalStepper';
export default HorizontalStepper;
