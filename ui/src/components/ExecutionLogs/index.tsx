import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  InfiniteScrollTable,
  Button,
  EmptyState,
  Select
} from '@contentstack/venus-components';
import { RootState } from '../../store';
import { DropdownOption, FilterOption, LogEntry, StackIds } from './executionlog.interface';
import './index.scss';

import FilterModal from '../FilterModale';
import { getMigrationLogs } from '../../services/api/migration.service';
import { EXECUTION_LOGS_UI_TEXT } from '../../utilities/constants';

const ExecutionLogs = ({ projectId }: { projectId: string }) => {
  const [data, setData] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCounts, setTotalCounts] = useState<number>(0);
  const [searchText, setSearchText] = useState<string>('');
  const [filterOption, setFilterOption] = useState<FilterOption[]>([]);
  const [isCursorInside, setIsCursorInside] = useState(false);
  const [isFilterApplied, setIsFilterApplied] = useState(false);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [filterValue, setFilterValue] = useState<string>('all');

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

  const [selectedStack, setSelectedStack] = useState<DropdownOption>(
    {
      label: stackIds?.[stackIds?.length - 1]?.label ?? '',
      value: stackIds?.[stackIds?.length - 1]?.value ?? ''
    }
  );

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
        let filterValueCopy: FilterOption[] = [...filterOption];

        if (!filterValueCopy?.length && isChecked) {
          filterValueCopy?.push(value);
        } else if (isChecked) {
          // Remove the old value and keep updated one in case old value exists
          const updatedFilter = filterValueCopy?.filter((v) => v?.value !== value?.value);
          filterValueCopy = [...updatedFilter, value];
        } else if (!isChecked) {
          filterValueCopy = filterValueCopy?.filter((v) => v?.value !== value?.value);
        }

        setFilterOption(filterValueCopy);
      } catch (error) {
        console.error('Error updating filter value:', error);
      }
    };

    // Method to handle Apply
    const onApply = () => {
      try {
        if (!filterOption?.length) {
          const newFilter = 'all';
          setFilterValue(newFilter);
          fetchData({ filter: newFilter });
          closeModal();
          return;
        }

        const usersQueryArray = filterOption?.map((item) => item?.value);
        const newFilter = usersQueryArray?.length > 1 ? usersQueryArray?.join('-') : usersQueryArray?.[0];
        setFilterValue(newFilter);
        fetchData({ filter: newFilter });
        setIsFilterApplied(true);
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
        }}>
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
          selectedLevels={filterOption}
          setFilterValue={setFilterOption}
        />
      </div>
    );
  };

  const columns = [
    {
      Header: 'Timestamp',
      disableSortBy: true,
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
        return <div>No Data Available</div>;
      },
      width: 240
    },
    {
      Header: 'Level',
      id: 'level',
      disableSortBy: true,
      accessor: (data: LogEntry) => <div>{data?.level}</div>,
      width: 150,
      filter: ColumnFilter
    },
    {
      Header: 'Message',
      disableSortBy: true,
      accessor: (data: LogEntry) => {
        return (
          <div>
            <div>{data?.message}</div>
          </div>
        );
      },
      width: 550
    },
    {
      Header: 'Method Name',
      disableSortBy: true,
      accessor: (data: LogEntry) => {
        return (
          <div>
            <div>{data?.methodName}</div>
          </div>
        );
      },

      width: 200
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
        projectId,
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
    <div className='table-height'>
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
        v2Features={{
          pagination: true,
          isNewEmptyState: true
        }}
        isResizable={true}
        isRowSelect={false}
        columnSelector={false}
        canSearch={true}
        searchPlaceholder={EXECUTION_LOGS_UI_TEXT?.SEARCH_PLACEHOLDER}
        searchValue={searchText ?? ''}
        onSearchChangeEvent={(value: string) => setSearchText(value)}
        withExportCta={{
          component: (
            <Select
              className='dropdown-wrapper'
              width="250px"
              version="v2"
              value={testStacks?.length ? selectedStack : ''}
              options={stackIds ?? []}
              placeholder={EXECUTION_LOGS_UI_TEXT?.SELECT_PLACEHOLDER}
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
            heading={searchText === '' ? EXECUTION_LOGS_UI_TEXT?.EMPTY_STATE_HEADING?.NO_LOGS : EXECUTION_LOGS_UI_TEXT?.EMPTY_STATE_HEADING?.NO_MATCH}
            description={
              searchText === ''
                ? EXECUTION_LOGS_UI_TEXT?.EMPTY_STATE_DESCRIPTION?.NO_LOGS
                : EXECUTION_LOGS_UI_TEXT?.EMPTY_STATE_DESCRIPTION?.NO_RESULT
            }
            moduleIcon={searchText === '' ? EXECUTION_LOGS_UI_TEXT?.EMPTY_STATE_ICON?.NO_LOGS : EXECUTION_LOGS_UI_TEXT?.EMPTY_STATE_ICON?.NO_MATCH}
            type="secondary"
            className="custom-empty-state"
          />
        }
        moduleIcon={searchText === '' ? 'NoDataEmptyState' : 'NoSearchResult'}
        type="secondary"
        className="custom-empty-state"
      />
    </div>
  );
};

export default ExecutionLogs;
