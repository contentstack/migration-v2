// Redux
import { RootState } from '../../store';

import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  clearLocalStorage,
} from '../../utilities/functions';
// Styles
import './index.scss';
import { LOG_OUT } from '../../common/assets';
const ProfileCard = () => {
  const user = useSelector((state:RootState)=>state?.authentication?.user);
  const name = `${user?.first_name?.charAt(0)}${user?.last_name?.charAt(0)}`.toUpperCase() ?? '';
  const navigate = useNavigate();
   // Function for Logout
   const handleLogout = () => {
    if (clearLocalStorage()) {
      navigate('/', { replace: true });
    }
  };
  return (
    <div className="profile-card">
      <div className='profile-gray-background'/>
      <div className="profile-card__avatar">
        <div className="profile-card__initials">{name}</div>
      </div>
      <div className="profile-card__details">
        <div className="profile-card__name">{user?.first_name} {user?.last_name}</div>
        <div className="profile-card__email">{user?.email}</div>
      </div>
      <div
        className="profile-card__logout"
        role="button"
        tabIndex={0}
        onClick={handleLogout}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            handleLogout();
          }
        }}
      >
        <span className="profile-card__logout-icon">{LOG_OUT}</span>
        <span className="profile-card__logout-text">Log out</span>
      </div>
    </div>
  );
};

export default ProfileCard;
