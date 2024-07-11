import { Icon, Paragraph, Radio, Tooltip } from '@contentstack/venus-components';
import { MouseEvent, useState } from 'react';
import WordWrapper from '../WordWrapper/WordWrapper';
import { addDomainInPath } from '../../../utilities/functions';

import './card.scss';

type CardProps = {
  data: any;
  idField?: string;
  onCardClick: (T: any) => unknown;
  selectedCard: any;
  cardType?: string;
};

/**
 * Represents a card component.
 *
 * @param {CardProps} props - The props for the card component.
 * @returns {JSX.Element} The rendered card component.
 */
const Card = ({ data, selectedCard, onCardClick, cardType, idField = 'id' }: CardProps): JSX.Element => {
  const imgStyle = {
    width: cardType === 'legacyCMS' ? '60px' : '46px',
    height: cardType === 'legacyCMS' ? '60px' : '46px'
  };
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault(); // Prevent the default action
    onCardClick(data);
  };

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`connector_list ${cardType === 'legacyCMS' ? 'trigger_list' : ''}`}
      style={{ position: 'relative' }}
      onClick={handleClick}
    >
      {data.description && (
        <div style={{ position: 'absolute' }}>
          <Tooltip content={data.description} position="top-start" showArrow={false} version="v2">
            {isHovered ? (
              <span className="connector-help">
                <Icon size="mini" className={''} icon="Information" version="v2" />
              </span>
            ) : (
              <></>
            )}
          </Tooltip>
        </div>
      )}

      <span
        style={{
          position: 'absolute',
          right: '-1px',
          top: '-5px'
        }}
      >
        {isHovered || selectedCard[idField] === data?.[idField] ? (
          <Radio checked={selectedCard?.id === data?.id} disabled={!isHovered} />
        ) : (
          <></>
        )}
      </span>

      <div className="service_icon">
      </div>
      <div className="centered-card-title">
        <Paragraph variantStyle={'bold'} variant={'p2'} text={data.title}/>
      </div>
    </div>
  );
};

export default Card;
