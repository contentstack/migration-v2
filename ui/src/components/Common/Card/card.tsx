// Libraries
import {useState } from 'react';
import { useSelector } from 'react-redux';
import { Icon, Paragraph, Radio, Tooltip } from '@contentstack/venus-components';

// Redux Store
import { RootState } from '../../../store';

// Interface
import { ICardType } from './card.interface';

// CSS
import './card.scss';

/**
 * Props for the Card component.
 */
type CardProps<T extends ICardType = ICardType> = {
  data: T;
  idField?: string;
  onCardClick?: (data: T) => void | Promise<void>;
  selectedCard: T;
  cardType?: string;
  disabled: boolean;
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
const Card = <T extends ICardType = ICardType>({
  data,
  selectedCard,
  onCardClick,
  cardType,
  idField = 'id',
  disabled
}: CardProps<T>) => {
  const [isHovered, setIsHovered] = useState(false);

  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);

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

  const handleClick = (event: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>) => {
    if (newMigrationData?.project_current_step <= 1) {
      event.preventDefault(); // Prevent the default action
      onCardClick?.(data);
    }
  };

  // Accessibility: Enable keyboard navigation for card selection
  const handleKeyboardActivation = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const ENTER_KEY = 'Enter';
    const SPACE_KEY = ' ';
    
    if (event.key === ENTER_KEY || event.key === SPACE_KEY) {
      event.preventDefault(); // Prevent page scrolling on space
      handleClick(event);
    }
  };

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      // Accessibility: Handle keyboard activation (Enter/Space) for interactive card
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault(); // Prevent page scrolling on space
          handleClick(e);
        }
      }}
      role="button" // or "radio" if it's part of a group 
      tabIndex={0}
      className={`connector_list ${cardType === 'legacyCMS' ? 'trigger_list' : ''} ${
        disabled ? 'Card__disabled' : ''
      } `}
      style={{ position: 'relative' }}
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

      <div className="service_icon"></div>
      <div className="centered-card-title">
        <Paragraph variantStyle={'bold'} variant={'p2'} text={data.title} />
      </div>
    </div>
  );
};

export default Card;
