import * as Haptics from 'expo-haptics';

export function hapticLight(): void {
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    /* simulator / web */
  }
}

export function hapticMedium(): void {
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    /* noop */
  }
}

export function hapticHeavy(): void {
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch {
    /* noop */
  }
}

export function hapticSuccess(): void {
  try {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    /* noop */
  }
}

export function hapticWarning(): void {
  try {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {
    /* noop */
  }
}
