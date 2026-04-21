const os = require('os');
const path = require('path');

// Always load `.env` from the project root (not only from the shell cwd).
require('dotenv').config({ path: path.join(__dirname, '.env') });

/**
 * First non-loopback IPv4 (Wi‑Fi / Ethernet) so phone and simulator on the same LAN
 * reach the dev PC without `EXPO_PUBLIC_INNERVOICE_API_URL` in `.env`.
 */
function getFirstLanIPv4() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      const v4 = net.family === 'IPv4' || net.family === 4;
      if (v4 && !net.internal) {
        return net.address;
      }
    }
  }
  return '';
}

/**
 * Session API URL: `EXPO_PUBLIC_INNERVOICE_API_URL` wins, else `http://<LAN IP>:<port>`.
 */
function resolveInnervoiceApiUrl() {
  const explicit = (process.env.EXPO_PUBLIC_INNERVOICE_API_URL ?? '').trim();
  if (explicit) return explicit;
  const portRaw = (process.env.EXPO_PUBLIC_INNERVOICE_API_PORT ?? '8787').trim();
  const port = portRaw || '8787';
  const ip = getFirstLanIPv4();
  return ip ? `http://${ip}:${port}` : '';
}

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  expo: {
    name: 'InnerVoice',
    slug: 'innervoice',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/innervoice-logo.png',
    scheme: 'innervoice',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    splash: {
      image: './assets/innervoice-logo.png',
      resizeMode: 'contain',
      backgroundColor: '#EEF0FF',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.innervoice.app',
      infoPlist: {
        NSMicrophoneUsageDescription:
          'InnerVoice records your voice for therapeutic voice features during the session.',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/innervoice-logo.png',
        backgroundColor: '#EEF0FF',
      },
      package: 'com.innervoice.app',
      permissions: ['android.permission.RECORD_AUDIO'],
    },
    plugins: [
      'expo-router',
      'expo-audio',
      'expo-asset',
      'expo-document-picker',
      [
        'react-native-audio-api',
        {
          iosMicrophonePermission:
            'InnerVoice records your voice for therapeutic voice features during the session.',
          iosBackgroundMode: false,
          androidForegroundService: false,
          androidPermissions: ['android.permission.RECORD_AUDIO'],
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: { origin: false },
      voiceProvider: process.env.VOICE_PROVIDER ?? 'mistral',
      mistralApiKey: process.env.MISTRAL_API_KEY ?? '',
      mistralAgentVoiceId: process.env.MISTRAL_AGENT_VOICE_ID ?? '',
      mistralDefaultAgentVoiceId: process.env.MISTRAL_DEFAULT_AGENT_VOICE_ID ?? 'gb_jane_neutral',
      mistralInnervoiceSimulatedVoiceId: process.env.MISTRAL_INNERVOICE_SIMULATED_VOICE_ID ?? 'gb_jane_neutral',
      mistralTtsModel: process.env.MISTRAL_TTS_MODEL ?? '',
      mistralSttModel: process.env.MISTRAL_STT_MODEL ?? '',
      mistralChatModel: process.env.MISTRAL_CHAT_MODEL ?? '',
      elevenlabsApiKey: process.env.ELEVENLABS_API_KEY ?? '',
      elevenlabsModelId: process.env.ELEVENLABS_MODEL_ID ?? 'eleven_multilingual_v2',
      elevenlabsAgentVoiceId: process.env.ELEVENLABS_AGENT_VOICE_ID ?? '',
      debugMistral: process.env.EXPO_PUBLIC_DEBUG_MISTRAL === '1',
      refAudioConvertUrl: process.env.EXPO_PUBLIC_REF_AUDIO_CONVERT_URL ?? '',
      refAudioConvertSecret: process.env.EXPO_PUBLIC_REF_AUDIO_CONVERT_SECRET ?? '',
      innervoiceApiUrl: resolveInnervoiceApiUrl(),
      innervoiceApiSecret: process.env.EXPO_PUBLIC_INNERVOICE_API_SECRET ?? '',
    },
  },
};
