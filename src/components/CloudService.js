import React from 'react';
import { Card, Button, Paragraph } from 'react-native-paper';
import { globalStyles } from '../styles/globalStyles';

const CloudService = ({ service, onConnect, onManage }) => {
  return (
    <Card style={globalStyles.card}>
      <Card.Content>
        <Paragraph style={globalStyles.serviceName}>{service.name}</Paragraph>
        <Paragraph style={globalStyles.storageInfo}>
          {service.usedSpace} / {service.totalSpace}
        </Paragraph>
      </Card.Content>
      <Card.Actions>
        {!service.connected ? (
          <Button 
            mode="contained" 
            onPress={() => onConnect(service.id)}
            buttonColor="#4285F4"
            textColor="white"
          >
            Подключить
          </Button>
        ) : (
          <Button 
            mode="outlined" 
            onPress={() => onManage(service.id)}
            textColor="#34A853"
          >
            Управлять
          </Button>
        )}
      </Card.Actions>
    </Card>
  );
};

export default CloudService;
