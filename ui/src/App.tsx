// Libraries
import { Suspense, useEffect } from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { FullPageLoader } from '@contentstack/venus-components';

import { persistor, store } from './store';

// Components
import AppRouter from './components/Common/router';
import ErrorBoundary from './components/ErrorBoundary';
import AppLayout from './components/layout/AppLayout';
import { useNetworkCheck } from './components/NetworkProvider';

// Styles
// Grid + utility classes (d-flex, vh-100, row/col-*, spacing). These used to come from
// https://ui.contentstack.com/contentstack.min.css, which now returns 402. Kept above the
// venus import so venus's own px-scale classes (.mb-3, .ml-8 ...) keep winning.
import 'bootstrap/dist/css/bootstrap-grid.min.css';
import 'bootstrap/dist/css/bootstrap-utilities.min.css';
import './scss/legacy-cdn-shim.scss';
import '@contentstack/venus-components/build/main.css';
import './scss/App.scss';

function App() {
  const isOnline = useNetworkCheck();

  useEffect(() => {
    const selectModal = document.querySelector('.ReactModalPortal');

    if (selectModal instanceof HTMLElement) {
      if (!isOnline) {
        // Hide the modal by setting display to none
        selectModal.style.display = 'none';
      }
    }
  }, [isOnline]);

  return (
    <>
      {isOnline ? (
        <ErrorBoundary>
          <Suspense fallback={<FullPageLoader resourceName="Migration" />}>
            <Provider store={store}>
              <PersistGate
                loading={<FullPageLoader resourceName="Migration" />}
                persistor={persistor}
              >
                <AppLayout>
                  <AppRouter />
                </AppLayout>
              </PersistGate>
            </Provider>
          </Suspense>
        </ErrorBoundary>
      ) : (
        <div className="internetConnection">
          <h2>You lost the network connection!</h2>
        </div>
      )}
    </>
  );
}
export default App;
