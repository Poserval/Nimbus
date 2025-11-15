// Добавь эти методы в класс CloudManager:

// Получение файлов из конкретного сервиса
async getFilesFromService(serviceId) {
  try {
    const service = this.connectedServices.get(serviceId);
    if (!service) {
      throw new Error(`Сервис ${serviceId} не подключен`);
    }
    
    const files = await service.getFiles();
    return files.map(file => ({
      ...file,
      service: serviceId,
      serviceName: this.getServiceName(serviceId)
    }));
  } catch (error) {
    console.error(`Get files from ${serviceId} error:`, error);
    throw error;
  }
}

// Удаление файла из конкретного сервиса
async deleteFileFromService(fileId, serviceId) {
  try {
    const service = this.connectedServices.get(serviceId);
    if (!service) {
      throw new Error(`Сервис ${serviceId} не подключен`);
    }
    
    const result = await service.deleteFile(fileId);
    return result;
  } catch (error) {
    console.error(`Delete file from ${serviceId} error:`, error);
    throw error;
  }
}

// Получение информации о конкретном сервисе
async getServiceInfo(serviceId) {
  try {
    const service = this.connectedServices.get(serviceId);
    if (!service) {
      throw new Error(`Сервис ${serviceId} не подключен`);
    }
    
    const storageInfo = await service.getStorageInfo();
    return {
      service: serviceId,
      serviceName: this.getServiceName(serviceId),
      ...storageInfo
    };
  } catch (error) {
    console.error(`Get service info from ${serviceId} error:`, error);
    throw error;
  }
}
