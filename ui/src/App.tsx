import AppRouter from './components/Common/router';
import ErrorBoundary from './components/ErrorBoundary';
import AppContextProvider from './context/app/app.provider';
import AppLayout from './components/layout/AppLayout';
import { Suspense, useEffect } from 'react';
import { FullPageLoader } from '@contentstack/venus-components';
import { persistor, store } from './store';

// Styles
import '@contentstack/venus-components/build/main.css';
import './scss/App.scss';
import { Provider} from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

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

