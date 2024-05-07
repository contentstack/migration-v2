import { useContext, useState } from 'react';
import StepIcon from '../../../components/Stepper/FlowStepper/StepIcon';
import { AppContext } from '../../../context/app/app.context';
import { isEmptyString } from '../../../utilities/functions';
import { DEFAULT_DROPDOWN, IDropDown, INewMigration, IStep } from '../../../context/app/app.interface';


import './summary.scss';
import { Icon, Select } from '@contentstack/venus-components';
interface StacksSummaryProps {
  stepData: IStep;
}


const StacksSummary = (props: StacksSummaryProps): JSX.Element => {
  const { newMigrationData } = useContext(AppContext);
  const [selectedStack, setSelectedStack] = useState<IDropDown>(
    !isEmptyString(newMigrationData?.destination_stack?.selectedOrg?.value)
      ? newMigrationData?.destination_stack?.selectedStack
      : DEFAULT_DROPDOWN
  );
  const loadingOption = [
    {
      uid: '',
      label: 'Loading stacks...',
      value: 'loading',
      default: false,
      locale: '',
      created_at: ''
    }
  ];
  const [allStack, setAllStack] = useState<IDropDown[]>(loadingOption);

  return (
    <div className="row">
      {/* {!isEmptyString(newMigrationData?.destination_stack?.selectedStack?.label) &&
      !isEmptyString(newMigrationData?.destination_stack?.selectedStack?.value) && ( */}
       <div className="action-summary-wrapper ">
        <div className="service_list ">
          <div className="row">
            <div className="col-12 pb-3 ">
              <div className="Dropdown-wrapper p-0 active ">
                <Select
                  className="stackselect"
                  version={'v2'}
                  options={allStack}
                  onChange={()=>{return}}
                  value={selectedStack}
                  isSearchable={true}
                  isClearable={true}
                  placeholder={'Stacks'}
                />
              </div>
            </div>
            <div className="col-12 pb-2">
              <label className="title">Master Locale</label>
            </div>
            <div className="col-12 pb-2">
              <div className="stackselect locale-container">
                <span>{selectedStack?.locale}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="stackselect pb-3 text-end">
          <a className={`link`} onClick={()=>{return}}>
            <span className="small">
              <Icon icon="Plus" size="extraSmall" version="v2" active={true} />
              Create New Stack
            </span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default StacksSummary;
