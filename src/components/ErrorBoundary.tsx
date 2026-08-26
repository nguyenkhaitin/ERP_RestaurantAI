/**
 * ErrorBoundary - Catch render errors and display fallback UI
 */

import React, { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Error caught:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 min-h-screen bg-red-50 flex items-center justify-center">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-red-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <h2 className="text-lg font-bold text-red-900">Lỗi Render Component</h2>
            </div>
            
            <div className="space-y-3 mb-6">
              <div className="bg-red-50 p-3 rounded border border-red-200">
                <p className="text-sm font-mono text-red-700 break-words">
                  {this.state.error?.message}
                </p>
              </div>

              {this.state.errorInfo && (
                <details className="text-xs">
                  <summary className="font-medium text-slate-600 cursor-pointer hover:text-slate-900">
                    Chi tiết lỗi
                  </summary>
                  <pre className="mt-2 p-2 bg-slate-100 rounded text-[10px] overflow-auto max-h-40">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>

            <div className="space-y-2">
              <button
                onClick={this.handleReset}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Tải lại
              </button>
              <button
                onClick={() => window.location.reload()}
                className="w-full px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-all"
              >
                Làm mới trang
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
