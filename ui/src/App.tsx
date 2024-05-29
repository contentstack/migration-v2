import AppRouter from './components/Common/router';
import ErrorBoundary from './components/ErrorBoundary';
import AppContextProvider from './context/app/app.provider';
import AppLayout from './components/layout/AppLayout';
import { Suspense, useEffect } from 'react';
import { FullPageLoader } from '@contentstack/venus-components';
import { Provider } from 'react-redux';
import { store } from './store/store';


// Styles
import '@contentstack/venus-components/build/main.css';
import './scss/App.scss';



function App() {

  return (
    <ErrorBoundary>
      <Suspense fallback={<FullPageLoader resourceName="Migration" />}>
        <Provider store={store}>
        <AppLayout>
            <AppRouter />
          </AppLayout>
        </Provider>     
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
