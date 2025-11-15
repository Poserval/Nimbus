import { CLOUD_REGISTRY } from './cloudRegistry';
import GoogleDriveService from './googleDrive';
// Импортируем другие сервисы по мере создания
// import DropboxService from './dropbox';
// import MailRuService from './mailru';
// import TeraBoxService from './terabox';

class CloudManager {
  constructor() {
    this.connectedServices = new Map();
    this.serviceInstances = new Map();
    
    // Динамическая загрузка сервисов
    this.initializeServices();
  }

  initializeServices() {
    // Здесь будем подгружать сервисы по мере их реализации
    this.serviceInstances.set('google_drive', GoogleDriveService);
    
    // Заглушки для остальных сервисов
    Object.keys(CLOUD_REGISTRY).forEach(serviceId => {
      if (!this.serviceInstances.has(serviceId)) {
        this.serviceInstances.set(serviceId, this.createStubService(serviceId));
      }
    });
  }

  createStubService(serviceId) {
    return {
      authenticate: async () => {
        throw new Error(`Сервис ${CLOUD_REGISTRY[serviceId].name} в разработке`);
      },
      getFiles: async () => [],
      getStorageInfo: async () => ({
        used: '0 GB',
        total: '0 GB',
        available: '0 GB'
      })
    };
  }

  // Получаем ВСЕ доступные облака
  getAllAvailableServices() {
    return Object.entries(CLOUD_REGISTRY).map(([id, config]) => ({
      id,
      name: config.name,
      logo: config.logo,
      supported: config.supported,
      authType: config.authType,
      connected: this.connectedServices.has(id)
    }));
  }

  // Получаем облака по категориям
  getServicesByCategory() {
    const categories = {};
    const services = this.getAllAvailableServices();
    
    services.forEach(service => {
      if (!categories[service.category]) {
        categories[service.category] = [];
      }
      categories[service.category].push(service);
    });
    
    return categories;
  }
}

export default new CloudManager();
