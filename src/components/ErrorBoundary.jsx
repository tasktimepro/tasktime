import React from 'react';
import { ExclamationTriangleIcon, ArrowPathIcon } from '@/components/ui/icons';

/**
 * Error Fallback component - Displayed when an error occurs
 */
const ErrorFallback = ({ error, resetError }) => {
    return (
        <div className="min-h-[200px] flex items-center justify-center p-6">
            <div className="text-center max-w-md">
                <div className="mx-auto w-12 h-12 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900 mb-4">
                    <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                
                <h2 className="text-lg font-semibold text-foreground mb-2">
                    Something went wrong
                </h2>
                
                <p className="text-sm text-muted-foreground mb-4">
                    An unexpected error occurred. You can try refreshing the component or reloading the page.
                </p>
                
                {process.env.NODE_ENV === 'development' && error && (
                    <details className="text-left mb-4 p-3 bg-muted rounded-md">
                        <summary className="text-xs font-medium text-foreground cursor-pointer">
                            Error Details (Dev Only)
                        </summary>
                        <pre className="mt-2 text-xs text-red-600 dark:text-red-400 overflow-auto max-h-32">
                            {error.message}
                            {error.stack && `\n\n${error.stack}`}
                        </pre>
                    </details>
                )}
                
                <div className="flex justify-center space-x-3">
                    <button
                        onClick={resetError}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-md transition-colors"
                    >
                        <ArrowPathIcon className="h-4 w-4 mr-2" />
                        Try Again
                    </button>
                    
                    <button
                        onClick={() => window.location.reload()}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-secondary-foreground bg-secondary hover:bg-secondary/80 rounded-md transition-colors"
                    >
                        Reload Page
                    </button>
                </div>
            </div>
        </div>
    );
};

/**
 * Error Boundary component - Catches JavaScript errors in child components
 * 
 * Usage:
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 * 
 * Or with a custom fallback:
 * <ErrorBoundary fallback={<CustomFallback />}>
 *   <YourComponent />
 * </ErrorBoundary>
 */
class ErrorBoundary extends React.Component {

    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // Log the error to console in development
        if (process.env.NODE_ENV === 'development') {
            console.error('ErrorBoundary caught an error:', error, errorInfo);
        }
        
        // In production, you might want to log to an error reporting service
        // logErrorToService(error, errorInfo);
    }

    resetError = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            // Check if custom fallback is provided
            if (this.props.fallback) {
                return this.props.fallback;
            }
            
            // Use default ErrorFallback
            return (
                <ErrorFallback 
                    error={this.state.error} 
                    resetError={this.resetError} 
                />
            );
        }

        return this.props.children;
    }
}

/**
 * Higher-order component to wrap a component with an ErrorBoundary
 * 
 * Usage:
 * export default withErrorBoundary(YourComponent);
 */
export const withErrorBoundary = (WrappedComponent, fallback = null) => {
    const WithErrorBoundary = (props) => (
        <ErrorBoundary fallback={fallback}>
            <WrappedComponent {...props} />
        </ErrorBoundary>
    );
    
    WithErrorBoundary.displayName = `WithErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
    
    return WithErrorBoundary;
};

export { ErrorFallback };
export default ErrorBoundary;
