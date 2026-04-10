import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  public state: State;
  public props: Props;
  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-white p-8 flex flex-col items-center justify-center text-center">
          <h1 className="text-4xl font-black uppercase tracking-tighter mb-4 text-red-500">System Failure</h1>
          <p className="text-zinc-400 mb-8 max-w-md">
            An unexpected error has occurred. The Strategist is attempting to recalibrate.
          </p>
          <pre className="bg-zinc-900 p-4 rounded-xl text-xs font-mono text-left w-full overflow-auto max-h-40 mb-8">
            {this.state.error?.message}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            className="bg-white text-black font-bold py-3 px-8 rounded-full"
          >
            REBOOT SYSTEM
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
