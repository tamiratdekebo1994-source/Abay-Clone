import React from 'react';

// Catches render/effect errors in whatever it wraps so one broken page can't blank
// the entire app — without this, an uncaught error (e.g. a missing API method)
// unmounts the whole React tree and leaves a blank white screen.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-8 flex flex-col items-center justify-center text-center min-h-[50vh]">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Something went wrong loading this page</h2>
          <p className="text-sm text-gray-500 mb-4 max-w-md">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="btn-primary text-sm"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
