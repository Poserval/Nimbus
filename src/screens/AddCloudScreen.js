import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from '../screens/HomeScreen';
import AddCloudScreen from '../screens/AddCloudScreen';

const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen 
          name="Home" 
          component={HomeScreen}
          options={{ title: 'Nimbus - Ваши облака' }}
        />
        <Stack.Screen 
          name="AddCloud" 
          component={AddCloudScreen}
          options={{ title: 'Добавить облако' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
