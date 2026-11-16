import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Body Signal unhandled error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.error) {
      return (
        <main className="min-h-screen bg-slate-950 px-6 py-16 text-white flex items-center justify-center">
          <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
              <AlertCircle size={30} />
            </div>
            <h1 className="text-lg font-bold">앱 실행 중 오류가 발생했습니다</h1>
            <p className="text-xs leading-relaxed text-slate-400">
              기기 내에 암호화된 건강 기록은 안전하게 보존되어 있습니다. 앱을 다시 시작해 주세요.
            </p>
            <p className="text-[10px] font-mono text-rose-400 bg-slate-950 p-2 rounded-lg break-all">
              {this.state.error.message}
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
            >
              <RotateCcw size={16} /> 앱 새로고침
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
