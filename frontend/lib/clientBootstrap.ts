interface ClientBootstrapOptions {
  initializeTheme: () => void;
  subscribeAuth: () => () => void;
  onAuthError?: (error: unknown) => void;
}

/** Theme startup must not depend on optional deployment auth configuration. */
export function initializeClientBootstrap({
  initializeTheme,
  subscribeAuth,
  onAuthError,
}: ClientBootstrapOptions): () => void {
  initializeTheme();
  try {
    return subscribeAuth();
  } catch (error) {
    onAuthError?.(error);
    return () => undefined;
  }
}
