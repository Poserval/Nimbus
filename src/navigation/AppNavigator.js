import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from '../screens/HomeScreen';
import AddCloudScreen from '../screens/AddCloudScreen';
import FileManagerScreen from '../screens/FileManagerScreen';

const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Home"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#4285F4',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen 
          name="Home" 
          component={HomeScreen}
          options={{ 
            title: 'Nimbus - Ваши облака',
            headerStyle: {
              backgroundColor: '#6200ee',
            },
          }}
        />
        <Stack.Screen 
          name="AddCloud" 
          component={AddCloudScreen}
          options={{ 
            title: 'Добавить облако',
            headerStyle: {
              backgroundColor: '#4285F4',
            },
          }}
        />
        <Stack.Screen 
          name="FileManager" 
          component={FileManagerScreen}
          options={({ route }) => ({ 
            title: `Файлы - ${getServiceTitle(route.params?.serviceId)}`,
            headerStyle: {
              backgroundColor: '#34A853',
            },
          })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Вспомогательная функция для заголовка
function getServiceTitle(serviceId) {
  const titles = {
    'google_drive': 'Google Drive',
    'dropbox': 'Dropbox', 
    'yandex_disk': 'Яндекс Диск',
    'mail_ru': 'Облако Mail.ru',
    'terabox': 'TeraBox',
    'onedrive': 'OneDrive'
  };
  return titles[serviceId] || 'Облако';
}
