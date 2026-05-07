// Libraries
import { FC, useEffect, useRef, useState } from 'react';
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
  Notification,
  Icon
} from '@contentstack/venus-components';
import { Field as FinalField, Form as FinalForm } from 'react-final-form';
import { toast as toastify } from 'react-toastify';

// Utilities
import {
  LOGIN_SUCCESSFUL_MESSAGE,
  TFA_MESSAGE,
  TFA_VIA_SMS_MESSAGE,
  CS_ENTRIES
} from '../../utilities/constants';
import { clearLocalStorage, failureNotification, setDataInLocalStorage } from '../../utilities/functions';

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

/** Delay before redirect to /projects after SSO token is stored and user is hydrated */
const SSO_SUCCESS_REDIRECT_MS = 2800;

/** Must match oauth-callback-html `OAUTH_CALLBACK_POSTMESSAGE_SOURCE` in the API. */
const SSO_OAUTH_POSTMESSAGE_SOURCE = 'cs-migration-oauth-callback';

/**
 * Stable id for the SSO "select this organization" warning toast so we can
 * dismiss it explicitly when the SSO flow ends (success / cancel / error /
 * unmount) instead of leaving it stuck on screen.
 */
const SSO_ORG_INSTRUCTION_NOTIFICATION_ID = 'sso-org-instruction';

/** Safety auto-close for the SSO org instruction toast (ms). */
const SSO_ORG_INSTRUCTION_AUTO_CLOSE_MS = 5000;

const dismissSsoOrgInstruction = () => {
  try {
    toastify.dismiss(SSO_ORG_INSTRUCTION_NOTIFICATION_ID);
  } catch {
    /* no-op: dismissing a missing/already-closed toast must not throw */
  }
};

const isOrgMismatchSsoMessage = (message: string) =>
  message.includes('Organization mismatch');

const Login: FC<IProps> = () => {
  const [data, setData] = useState<LoginType>({});
  const [loginStates, setLoginStates] = useState<IStates>(defaultStates);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showSSOSuccessScreen, setShowSSOSuccessScreen] = useState(false);
  const ssoSuccessRedirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ssoPollCancelledRef = useRef(false);
  const ssoPollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ssoPopupWindowRef = useRef<Window | null>(null);

  const cancelSsoPoll = () => {
    ssoPollCancelledRef.current = true;
    if (ssoPollTimerRef.current !== null) {
      clearTimeout(ssoPollTimerRef.current);
      ssoPollTimerRef.current = null;
    }
    // The org-instruction toast is only relevant while the SSO flow is in
    // progress. Whenever the flow ends (success, cancel, error, timeout) we
    // funnel through cancelSsoPoll, so dismiss the toast here too.
    dismissSsoOrgInstruction();
  };

  const fetchData = async () => {
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

  useEffect(() => {
    return () => {
      if (ssoSuccessRedirectTimerRef.current) {
        clearTimeout(ssoSuccessRedirectTimerRef.current);
      }
      // Don't leave the SSO org-instruction toast stranded if the user
      // navigates away mid-flow.
      dismissSsoOrgInstruction();
    };
  }, []);

  useEffect(() => {
    const onSsoOAuthMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object' || data.source !== SSO_OAUTH_POSTMESSAGE_SOURCE) {
        return;
      }
      if (data.ok === false) {
        const message =
          typeof data.message === 'string' && data.message.length > 0
            ? data.message
            : 'Authorization failed.';
        cancelSsoPoll();
        setIsLoading(false);
        try {
          if (ssoPopupWindowRef.current && !ssoPopupWindowRef.current.closed) {
            ssoPopupWindowRef.current.close();
          }
        } catch {
          /* ignore */
        }
        failureNotification(message, { persist: isOrgMismatchSsoMessage(message) });
      }
    };
    window.addEventListener('message', onSsoOAuthMessage);
    return () => window.removeEventListener('message', onSsoOAuthMessage);
  }, []);

  const { login, two_factor_authentication: twoFactorAuthentication } = data;
  const user = useSelector((state: RootState) => state?.authentication?.user);
  const accountData = {
    heading: data?.heading,
    subtitle: data?.subtitle,
    copyrightText: data?.copyrightText
  };

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
          failureNotification(res?.data?.error_message as string);
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
      failureNotification(response?.data?.error_message || response?.data?.error?.message);
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
    cancelSsoPoll();
    setIsLoading(true);
    try {
      const currentRegion = region;
      
      await getAppConfig()
        .then((res: any) => {
          if (res?.status === 404) {
            failureNotification('Kindly setup the SSO first');
            setIsLoading(false);
            return;
          }
          
          if (res?.status === 400) {
            failureNotification('Invalid SSO configuration. Please try again.');
            setIsLoading(false);
            return;
          }
          
          if (res?.status === 500) {
            failureNotification('Kindly setup the SSO first');
            setIsLoading(false);
            return;
          }
  
          const appConfig = res?.data;

          console.info('appConfig', appConfig);
          
          if (appConfig?.isDefault) {
            failureNotification('SSO is not configured. Please run the setup script first.');
            setIsLoading(false);
            return;
          }
          // Check if authUrl exists
          if (!appConfig?.authUrl) {
            failureNotification('Invalid Auth URL. Please try again.');
            setIsLoading(false);
            return;
          }
  
          // Checks if region matches
          if (appConfig?.region?.key && appConfig?.region?.key !== currentRegion) {
            failureNotification('Kindly choose correct region as the SSO region');
            setIsLoading(false);
            return;
          }

          if (appConfig?.organization?.name) {
            dismissSsoOrgInstruction();
            Notification({
              notificationId: SSO_ORG_INSTRUCTION_NOTIFICATION_ID,
              notificationContent: {
                text: `In Contentstack, select organization "${appConfig?.organization?.name}" when you install or authorize this app. Choosing a different organization will cause SSO to fail.`,
              },
              type: 'warning',
              notificationProps: {
                hideProgressBar: true,
                position: 'bottom-center',
                autoClose: SSO_ORG_INSTRUCTION_AUTO_CLOSE_MS,
              },
            });
          }
  
          const authURL = appConfig?.authUrl;
          const ssoWindow = window.open(authURL, '_blank', 'noopener,noreferrer');
          ssoPopupWindowRef.current = ssoWindow;
          
          if (appConfig?.user?.uid) {
            startSSOPolling(appConfig?.user?.uid, ssoWindow);
          } else {
            dismissSsoOrgInstruction();
            failureNotification('Missing user information in SSO configuration');
            setIsLoading(false);
          }
          
        })
        .catch((err: any) => {
          failureNotification('Something went wrong please try normal login method');
          setIsLoading(false);
        });
        
    } catch (error) {
      failureNotification('Something went wrong please try normal login method');
      setIsLoading(false);
    }
  };
  

  const startSSOPolling = (userId: string, ssoWindow: Window | null) => {
    ssoPollCancelledRef.current = false;
    if (ssoPollTimerRef.current !== null) {
      clearTimeout(ssoPollTimerRef.current);
      ssoPollTimerRef.current = null;
    }

    const pollInterval = 2000;
    const maxPollTime = 300000;
    let pollCount = 0;
    const maxPolls = maxPollTime / pollInterval;

    const scheduleNext = (fn: () => void) => {
      if (ssoPollCancelledRef.current) return;
      ssoPollTimerRef.current = setTimeout(fn, pollInterval);
    };

    const poll = async () => {
      if (ssoPollCancelledRef.current) return;
      pollCount += 1;

      try {
        if (ssoWindow?.closed) {
          cancelSsoPoll();
          failureNotification('SSO login was cancelled');
          setIsLoading(false);
          return;
        }

        await checkSSOAuthStatus(userId)
          .then((authRes: any) => {
            if (ssoPollCancelledRef.current) return;

            if (authRes?.status === 200 && authRes?.data?.authenticated === true) {
              cancelSsoPoll();
              if (ssoWindow && !ssoWindow.closed) {
                ssoWindow.close();
              }
              handleSuccessfulSSOLogin(authRes?.data);
              return;
            }

            const fatalErrors = ['Organization mismatch', 'SSO authentication expired'];
            const message = authRes?.data?.message;

            if (message && fatalErrors.some((err) => message.includes(err))) {
              cancelSsoPoll();
              failureNotification(message, {
                persist: isOrgMismatchSsoMessage(message),
              });
              setIsLoading(false);
              if (ssoWindow && !ssoWindow.closed) {
                ssoWindow.close();
              }
              return;
            }

            if (pollCount < maxPolls) {
              scheduleNext(poll);
            } else {
              cancelSsoPoll();
              failureNotification('SSO authentication timed out. Please try again.');
              setIsLoading(false);
              if (ssoWindow && !ssoWindow.closed) {
                ssoWindow.close();
              }
            }
          })
          .catch(() => {
            if (ssoPollCancelledRef.current) return;
            if (pollCount < maxPolls) {
              scheduleNext(poll);
            } else {
              cancelSsoPoll();
              failureNotification('Something went wrong please try normal login method');
              setIsLoading(false);
              if (ssoWindow && !ssoWindow.closed) {
                ssoWindow.close();
              }
            }
          });
      } catch {
        cancelSsoPoll();
        failureNotification('Something went wrong please try normal login method');
        setIsLoading(false);
        if (ssoWindow && !ssoWindow.closed) {
          ssoWindow.close();
        }
      }
    };

    ssoPollTimerRef.current = setTimeout(poll, pollInterval);
  };
  

  const handleSuccessfulSSOLogin = async (authData: any) => {
    try {
      setIsLoading(false);
  
      if (!authData?.app_token) {
        throw new Error("Missing app token");
      }
  
      // Store token FIRST
      setDataInLocalStorage('app_token', authData?.app_token);
  
      localStorage?.removeItem('organization');
      dispatch(clearOrganisationData());
  
      // Update redux auth
      dispatch(setAuthToken({
        authToken: authData?.app_token,
        isAuthenticated: true
      }));
  
      dispatch(setUser({
        ...user,
        region,
        is_sso: true
      }));
  
      // WAIT for user hydration
      await dispatch(getUserDetails())?.unwrap();
  
      setLoginStates(prev => ({ ...prev, submitted: true, isLoginViaSSO: true }));
      setShowSSOSuccessScreen(true);

      if (ssoSuccessRedirectTimerRef.current) {
        clearTimeout(ssoSuccessRedirectTimerRef.current);
      }
      ssoSuccessRedirectTimerRef.current = setTimeout(() => {
        ssoSuccessRedirectTimerRef.current = null;
        navigate('/projects', { replace: true });
      }, SSO_SUCCESS_REDIRECT_MS);
  
    } catch (error) {
      console.error('Error processing SSO login success:', error);
      failureNotification(
        'Login successful but setup failed. Please refresh.'
      );
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
      {showSSOSuccessScreen ? (
        <div
          className="AccountForm AccountForm_login sso-login-success"
          role="status"
          aria-live="polite"
          data-testid="sso-login-success"
        >
          <div className="sso-login-success__icon">
            <Icon icon="CheckedCircle" version="v2" size="large" />
          </div>
          <h2 className="mb-16">You&apos;re signed in</h2>
          <p className="sso-login-success__message">Taking you to your projects…</p>
        </div>
      ) : loginStates?.tfa ? (
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
