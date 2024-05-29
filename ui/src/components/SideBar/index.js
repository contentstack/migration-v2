// Libraries
import { Icon } from '@contentstack/venus-components';
// Styles
import './index.scss';

const SideBar = () => {

  return (
    <div className="side-nav side-nav--full recycle-wrapper" style={{ width: '56px', padding: '20px' }}>
        <Icon size="small" icon="Delete" version="v2" />
    </div>
  );
};

export default SideBar;
