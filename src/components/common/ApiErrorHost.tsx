// Blocking "Something Went Wrong" overlay for API/action failures, driven
// imperatively (callable from services/thunks, not just components) so the
// decision computed by appCore.handleError() — previously discarded in
// src/api/request.ts — actually reaches the user with a retry action,
// instead of the caller silently getting nothing beyond a rejected promise.
import React, { useEffect, useState } from 'react';
import { Modal } from 'react-native';
import { ApiErrorScreen } from '@codeimplants/ui-kit';
import type { ApiErrorType } from '@codeimplants/ui-kit';
import { buildSupportProp } from '../../constants/support';

type ApiErrorState = {
  title?: string;
  message: string;
  statusCode?: number;
  errorType?: ApiErrorType;
  onRetry?: () => void;
} | null;

let current: ApiErrorState = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());

export function showApiError(state: NonNullable<ApiErrorState>) {
  current = state;
  notify();
}

export function dismissApiError() {
  current = null;
  notify();
}

export function ApiErrorHost() {
  const [, force] = useState(0);

  useEffect(() => {
    const l = () => force(n => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  if (!current) return null;
  const { title, message, statusCode, errorType, onRetry } = current;

  return (
    <Modal visible animationType="fade" onRequestClose={dismissApiError}>
      <ApiErrorScreen
        title={title}
        description={message}
        statusCode={statusCode}
        errorType={errorType}
        showRetryButton={!!onRetry}
        onRetry={
          onRetry
            ? () => {
                dismissApiError();
                onRetry();
              }
            : undefined
        }
        onHome={dismissApiError}
        homeButtonText="Close"
        support={buildSupportProp('API Error', {
          errorMessage: message,
          errorCode: statusCode != null ? String(statusCode) : undefined,
        })}
      />
    </Modal>
  );
}
