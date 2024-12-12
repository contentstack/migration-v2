import React, { Component, ErrorInfo, ReactNode } from 'react';
import ErrorPage from '../../pages/Errors';
import { CS_ENTRIES } from '../../utilities/constants';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return <ErrorPage contentType={CS_ENTRIES.INTERNAL_SERVER_ERROR} />;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
