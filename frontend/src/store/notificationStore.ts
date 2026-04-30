import { create } from "zustand";

export interface GarageNotification {
  id: string;
  type: "camera" | "sign" | "ramp" | "entry" | "exit";
  title: string;
  body: string;
  timestamp: number;
}

interface NotificationState {
  notifications: GarageNotification[];
  triggeredIds: Set<string>; // feature IDs already triggered this session

  addNotification: (n: Omit<GarageNotification, "id" | "timestamp">) => void;
  dismissNotification: (id: string) => void;
  markTriggered: (featureId: string) => void;
  clearTriggered: (featureId: string) => void;
  isTriggered: (featureId: string) => boolean;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  triggeredIds: new Set(),

  addNotification: (n) => {
    const notification: GarageNotification = {
      ...n,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
    };
    set((s) => ({ notifications: [...s.notifications.slice(-4), notification] }));
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      get().dismissNotification(notification.id);
    }, 5000);
  },

  dismissNotification: (id) =>
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),

  markTriggered: (featureId) =>
    set((s) => ({ triggeredIds: new Set([...s.triggeredIds, featureId]) })),

  clearTriggered: (featureId) =>
    set((s) => {
      const next = new Set(s.triggeredIds);
      next.delete(featureId);
      return { triggeredIds: next };
    }),

  isTriggered: (featureId) => get().triggeredIds.has(featureId),
}));
