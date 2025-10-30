'use client';

import { useState, useEffect, useCallback } from 'react';

export type NotificationType = 'success' | 'update' | 'delete' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number;
}

let notificationIdCounter = 0;
let notificationListeners: ((notification: Notification) => void)[] = [];

/**
 * Global function to show a notification from anywhere in the app
 */
export function showNotification(
  message: string,
  type: NotificationType = 'info',
  duration: number = 5000
) {
  const notification: Notification = {
    id: `notification-${++notificationIdCounter}-${Date.now()}`,
    type,
    message,
    duration,
  };

  notificationListeners.forEach((listener) => listener(notification));
}

/**
 * Notifications component - displays toast notifications in top-right corner
 * Add this component to your main layout to enable global notifications
 */
export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((notification: Notification) => {
    setNotifications((prev) => [...prev, notification]);

    // Auto-dismiss after duration
    if (notification.duration) {
      setTimeout(() => {
        removeNotification(notification.id);
      }, notification.duration);
    }
  }, []);

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  useEffect(() => {
    // Register this component as a listener
    notificationListeners.push(addNotification);

    // Cleanup on unmount
    return () => {
      notificationListeners = notificationListeners.filter(
        (listener) => listener !== addNotification
      );
    };
  }, [addNotification]);

  const getNotificationStyles = (type: NotificationType) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-500 text-green-800 dark:bg-green-900/20 dark:border-green-700 dark:text-green-300';
      case 'update':
        return 'bg-yellow-50 border-yellow-500 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-700 dark:text-yellow-300';
      case 'delete':
        return 'bg-red-50 border-red-500 text-red-800 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300';
      case 'info':
      default:
        return 'bg-blue-50 border-blue-500 text-blue-800 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300';
    }
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'success':
        return (
          <svg
            className="h-5 w-5 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case 'update':
        return (
          <svg
            className="h-5 w-5 text-yellow-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        );
      case 'delete':
        return (
          <svg
            className="h-5 w-5 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        );
      case 'info':
      default:
        return (
          <svg
            className="h-5 w-5 text-blue-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
    }
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed right-4 top-20 z-9999 flex flex-col gap-3 w-96 max-w-[calc(100vw-2rem)]">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`animate-slide-in-right flex items-start gap-3 rounded-lg border-l-4 p-4 shadow-lg ${getNotificationStyles(
            notification.type
          )}`}
        >
          <div className="flex-shrink-0 mt-0.5">
            {getNotificationIcon(notification.type)}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{notification.message}</p>
          </div>
          <button
            onClick={() => removeNotification(notification.id)}
            className="flex-shrink-0 ml-2 hover:opacity-70 transition-opacity"
            aria-label="Close notification"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
