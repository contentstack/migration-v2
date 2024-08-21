import { Suspense } from 'react';
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
