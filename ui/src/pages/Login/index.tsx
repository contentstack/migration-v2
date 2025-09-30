// Libraries
import { FC, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';

import { clearOrganisationData, getUserDetails, setAuthToken, setUser, clearAuthToken } from '../../store/slice/authSlice';
import {
  Button,
  Field,
  FieldLabel,
  TextInput,
  ValidationMessage,
  Link,
  Notification
} from '@contentstack/venus-components';
import { Field as FinalField, Form as FinalForm } from 'react-final-form';

// Utilities
import {
  LOGIN_SUCCESSFUL_MESSAGE,
  TFA_MESSAGE,
  TFA_VIA_SMS_MESSAGE,
  CS_ENTRIES
} from '../../utilities/constants';
import { clearLocalStorage, failtureNotification, setDataInLocalStorage } from '../../utilities/functions';

// API Service
import { getCMSDataFromFile } from '../../cmsData/cmsSelector';
import { userSession, requestSMSToken, getAppConfig, checkSSOAuthStatus } from '../../services/api/login.service';

// Interface
import { IProps, IStates, defaultStates, User, UserRes, LoginType } from './login.interface';

//Components
import AccountPage from '../../components/AccountPage';

// Styles
import './index.scss';
import { RootState } from '../../store';

const Login: FC<IProps> = () => {
  const [data, setData] = useState<LoginType>({});

  // ************* Fetch Login Data ************
  const fetchData = async () => {
    //check if offline CMS data field is set to true, if then read data from cms data file.
    getCMSDataFromFile(CS_ENTRIES.LOGIN)
      .then((data) => setData(data))
      .catch((err) => {
        console.error(err);
        setData({});
      });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const { login, two_factor_authentication: twoFactorAuthentication } = data;
  const user = useSelector((state: RootState) => state?.authentication?.user);
  const accountData = {
    heading: data?.heading,
    subtitle: data?.subtitle,
    copyrightText: data?.copyrightText
  };

  // ************* ALL States Here ************
  const [loginStates, setLoginStates] = useState<IStates>(defaultStates);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  // const [isBlock, setIsBlock] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  // Get the region
  const urlParams = new URLSearchParams(location?.search);
  const region = urlParams?.get?.('region');

  // ************* send SMS token ************
  const sendSMS = async () => {
    const userAuth = {
      user: {
        email: loginStates?.user?.email,
        password: loginStates?.user?.password,
        region: region
      }
    };

    await requestSMSToken(userAuth?.user)
      .then((res: UserRes) => {
        if (res?.status === 200 && res?.data?.notice === TFA_VIA_SMS_MESSAGE) {
          Notification({
            notificationContent: { text: res?.data?.notice },
            type: 'success',
            notificationProps: {
              hideProgressBar: true
            }
          });
        }

        if (res?.message === LOGIN_SUCCESSFUL_MESSAGE) {
          setLoginStates((prev) => ({ ...prev, submitted: true }));
        }

        if (res?.status === 422) {
          failtureNotification(res?.data?.error_message as string);
        }
      })
      .catch((err: string) => console.error(err));
  };

  // ************* Login submit ************
  const onSubmit = async (values: User) => {
    setIsLoading(true);
    if (loginStates?.tfa) {
      setLoginStates((prevState: IStates) => {
        return {
          ...prevState,
          user: {
            ...prevState.user,
            tfa_token: values?.tfa_token ?? ''
          }
        };
      });
    } else {
      setLoginStates((prevState: IStates) => {
        return {
          ...prevState,
          user: {
            ...prevState.user,
            email: values?.email,
            password: values?.password
          }
        };
      });
    }

    const userAuth = {
      user: {
        email: loginStates?.user?.email !== '' ? loginStates?.user?.email : values?.email,
        password:
          loginStates?.user?.password !== '' ? loginStates?.user?.password : values?.password,
        region: region,
        tfa_token: values?.tfa_token ?? ''
      }
    };

    const response = await userSession(userAuth?.user);
    if ((response?.status === 294 || response?.data?.error_code === 294) && response?.data?.error_message === TFA_MESSAGE) {
      setIsLoading(false);
      setLoginStates((prev) => ({ ...prev, tfa: true }));
    }

    if (response?.status === 104 || response?.status === 400 || response?.status === 422) {
      setIsLoading(false);
      failtureNotification(response?.data?.error_message || response?.data?.error?.message);
    }
    dispatch(clearAuthToken());
    localStorage?.removeItem('app_token');
    if (response?.status === 200 && response?.data?.message === LOGIN_SUCCESSFUL_MESSAGE) {
      setIsLoading(false);
      setDataInLocalStorage('app_token', response?.data?.app_token);
      
      // Clear any previous organization data to ensure fresh organization selection for new user
      localStorage?.removeItem('organization');
      dispatch(clearOrganisationData());
      
      const authenticationObj = {
        authToken: response?.data?.app_token,
        isAuthenticated: true
      };
      const userObj = {
        ...user,
        region: region
      };
      dispatch(setUser(userObj));
      dispatch(setAuthToken(authenticationObj));

      setLoginStates((prev) => ({ ...prev, submitted: true }));

      dispatch(getUserDetails());

      navigate(`/projects`, { replace: true });
    }
  };

  //functions for email and password validation
  const emailValidation = (value: string): string | undefined => {
    const emailRegex = /^[a-z0-9._%+-]+@([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;

    return emailRegex.test(value) ? undefined : 'Please enter a valid email address';
  };

  const passwordValidation = (value: string): string | undefined => {
    // const passwordRegex = /[0-1A-Za-z]/
    if (value?.length) {
      return undefined;
    } else {
      return 'Please enter a password';
    }
  };

  // Function for TFA validation
  const TFAValidation = (value: string): string | undefined => {
    if (value?.length) {
      return undefined;
    } else {
      return 'Please enter Two Factor Authentication code.';
    }
  };

  const onEmailChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setLoginStates((prevState) => updateUserEmail(prevState, event.target.value));
  };

  const updateUserEmail = (prevState: IStates, email: string): IStates => {
    return {
      ...prevState,
      user: {
        ...prevState?.user,
        email: email
      }
    };
  };

  const onPasswordChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setLoginStates((prevState) => updateUserPassword(prevState, event.target.value));
  };

  const updateUserPassword = (prevState: IStates, password: string): IStates => {
    return {
      ...prevState,
      user: {
        ...prevState.user,
        password: password
      }
    };
  };

  const handleSSOLogin = async () => {
    setIsLoading(true);
    try {
      const currentRegion = region;
      
      await getAppConfig()
        .then((res: any) => {
          if (res?.status === 404) {
            failtureNotification('Kindly setup the SSO first');
            setIsLoading(false);
            return;
          }
          
          if (res?.status === 400) {
            failtureNotification('Something went wrong please try normal login method');
            setIsLoading(false);
            return;
          }
          
          if (res?.status === 500) {
            failtureNotification('Something went wrong please try normal login method');
            setIsLoading(false);
            return;
          }
  
          const appConfig = res?.data;
          
          // Check if authUrl exists
          if (!appConfig?.authUrl) {
            failtureNotification('Something went wrong please try normal login method');
            setIsLoading(false);
            return;
          }
  
          // Checks if region matches
          if (appConfig?.region?.key && appConfig.region.key !== currentRegion) {
            failtureNotification('Kindly choose correct region as the SSO region');
            setIsLoading(false);
            return;
          }
  
          const authURL = appConfig.authUrl;
          const ssoWindow = window.open(authURL, '_blank', 'noopener,noreferrer');
          
          if (appConfig.user?.uid) {
            startSSOPolling(appConfig.user.uid, ssoWindow);
          } else {
            failtureNotification('Missing user information in SSO configuration');
            setIsLoading(false);
          }
          
        })
        .catch((err: any) => {
          failtureNotification('Something went wrong please try normal login method');
          setIsLoading(false);
        });
        
    } catch (error) {
      failtureNotification('Something went wrong please try normal login method');
      setIsLoading(false);
    }
  };
  

  const startSSOPolling = (userId: string, ssoWindow: Window | null) => {
    const pollInterval = 2000; 
    const maxPollTime = 300000; 
    let pollCount = 0;
    const maxPolls = maxPollTime / pollInterval; 
    const poll = async () => {
      pollCount++;
      
      try {
        if (ssoWindow?.closed) {
          failtureNotification('SSO login was cancelled');
          setIsLoading(false);
          return;
        }
        
        await checkSSOAuthStatus(userId)
          .then((authRes: any) => {
            
            if (authRes?.status === 200 && authRes?.data?.authenticated === true) {
              
              if (ssoWindow && !ssoWindow.closed) {
                ssoWindow.close();
              }
              
              handleSuccessfulSSOLogin(authRes.data);
              return;
            }
            
            if (pollCount < maxPolls) {
              setTimeout(poll, pollInterval);
            } else {
              failtureNotification('SSO authentication timed out. Please try again.');
              setIsLoading(false);
              if (ssoWindow && !ssoWindow.closed) {
                ssoWindow.close();
              }
            }
          })
          .catch((error: any) => {
            
            
            if (pollCount < maxPolls) {
              setTimeout(poll, pollInterval);
            } else {
              failtureNotification('Something went wrong please try normal login method');
              setIsLoading(false);
              if (ssoWindow && !ssoWindow.closed) {
                ssoWindow.close();
              }
            }
          });
          
      } catch (error) {
        failtureNotification('Something went wrong please try normal login method');
        setIsLoading(false);
        if (ssoWindow && !ssoWindow.closed) {
          ssoWindow.close();
        }
      }
    };
    
    setTimeout(poll, pollInterval);
  };
  

  const handleSuccessfulSSOLogin = (authData: any) => {
    
    try {
      setIsLoading(false);
      
      setDataInLocalStorage('app_token', authData.app_token);
      
      localStorage?.removeItem('organization');
      dispatch(clearOrganisationData());
    
      
      const authenticationObj = {
        authToken: authData.app_token,
        isAuthenticated: true
      };
      
      const userObj = {
        ...user,
        region: region
      };
      
      dispatch(setUser(userObj));
      dispatch(setAuthToken(authenticationObj));
      setLoginStates((prev) => ({ ...prev, submitted: true }));
      
      dispatch(getUserDetails());
      
      navigate(`/projects`, { replace: true });
      
    } catch (error) {
      console.error('Error processing SSO login success:', error);
      failtureNotification('Login successful but navigation failed. Please refresh the page.');
    }
  };

  // useEffect(()=>{
  //   const handlePopState = (event: PopStateEvent) => {
  //     event.preventDefault();
  //     window.history.pushState(null, '', window.location.href);
  //   };
  //   if(isBlock){
  //     window.history.pushState(null, '', window.location.href);
  //   }
  //   window.history.pushState(null, '', window.location.href);
  //   window.addEventListener('popstate',handlePopState);
  //   return () => {
  //     window.removeEventListener('popstate', handlePopState);
  //   };
  // },[isBlock]);

  useEffect(() => {
    const redirectUrl = loginStates?.tfa && region ? `/login?region=${region}` : '/region-login';

    const handleBackButton = () => {
      // Redirect to an internal route
      navigate(redirectUrl, { replace: true });
    };

    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      handleBackButton();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [navigate, loginStates]);

  return (
    <AccountPage data={accountData}>
      {loginStates?.tfa ? (
        <div className="AccountForm AccountForm_login">
          {twoFactorAuthentication?.title && (
            <h2 className="mb-40">{twoFactorAuthentication?.title}</h2>
          )}
  
          <FinalForm
            onSubmit={onSubmit}
            render={({ handleSubmit }): JSX.Element => (
              <form onSubmit={handleSubmit}>
                <Field>
                  <FinalField name="tfa_token" validate={TFAValidation}>
                    {({ input, meta }): JSX.Element => (
                      <>
                        {twoFactorAuthentication?.security_code?.title && (
                          <FieldLabel
                            testId="cs-tfa-token"
                            className="mb-2"
                            version="v2"
                            htmlFor="tfa_token"
                            aria-label="tfa_token"
                          >
                            {twoFactorAuthentication?.security_code?.title}
                          </FieldLabel>
                        )}
                        <TextInput
                          {...input}
                          version="v2"
                          placeholder={twoFactorAuthentication?.security_code?.placeholder}
                          error={meta?.error && meta?.touched}
                          width="large"
                          testId="cs-tfa-token-input-field"
                          id="tfa_token"
                        />
                        {meta?.error && meta?.touched && (
                          <ValidationMessage
                            testId="cs-tfa-token-error"
                            className="mt-2"
                            version="v2"
                          >
                            {meta?.error}
                          </ValidationMessage>
                        )}
                      </>
                    )}
                  </FinalField>
                </Field>
                <div className="flex-v-center mb-40">
                  {twoFactorAuthentication?.send_sms?.pre_link_text && (
                    <p className="pre-text-color">
                      {twoFactorAuthentication?.send_sms?.pre_link_text}
                    </p>
                  )}
                  {twoFactorAuthentication?.send_sms?.link_text && (
                    <Link
                      className="ml-8 send-sms"
                      testId="cs-tfa-send-sms"
                      cbOnClick={sendSMS}
                      fontWeight="semi-bold"
                      underline={true}
                    >
                      {twoFactorAuthentication?.send_sms?.link_text}
                    </Link>
                  )}
                </div>
                {twoFactorAuthentication?.cta?.title && (
                  <Button
                    version="v2"
                    className="AccountForm__actions AccountForm__actions__verify_button"
                    isFullWidth={true}
                    testId="cs-verfication"
                    type="submit"
                    icon="v2-Check"
                    tabIndex={0}
                  >
                    {twoFactorAuthentication?.cta?.title}
                  </Button>
                )}
              </form>
            )}
          />
        </div>
      ) : (
        <div className="AccountForm AccountForm_login app-login">
          {login?.title && <h2 className="mb-40">{login?.title}</h2>}
          <div>
            <FinalForm
              onSubmit={onSubmit}
              render={({ handleSubmit }): JSX.Element => {
                return (
                  <div className="login-wrapper">
                    <form onSubmit={handleSubmit}>
                      <Field className="mb-40">
                        <FinalField name="email" validate={emailValidation}>
                          {({ input, meta }): JSX.Element => {
                            return (
                              <>
                                {login?.email && (
                                  <FieldLabel
                                    testId="cs-login-email"
                                    className="mb-2"
                                    required={true}
                                    version="v2"
                                    htmlFor={login?.email}
                                  >
                                    {login?.email}
                                  </FieldLabel>
                                )}
                                <TextInput
                                  {...input}
                                  onChange={(event: React.ChangeEvent<HTMLInputElement>): void => {
                                    input?.onChange(event);
                                    onEmailChange(event);
                                  }}
                                  name={login?.email}
                                  width="large"
                                  id="email"
                                  version="v2"
                                  type="email"
                                  data-testid="cs-login-email-input-field"
                                  placeholder={login?.placeholder?.email}
                                  error={(meta?.error || meta?.submitError) && meta?.touched}
                                  aria-label={login?.email}
                                />
                                {meta.error && meta.touched && (
                                  <ValidationMessage
                                    testId="cs-login-email-error"
                                    className="mt-2"
                                    version="v2"
                                  >
                                    {meta?.error}
                                  </ValidationMessage>
                                )}
                              </>
                            );
                          }}
                        </FinalField>
                      </Field>

                      <Field className="mb-40">
                        <FinalField name="password" validate={passwordValidation}>
                          {({ input, meta }): JSX.Element => {
                            return (
                              <>
                                {login?.password && (
                                  <FieldLabel
                                    testId="cs-login-password"
                                    className="mb-2"
                                    required={true}
                                    version="v2"
                                    htmlFor="password"
                                  >
                                    {login?.password}
                                  </FieldLabel>
                                )}
                                <TextInput
                                  {...input}
                                  onChange={(event: React.ChangeEvent<HTMLInputElement>): void => {
                                    input?.onChange(event);
                                    onPasswordChange(event);
                                  }}
                                  width="large"
                                  canShowPassword={true}
                                  name="password"
                                  id="password"
                                  type="password"
                                  version="v2"
                                  testId="cs-login-password-input-field"
                                  placeholder={login?.placeholder?.password}
                                  error={(meta?.error || meta?.submitError) && meta?.touched}
                                />
                                {meta?.error && meta?.touched && (
                                  <ValidationMessage
                                    testId="cs-login-password-error"
                                    className="mt-2"
                                    version="v2"
                                  >
                                    {meta?.error}
                                  </ValidationMessage>
                                )}
                              </>
                            );
                          }}
                        </FinalField>
                      </Field>
  
                      <div className="AccountForm__actions">
                        <div className="mb-16">
                          <Button
                            className="AccountForm__actions__login_button"
                            isFullWidth={true}
                            version="v2"
                            testId="cs-email-login"
                            buttonType="primary"
                            type="submit"
                            icon="v2-Login"
                            tabindex={0}
                            isLoading={isLoading}
                          >
                            {login?.cta?.title}
                          </Button>
                        </div>
                        <div className="mb-16">
                          <Button
                            className="AccountForm__actions__sso_button"
                            isFullWidth={true}
                            version="v2"
                            testId="cs-sso-login"
                            buttonType="secondary"
                            type="button"
                            icon="v2-CloudArrowUp"
                            tabIndex={0}
                            isLoading={isLoading}
                            onClick={handleSSOLogin}
                          >
                            Log in via SSO
                          </Button>
                        </div>
                      </div>
                    </form>
                  </div>
                );
              }}
            />
          </div>
        </div>
      )}
    </AccountPage>
  );
};

export default Login;
