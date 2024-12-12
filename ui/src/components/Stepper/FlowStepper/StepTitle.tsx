import React from 'react';

type StepTitleProps = {
  title: string;
  desc: string;
  stepActive: boolean;
  isHovered: boolean;
};

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
