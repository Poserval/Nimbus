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
          <Button onPress={() => onConnect(service.id)}>Подключить</Button>
        ) : (
          <Button onPress={() => onManage(service.id)}>Управлять</Button>
        )}
      </Card.Actions>
    </Card>
  );
};

export default CloudService;
