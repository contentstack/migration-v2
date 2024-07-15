import { Tooltip } from '@contentstack/venus-components';
import cn from 'classnames';
import React from 'react';

type Props = {
  text: string;
  maxLength: number;
  tooltipcontent: string | React.ReactNode;
  className?: string;
  position?: string;
};

function WordWrapper(props: Props) {
  const { maxLength, tooltipcontent, position = 'right' } = props;
  const text = props.text || '';

  const classNames = cn('WordWrapper', props.className);

  const TooltipContent = (
    <div
      style={{ whiteSpace: 'normal', wordWrap: 'break-word' }}
      onClick={(event: any) => {
        event.stopPropagation();
      }}
    >
      {tooltipcontent || text}
    </div>
  );

  if (text.length > maxLength) {
    return (
      <Tooltip content={TooltipContent} position={position} interactive={false}>
        <div
          style={{
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            overflow: 'hidden'
          }}
        >
          {text.substring(0, maxLength)}...
        </div>
      </Tooltip>
    );
  }

  return (
    <span style={{ textOverflow: 'ellipsis' }} className={classNames}>
      {text}
    </span>
  );
}

export default WordWrapper;
