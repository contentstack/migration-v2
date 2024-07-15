import React, { useState, useImperativeHandle, forwardRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './HorizontalStepper.scss';
import { Icon } from '@contentstack/venus-components';

/**
 * Enum representing the status of a step in a horizontal stepper.
 */
export enum StepStatus {
    /**
     * The step is currently active.
     */
    ACTIVE = "ACTIVE",
    /**
     * The step has been completed.
     */
    COMPLETED = "COMPLETED",
    /**
     * The step is disabled and cannot be accessed.
     */
    DISABLED = "DISABLED"
}

/**
 * Represents an array of steps in a horizontal stepper.
 */
export type stepsArray = {
    /**
     * The unique identifier for the step.
     */
    id: string;
    /**
     * The title of the step.
     */
    title?: JSX.Element | string;
    /**
     * The data associated with the step.
     */
    data?: React.ReactElement;
    /**
     * The status of the step.
     */
    status?: StepStatus;
};

/**
 * Props for the HorizontalStepper component.
 */
export type stepperProps = {
    /**
     * An array of steps for the stepper.
     */
    steps: Array<stepsArray>;
    /**
     * Optional class name for the stepper component.
     */
    className?: string;
    /**
     * Optional message or JSX element to display when the stepper is empty.
     */
    emptyStateMsg?: string | JSX.Element;
    /**
     * Additional props to be passed to each step component.
     */
    stepComponentProps?: any;
    /**
     * Determines whether to hide the tab view in the stepper.
     */
    hideTabView?: boolean;
    /**
     * Optional class name for the step content container.
     */
    stepContentClassName?: string;
    /**
     * Optional class name for the step title.
     */
    stepTitleClassName?: string;
    /**
     * Optional test ID for the stepper component.
     */
    testId?: string;
};

/**
 * Represents the handles for the HorizontalStepper component.
 */
export type HorizontalStepperHandles = {
    /**
     * Callback function to handle step change.
     * @param currentStep - The current step number.
     */
    handleStepChange: (currentStep: number) => void;
};

/**
 * A horizontal stepper component that displays a series of steps and allows navigation between them.
 * @param props - The props for the HorizontalStepper component.
 * @param ref - A ref object that can be used to access the imperative methods of the HorizontalStepper component.
 * @returns The rendered HorizontalStepper component.
 */
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
            /**
             * Changes the current step of the HorizontalStepper component.
             * @param currentStep - The index of the step to change to.
             */
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

        /**
         * Sets the active step of the HorizontalStepper component and navigates to the corresponding URL.
         * @param idx - The index of the step to set as active.
         */
        const setTabStep = (idx: number) => {
            
            if (stepsCompleted?.includes(idx) || stepsCompleted?.length === idx) {
                setShowStep(idx);
                const url = `/projects/${projectId}/migration/steps/${idx + 1}`;
                navigate(url, { replace: true });
            }
        };

        /**
         * Renders the titles and circles for each step in the HorizontalStepper component.
         */
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
