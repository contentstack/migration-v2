import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  InfiniteScrollTable,
  Button,
  EmptyState,
  Select,
  cbModal
} from '@contentstack/venus-components';
import { RootState } from '../../store';
import { DropdownOption, FilterOption, LogEntry, StackIds } from './executionlog.interface';
import './index.scss';

import { getMigrationLogs } from '../../services/api/migration.service';
import { EXECUTION_LOGS_UI_TEXT } from '../../utilities/constants';
import LogModal from '../Common/Modal/LogModal/LogModal';
import { useParams } from 'react-router';
import FilterModal from '../FilterModal/FilterModal';

const ExecutionLogs = () => {
  const [data, setData] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCounts, setTotalCounts] = useState<number>(0);
  const [searchText, setSearchText] = useState<string>('');
  const [selectedFilterOption, setSelectedFilterOption] = useState<FilterOption[]>([]);
  const [isCursorInside, setIsCursorInside] = useState(false);
  const [isFilterApplied, setIsFilterApplied] = useState(false);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [filterValue, setFilterValue] = useState<string>('all');
  const [filterOptions, setFilterOptions] = useState<FilterOption[]>([]);

  const { projectId } = useParams<{ projectId: string }>();

  const v2Features = {
    pagination: true,
    isNewEmptyState: true,
    tableRowAction: true
  };

  const selectedOrganisation = useSelector(
    (state: RootState) => state?.authentication?.selectedOrganisation
  );

  const testStacks = useSelector(
    (state: RootState) => state?.migration?.newMigrationData?.testStacks
  );

  const mainStack = useSelector(
    (state: RootState) => state?.migration?.newMigrationData?.stackDetails
  );
  const migrationCompleted = useSelector(
    (state: RootState) =>
      state?.migration?.newMigrationData?.migration_execution?.migrationCompleted
  );

  const stackIds = testStacks?.map?.((stack: StackIds) => ({
    label: stack?.stackName,
    value: stack?.stackUid
  }));

  if (migrationCompleted) {
    stackIds?.push({
      label: mainStack?.label,
      value: mainStack?.value
    });
  }

  const [selectedStack, setSelectedStack] = useState<DropdownOption>({
    label: stackIds?.[stackIds?.length - 1]?.label ?? '',
    value: stackIds?.[stackIds?.length - 1]?.value ?? ''
  });

  useEffect(() => {
    if (selectedStack) {
      fetchData({});
    }
  }, [selectedStack]);

  const ColumnFilter = () => {
    const closeModal = () => {
      setIsFilterDropdownOpen(false);
    };

    const openFilterDropdown = () => {
      if (!isFilterDropdownOpen) {
        setIsFilterDropdownOpen(true);
      }
    };

    const handleClickOutside = () => {
      if (!isCursorInside) {
        closeModal && closeModal();
      }
    };

    //Method to maintain filter value
    const updateValue = ({ value, isChecked }: { value: FilterOption; isChecked: boolean }) => {
      try {
        let filterValueCopy: FilterOption[] = [...selectedFilterOption];

        if (!filterValueCopy?.length && isChecked) {
          filterValueCopy?.push(value);
        } else if (isChecked) {
          // Remove the old value and keep updated one in case old value exists
          const updatedFilter = filterValueCopy?.filter((v) => v?.value !== value?.value);
          filterValueCopy = [...updatedFilter, value];
        } else if (!isChecked) {
          filterValueCopy = filterValueCopy?.filter((v) => v?.value !== value?.value);
        }

        setSelectedFilterOption(filterValueCopy);
      } catch (error) {
        console.error('Error updating filter value:', error);
      }
    };

    // Method to handle Apply
    const onApply = () => {
      try {
        if (!selectedFilterOption?.length) {
          const newFilter = 'all';
          setFilterValue(newFilter);
          fetchData({ filter: newFilter });
          closeModal();
          return;
        }
        setIsFilterApplied(true);

        const usersQueryArray = selectedFilterOption?.map?.((item) => item?.value);
        const newFilter =
          usersQueryArray?.length > 1 ? usersQueryArray?.join('-') : usersQueryArray?.[0];
        setFilterValue(newFilter);
        fetchData({ filter: newFilter });
        closeModal();
      } catch (error) {
        console.error('Error applying filter:', error);
      }
    };

    useEffect(() => {
      document.addEventListener('click', handleClickOutside, false);
      return () => {
        document.removeEventListener('click', handleClickOutside, false);
      };
    }, [isCursorInside]);

    const iconProps = {
      className: isFilterApplied
        ? EXECUTION_LOGS_UI_TEXT.FILTER_ICON.FILTER_ON
        : EXECUTION_LOGS_UI_TEXT.FILTER_ICON.FILTER_OFF,
      withTooltip: true,
      tooltipContent: 'Filter',
      tooltipPosition: 'left'
    };

    return (
      <div
        onMouseEnter={() => {
          setIsCursorInside(true);
        }}
        onMouseLeave={() => {
          setIsCursorInside(false);
        }}
        className="filter-button">
        <Button
          onClick={openFilterDropdown}
          icon="v2-Filter"
          buttonType="tertiary"
          onlyIcon={true}
          version="v2"
          onlyIconHoverColor="secondary"
          iconProps={iconProps}
        />
        <FilterModal
          isOpen={isFilterDropdownOpen}
          closeModal={closeModal}
          updateValue={updateValue}
          onApply={onApply}
          selectedLevels={selectedFilterOption}
          setSelectedFilterOption={setSelectedFilterOption}
          filterOptions={filterOptions}
        />
      </div>
    );
  };

  const onClose = () => {
    console.info('on modal close');
  };

  const handleModaleClick = (data: LogEntry) => {
    cbModal({
      component: (props: any) => <LogModal props={{ ...props }} data={data} />,
      modalProps: {
        onClose,
        shouldCloseOnOverlayClick: true
      }
    });
  };

  const columns = [
    {
      Header: 'Timestamp',
      width: 250,
      id: 'timestamp',
      disableSortBy: true,
      disableResizing: false,
      addToColumnSelector: true,
      accessor: (data: LogEntry) => {
        if (data?.timestamp) {
          const date = new Date(data?.timestamp);
          const options: Intl.DateTimeFormatOptions = {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          };
          const formatted = new Intl.DateTimeFormat('en-US', options)?.format(date);
          return <div>{formatted}</div>;
        }
        return <div className="center-dash"> - </div>;
      }
    },
    {
      Header: 'Level',
      width: 150,
      id: 'level',
      disableSortBy: true,
      disableResizing: false,
      addToColumnSelector: true,
      accessor: (data: LogEntry) => {
        if (data?.level) {
          return <div>{data?.level}</div>;
        }
        return <div className="center-dash"> - </div>;
      },
      filter: ColumnFilter
    },
    {
      Header: 'Message',
      width: 560,
      id: 'message',
      disableSortBy: true,
      disableResizing: false,
      addToColumnSelector: true,
      accessor: (data: LogEntry) => {
        if (data?.message) {
          return <div className="message-cell">{data?.message}</div>;
        }
        return <div className="center-dash"> - </div>;
      }
    },
    {
      Header: 'Method Name',
      width: 180,
      id: 'methodName',
      disableSortBy: true,
      disableResizing: false,
      addToColumnSelector: true,
      accessor: (data: LogEntry) => {
        if (data?.methodName) {
          return <div>{data?.methodName}</div>;
        }
        return <div className="center-dash"> - </div>;
      }
    }
  ];

  // Method to fetch data from API
  const fetchData = async ({
    skip = 0,
    limit = 30,
    startIndex = 0,
    stopIndex = 30,
    searchText = 'null',
    filter = filterValue
  }) => {
    searchText = searchText === '' ? 'null' : searchText;

    if (!selectedStack) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await getMigrationLogs(
        selectedOrganisation?.value || '',
        projectId ?? '',
        selectedStack?.value,
        skip,
        limit,
        startIndex,
        stopIndex,
        searchText,
        filter
      );

      if (response?.status !== 200) {
        console.error('Error fetching logs:', response);
        setData([]);
        setTotalCounts(0);
      } else {
        setData(response?.data?.logs);
        setTotalCounts(response?.data?.total);
        setFilterOptions(
          response?.data?.filterOptions?.map?.((item: string) => ({
            label: item,
            value: item
          })) || []
        );
      }
    } catch (error) {
      console.error('Unexpected error while fetching logs:', error);
      setData([]);
      setTotalCounts(0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="executionTable-height">
      <InfiniteScrollTable
        itemSize={60}
        columns={columns}
        data={data ?? []}
        uniqueKey={'id'}
        fetchTableData={fetchData}
        totalCounts={totalCounts ?? 0}
        loading={loading}
        rowPerPageOptions={[10, 30, 50, 100]}
        minBatchSizeToFetch={30}
        v2Features={v2Features}
        isRowSelect={false}
        isResizable={false}
        columnSelector={false}
        canSearch={true}
        searchPlaceholder={EXECUTION_LOGS_UI_TEXT.SEARCH_PLACEHOLDER}
        searchValue={searchText ?? ''}
        onSearchChangeEvent={(value: string) => setSearchText(value)}
        withExportCta={{
          component: (
            <Select
              className="dropdown-wrapper"
              width="250px"
              version="v2"
              value={testStacks?.length ? selectedStack : ''}
              options={stackIds ?? []}
              placeholder={EXECUTION_LOGS_UI_TEXT.SELECT_PLACEHOLDER}
              onChange={(s: DropdownOption) => {
                setSelectedStack({
                  label: s?.label ?? '',
                  value: s?.value ?? ''
                });
                setSearchText('');
              }}
            />
          ),
          showExportCta: true
        }}
        customEmptyState={
          <EmptyState
            forPage="list"
            heading={
              searchText === ''
                ? EXECUTION_LOGS_UI_TEXT.EMPTY_STATE_HEADING.NO_LOGS
                : EXECUTION_LOGS_UI_TEXT.EMPTY_STATE_HEADING.NO_MATCH
            }
            description={
              searchText === ''
                ? EXECUTION_LOGS_UI_TEXT.EMPTY_STATE_DESCRIPTION.NO_LOGS
                : EXECUTION_LOGS_UI_TEXT.EMPTY_STATE_DESCRIPTION.NO_RESULT
            }
            moduleIcon={
              searchText === ''
                ? EXECUTION_LOGS_UI_TEXT.EMPTY_STATE_ICON.NO_LOGS
                : EXECUTION_LOGS_UI_TEXT.EMPTY_STATE_ICON.NO_MATCH
            }
            type="secondary"
            className="custom-empty-state"
          />
        }
        onRowClick={(e: LogEntry) => {
          handleModaleClick(e);
        }}
        tableRowActionList={[
          {
            title: 'View Log',
            action: () => {
              // This action is handled in the onRowClick method
            }
          }
        ]}
      />
    </div>
  );
};

export default ExecutionLogs;
