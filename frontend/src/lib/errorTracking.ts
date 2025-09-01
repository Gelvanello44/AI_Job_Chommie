import * as Sentry from "@sentry/react";

interface User {
  id: string;
  email?: string;
  username?: string;
}

export const trackError = (error: Error, context?: Record<string, any>) => {
  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext("error_context", context);
      Object.keys(context).forEach((key) => {
        scope.setTag(key, context[key]);
      });
    }
    Sentry.captureException(error);
  });
};

export const trackMessage = (message: string, level: Sentry.SeverityLevel = "info") => {
  Sentry.captureMessage(message, level);
};

export const setUserContext = (user: User) => {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
  });
};

export const addBreadcrumb = (
  message: string,
  category: string,
  data?: Record<string, any>
) => {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: "info",
    timestamp: Date.now() / 1000,
  });
};

export const clearUser = () => {
  Sentry.setUser(null);
};

export const captureUserFeedback = (name: string, email: string, comments: string) => {
  const user = Sentry.getCurrentHub().getScope()?.getUser();
  Sentry.captureUserFeedback({
    name,
    email,
    comments,
    event_id: Sentry.lastEventId(),
  });
};
