import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_USER_ID = 'innervoice.userId';
const KEY_DISPLAY_NAME = 'innervoice.displayName';

function randomId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `iv-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export async function getOrCreateUserId(): Promise<string> {
  const existing = await AsyncStorage.getItem(KEY_USER_ID);
  if (existing?.trim()) return existing.trim();
  const id = randomId();
  await AsyncStorage.setItem(KEY_USER_ID, id);
  return id;
}

export async function getDisplayName(): Promise<string> {
  return (await AsyncStorage.getItem(KEY_DISPLAY_NAME))?.trim() ?? '';
}

export async function setDisplayName(name: string): Promise<void> {
  await AsyncStorage.setItem(KEY_DISPLAY_NAME, name.trim());
}
