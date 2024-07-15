import { Button, Checkbox, Icon, Radio, Search, Tooltip } from '@contentstack/venus-components';
import React, { useEffect, useState } from 'react';

import WordWrapper from '../../WordWrapper/WordWrapper';
import { IFilterStatusType, IFilterType } from './filterModal.interface';
import './FilterModal.scss';

type Props = {
  title: string;
  list: IFilterType[];
  status: IFilterStatusType;
  applyFilter: (status: IFilterStatusType) => void;
  isMulti?: boolean;
  canSearch?: boolean;
  style?: React.CSSProperties;
  searchPlaceholder?: string;
  modalOnly?: boolean;
  showModal?: boolean;
  setShowModal?: (modal: boolean) => void;
  iconSize?: 'original' | 'tiny' | 'mini' | 'small' | 'large' | 'medium' | 'extraSmall';
};

/**
 * Represents a filter modal component.
 *
 * @component
 * @param {Props} props - The props for the FilterModal component.
 * @returns {JSX.Element} The rendered FilterModal component.
 */

export const FilterModal = (props: Props) => {
  const {
    title,
    list,
    applyFilter,
    status,
    isMulti = false,
    canSearch = false,
    style,
    searchPlaceholder = '',
    modalOnly = false,
    showModal = false,
    setShowModal,
    iconSize = 'medium'
  } = props;

  const [localCheckStatus, setLocalCheckStatus] = useState(status);
  const isAnyFilterApplied = Object.keys(localCheckStatus).some((key) => localCheckStatus[key]);

  const [isQueryApplied, setIsQueryApplied] = useState(isAnyFilterApplied);

  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [searchText, setSearchText] = useState('');

  // const uniqueId = `FilterModal-icon-${title}`;
  const [filterItems, setFilterItems] = useState(list);

  const openFilterDropdown = (event: MouseEvent) => {
    event.preventDefault();
    if (!isFilterDropdownOpen) {
      setIsFilterDropdownOpen(true);
    }
  };

  useEffect(() => {
    const items: typeof list = [];
    list.forEach((item) => {
      if (item.label.toLowerCase().includes(searchText) || item.value.includes(searchText)) {
        items.push(item);
      }

      setFilterItems(items);
    });
  }, [searchText, list.length]);

  const handleOutsideClick = (e: MouseEvent) => {
    if (isFilterDropdownOpen || showModal) {
      const modalElement = document.querySelector('.Filter__modal');
      if (modalElement && !modalElement.contains(e.target as Node)) {
        if (modalOnly && setShowModal) {
          setShowModal(false);
        } else {
          setIsFilterDropdownOpen(false);
        }
      }
    }
  };

  useEffect(() => {
    document.addEventListener('click', handleOutsideClick);

    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [isFilterDropdownOpen, showModal]);

  return (
    <div
      className="Filter__wrapper"
      onClick={(e) => {
        e.stopPropagation();
      }}
      style={style}
    >
      {!modalOnly && (
        <Button
          className={`Filter__icon ${
            isQueryApplied || isFilterDropdownOpen || showModal ? 'Filter__icon_bg_color' : ''
          }`}
          onClick={openFilterDropdown}
          buttonType="light"
          version="v2"
          size="small"
          onlyIcon
          icon={'Filter'}
          iconProps={{
            active: isQueryApplied || isFilterDropdownOpen || showModal,
            version: 'v2',
            size: iconSize,
            hover: true,
            hoverType: 'primary',
            withTooltip: true,
            tooltipContent: 'Filter',
            tooltipPosition: 'top'
          }}
        />
      )}

      {(isFilterDropdownOpen || showModal) && (
        <div className={`Filter__modal`}>
          {/* header */}
          <div className="flex-v-center flex-justify Filter__modal-header">
            <div className="Filter__modal-header-container">
              <span className="Filter__modal-header-title">{title}</span>
              <span className="Filter__modal-header-counter">{filterItems?.length}</span>
            </div>
            <div
              onClick={() => {
                if (modalOnly) {
                  applyFilter(localCheckStatus);
                } else {
                  setIsFilterDropdownOpen(false);
                }
              }}
              className="flex-v-center flex-h-center Filter__modal-header-cancel show-hower-bg"
            >
              <Tooltip position="top" content="Close Filter">
                <Icon icon="Cancel" version="v2" size="medium" />
              </Tooltip>
            </div>
          </div>

          {canSearch && (
            <div className="Filter__searchbox">
              <Search
                onClear={true}
                width="full"
                value={searchText}
                debounceSearch
                onChange={(text: string) => {
                  setSearchText(text);
                }}
                placeholder={searchPlaceholder}
              />
            </div>
          )}

          {/* content */}
          <div className="Filter__modal-content">
            {filterItems?.length > 0 ? (
              filterItems?.map((item: IFilterType) => {
                return (
                  <div
                    key={item.value}
                    className="Filter__item"
                    onClick={() => {
                      if (isMulti) {
                        setLocalCheckStatus((state) => {
                          return {
                            ...state,
                            [item.value]: !state[item.value]
                          };
                        });
                      } else {
                        setLocalCheckStatus((state) => {
                          Object.keys(state).forEach((key) => {
                            if (key !== item.value) state[key] = false;
                          });
                          const newState = {
                            ...state,
                            [item.value]: !state[item.value]
                          };

                          const isAnyFilterApplied = Object.keys(newState).some(
                            (key) => newState[key]
                          );

                          setIsQueryApplied(isAnyFilterApplied);
                          applyFilter(newState);
                          return newState;
                        });

                        if (modalOnly && setShowModal) {
                          setSearchText('');
                          setShowModal(false);
                        } else {
                          setIsFilterDropdownOpen(false);
                        }
                      }
                    }}
                  >
                    {isMulti ? (
                      <Checkbox
                        checked={localCheckStatus[item.value]}
                        label={
                          <WordWrapper
                            tooltipcontent={item.label}
                            text={item.label}
                            maxLength={23}
                          />
                        }
                      />
                    ) : (
                      <Radio
                        label={
                          <WordWrapper
                            tooltipcontent={item.label}
                            text={item.label}
                            maxLength={23}
                          />
                        }
                        checked={localCheckStatus[item.value]}
                      />
                    )}
                  </div>
                );
              })
            ) : (
              <div className="Filter__no-found">No Filter Item Found</div>
            )}
          </div>

          {/* footer */}
          {isMulti && filterItems.length > 0 && (
            <div className="Filter__modal-footer">
              <Button
                aria-label="Apply Filter"
                version="v2"
                buttonType="primary"
                size="small"
                onClick={() => {
                  const isAnyFilterApplied = Object.keys(localCheckStatus).some(
                    (key) => localCheckStatus[key]
                  );
                  if (isAnyFilterApplied) {
                    applyFilter(localCheckStatus);
                    setSearchText('');

                    if (!modalOnly) {
                      setIsQueryApplied(true);
                      setIsFilterDropdownOpen(false);
                    }
                  } else {
                    // showNotification('No filters selected!', 'warning');

                    if (!modalOnly) {
                      setIsQueryApplied(false);
                    }
                  }
                }}
              >
                Apply
              </Button>
              <Button
                aria-label="Clear All"
                onClick={() => {
                  applyFilter({});
                  setIsQueryApplied(false);
                  setIsFilterDropdownOpen(false);
                  setSearchText('');
                  setLocalCheckStatus({});
                }}
                className="mr-20"
                buttonType="tertiary"
                version="v2"
                type="primary"
                size="small"
              >
                Clear All
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
