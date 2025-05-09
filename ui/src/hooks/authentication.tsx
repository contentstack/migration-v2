import { useSelector, useDispatch } from 'react-redux';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {jwtDecode} from 'jwt-decode';
import { reInitiliseState } from '../store/slice/authSlice'; 

const useAuthCheck = () => {
  const authToken = useSelector((state:any) => state.authentication.authToken);
  const selectedOrganisation = useSelector((state:any) => state.authentication.selectedOrganisation);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    if (authToken) {
      try {
        const { exp } = jwtDecode(authToken); 
        const currentTime = Date.now() / 1000;

        if (exp && exp < currentTime) {
          
          dispatch(reInitiliseState());
          navigate('/');
        }
      } catch (error) {
        console.error('Error decoding token:', error);
        dispatch(reInitiliseState());
        navigate('/');
      }
    } 
  }, [authToken, selectedOrganisation, dispatch, navigate]);
};

export default useAuthCheck;
