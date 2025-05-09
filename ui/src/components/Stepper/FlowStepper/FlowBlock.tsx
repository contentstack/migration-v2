import React, { ReactNode } from 'react';

type FlowBlockProps = {
  children?: ReactNode;
  spear?: string;
  className?: string;
};

const FlowBlock = ({ children, spear = '', className = '' }: FlowBlockProps) => {
  return <div className={`${spear ? 'ft-spear-head-bg-line' : ''} ${className}`}>{children}</div>;
};

export default FlowBlock;
