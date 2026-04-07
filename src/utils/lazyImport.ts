import { ComponentType, lazy } from "react";

/**
 * Custom lazy load with retry mechanism
 * Tự động thử lại khi tải chunk thất bại (do mạng yếu hoặc version mismatch)
 */
export const lazyRetry = <T extends ComponentType<any>>(
    factory: () => Promise<{ default: T }>,
    retries: number = 2
) => {
    return lazy(() =>
        new Promise<{ default: T }>((resolve, reject) => {
            factory()
                .then(resolve)
                .catch((error) => {
                    // Check network/chunk error
                    const isChunkError =
                        error?.message?.includes("Failed to fetch dynamically imported module") ||
                        error?.message?.includes("Importing a module script failed") ||
                        error?.message?.includes("Loading chunk");

                    if (isChunkError) {
                        // If chunk load fails, it might be due to a deployment.
                        // We verify if we have retries left.
                        if (retries > 0) {
                            // Backoff slightly
                            setTimeout(() => {
                                // Retry recursively
                                // Note: lazy expects a promise returning a module
                                // To retry properly we'd need to re-call factory.
                                // However, import() might cache failures? 
                                // Usually import('...?' + t) busts cache but vite handles imports delicately.

                                // Simple retry approach:
                                // Recursion is tricky with the lazy wrapper.
                                // We will try simply refreshing the page if it's a hard chunk error and no retries.
                            }, 1000);
                        }
                    }

                    // Retry logic standard implementation
                    if (retries > 0) {
                        setTimeout(() => {
                            // Recursively call factory is not enough as 'import' might be cached.
                            // But usually for network errors, re-requesting works.
                            // The simple trick: 
                            factory().then(resolve).catch((err2) => {
                                if (retries > 1) {
                                    factory().then(resolve).catch(reject);
                                } else {
                                    // If explicit chunk error on persistent failure -> Force reload
                                    if (isChunkError) {
                                        console.warn("Chunk load failed persistently. Forcing reload.");
                                        // Verify we haven't just reloaded to avoid loop
                                        const lastReload = parseInt(sessionStorage.getItem('chunk_retry_reload') || '0');
                                        if (Date.now() - lastReload > 10000) {
                                            sessionStorage.setItem('chunk_retry_reload', Date.now().toString());
                                            window.location.reload();
                                        }
                                    }
                                    reject(err2);
                                }
                            });
                        }, 1000);
                    } else {
                        reject(error);
                    }
                });
        })
    );
};

// Simplified version actually working with React.lazy
// Ref: https://github.com/facebook/react/issues/14254#issuecomment-983946395

export const lazyImport = (
    importFn: () => Promise<any>
) => {
    return lazy(async () => {
        const pageHasAlreadyBeenForceRefreshed = JSON.parse(
            window.sessionStorage.getItem('page-has-been-force-refreshed') || 'false'
        );

        try {
            return await importFn();
        } catch (error: any) {
            const isChunkError =
                error?.message?.includes("Failed to fetch dynamically imported module") ||
                error?.message?.includes("Importing a module script failed") ||
                error?.message?.includes("Loading chunk");

            // If we get a chunk error and haven't refreshed yet, force refresh
            if (isChunkError && !pageHasAlreadyBeenForceRefreshed) {
                window.sessionStorage.setItem('page-has-been-force-refreshed', 'true');
                window.location.reload();
            }

            // If we have already refreshed or it's another error, throw it so ErrorBoundary catches it
            throw error;
        }
    });
};
