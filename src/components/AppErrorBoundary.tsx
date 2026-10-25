import { Heading, Text, DesignSystemProvider } from '../design-system';
import { Button } from '../design-system';
import { Component, type ErrorInfo, type ReactNode } from 'react';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export default class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    // Preserve the technical error for browser monitoring/devtools while the
    // operator receives a recoverable screen instead of a blank application.
    console.error('[Kifer Saúde] erro não tratado na interface', error, errorInfo.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <DesignSystemProvider><main className="flex min-h-dvh items-center justify-center bg-[var(--bg-canvas)] px-6 py-12 text-[var(--text-primary)]">
        <section
          aria-labelledby="app-error-title"
          className="w-full max-w-lg rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-8 text-center shadow-lg"
          role="alert"
        >
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--danger-soft)] text-xl" aria-hidden="true">
            !
          </div>
          <Heading level={1} id="app-error-title" className="text-xl font-semibold">
            O sistema encontrou um erro inesperado
          </Heading>
          <Text className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
            A tela não conseguiu carregar corretamente. Recarregue a página para tentar novamente. Seus dados salvos não foram apagados.
          </Text>
          <Button variant="primary"
            type="button"
            className="mt-6 inline-flex items-center justify-center font-semibold transition focus:outline-none"
            onClick={this.handleReload}
          >
            Recarregar página
          </Button>
        </section>
      </main></DesignSystemProvider>
    );
  }
}
