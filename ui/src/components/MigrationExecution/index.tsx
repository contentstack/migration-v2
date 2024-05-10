import { useEffect, useContext } from 'react';
import { Icon, Button, Field, TextInput, FieldLabel } from '@contentstack/venus-components';

// Services
import { getCMSDataFromFile } from '../../cmsData/cmsSelector';

// Utilities
import { CS_ENTRIES } from '../../utilities/constants';
import { validateArray } from '../../utilities/functions';

// Context
import { AppContext } from '../../context/app/app.context';

// Interface
import { DEFAULT_MIGRATION_EXECUTION } from '../../context/app/app.interface';

//stylesheet
import './index.scss';

const MigrationExecution = () => {
  const { migrationData, updateMigrationData, newMigrationData } = useContext(AppContext);
  const {
    migrationexecution: { migration_information: MigrationInformation }
  } = migrationData;

  /********** ALL USEEFFECT HERE *************/
  useEffect(() => {
    //check if offline CMS data field is set to true, if then read data from cms data file.
    getCMSDataFromFile(CS_ENTRIES.MIGRATION_EXECUTION)
      .then((data) => {
        //Check for null
        if (!data) {
          updateMigrationData({ migrationexecution: DEFAULT_MIGRATION_EXECUTION });
        }

        updateMigrationData({ migrationexecution: data });
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
    <div>
      <div className="action-component-body select-wrapper">
        {MigrationInformation &&
          validateArray(MigrationInformation) &&
          MigrationInformation?.map((item, index) => (
            <div className="select-wrapper" key={`${index.toString()}`}>
              <Field width="small" disabled={item?.disable}>
                <FieldLabel className="selectedOptions" htmlFor="label">
                  {item?.title}
                </FieldLabel>
                <span className="execution-wrapper">{getPlaceHolder(item?.title)}</span>
              </Field>
              {index < MigrationInformation?.length - 1 && (
                <Icon className="icon-wrapper" icon="Forward" size="tiny" />
              )}
            </div>
          ))}
      </div>
      <div className="terminal-container"></div>
      <div className="cta-wrapper">
        <Button aria-label="cancel migartion">cancel</Button>
      </div>
    </div>
  );
};

export default MigrationExecution;
