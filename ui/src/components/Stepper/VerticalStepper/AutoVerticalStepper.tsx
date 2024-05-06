import React, { useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { Icon, Tooltip } from '@contentstack/venus-components';

// Utilities
import { addDomainInPath } from '../../../utilities/functions';

// Styles
import './AutoVerticalStepper.scss';

export enum StepStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  DISABLED = 'DISABLED'
}

type AutoVerticalStepperProps = {
  steps: any[];
  className?: string;
  stepComponentProps?: any;
  stepTitleClassName?: string;
  isEdit: boolean;
  handleOnAllStepsComplete: (flag: boolean) => void;
};

export type AutoVerticalStepperComponentHandles = {
  handleDynamicStepChange: (stepIndex: number, closeStep?: boolean) => void;
};

// eslint-disable-next-line react/display-name
const AutoVerticalStepper = React.forwardRef<
  AutoVerticalStepperComponentHandles,
  React.PropsWithChildren<AutoVerticalStepperProps>
>(
  (
    props: AutoVerticalStepperProps,
    ref: React.ForwardedRef<AutoVerticalStepperComponentHandles>
  ) => {
    const {
      steps,
      className = '',
      stepComponentProps,
      stepTitleClassName = '',
      isEdit = false,
      handleOnAllStepsComplete = () => {
        return;
      }
    } = props;

    const [stepStatus, setStepStatus] = useState(steps.map((s: any) => s.status));

    useEffect(() => {
      if (!stepComponentProps?.step?.step_id && !stepComponentProps?.connector?.group_name) {
        setStepStatus(steps.map((s: any) => s.status));
      }
    }, [stepComponentProps?.step?.step_id, stepComponentProps?.connector?.group_name]);

    const StepperStepTitleCreator: (data: any) => JSX.Element = (data: any) => {
      return (
        <>
          <div className="migration-vertical-stepper-container">
            <div>
              <span className="stepper-title">{data.title}</span>
              <span className="stepper-titleNote">{data.titleNote ? data.titleNote : ''}</span>
            </div>
            {data.lock ? (
              <Tooltip content={data.step_lock_text} position="right" type="primary" maxWidth={500}>
                <div className="" style={{ cursor: 'not-allowed', marginLeft: '10px' }}>
                  <img src={addDomainInPath('images/lock.png')} alt="lock-icon" />
                </div>
              </Tooltip>
            ) : null}
          </div>
          <div className="stepper-discription"> {data.description}</div>
        </>
      );
    };

    const handleStepChange = (stepIndex: number, closeStep = false) => {
      if (closeStep) {
        const data = stepStatus.map((s: any, i: number) => {
          if (i === stepIndex) {
            return StepStatus.COMPLETED;
          }
          return s;
        });
        setStepStatus(data);

        //Call when all steps are completed;
        handleOnAllStepsComplete(true);
      } else {
        const data: string[] = stepStatus.map((s: any, i: number) => {
          if (i <= stepIndex) {
            return StepStatus.COMPLETED;
          } else if (i === stepIndex + 1) {
            return StepStatus.ACTIVE;
          } else {
            return StepStatus.DISABLED;
          }
        });
        setStepStatus(data);
        // setTimeout(() => {
        //   document.getElementById(steps?.[stepIndex + 1]?.step_id)?.scrollIntoView({
        //     behavior: 'smooth',
        //     block: 'center',
        //     inline: 'nearest'
        //   });
        // }, 100);
      }
    };

    const goToStep = (stepIndex: number) => {
      const data: string[] = stepStatus.map((s: any, i: number) => {
        if (s === StepStatus.ACTIVE && i !== stepIndex) {
          return StepStatus.DISABLED;
        }
        if (i > stepIndex) {
          return StepStatus.DISABLED;
        }
        if (i === stepIndex) {
          return StepStatus.ACTIVE;
        }
        return s;
      });
      setStepStatus(data);
    };

    // Export Methods to Parent Component
    useImperativeHandle(ref, () => ({
      handleDynamicStepChange: (stepIndex, closeStep = false) =>
        handleStepChange(stepIndex, closeStep)
    }));

    return useMemo(() => {
      const stepClassNameObject: any = {
        [StepStatus.ACTIVE]: 'active',
        [StepStatus.COMPLETED]: 'completed',
        [StepStatus.DISABLED]: 'disabled',
        [`${StepStatus.ACTIVE}__${StepStatus.COMPLETED}`]: 'active__to__completed',
        [`${StepStatus.ACTIVE}__${StepStatus.ACTIVE}`]: 'active__to__active',
        [`${StepStatus.ACTIVE}__${StepStatus.DISABLED}`]: 'active__to__disabled',
        [`${StepStatus.DISABLED}__${StepStatus.COMPLETED}`]: 'disabled__to__completed',
        [`${StepStatus.DISABLED}__${StepStatus.ACTIVE}`]: 'disabled__to__active',
        [`${StepStatus.DISABLED}__${StepStatus.DISABLED}`]: 'disabled__to__disabled',
        [`${StepStatus.COMPLETED}__${StepStatus.COMPLETED}`]: 'completed__to__completed',
        [`${StepStatus.COMPLETED}__${StepStatus.ACTIVE}`]: 'completed__to__active',
        [`${StepStatus.COMPLETED}__${StepStatus.DISABLED}`]: 'completed__to__disabled'
      };

      const getStepStatus = (idx: number) => {
        return stepStatus[idx];
      };

      const summaryActivateStep = (e: any) => {
        const index = e.currentTarget.getAttribute('data-step-index');
        handleOnAllStepsComplete(false);

        if (isEdit) {
          goToStep(+index);
        } else {
          handleStepChange(index - 1);
        }
      };

      return (
        <div className={`migration-vertical-stepper StepperWrapper ${className}`}>
          <ol className="Vertical">
            {steps.map((step: any, index: number) => {             
              const shouldShowIcon = (step?.title !== 'Select Stack' && step?.title !== 'Upload File' ) ? !step?.lock : false;

              const DataComponent = step.data as React.ElementType;
              const SummeryComponent = step.summery as React.ElementType;

              let stepClassName = stepClassNameObject[getStepStatus(index)];
              if (step.lock) stepClassName = 'completed';
              const getGridientClass =
                stepClassNameObject[`${getStepStatus(index)}__${getStepStatus(index + 1)}`];
              return (
                <li
                  id={step.step_id}
                  className={`${stepClassName} ${getGridientClass}`}
                  key={step.step_id}
                  style={{ paddingBottom: '40px' }}
                >
                  <div className={`step__title ${stepTitleClassName}`}>
                    {StepperStepTitleCreator(step)}
                  </div>
                  {stepClassName === 'disabled' ? (
                    <></>
                  ) : (
                    <>
                      {stepClassName === 'active' ? (
                        <div className="step-content-wrapper">
                          <div className="action-content step-content">
                            <div
                              className={
                                step.step_id === 'Step1' ||
                                step.step_id === 'Step2' ||
                                step.step_id === 'Step3'
                                  ? ''
                                  : 'StepperWrapper__step'
                              }
                            >
                              <DataComponent
                                handleStepChange={handleStepChange}
                                currentStep={index}
                                {...(stepComponentProps && {
                                  stepComponentProps: stepComponentProps
                                })}
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <></>
                      )}
                      {stepClassName === 'completed' ? (
                        <div
                          className={`action-summary-wrapper ${
                            shouldShowIcon ? '' : 'step-content-wrapper step-summary-wrapper'
                          }`}
                          data-step-index={index}
                          onClick={
                            !step?.lock
                              ? summaryActivateStep
                              : () => {
                                  return;
                                }
                          }
                        >
                          <div className="action-content step-content">
                            <div className={'StepperWrapper__step'}>
                              <SummeryComponent
                                onClick={
                                  !step?.lock
                                    ? summaryActivateStep
                                    : () => {
                                        return;
                                      }
                                }
                                currentStep={index}
                                stepData={step}
                                {...(stepComponentProps && {
                                  stepComponentProps: {
                                    ...stepComponentProps,

                                    //pass onStepLockHandler
                                    ...(step?.lock && {
                                      handleOnStepLock: handleStepChange
                                    })
                                  }
                                })}
                              />

                              {shouldShowIcon ? (
                                <span className="summery-edit">
                                  <Icon icon="Edit" size="small" version="v2" />
                                </span>
                              ) : (
                                <></>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <></>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      );
    }, [steps, stepStatus]);
  }
);

export default AutoVerticalStepper;
