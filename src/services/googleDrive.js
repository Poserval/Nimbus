import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import axios from 'axios';
import { GOOGLE_DRIVE_CONFIG, REDIRECT_CONFIG } from '../config/auth';

// Создаем redirect URI
const redirectUri = AuthSession.makeRedirectUri(REDIRECT_CONFIG);

export class GoogleDriveService {
  constructor() {
    this.accessToken = null;
    this.refreshToken = null;
    this.userInfo = null;
  }

  // Авторизация через Google
  async authenticate() {
    try {
      console.log('Starting Google Drive authentication...');
      console.log('Client ID:', GOOGLE_DRIVE_CONFIG.clientId);
      console.log('Redirect URI:', redirectUri);

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${GOOGLE_DRIVE_CONFIG.clientId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(GOOGLE_DRIVE_CONFIG.scopes.join(' '))}` +
        `&access_type=offline` +
        `&prompt=consent`;

      console.log('Opening browser for authentication...');
      
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
      
      console.log('Authentication result:', result);

      if (result.type === 'success' && result.url) {
        console.log('Parsing authorization code from URL...');
        const urlParams = new URLSearchParams(result.url.split('?')[1]);
        const code = urlParams.get('code');
        
        if (code) {
          console.log('Authorization code received, exchanging for token...');
          await this.exchangeCodeForToken(code);
          return true;
        } else {
          console.log('No authorization code found in URL');
        }
      } else {
        console.log('Authentication failed or was cancelled');
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
      console.log('Exchanging code for token...');
      
      const tokenResponse = await axios.post(
        'https://oauth2.googleapis.com/token',
        {
          client_id: GOOGLE_DRIVE_CONFIG.clientId,
          client_secret: GOOGLE_DRIVE_CONFIG.clientSecret,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      this.accessToken = tokenResponse.data.access_token;
      this.refreshToken = tokenResponse.data.refresh_token;
      
      console.log('Token exchange successful!');
      console.log('Access Token:', this.accessToken ? 'Received' : 'Missing');
      console.log('Refresh Token:', this.refreshToken ? 'Received' : 'Missing');
      
      return this.accessToken;
    } catch (error) {
      console.error('Token exchange error:');
      console.error('Status:', error.response?.status);
      console.error('Data:', error.response?.data);
      console.error('Message:', error.message);
      throw error;
    }
  }

  // Получение информации о хранилище
  async getStorageInfo() {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      console.log('Fetching storage info...');
      
      const response = await axios.get(
        'https://www.googleapis.com/drive/v3/about?fields=storageQuota',
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      const quota = response.data.storageQuota;
      const storageInfo = {
        used: this.bytesToGB(quota.usage),
        total: this.bytesToGB(quota.limit),
        available: this.bytesToGB(quota.limit - quota.usage),
      };
      
      console.log('Storage info:', storageInfo);
      return storageInfo;
    } catch (error) {
      console.error('Get storage info error:');
      console.error('Status:', error.response?.status);
      console.error('Data:', error.response?.data);
      throw error;
    }
  }

  // Получение списка файлов
  async getFiles() {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      console.log('Fetching files list...');
      
      const response = await axios.get(
        'https://www.googleapis.com/drive/v3/files?fields=files(id,name,size,mimeType,modifiedTime)',
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      const files = response.data.files.map(file => ({
        id: file.id,
        name: file.name,
        size: file.size ? this.bytesToMB(file.size) : '0 MB',
        type: file.mimeType,
        modified: file.modifiedTime,
        service: 'google_drive',
      }));
      
      console.log(`Retrieved ${files.length} files`);
      return files;
    } catch (error) {
      console.error('Get files error:');
      console.error('Status:', error.response?.status);
      console.error('Data:', error.response?.data);
      throw error;
    }
  }

  // Удаление файла
  async deleteFile(fileId) {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      console.log(`Deleting file ${fileId}...`);
      
      await axios.delete(
        `https://www.googleapis.com/drive/v3/files/${fileId}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );
      
      console.log('File deleted successfully');
      return true;
    } catch (error) {
      console.error('Delete file error:');
      console.error('Status:', error.response?.status);
      console.error('Data:', error.response?.data);
      throw error;
    }
  }

  // Вспомогательные функции
  bytesToGB(bytes) {
    if (!bytes) return '0 GB';
    return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  }

  bytesToMB(bytes) {
    if (!bytes) return '0 MB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  }

  // Проверка авторизации
  isAuthenticated() {
    return !!this.accessToken;
  }

  // Выход из системы
  logout() {
    this.accessToken = null;
    this.refreshToken = null;
    this.userInfo = null;
    console.log('Logged out from Google Drive');
  }
}

export default new GoogleDriveService();
