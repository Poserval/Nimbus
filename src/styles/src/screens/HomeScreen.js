import React, { useState, useEffect } from 'react';
import { ScrollView } from 'react-native';
import { Title, FAB } from 'react-native-paper';
import { globalStyles } from '../styles/globalStyles';
import CloudService from '../components/CloudService';

// Это временные мок-данные. Позже мы заменим их реальными данными из API.
const mockCloudServices = [
  {
    id: 1,
    name: 'Google Drive',
    connected: true,
    usedSpace: '15.2 GB',
    totalSpace: '100 GB',
    icon: 'google-drive', // Это потребует настройки иконок
  },
  {
    id: 2,
    name: 'Dropbox',
    connected: false,
    usedSpace: '0 GB',
    totalSpace: '0 GB',
    icon: 'dropbox', // Это потребует настройки иконок
  },
  {
    id: 3,
    name: 'OneDrive',
    connected: false,
    usedSpace: '0 GB',
    totalSpace: '0 GB',
    icon: 'microsoft-onedrive',
  },
];

export default function HomeScreen() {
  const [services, setServices] = useState(mockCloudServices);

  // Здесь позже будет функция для загрузки реальных данных
  useEffect(() => {
    // loadCloudServices();
  }, []);

  const handleConnectService = (serviceId) => {
    console.log('Connect to service:', serviceId);
    // Здесь будет логика авторизации
  };

  const handleManageService = (serviceId) => {
    console.log('Manage service:', serviceId);
    // Здесь будет навигация на экран управления файлами
  };

  return (
    <>
      <ScrollView style={globalStyles.container}>
        <Title style={globalStyles.title}>Мои Облака</Title>
        {services.map((service) => (
          <CloudService
            key={service.id}
            service={service}
            onConnect={handleConnectService}
            onManage={handleManageService}
          />
        ))}
      </ScrollView>
      {/* Кнопка для добавления нового сервиса */}
      <FAB
        style={{
          position: 'absolute',
          margin: 16,
          right: 0,
          bottom: 0,
        }}
        icon="plus"
        onPress={() => console.log('Add new service')}
      />
    </>
  );
}
