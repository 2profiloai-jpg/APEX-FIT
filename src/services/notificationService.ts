
import { toast } from "sonner";

class NotificationService {
  private hasSupport = typeof window !== 'undefined' && 'Notification' in window;

  async requestPermission(): Promise<boolean> {
    if (!this.hasSupport) {
      toast.error("Il tuo browser non supporta le notifiche.");
      return false;
    }

    if (Notification.permission === 'granted') return true;

    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error("Errore durante la richiesta di permesso notifiche:", error);
      return false;
    }
  }

  get isGranted(): boolean {
    return this.hasSupport && Notification.permission === 'granted';
  }

  notify(title: string, options?: NotificationOptions) {
    if (!this.isGranted) return;

    // Use a default icon or the app icon if available
    const notificationOptions: NotificationOptions = {
      icon: 'https://picsum.photos/seed/fitness/192/192',
      badge: 'https://picsum.photos/seed/fitness/192/192',
      ...options
    };

    try {
      // In many browsers, simple Notification constructor works
      new Notification(title, notificationOptions);
    } catch (e) {
      // Fallback for some mobile browsers that require Service Worker showNotification
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
          registration.showNotification(title, notificationOptions);
        });
      }
    }
  }

  // Specific high-level notification
  sendCalorieReminder(remaining: number) {
    if (remaining > 0) {
      this.notify("Apex Lift: Obiettivo Nutrizionale", {
        body: `Ti mancano ancora ${remaining} kcal per oggi. Non mollare!`,
        tag: 'calorie-reminder'
      });
    }
  }

  sendWorkoutReminder(workoutName: string) {
    this.notify("Apex Lift: Ora di Allenarsi!", {
      body: `Oggi hai in programma: ${workoutName}. Preparati!`,
      tag: 'workout-reminder'
    });
  }

  sendRestDayReminder() {
    this.notify("Apex Lift: Recupero", {
      body: "Oggi è giorno di riposo. Goditi il recupero muscolare!",
      tag: 'workout-reminder'
    });
  }
}

export const notificationService = new NotificationService();
