import React, { useEffect, useImperativeHandle, useMemo, useState } from 'react';
import './AutoVerticalStepper.scss';
import { Heading, Paragraph } from '@contentstack/venus-components';


export enum StepStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  DISABLED = 'DISABLED'
}

type AutoVerticalStepperProps = {
  steps: any[];
  className?: string;
  description?: string;
  stepComponentProps?: any;
  isEdit: boolean;
  isRequired:boolean;
  handleOnAllStepsComplete: (flag: boolean) => void;
};

export type AutoVerticalStepperComponentHandles = {
  handleDynamicStepChange: (stepIndex: number, closeStep?: boolean) => void;
};

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
      description='',
      stepComponentProps,
      isEdit = false,
      handleOnAllStepsComplete = () => {
        return;
      }
    } = props;

    const [stepStatus, setStepStatus] = useState(steps?.map((s: any) => s.status));

    useEffect(() => {
      if (!stepComponentProps?.step?.step_id && !stepComponentProps?.connector?.group_name) {
        setStepStatus(steps?.map((s: any) => s.status));
      }
    }, [stepComponentProps?.step?.step_id, stepComponentProps?.connector?.group_name]);

    const handleStepChange = (stepIndex: number, closeStep = false) => {

      if (closeStep) {
        const data = stepStatus.map((s: any, i: number) => {
          if (i === stepIndex) {
            return StepStatus.COMPLETED;
          }
          return s;
        });
        setStepStatus(data);
        
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
      }
    };

    const StepperStepTitleCreator: (data: any,isRequired:boolean) => JSX.Element = (data: any, isRequired:boolean) => {
      const showSpan = data?.title == 'Orgnization' ? <span>(read only)</span> : ''
      return (
        <>
          <div className="migration-vertical-stepper-container">
            <div>
              <div className='orgWrapper'>
                <Heading className='stepper-title' tagName='h3' text={data.title} />
                {isRequired || data?.isRequired && <span className="FieldLabel__required-text">(required)</span>  }    
                {data?.ifReadonly && <span>(read only)</span>}
              </div>
              <span className="stepper-titleNote">{data.titleNote ? data.titleNote : ''}</span>
            </div>
            {/* {data?.lock ? (
              <Tooltip content={data.step_lock_text} position="right" type="primary" maxWidth={500}>
                <div className="" style={{ cursor: 'not-allowed', marginLeft: '10px' }}>
                  <img src={addDomainInPath('images/lock.png')} alt="lock-icon" />
                </div>
              </Tooltip>
            ) : null} */}
          </div>
          {data.description && <div className="stepper-discription"> {data.description}</div>}
        </>
      );
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

    const summaryActivateStep = (e: any) => {
      const index = e.currentTarget.getAttribute('data-step-index');
      handleOnAllStepsComplete(false);

      if (isEdit) {
        goToStep(+index);
      } else {
        handleStepChange(index - 1);
      }
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
      return (
        <div className={`migration-vertical-stepper  ${className}`}>
          {props?.description && <div className='description'>{props?.description}</div>}
          <ol className="Vertical">
            {steps?.map((step: any, index: number) => {
              
              let stepClassName = stepClassNameObject[getStepStatus(index)];
              if (step?.lock) stepClassName = 'completed';
              const getGridientClass =
                stepClassNameObject[`${getStepStatus(index)}__${getStepStatus(index + 1)}`];
              
              return (
                <li
                  id={step?.step_id}
                  className="step_block"
                  key={step?.step_id}
                  style={{ paddingBottom: '10px' }}
                >
                  <div className={`step__title `}>
                    {StepperStepTitleCreator(step, props?.isRequired)}
                  </div>
                  <div className="step-content-wrapper">
                    <div className="action-content step-content">
                      <div
                        className={
                          step?.step_id === 'Step1' ||
                          step?.step_id === 'Step2' ||
                          step?.step_id === 'Step3'
                            ? ''
                            : 'StepperWrapper__step'
                        }
                        onClick={
                          !step?.lock
                            ? summaryActivateStep
                            : () => {
                                return;
                              }
                        }
                      >
                        {step.data && (
                          <step.data
                            handleStepChange={handleStepChange}
                            currentStep={index}
                            {...(stepComponentProps && {
                              stepComponentProps: stepComponentProps
                            })}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          </div>
        
      );
      
    }, [steps, stepStatus]);
  }
);

AutoVerticalStepper.displayName= 'AutoverticalStepper';
export default AutoVerticalStepper;
