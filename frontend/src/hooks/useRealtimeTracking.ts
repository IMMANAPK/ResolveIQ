import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from '@/lib/socket';
import { useAuth } from '@/contexts/AuthContext';

interface NotificationReadEvent {
  trackingId: string;
  notificationId: string;
  complaintId?: string;
  recipientId?: string;
  readAt: string;
}

interface EscalationTriggeredEvent {
  notificationId: string;
  complaintId: string;
  step: string;
}

/**
 * Subscribe to real-time Socket.io events and invalidate TanStack Query caches
 * so pages automatically refresh when email is read or escalation is triggered.
 */
export function useRealtimeTracking() {
  const qc = useQueryClient();
  const { token } = useAuth();

  useEffect(() => {
    if (!token) return;

    const socket = getSocket();

    const onNotificationRead = (data: NotificationReadEvent) => {
      // Invalidate the specific complaint's notifications
      if (data.complaintId) {
        qc.invalidateQueries({ queryKey: ['notifications', 'complaint', data.complaintId] });
      }
      // Invalidate the global notifications list
      qc.invalidateQueries({ queryKey: ['notifications'] });
    };

    const onEscalationTriggered = (data: EscalationTriggeredEvent) => {
      qc.invalidateQueries({ queryKey: ['escalation', data.complaintId] });
      qc.invalidateQueries({ queryKey: ['notifications', 'complaint', data.complaintId] });
    };

    socket.on('notification:read', onNotificationRead);
    socket.on('escalation:triggered', onEscalationTriggered);

    return () => {
      socket.off('notification:read', onNotificationRead);
      socket.off('escalation:triggered', onEscalationTriggered);
    };
  }, [qc, token]);
}
