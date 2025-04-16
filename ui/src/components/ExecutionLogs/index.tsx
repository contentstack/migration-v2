import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { InfiniteScrollTable, Dropdown } from '@contentstack/venus-components';
import { getMigrationLogs } from '../../services/api/project.service';
import { RootState } from '../../store';
import './index.scss';

const ExecutionLogs = ({ projectId }: { projectId: string }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCounts, setTotalCounts] = useState<number | null>(null);
  const [itemStatusMap, setItemStatusMap] = useState<Record<string, string>>({});
  const [selectedStackId, setSelectedStackId] = useState<string>('');
  const [selectedStackName, setSelectedStackName] = useState<string>('');
  const selectedOrganisation = useSelector(
    (state: RootState) => state?.authentication?.selectedOrganisation
  );
  const stacks = useSelector((state: RootState) => state?.migration?.newMigrationData?.testStacks);
  const stackIds = stacks?.map((stack: any) => ({
    label: stack?.stackName,
    value: stack?.stackUid
  }));

  //   const [columns, setColumns] = useState<any[]>([]);

  useEffect(() => {
    if (selectedStackId) {
      fetchData();
      loadMoreItems({ startIndex: 0, stopIndex: 100 });
    }
  }, [selectedStackId]);

  const columns = [
    {
      Header: 'Level',
      id: 'level',
      accessor: (data: any) => {
        return (
          <div>
            <div>{data.level}</div>
          </div>
        );
      },
      addToColumnSelector: true,
      disableResizing: false,
      canDragDrop: true,
      width: 150
    },
    {
      Header: 'Message',
      accessor: (data: any) => {
        return (
          <div>
            <div>{data.message}</div>
          </div>
        );
      },
      addToColumnSelector: true,
      disableResizing: false,
      canDragDrop: true,
      width: 500
    },
    {
      Header: 'Method Name',
      accessor: (data: any) => {
        return (
          <div>
            <div>{data.methodName}</div>
          </div>
        );
      },
      addToColumnSelector: true,
      disableResizing: false,
      canDragDrop: true,
      width: 200
    },
    {
      Header: 'Timestamp',
      accessor: (data: any) => {
        return (
          <div>
            <div>{data.timestamp}</div>
          </div>
        );
      },
      addToColumnSelector: true,
      disableResizing: false,
      canDragDrop: true,
      width: 300
    }
  ];

  const fetchData = async () => {
    if (!selectedStackId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const response = await getMigrationLogs(
      selectedOrganisation?.value || '',
      projectId,
      selectedStackId
    );
    setData(response.data);
    setTotalCounts(response.data.length);
    setLoading(false);
  };

  const loadMoreItems = async ({ startIndex, stopIndex }: any) => {
    if (!selectedStackId) return;

    for (let index = startIndex; index <= stopIndex; index++) {
      itemStatusMap[index] = 'loading';
    }
    setItemStatusMap({ ...itemStatusMap });

    setLoading(true);
    const response = await getMigrationLogs(
      selectedOrganisation?.value || '',
      projectId,
      selectedStackId
    );
    const updatedStatusMap = { ...itemStatusMap };
    for (let index = startIndex; index <= stopIndex; index++) {
      updatedStatusMap[index] = 'loaded';
    }
    setItemStatusMap({ ...updatedStatusMap });
    setData([...data, ...response.data]);
    setTotalCounts(response.data.length);
    setLoading(false);
    return response.data;
  };

  return data.length === 0 ? (
    <div className="ExecutionLogs">
      <div className="Dropdown-wrapper">
        <Dropdown
          version={'v2'}
          list={stackIds}
          type={'select'}
          searchPlaceholder={selectedStackName == '' ? 'Select Stack Id' : selectedStackName}
          onChange={(s) => {
            setSelectedStackId(s.value);
            setSelectedStackName(s.label);
            fetchData();
            loadMoreItems({ startIndex: 0, stopIndex: 100 });
          }}
        />
      </div>
      <div className="ExecutionLogs-no-data">
        <p> {selectedStackId == '' ? 'Please Select Stack Id' : 'No data available'} </p>
      </div>
    </div>
  ) : (
    <div>
      <div className="Dropdown-wrapper">
        <Dropdown
          version={'v2'}
          list={stackIds}
          type={'select'}
          searchPlaceholder={selectedStackName == '' ? 'Select Stack Id' : selectedStackName}
          onChange={(s) => {
            setSelectedStackId(s.value);
            setSelectedStackName(s.label);
            fetchData();
            loadMoreItems({ startIndex: 0, stopIndex: 100 });
          }}
          adjustWidthForContent={true}
        />
      </div>

      <div className="custom-search-wrapper">
        <InfiniteScrollTable
          data={data}
          columns={columns}
          uniqueKey={'timestamp'}
          fetchTableData={fetchData}
          loading={loading}
          totalCounts={totalCounts}
          loadMoreItems={loadMoreItems}
          itemStatusMap={itemStatusMap}
          minBatchSizeToFetch={30}
          canSearch={true}
          searchPlaceholder={'Search logs'}
          isResizable={true}
          isRowSelect={false}
          canRefresh={false}
          rowPerPageOptions={[30, 50, 100]}
          v2Features={{
            pagination: true,
            isNewEmptyState: true
          }}
        />
      </div>
    </div>
  );
};

export default ExecutionLogs;
