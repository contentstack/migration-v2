import { Suspense, useEffect } from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { FullPageLoader } from '@contentstack/venus-components';

import { persistor, store } from './store';

// Components
import AppRouter from './components/Common/router';
import ErrorBoundary from './components/ErrorBoundary';
import AppLayout from './components/layout/AppLayout';

// Styles
import '@contentstack/venus-components/build/main.css';
import './scss/App.scss';
import { useNetworkCheck } from './components/NetworkProvider';

function App() {
  const isOnline = useNetworkCheck();

  useEffect(() => {
    const selectModal = document.querySelector('.ReactModalPortal');
    
    if (selectModal instanceof HTMLElement) {
      if (!isOnline) {
        // Hide the modal by setting display to none
        selectModal.style.display = 'none';
      } else {
        // Show the modal by setting display to block (or its original value)
        selectModal.style.display = 'block';
      }
    }
  }, [isOnline]);

  return (
    <>
      {isOnline ? (
        <ErrorBoundary>
          <Suspense fallback={<FullPageLoader resourceName="Migration" />}>
            <Provider store={store}>
              <PersistGate loading={<FullPageLoader resourceName="Migration" />} persistor={persistor}>
                <AppLayout>
                  <AppRouter />
                </AppLayout>
              </PersistGate>
            </Provider>
          </Suspense>
        </ErrorBoundary>
      ) : (
        <div className='internetConnection'><h2>You lost the network connection!</h2></div>
      )}
    </>
  );
}
export default App;
