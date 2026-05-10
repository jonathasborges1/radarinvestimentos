import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import {
  NotificationProvider,
  useNotification,
} from '../../../context/NotificationContext';

/**
 * Helper component that exposes notification actions for testing.
 */
function TestConsumer() {
  const { addNotification } = useNotification();
  return (
    <div>
      <button onClick={() => addNotification('success', 'Sucesso!')}>
        Add Success
      </button>
      <button onClick={() => addNotification('error', 'Erro!')}>
        Add Error
      </button>
      <button onClick={() => addNotification('warning', 'Aviso!')}>
        Add Warning
      </button>
      <button onClick={() => addNotification('info', 'Info!')}>
        Add Info
      </button>
    </div>
  );
}

describe('NotificationContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders no notifications initially', () => {
    render(
      <NotificationProvider>
        <TestConsumer />
      </NotificationProvider>
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('adds a success notification and auto-dismisses after 3s', () => {
    render(
      <NotificationProvider>
        <TestConsumer />
      </NotificationProvider>
    );

    fireEvent.click(screen.getByText('Add Success'));
    expect(screen.getByText('Sucesso!')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByText('Sucesso!')).not.toBeInTheDocument();
  });

  it('adds an error notification that persists (no auto-dismiss)', () => {
    render(
      <NotificationProvider>
        <TestConsumer />
      </NotificationProvider>
    );

    fireEvent.click(screen.getByText('Add Error'));
    expect(screen.getByText('Erro!')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(10000);
    });
    // Error notifications persist
    expect(screen.getByText('Erro!')).toBeInTheDocument();
  });

  it('adds a warning notification and auto-dismisses after 5s', () => {
    render(
      <NotificationProvider>
        <TestConsumer />
      </NotificationProvider>
    );

    fireEvent.click(screen.getByText('Add Warning'));
    expect(screen.getByText('Aviso!')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByText('Aviso!')).not.toBeInTheDocument();
  });

  it('adds an info notification and auto-dismisses after 3s', () => {
    render(
      <NotificationProvider>
        <TestConsumer />
      </NotificationProvider>
    );

    fireEvent.click(screen.getByText('Add Info'));
    expect(screen.getByText('Info!')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByText('Info!')).not.toBeInTheDocument();
  });

  it('stacks multiple notifications', () => {
    render(
      <NotificationProvider>
        <TestConsumer />
      </NotificationProvider>
    );

    fireEvent.click(screen.getByText('Add Success'));
    fireEvent.click(screen.getByText('Add Error'));
    fireEvent.click(screen.getByText('Add Warning'));

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(3);
  });

  it('removes a notification when close button is clicked', () => {
    render(
      <NotificationProvider>
        <TestConsumer />
      </NotificationProvider>
    );

    fireEvent.click(screen.getByText('Add Error'));
    expect(screen.getByText('Erro!')).toBeInTheDocument();

    const closeButton = screen.getByLabelText('Fechar notificação');
    fireEvent.click(closeButton);
    expect(screen.queryByText('Erro!')).not.toBeInTheDocument();
  });

  it('throws when useNotification is used outside provider', () => {
    function BadConsumer() {
      useNotification();
      return null;
    }

    // Suppress console.error for expected error
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<BadConsumer />)).toThrow(
      'useNotification must be used within a NotificationProvider'
    );
    spy.mockRestore();
  });
});
