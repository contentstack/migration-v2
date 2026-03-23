// Redux
import { RootState } from '../../store';

import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { clearLocalStorage } from '../../utilities/functions';
// Styles
import './index.scss';
import { LOG_OUT } from '../../common/assets';
import { logout } from '../../services/api/login.service';
import { useState } from 'react';

const ProfileCard = () => {
  const user = useSelector((state: RootState) => state?.authentication?.user);
  const name = `${user?.first_name?.charAt(0)}${user?.last_name?.charAt(0)}`.toUpperCase() ?? '';
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return; // Prevent multiple clicks
    
    setIsLoggingOut(true);
    
    try {
      const response = await logout(user?.email as string);
      
      if (response?.status !== 200) {
        console.error('Backend logout failed:', response?.data);
      }
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      if (clearLocalStorage()) {
        navigate('/', { replace: true });
      }
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="profile-card">
      <div className="profile-card__header">
        <div className="profile-card__avatar">{name}</div>
      </div>
      <div className="profile-card__body">
        <div className="profile-card__name">
          {user?.first_name} {user?.last_name}
        </div>
        <div className="profile-card__email">{user?.email}</div>
      </div>
      <div className="profile-card__region">
        Region: {user?.region?.replaceAll('_', '-')}
      </div>
      <div
        className="profile-card__logout"
        onClick={handleLogout}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            handleLogout();
          }
        }}
        style={{ 
          opacity: isLoggingOut ? 0.6 : 1, 
          cursor: isLoggingOut ? 'not-allowed' : 'pointer',
          pointerEvents: isLoggingOut ? 'none' : 'auto'
        }}
      >
        {LOG_OUT}
        {isLoggingOut ? 'Logging out...' : 'Log out'}
      </div>
    </div>
  );
};

export default ProfileCard;
