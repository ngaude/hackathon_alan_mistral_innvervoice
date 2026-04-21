export const MISTRAL_CHAT_MODEL_DEFAULT = 'mistral-large-latest';

export function getMistralChatModel(): string {
  const v =
    typeof process !== 'undefined' && typeof process.env?.MISTRAL_CHAT_MODEL === 'string'
      ? process.env.MISTRAL_CHAT_MODEL.trim()
      : '';
  return v || MISTRAL_CHAT_MODEL_DEFAULT;
}
