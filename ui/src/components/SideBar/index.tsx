// Libraries
import { Tooltip, Icon, Link } from '@contentstack/venus-components';
import { useNavigate } from 'react-router';

// Styles
import './index.scss';

type SettingIconProp = {
  projectId: string;
}

const SideBar = ({projectId}: SettingIconProp) => {
  const navigate = useNavigate();

  const settingsNavigate = () => {
    const url = `/projects/${projectId}/settings`;
    navigate(url, { replace: true });
  }
  return (
    <div className="side-nav side-nav--full recycle-wrapper" style={{ width: '56px', textAlign: 'center'}}>
      {location.pathname.includes('/projects/') && 
      <Tooltip content={'Project Settings'} position="right">
        <Link aria-label='Project Settings' cbOnClick={settingsNavigate}>
          <Icon size='original' icon='Setting' />
        </Link>
      </Tooltip>
      }
    </div>
  );
};

export default SideBar;
