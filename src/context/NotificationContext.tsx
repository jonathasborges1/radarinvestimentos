import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type { Notification, NotificationType } from '../types';

interface NotificationContextValue {
  notifications: Notification[];
  addNotification: (type: NotificationType, message: string) => void;
  removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const DURATION_MAP: Record<NotificationType, number | undefined> = {
  success: 3000,
  error: undefined, // persistent
  warning: 5000,
  info: 3000,
};

interface NotificationProviderProps {
  children: ReactNode;
}

/**
 * Provider that manages a stack of notifications with auto-dismiss support.
 * Success and info auto-dismiss after 3s, warning after 5s, error is persistent.
 */
export function NotificationProvider({ children }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const counterRef = useRef(0);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const addNotification = useCallback(
    (type: NotificationType, message: string) => {
      counterRef.current += 1;
      const id = `notification-${counterRef.current}-${Date.now()}`;
      const duration = DURATION_MAP[type];

      const notification: Notification = { id, type, message, duration };
      setNotifications((prev) => [...prev, notification]);

      if (duration !== undefined) {
        setTimeout(() => {
          removeNotification(id);
        }, duration);
      }
    },
    [removeNotification]
  );

  return (
    <NotificationContext.Provider
      value={{ notifications, addNotification, removeNotification }}
    >
      {children}
      <NotificationContainer
        notifications={notifications}
        onClose={removeNotification}
      />
    </NotificationContext.Provider>
  );
}

/**
 * Hook to access notification actions.
 * Must be used within a NotificationProvider.
 */
export function useNotification(): Pick<
  NotificationContextValue,
  'addNotification' | 'removeNotification'
> {
  const context = useContext(NotificationContext);
  if (context === null) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return {
    addNotification: context.addNotification,
    removeNotification: context.removeNotification,
  };
}

/* ------------------------------------------------------------------ */
/*  NotificationContainer — renders stacked notifications             */
/* ------------------------------------------------------------------ */

const TYPE_STYLES: Record<NotificationType, string> = {
  success:
    'bg-green-50 dark:bg-green-900/30 border-green-400 dark:border-green-600 text-green-800 dark:text-green-200',
  error:
    'bg-red-50 dark:bg-red-900/30 border-red-400 dark:border-red-600 text-red-800 dark:text-red-200',
  warning:
    'bg-amber-50 dark:bg-amber-900/30 border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-200',
  info:
    'bg-blue-50 dark:bg-blue-900/30 border-blue-400 dark:border-blue-600 text-blue-800 dark:text-blue-200',
};

const TYPE_ICONS: Record<NotificationType, React.ReactNode> = {
  success: (
    <svg
      className="h-5 w-5 text-green-500 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  ),
  error: (
    <svg
      className="h-5 w-5 text-red-500 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  ),
  warning: (
    <svg
      className="h-5 w-5 text-amber-500 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01M10.29 3.86l-8.6 14.86A1 1 0 002.56 20h18.88a1 1 0 00.87-1.28l-8.6-14.86a1 1 0 00-1.72 0z"
      />
    </svg>
  ),
  info: (
    <svg
      className="h-5 w-5 text-blue-500 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
      />
    </svg>
  ),
};

interface NotificationContainerProps {
  notifications: Notification[];
  onClose: (id: string) => void;
}

/**
 * Renders stacked notifications at the top-right of the screen.
 */
function NotificationContainer({
  notifications,
  onClose,
}: NotificationContainerProps) {
  if (notifications.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notificações"
      className="fixed top-4 right-4 z-50 flex flex-col gap-3 w-80 max-w-[calc(100vw-2rem)]"
    >
      {notifications.map((notification) => (
        <div
          key={notification.id}
          role="alert"
          className={`border-l-4 rounded-md p-4 shadow-lg flex items-start gap-3 animate-[slideIn_0.3s_ease-out] ${TYPE_STYLES[notification.type]}`}
        >
          {TYPE_ICONS[notification.type]}
          <p className="text-sm flex-1">{notification.message}</p>
          <button
            type="button"
            onClick={() => onClose(notification.id)}
            className="shrink-0 rounded-md p-1 hover:opacity-70 focus:outline-none focus:ring-2 focus:ring-offset-1"
            aria-label="Fechar notificação"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
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

export { NotificationContext, NotificationContainer };
