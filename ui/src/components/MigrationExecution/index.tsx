import { useEffect, useState } from 'react';
import { Icon, Field, TextInput, FieldLabel, CircularLoader } from '@contentstack/venus-components';
import { useSelector, useDispatch } from 'react-redux';

// Services
import { getCMSDataFromFile } from '../../cmsData/cmsSelector';

// Redux
import { RootState } from '../../store';
import { setMigrationData, updateMigrationData } from '../../store/slice/migrationDataSlice';

// Utilities
import { CS_ENTRIES } from '../../utilities/constants';
import { validateArray } from '../../utilities/functions';

// Interface
import { DEFAULT_MIGRATION_EXECUTION } from '../../context/app/app.interface';

// Component
import LogViewer from '../LogScreen';

//stylesheet
import './index.scss';

const MigrationExecution = () => {
  //const { migrationData, updateMigrationData, newMigrationData } = useContext(AppContext);
  const dispatch = useDispatch();

  const migrationData = useSelector((state:RootState)=>state?.migration?.migrationData);
  const newMigrationData = useSelector((state:RootState)=>state?.migration?.newMigrationData);
  const {
    migrationexecution: { migration_information: MigrationInformation }
  } = migrationData;

  const [isLoading, setIsLoading] = useState(newMigrationData?.isprojectMapped);

  /********** ALL USEEFFECT HERE *************/
  useEffect(() => {
    //check if offline CMS data field is set to true, if then read data from cms data file.
    getCMSDataFromFile(CS_ENTRIES.MIGRATION_EXECUTION)
      .then((data) => {
        //Check for null
        if (!data) {
          //updateMigrationData({ migrationexecution: DEFAULT_MIGRATION_EXECUTION });
          dispatch(updateMigrationData({ migrationexecution: DEFAULT_MIGRATION_EXECUTION }));
          setIsLoading(false);
          return;
        }

        //updateMigrationData({ migrationexecution: data });
        dispatch(updateMigrationData({ migrationexecution: data }))
        setIsLoading(false);

      })
      .catch((err) => {
        console.error(err);
      });
  }, []);

  const getPlaceHolder = (title: string) => {
    switch (title) {
      case 'Uploaded CMS':
        return newMigrationData?.legacy_cms?.selectedCms?.title;

      case 'Organization':
        return newMigrationData?.destination_stack?.selectedOrg?.label;

      case 'Selected stack':
        return newMigrationData?.destination_stack?.selectedStack?.label;

      case 'Selected locale':
        return newMigrationData?.destination_stack?.selectedStack?.master_locale;
    }
  };

  return (
    isLoading || newMigrationData?.isprojectMapped
      ? <div className="row">
      <div className="col-12 text-center center-align">
        <CircularLoader />
      </div>
    </div>
    : <div className='migration-step-container'>
      <div className='content-block'>
        <div className='content-body'>
          <p>We have Uploaded CMS, Organization, Selected stack and locale. The actual migration process can be started here.</p>
          <div className='select-wrapper mt-3'>
            {MigrationInformation &&
              validateArray(MigrationInformation) &&
              MigrationInformation?.map((item, index) => (
              <div className="select-wrapper" key={`${index.toString()}`}>
                <Field disabled={item?.disable}>
                  <FieldLabel className="selectedOptions" htmlFor="label">
                    {item?.title}
                  </FieldLabel>
                  <TextInput
                    type="text"
                    isReadOnly
                    name="stackKey"
                    value={getPlaceHolder(item?.title)}
                    version="v2"
                    // width="regular"
                  />
                </Field>
                {index < MigrationInformation?.length - 1 && (
                  <Icon className="arrow-wrapper" icon="ArrowRight" size="large" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className='content-block'>
        <div className='content-header'>Execution Logs</div>
        <div>
          <LogViewer serverPath={process.env.REACT_APP_BASE_API_URL ?? ''} />
        </div>
      </div>
    </div>
  );
};

export default MigrationExecution;
