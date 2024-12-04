import { Icon, Paragraph, Radio, Tooltip } from '@contentstack/venus-components';
import { MouseEvent, useState } from 'react';
import WordWrapper from '../WordWrapper/WordWrapper';
import { addDomainInPath } from '../../../utilities/functions';

import './card.scss';

/**
 * Props for the Card component.
 */
type CardProps = {
  data: any;
  idField?: string;
  onCardClick?: (T: any) => unknown;
  selectedCard: any;
  cardType?: string;
};

/**
 * Renders a card component.
 *
 * @param data - The data object for the card.
 * @param selectedCard - The currently selected card.
 * @param onCardClick - The callback function to handle card click event.
 * @param cardType - The type of the card.
 * @param idField - The field name for the card's ID. Defaults to 'id'.
 */
const Card = ({ data, selectedCard, onCardClick, cardType, idField = 'id' }: CardProps) => {
  const imgStyle = {
    width: cardType === 'legacyCMS' ? '60px' : '46px',
    height: cardType === 'legacyCMS' ? '60px' : '46px'
  };
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = () => {
    if (selectedCard[idField] === data?.[idField]) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault(); // Prevent the default action
    onCardClick?.(data);
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
