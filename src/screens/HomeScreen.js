import React, { useState, useEffect } from 'react';
import { ScrollView, View, Alert } from 'react-native';
import { Title, FAB, ActivityIndicator, Text } from 'react-native-paper';
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
  {
    id: 'mail_ru',
    name: 'Облако Mail.ru',
    connected: false,
    usedSpace: '0 GB',
    totalSpace: '0 GB',
  },
  {
    id: 'terabox',
    name: 'TeraBox',
    connected: false,
    usedSpace: '0 GB',
    totalSpace: '0 GB',
  },
  {
    id: 'onedrive',
    name: 'OneDrive',
    connected: false,
    usedSpace: '0 GB',
    totalSpace: '0 GB',
  },
];

export default function HomeScreen({ navigation }) {
  const [services, setServices] = useState(AVAILABLE_SERVICES);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadConnectedServices();
  }, []);

  const loadConnectedServices = async () => {
    setRefreshing(true);
    try {
      // Здесь будет логика загрузки реальных данных о подключенных сервисах
      // Пока используем заглушку
      const storageInfo = await CloudManager.getTotalStorageInfo();
      
      // Обновляем статусы сервисов на основе реальных данных
      setServices(prevServices => 
        prevServices.map(service => {
          const serviceInfo = storageInfo.services.find(s => s.service === service.id);
          if (serviceInfo) {
            return {
              ...service,
              connected: true,
              usedSpace: serviceInfo.used,
              totalSpace: serviceInfo.total
            };
          }
          return service;
        })
      );
    } catch (error) {
      console.error('Load connected services error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleConnectService = async (serviceId) => {
    setLoading(true);
    try {
      const success = await CloudManager.connectService(serviceId);
      if (success) {
        Alert.alert('Успех!', `${getServiceName(serviceId)} подключен`);
        // Обновляем статус сервиса
        updateServiceStatus(serviceId, true);
        
        // Загружаем актуальную информацию о хранилище
        setTimeout(() => {
          loadConnectedServices();
        }, 1000);
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
    navigation.navigate('FileManager', { serviceId });
  };

  const updateServiceStatus = (serviceId, connected) => {
    setServices(prev => prev.map(service => 
      service.id === serviceId 
        ? { ...service, connected }
        : service
    ));
  };

  const getServiceName = (serviceId) => {
    const service = AVAILABLE_SERVICES.find(s => s.id === serviceId);
    return service ? service.name : serviceId;
  };

  const handleAddCloud = () => {
    navigation.navigate('AddCloud');
  };

  if (loading) {
    return (
      <View style={[globalStyles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 10 }}>Подключение к облаку...</Text>
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
        
        {services.filter(s => s.connected).length === 0 && (
          <View style={{ alignItems: 'center', marginTop: 50, padding: 20 }}>
            <Text style={{ textAlign: 'center', fontSize: 16, color: '#666' }}>
              Подключите ваше первое облачное хранилище{'\n'}
              чтобы начать работу с Nimbus
            </Text>
          </View>
        )}
      </ScrollView>
      
      {/* Кнопка добавления нового облака */}
      <FAB
        style={{
          position: 'absolute',
          margin: 16,
          right: 0,
          bottom: 0,
          backgroundColor: '#4285F4',
        }}
        icon="plus"
        onPress={handleAddCloud}
        color="white"
      />
      
      {/* Кнопка обновления списка */}
      <FAB
        style={{
          position: 'absolute',
          margin: 16,
          right: 0,
          bottom: 70,
          backgroundColor: '#34A853',
        }}
        icon="refresh"
        onPress={loadConnectedServices}
        color="white"
        small
        loading={refreshing}
      />
    </>
  );
}
