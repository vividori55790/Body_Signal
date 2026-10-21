import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Body Signal rendered an unexpected error.", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
          <div className="mx-auto max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
            <h1 className="text-xl font-bold">Body Signal needs to restart</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              An unexpected error occurred. Your saved local data was not deleted.
              Reload the app and try again.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="mt-6 rounded-lg bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950"
            >
              Reload app
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
