import GoogleDriveService from './googleDrive';
// Позже добавим другие сервисы
// import DropboxService from './dropbox';
// import YandexDiskService from './yandexDisk';

class CloudManager {
  constructor() {
    this.connectedServices = new Map(); // ID сервиса -> экземпляр
    this.services = {
      'google_drive': GoogleDriveService,
      // 'dropbox': DropboxService,
      // 'yandex_disk': YandexDiskService,
    };
  }

  // Подключение сервиса
  async connectService(serviceId) {
    try {
      const service = this.services[serviceId];
      if (!service) {
        throw new Error(`Service ${serviceId} not supported`);
      }

      const isConnected = await service.authenticate();
      if (isConnected) {
        this.connectedServices.set(serviceId, service);
        await this.saveToStorage(serviceId);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Connect ${serviceId} error:`, error);
      return false;
    }
  }

  // Получение списка всех файлов со всех облаков
  async getAllFiles() {
    const allFiles = [];
    
    for (const [serviceId, service] of this.connectedServices) {
      try {
        const files = await service.getFiles();
        const filesWithService = files.map(file => ({
          ...file,
          service: serviceId,
          serviceName: this.getServiceName(serviceId)
        }));
        allFiles.push(...filesWithService);
      } catch (error) {
        console.error(`Get files from ${serviceId} error:`, error);
      }
    }

    return allFiles;
  }

  // Получение общей статистики по хранилищам
  async getTotalStorageInfo() {
    let totalUsed = 0;
    let totalAvailable = 0;
    const servicesInfo = [];

    for (const [serviceId, service] of this.connectedServices) {
      try {
        const info = await service.getStorageInfo();
        servicesInfo.push({
          service: serviceId,
          serviceName: this.getServiceName(serviceId),
          used: info.used,
          total: info.total,
          available: info.available
        });
        
        // Парсим GB для подсчета общего объема
        totalUsed += this.parseGBString(info.used);
        totalAvailable += this.parseGBString(info.total);
      } catch (error) {
        console.error(`Get storage from ${serviceId} error:`, error);
      }
    }

    return {
      total: {
        used: totalUsed.toFixed(2) + ' GB',
        total: totalAvailable.toFixed(2) + ' GB',
        usedPercent: ((totalUsed / totalAvailable) * 100).toFixed(1)
      },
      services: servicesInfo
    };
  }

  // Удаление файла в конкретном облаке
  async deleteFile(fileId, serviceId) {
    const service = this.connectedServices.get(serviceId);
    if (!service) {
      throw new Error(`Service ${serviceId} not connected`);
    }
    
    return await service.deleteFile(fileId);
  }

  // Вспомогательные методы
  getServiceName(serviceId) {
    const names = {
      'google_drive': 'Google Drive',
      'dropbox': 'Dropbox',
      'yandex_disk': 'Яндекс Диск',
      'onedrive': 'OneDrive'
    };
    return names[serviceId] || serviceId;
  }

  parseGBString(gbString) {
    return parseFloat(gbString) || 0;
  }

  async saveToStorage(serviceId) {
    // Сохраняем информацию о подключенных сервисах в AsyncStorage
    const connected = Array.from(this.connectedServices.keys());
    // Здесь будет логика сохранения
  }

  async loadFromStorage() {
    // Загружаем подключенные сервисы при старте приложения
    // Здесь будет логика загрузки
  }
}

export default new CloudManager();
