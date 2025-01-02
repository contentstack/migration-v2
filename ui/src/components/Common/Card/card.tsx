// Libraries
import { Icon, Paragraph, Radio, Tooltip } from '@contentstack/venus-components';
import { MouseEvent, useState } from 'react';
import { useSelector } from 'react-redux';

// Redux Store
import { RootState } from '../../../store';

// Interface
import { ICardType } from './card.interface';

// CSS
import './card.scss';

/**
 * Props for the Card component.
 */
type CardProps = {
  data: ICardType;
  idField?: string;
  onCardClick?: (T: any) => unknown;
  selectedCard: ICardType;
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
const Card = ({ data, selectedCard, onCardClick, idField = 'id' }: CardProps) => {
  const [isHovered, setIsHovered] = useState(false);

  const newMigrationData = useSelector((state:RootState)=>state?.migration?.newMigrationData);

  const handleMouseEnter = () => {
    if (!newMigrationData?.legacy_cms?.uploadedFile?.isValidated) {
      if (selectedCard[idField] === data?.[idField]) {
        setIsHovered(true);
      }
    } 
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!newMigrationData?.legacy_cms?.uploadedFile?.isValidated) {
      event.preventDefault(); // Prevent the default action
      onCardClick?.(data);
    }
  };

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`connector_list ${newMigrationData?.legacy_cms?.uploadedFile?.isValidated ? 'disabled-card' : ''}`}
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
