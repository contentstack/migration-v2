import React from 'react';
import { addDomainInPath } from '../../../utilities/functions';

/**
 * Props for the StepIcon component.
 */
type StepIconProps = {
  /**
   * The icon to be displayed.
   */
  icon?: string;

  /**
   * Additional class name for the component.
   */
  className?: string;
};

/**
 * Renders a step icon component.
 *
 * @param icon - The icon name.
 * @param className - Additional CSS class names for the component.
 * @returns The rendered step icon component.
 */
const StepIcon = ({ icon = 'lightning', className = '' }: StepIconProps) => {
  return (
    <img
      alt="cms logo"
      className={`configure_action_logo step-flow-icon ${className}`}
      src={addDomainInPath(`/images/${icon}.png`)}
    />
  );
};

export default StepIcon;
