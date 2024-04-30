import AppRouter from './components/Common/router';
import ErrorBoundary from './components/ErrorBoundary';
import AppContextProvider from './context/app/app.provider';
import AppLayout from './components/layout/AppLayout';
import { Suspense } from 'react';
import { FullPageLoader } from '@contentstack/venus-components';

// Styles
import '@contentstack/venus-components/build/main.css';
import './scss/App.scss';

function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<FullPageLoader resourceName="Migration" />}>
        <AppContextProvider>
          <AppLayout>
            <AppRouter />
          </AppLayout>
        </AppContextProvider>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
