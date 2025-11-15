import React, { useState, useEffect } from 'react';
import { ScrollView, Alert } from 'react-native';
import { Title, FAB, ActivityIndicator } from 'react-native-paper';
import { globalStyles } from '../styles/globalStyles';
import CloudService from '../components/CloudService';
import CloudManager from '../services/cloudManager';

const AVAILABLE_SERVICES = [
  {
    id: 'google_drive',
    name: 'Google Drive',
    connected: false,
    usedSpace: '0 GB',
    totalSpace: '0 GB',
  },
  {
    id: 'dropbox', 
    name: 'Dropbox',
    connected: false,
    usedSpace: '0 GB',
    totalSpace: '0 GB',
  },
  {
    id: 'yandex_disk',
    name: 'Яндекс Диск',
    connected: false,
    usedSpace: '0 GB', 
    totalSpace: '0 GB',
  },
];

export default function HomeScreen({ navigation }) {
  const [services, setServices] = useState(AVAILABLE_SERVICES);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadConnectedServices();
  }, []);

  const loadConnectedServices = async () => {
    // Позже добавим загрузку из хранилища
  };

  const handleConnectService = async (serviceId) => {
    setLoading(true);
    try {
      const success = await CloudManager.connectService(serviceId);
      if (success) {
        Alert.alert('Успех!', `${serviceId} подключен`);
        // Обновляем статус сервиса
        updateServiceStatus(serviceId, true);
      } else {
        Alert.alert('Ошибка', 'Не удалось подключить сервис');
      }
    } catch (error) {
      Alert.alert('Ошибка', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleManageService = (serviceId) => {
    navigation.navigate('Files', { serviceId });
  };

  const updateServiceStatus = (serviceId, connected) => {
    setServices(prev => prev.map(service => 
      service.id === serviceId 
        ? { ...service, connected }
        : service
    ));
  };

  if (loading) {
    return (
      <View style={globalStyles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

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
      
      <FAB
        style={{
          position: 'absolute',
          margin: 16,
          right: 0,
          bottom: 0,
        }}
        icon="refresh"
        onPress={loadConnectedServices}
      />
    </>
  );
}
