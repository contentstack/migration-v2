import { Button, ButtonGroup, Checkbox, Icon } from '@contentstack/venus-components';
import './FilterModal.scss';
import { FilterModaleProps } from './filterModal.interface';


const FilterModal = ({
  isOpen,
  closeModal,
  updateValue,
  onApply,
  selectedLevels,
  setSelectedFilterOption,
  filterOptions
}: FilterModaleProps) => {
  const clearAll = () => {
    setSelectedFilterOption([]);
    
  };

  if (!isOpen) return null;

  return (
    <div className="tableFilterModalStories">
      {/* Modal header */}
      <div className="tableFilterModalStories__header">
        <span className="text-size">Level</span>
        <div className="close-btn">
          <Icon version="v2" icon={'CloseNoborder'} size="medium" onClick={closeModal} />
        </div>
      </div>
      {/* Modal Body */}
      <div className="tableFilterModalStories__body">
      <ul>
        {filterOptions?.map?.((item) => (
          <li key={item.value}>
            <div className="tableFilterModalStories__suggestion-item">
              <Checkbox
              checked={selectedLevels?.some?.((v) => v?.value === item?.value) || false}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                updateValue?.({ value: item, isChecked: e?.target?.checked })
              }
              version="v2"
              label={item?.label || ''}
              className="text-size"
              />
            </div>
          </li>
        ))}
      </ul>
      </div>

      {/* Modal Footer */}
      <div className="tableFilterModalStories__footer">
        <Button buttonType="tertiary" version="v2" onClick={clearAll}>
          Clear All
        </Button>
        <ButtonGroup>
          <Button size="regular" version="v2" onClick={onApply}>
            Apply
          </Button>
        </ButtonGroup>
      </div>
    </div>
  );
};

export default FilterModal;
