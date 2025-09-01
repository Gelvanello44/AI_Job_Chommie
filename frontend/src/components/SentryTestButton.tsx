import React from "react";
import { trackError, trackMessage } from "../lib/errorTracking";

const SentryTestButton: React.FC = () => {
  const isDevelopment = import.meta.env.VITE_SENTRY_ENVIRONMENT === "development";

  if (!isDevelopment) {
    return null;
  }

  const handleTestError = () => {
    try {
      throw new Error("Test error from Sentry Test Button - React Frontend");
    } catch (error) {
      trackError(error as Error, {
        component: "SentryTestButton",
        action: "manual_test",
        timestamp: new Date().toISOString(),
      });
    }
  };

  const handleTestMessage = () => {
    trackMessage("Test message from React Frontend", "info");
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <button
        onClick={handleTestError}
        className="px-4 py-2 bg-red-500 text-white rounded shadow-lg hover:bg-red-600 transition-colors"
        title="Test Sentry Error Tracking"
      >
        Test Sentry Error
      </button>
      <button
        onClick={handleTestMessage}
        className="px-4 py-2 bg-blue-500 text-white rounded shadow-lg hover:bg-blue-600 transition-colors"
        title="Test Sentry Message Tracking"
      >
        Test Sentry Message
      </button>
    </div>
  );
};

export default SentryTestButton;
