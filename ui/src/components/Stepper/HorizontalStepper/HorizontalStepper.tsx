import React, { useState, useImperativeHandle, forwardRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './HorizontalStepper.scss';
import { Icon } from '@contentstack/venus-components';

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
    stepComponentProps?: any;
    hideTabView?: boolean;
    stepContentClassName?: string;
    stepTitleClassName?: string;
    testId?: string;
};

export type HorizontalStepperHandles = {
    handleStepChange: (currentStep: number) => void;
};

const HorizontalStepper = forwardRef(
    (props: stepperProps, ref: React.ForwardedRef<HorizontalStepperHandles>) => {
        const { steps, className, emptyStateMsg, stepComponentProps, hideTabView, testId } = props;
        const [showStep, setShowStep] = useState(0);
        const [stepsCompleted, setStepsCompleted] = useState<number[]>([]);
        const { stepId } = useParams<{ stepId: any }>();

        const navigate = useNavigate();
        const { projectId = '' } = useParams();

        useEffect(() => {
            const stepIndex = parseInt(stepId, 10) - 1;
            if (!isNaN(stepIndex) && stepIndex >= 0 && stepIndex < steps?.length) {
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

        const setTabStep = (idx: number) => {
            
            if (stepsCompleted?.includes(idx) || stepsCompleted?.length === idx) {
                setShowStep(idx);
                const url = `/projects/${projectId}/migration/steps/${idx + 1}`;
                navigate(url, { replace: true });
            }
        };

        const StepsTitleCreator: React.FC = () => (
            <div className="stepper stepper-position">
                {steps?.map(({ id, title }, idx: number) => {
                
                    
                    const completedClass = stepsCompleted?.includes(idx)  ? 'completed' : '';
                    const activeClass = idx === showStep  && !stepsCompleted?.includes(idx)? 'active' : '';           
                    const disableClass =
                        !stepsCompleted.includes(idx) && idx !== showStep && !stepsCompleted?.includes(idx - 1)
                            ? 'disableEvents'
                            : '';
                    
                    return (
                        <React.Fragment key={id}>
                            <div className="stepWrapperContainer">
                                <div
                                    className={`stepWrapper ${completedClass} ${activeClass} ${disableClass}`}
                                    onClick={() => setTabStep(idx)}
                                >
                                    <div className="circle-title-wrapper">
                                        <div className="badge">
                                            {completedClass ? (
                                                <div className="icon-flex">
                                                    <Icon icon="Check" size="tiny" active={false} height="13px" width="19px" />
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
