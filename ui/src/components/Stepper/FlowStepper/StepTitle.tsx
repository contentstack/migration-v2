import React from 'react';

/**
 * Props for the StepTitle component.
 */
type StepTitleProps = {
  /**
   * The title of the step.
   */
  title: string;
  
  /**
   * The description of the step.
   */
  desc: string;
  
  /**
   * Indicates whether the step is currently active.
   */
  stepActive: boolean;
  
  /**
   * Indicates whether the step is being hovered over.
   */
  isHovered: boolean;
};

/**
 * Renders the title and description of a step in the flow stepper.
 *
 * @param {StepTitleProps} props - The component props.
 * @param {string} props.title - The title of the step.
 * @param {string} props.desc - The description of the step.
 * @param {boolean} [props.stepActive=false] - Indicates if the step is currently active.
 * @param {boolean} [props.isHovered=false] - Indicates if the step is currently being hovered over.
 * @returns {JSX.Element} The rendered StepTitle component.
 */
const StepTitle = ({ title, desc, stepActive = false, isHovered = false }: StepTitleProps) => {
  return (
    <div>
      <h5
        className={`overflow-ellipses block-title`}
        style={stepActive || isHovered ? { color: '#5D50BE' } : { color: '#475161' }}
      >
        {title}
      </h5>

      <div
        className={`block-description`}
        style={stepActive || isHovered ? { color: '#5D50BE' } : { color: '#6E6B86' }}
      >
        {desc}
      </div>
    </div>
  );
};

export default StepTitle;
