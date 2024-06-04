// Libraries
import { Icon } from '@contentstack/venus-components';
// Styles
import './index.scss';

const SideBar = () => {
  return (
    <div className="side-nav side-nav--full recycle-wrapper" style={{ width: '56px', padding: '20px' }}>
        {location.pathname == '/projects' && <Icon size="small" icon="Restore" version="v2" />}
        {location.pathname.includes('/projects/') && <Icon size='small' icon='StackSettings' version="v2" />}
    </div>
  );
};

export default SideBar;
