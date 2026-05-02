import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Shield } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#FDFCFB] p-6 text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-500">
            <Shield size={32} />
          </div>
          <h2 className="text-xl font-bold text-[#2D2D2D]">Something went wrong</h2>
          <p className="text-sm text-[#666666] max-w-xs">We encountered an unexpected error. Please refresh the page or try again later.</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-primary text-bg-main rounded-full font-bold text-sm shadow-lg shadow-primary/20"
          >
            Refresh App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
