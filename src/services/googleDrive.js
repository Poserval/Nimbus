import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import axios from 'axios';

// Настройки Google OAuth (эти данные нужно будет получить в Google Cloud Console)
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID';
const GOOGLE_CLIENT_SECRET = 'YOUR_GOOGLE_CLIENT_SECRET';
const REDIRECT_URI = AuthSession.makeRedirectUri({ useProxy: true });

const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
];

export class GoogleDriveService {
  constructor() {
    this.accessToken = null;
    this.userInfo = null;
  }

  // Авторизация через Google
  async authenticate() {
    try {
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${GOOGLE_CLIENT_ID}` +
        `&redirect_uri=${REDIRECT_URI}` +
        `&response_type=code` +
        `&scope=${SCOPES.join(' ')}` +
        `&access_type=offline`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URI);
      
      if (result.type === 'success') {
        const { code } = result.params;
        await this.exchangeCodeForToken(code);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Google Drive auth error:', error);
      return false;
    }
  }

  // Обмен кода на access token
  async exchangeCodeForToken(code) {
    try {
      const response = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      });

      this.accessToken = response.data.access_token;
      return this.accessToken;
    } catch (error) {
      console.error('Token exchange error:', error);
      throw error;
    }
  }

  // Получение информации о хранилище
  async getStorageInfo() {
    try {
      const response = await axios.get(
        'https://www.googleapis.com/drive/v3/about?fields=storageQuota',
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      const quota = response.data.storageQuota;
      return {
        used: this.bytesToGB(quota.usage),
        total: this.bytesToGB(quota.limit),
        available: this.bytesToGB(quota.limit - quota.usage),
      };
    } catch (error) {
      console.error('Get storage info error:', error);
      throw error;
    }
  }

  // Получение списка файлов
  async getFiles() {
    try {
      const response = await axios.get(
        'https://www.googleapis.com/drive/v3/files?fields=files(id,name,size,mimeType,modifiedTime)',
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      return response.data.files.map(file => ({
        id: file.id,
        name: file.name,
        size: file.size ? this.bytesToMB(file.size) : '0 MB',
        type: file.mimeType,
        modified: file.modifiedTime,
        service: 'google_drive',
      }));
    } catch (error) {
      console.error('Get files error:', error);
      throw error;
    }
  }

  // Удаление файла
  async deleteFile(fileId) {
    try {
      await axios.delete(
        `https://www.googleapis.com/drive/v3/files/${fileId}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );
      return true;
    } catch (error) {
      console.error('Delete file error:', error);
      throw error;
    }
  }

  // Вспомогательные функции
  bytesToGB(bytes) {
    return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  }

  bytesToMB(bytes) {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  }

  // Выход из системы
  logout() {
    this.accessToken = null;
    this.userInfo = null;
  }
}

export default new GoogleDriveService();
