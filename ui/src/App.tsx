// Libraries
import { Suspense } from 'react';
import { Provider} from 'react-redux';
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

function App() {

  return (
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
  );
}

export default App;


function dispatch(arg0: any) {
  throw new Error('Function not implemented.');
}

