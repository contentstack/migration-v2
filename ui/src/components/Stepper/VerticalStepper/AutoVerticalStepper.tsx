import React, { useImperativeHandle, useMemo, useState } from 'react';
import './AutoVerticalStepper.scss';
import { Heading } from '@contentstack/venus-components';
import { IStep } from '../../../context/app/app.interface';


export enum StepStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  DISABLED = 'DISABLED'
}

type AutoVerticalStepperProps = {
  steps: IStep[];
  className?: string;
  description?: string;
  stepComponentProps?: ()=>{};
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
      stepComponentProps,
      isEdit = false,
      handleOnAllStepsComplete = () => {
        return;
      }
    } = props;

    const [stepStatus, setStepStatus] = useState(steps?.map((s: IStep) => s.status));
    

    const handleStepChange = (stepIndex: number, closeStep = false) => {

      if (closeStep) {
        const data = stepStatus.map((s: string | undefined, i: number) => {
          if (i === stepIndex) {
            return StepStatus.COMPLETED;
          }
          return s;
        });
        setStepStatus(data);
        
        handleOnAllStepsComplete(true);
      } else {
        const data: string[] = stepStatus.map((s: string | undefined, i: number) => {
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

    const StepperStepTitleCreator: (data: IStep,isRequired:boolean) => JSX.Element = (data: IStep, isRequired:boolean) => {
      
      return (
        <>
          <div className="migration-vertical-stepper-container">
            <div>
              <div className='orgWrapper'>
                <Heading className='stepper-title' tagName='h3' text={data.title} />
                {(isRequired || data?.isRequired) && <span className="required-text">(required)</span>  }    
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
      const data: string[] = stepStatus.map((s: string | undefined, i: number) => {
        if (s === StepStatus.ACTIVE && i !== stepIndex) {
          return StepStatus.DISABLED;
        }
        if (i > stepIndex) {
          return StepStatus.DISABLED;
        }
        if (i === stepIndex) {
          return StepStatus.ACTIVE;
        }
        return s !== undefined ? s : '' ;
      });
      setStepStatus(data);
    };

    const summaryActivateStep = (e: React.MouseEvent<HTMLDivElement>) => {
      const index = e?.currentTarget?.getAttribute('data-step-index');
      if(! index) return;
      handleOnAllStepsComplete(false);
      if (!index) return;

      const stepIndex = parseInt(index, 10);
      if (isEdit) {
        goToStep(stepIndex);
      } else {
        handleStepChange(stepIndex - 1);
      }
    };

    // Export Methods to Parent Component
    useImperativeHandle(ref, () => ({
      handleDynamicStepChange: (stepIndex, closeStep = false) =>
        handleStepChange(stepIndex, closeStep)
    }));
    
    return useMemo(() => {

      return (
        <div className={`migration-vertical-stepper  ${className}`}>
          {props?.description && <div className='description'>{props?.description}</div>}
          <ol className="Vertical">
            {steps?.map((step: IStep, index: number) => {
                          
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
