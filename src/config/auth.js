// Конфигурация OAuth для Google Drive
// ЗАМЕНИТЕ 'ВАШ_CLIENT_ID' на ваш настоящий Client ID из Google Cloud Console

export const GOOGLE_DRIVE_CONFIG = {
  clientId: 'ВАШ_CLIENT_ID', // ← ЗАМЕНИТЕ ЭТО
  clientSecret: 'ВАШ_CLIENT_SECRET', // ← И ЭТО ТОЖЕ
  scopes: [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.file',
  ],
};

// Redirect URI для Expo
export const REDIRECT_CONFIG = {
  useProxy: true,
};
