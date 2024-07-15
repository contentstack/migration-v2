import React, { ReactNode } from 'react';

/**
 * Props for the FlowBlock component.
 */
type FlowBlockProps = {
  children?: ReactNode;
  spear?: string;
  className?: string;
};

/**
 * Represents a block in the flow stepper component.
 *
 * @param {FlowBlockProps} props - The props for the FlowBlock component.
 * @param {ReactNode} props.children - The content of the FlowBlock component.
 * @param {string} [props.spear=''] - The spear value for the FlowBlock component.
 * @param {string} [props.className=''] - The additional CSS class name for the FlowBlock component.
 * @returns {JSX.Element} The rendered FlowBlock component.
 */
const FlowBlock = ({ children, spear = '', className = '' }: FlowBlockProps) => {
  return <div className={`${spear ? 'ft-spear-head-bg-line' : ''} ${className}`}>{children}</div>;
};

export default FlowBlock;
