import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught:', error, errorInfo)
    }
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-foreground">
          <p className="text-center text-sm text-muted-foreground">
            예기치 않은 오류가 발생했습니다.
          </p>
          <p className="max-w-md truncate text-center text-xs text-muted-foreground" title={this.state.error.message}>
            {this.state.error.message}
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-muted"
          >
            다시 시도
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
