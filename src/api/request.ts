import { appCore } from '../appCore';
import * as AnalyticsSDK from '@codeimplants/analytics';
import type { ApiErrorType } from '@codeimplants/ui-kit';
import { showApiError } from '../components/common/ApiErrorHost';

const { Analytics } = AnalyticsSDK;

type ErrorContext = {
  action: string;
  component?: string;
  metadata?: Record<string, unknown>;
};

function classifyApiErrorType(error: any): ApiErrorType | undefined {
  const status = error?.response?.status;
  if (error?.code === 'ECONNABORTED' || /timeout/i.test(error?.message ?? '')) return 'timeout';
  if (!error?.response) return 'network_error';
  if (status >= 500) return 'server_error';
  if (status >= 400) return 'client_error';
  return undefined;
}

export async function withCoreRetry<T>(
  operation: () => Promise<T>,
  context: ErrorContext,
  options?: { maxAttempts?: number },
) {
  try {
    return await appCore.executeWithRetry(operation, {
      maxAttempts: options?.maxAttempts ?? 3,
    });
  } catch (error: any) {
    console.error(`[withCoreRetry] Error in ${context.action}:`, {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      config: {
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        method: error.config?.method,
      }
    });
    await Analytics.track('API_FAILURE', {
      action: context.action,
      component: context.component ?? 'unknown',
    });
    const decision = appCore.handleError(error as Error, context);
    if (decision.action === 'show_error' || decision.action === 'show_support') {
      showApiError({
        title: decision.screenData?.title,
        message: decision.screenData?.message || error.message || 'Something went wrong. Please try again.',
        statusCode: error?.response?.status,
        errorType: classifyApiErrorType(error),
        onRetry: () => {
          // Fire-and-forget: re-runs the original call through the same
          // retry/error pipeline. Its own rejection is not this dismissal's
          // concern — the pipeline will show the overlay again if it fails.
          void withCoreRetry(operation, context, options);
        },
      });
    }
    throw error;
  }
}
