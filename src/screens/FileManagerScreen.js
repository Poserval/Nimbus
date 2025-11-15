import React, { useState, useEffect } from 'react';
import { View, FlatList, Alert } from 'react-native';
import { Searchbar, List, Title, Button, ActivityIndicator } from 'react-native-paper';
import { globalStyles } from '../styles/globalStyles';
import CloudManager from '../services/cloudManager';

export default function FileManagerScreen({ route, navigation }) {
  const { serviceId } = route.params;
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadFiles();
  }, [serviceId]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const fileList = await CloudManager.getFilesFromService(serviceId);
      setFiles(fileList);
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось загрузить файлы');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFile = async (fileId, fileName) => {
    Alert.alert(
      'Удалить файл',
      `Вы уверены, что хотите удалить "${fileName}"?`,
      [
        { text: 'Отмена', style: 'cancel' },
        { 
          text: 'Удалить', 
          style: 'destructive',
          onPress: async () => {
            try {
              await CloudManager.deleteFile(fileId, serviceId);
              loadFiles(); // Перезагружаем список
              Alert.alert('Успех', 'Файл удален');
            } catch (error) {
              Alert.alert('Ошибка', 'Не удалось удалить файл');
            }
          }
        }
      ]
    );
  };

  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <View style={[globalStyles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={globalStyles.container}>
      <Title>Файлы в {serviceId}</Title>
      
      <Searchbar
        placeholder="Поиск файлов..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={{ marginBottom: 15 }}
      />

      <FlatList
        data={filteredFiles}
        keyExtractor={(item) => `${item.service}-${item.id}`}
        renderItem={({ item }) => (
          <List.Item
            title={item.name}
            description={`${item.size} • ${new Date(item.modified).toLocaleDateString()}`}
            left={props => <List.Icon {...props} icon={item.type.includes('folder') ? 'folder' : 'file'} />}
            right={props => (
              <Button 
                mode="text" 
                icon="delete" 
                onPress={() => handleDeleteFile(item.id, item.name)}
              >
                Удалить
              </Button>
            )}
          />
        )}
      />

      <Button 
        mode="contained" 
        onPress={loadFiles}
        style={{ marginTop: 10 }}
      >
        Обновить
      </Button>
    </View>
  );
}
