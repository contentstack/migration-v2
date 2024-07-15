import React from 'react';
import { addDomainInPath } from '../../../utilities/functions';

type StepIconProps = {
  icon?: string;
  className?: string;
};

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
