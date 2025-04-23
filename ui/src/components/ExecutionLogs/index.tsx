import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  InfiniteScrollTable,
  Dropdown,
  Button,
  EmptyState,
  Select
} from '@contentstack/venus-components';
import { RootState } from '../../store';
import { DropdownOption, FilterOption, LogEntry, StackIds } from './executionlog.interface';
import './index.scss';

import FilterModal from '../FilterModale';
import { getMigrationLogs } from '../../services/api/migration.service';

const ExecutionLogs = ({ projectId }: { projectId: string }) => {
  const [data, setData] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCounts, setTotalCounts] = useState<number | 0>(0);
  const [searchText, setSearchText] = useState<string>('');
  const [filterValue, setFilterValue] = useState<FilterOption[]>([]);
  const [isCursorInside, setIsCursorInside] = useState(false);
  const [isFilterApplied, setIsFilterApplied] = useState(false);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [filterV, setFilterV] = useState<string>('all');

  const selectedOrganisation = useSelector(
    (state: RootState) => state?.authentication?.selectedOrganisation
  );

  const stacks = useSelector((state: RootState) => state?.migration?.newMigrationData?.testStacks);

  const stackIds = stacks?.map((stack: StackIds) => ({
    label: stack?.stackName,
    value: stack?.stackUid
  }));

  const [selectedStackId, setSelectedStackId] = useState<string>(
    stackIds[stackIds.length - 1]?.value ?? ''
  );
  const [selectedStackName, setSelectedStackName] = useState<string>(
    stackIds[stackIds.length - 1]?.label ?? ''
  );

  useEffect(() => {
    if (selectedStackId) {
      fetchData({});
    }
  }, [selectedStackId]);

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
        let filterValueCopy: FilterOption[] = [...filterValue];

        if (!filterValueCopy.length && isChecked) {
          filterValueCopy.push(value);
        } else if (isChecked) {
          // Remove the old value and keep updated one in case old value exists
          const updatedFilter = filterValueCopy.filter((v) => v.value !== value.value);
          filterValueCopy = [...updatedFilter, value];
        } else if (!isChecked) {
          filterValueCopy = filterValueCopy.filter((v) => v.value !== value.value);
        }

        setFilterValue(filterValueCopy);
      } catch (error) {
        console.error('Error updating filter value:', error);
      }
    };

    // Method to handle Apply
    const onApply = () => {
      try {
        if (!filterValue.length) {
          const newFilter = 'all';
          setFilterV(newFilter);
          fetchData({ filter: newFilter });
          closeModal();
          return;
        }

        const usersQueryArray = filterValue.map((item) => item.value);
        const newFilter =
          usersQueryArray.length > 1 ? usersQueryArray.join('-') : usersQueryArray[0];

        setFilterV(newFilter);
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
        ? 'filterWithAppliedIcon Icon--v2 Icon--medium'
        : 'defaultFilterIcon Icon--v2 Icon--medium',
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
          selectedLevels={filterValue}
          setFilterValue={setFilterValue}
        />
      </div>
    );
  };

  const columns = [
    {
      Header: 'Timestamp',
      disableSortBy: true,
      accessor: (data: LogEntry) => {
        if (data.timestamp) {
          const date = new Date(data.timestamp);
          const options: Intl.DateTimeFormatOptions = {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          };
          const formatted = new Intl.DateTimeFormat('en-US', options).format(date);
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
      accessor: (data: LogEntry) => <div>{data.level}</div>,
      width: 150,
      filter: ColumnFilter
    },
    {
      Header: 'Message',
      disableSortBy: true,
      accessor: (data: LogEntry) => {
        return (
          <div>
            <div>{data.message}</div>
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
            <div>{data.methodName}</div>
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
    filter = filterV
  }) => {
    searchText = searchText === '' ? 'null' : searchText;

    if (!selectedStackId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await getMigrationLogs(
        selectedOrganisation?.value || '',
        projectId,
        selectedStackId,
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
        setData(response.data.logs);
        setTotalCounts(response.data.total);
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
    <div>
      <InfiniteScrollTable
        tableHeight={590}
        itemSize={60}
        TABLE_HEAD_HEIGHT={0}
        columns={columns}
        data={data}
        uniqueKey={'timestamp'}
        fetchTableData={fetchData}
        totalCounts={totalCounts}
        loading={loading}
        rowPerPageOptions={[10, 30, 50, 100]}
        minBatchSizeToFetch={30}
        v2Features={{
          pagination: true
        }}
        isResizable={true}
        isRowSelect={false}
        columnSelector={false}
        canSearch={true}
        searchPlaceholder={'Search Execution Logs'}
        searchValue={searchText}
        onSearchChangeEvent={(value: string) => setSearchText(value)}
        withExportCta={{
          component: (
            <div className="select-container">
              <Select
              width='250px'
              maxWidth='300px'
                version="v2"
                options={stackIds}
                value={selectedStackName}
                placeholder={
                  selectedStackName === ''
                    ? stackIds.length > 0
                      ? 'Select Stack Id'
                      : 'No stack created'
                    : selectedStackName
                }
                onChange={(s: DropdownOption) => {
                  setSelectedStackId(s.value);
                  setSelectedStackName(s.label);
                  setSearchText('');
                }}
              />
            </div>
          ),
          showExportCta: true
        }}
        customEmptyState={
          <EmptyState
            forPage="list"
            heading={searchText === '' ? 'No Logs' : 'No matching results found!'}
            description={
              searchText === ''
                ? 'Try Executing the Migration.'
                : 'Try changing the search query to find what you are looking for.'
            }
            moduleIcon={searchText === '' ? 'NoDataEmptyState' : 'NoSearchResult'}
            type="secondary"
            className="custom-empty-state"
          />
        }
      />
    </div>
  );
};

export default ExecutionLogs;
