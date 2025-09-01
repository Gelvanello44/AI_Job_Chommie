import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";

export const initSentry = () => {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || "development",
    integrations: [
      new BrowserTracing({
        tracePropagationTargets: [
          "localhost",
          /^https:\/\/yourapi\.domain\.com\/api/,
          /^\/api/,
        ],
      }),
    ],
    tracesSampleRate: import.meta.env.VITE_SENTRY_ENVIRONMENT === "production" ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    sendDefaultPii: true,
    beforeSend(event, hint) {
      // Filter out ResizeObserver errors in production
      if (import.meta.env.VITE_SENTRY_ENVIRONMENT === "production") {
        if (
          event.exception?.values?.[0]?.value?.includes("ResizeObserver loop limit exceeded")
        ) {
          return null;
        }
      }
      return event;
    },
    initialScope: {
      tags: {
        component: "frontend",
        framework: "react",
      },
    },
  });
};

export const SentryErrorBoundary = Sentry.withErrorBoundary;
export const SentryProfiler = Sentry.withProfiler;
