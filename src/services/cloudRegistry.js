// Реестр ВСЕХ поддерживаемых облаков
export const CLOUD_REGISTRY = {
  // 🔹 Популярные международные
  'google_drive': {
    name: 'Google Drive',
    logo: 'google-drive',
    authType: 'oauth2',
    supported: true
  },
  'dropbox': {
    name: 'Dropbox', 
    logo: 'dropbox',
    authType: 'oauth2',
    supported: true
  },
  'onedrive': {
    name: 'OneDrive',
    logo: 'microsoft-onedrive',
    authType: 'oauth2', 
    supported: true
  },
  'mega': {
    name: 'MEGA',
    logo: 'mega',
    authType: 'oauth2',
    supported: true
  },
  'terabox': {
    name: 'TeraBox',
    logo: 'terabox', 
    authType: 'oauth2',
    supported: true
  },
  'box': {
    name: 'Box',
    logo: 'box',
    authType: 'oauth2',
    supported: true
  },
  'pcloud': {
    name: 'pCloud',
    logo: 'pcloud',
    authType: 'oauth2',
    supported: true
  },

  // 🔹 Российские
  'yandex_disk': {
    name: 'Яндекс Диск',
    logo: 'yandex-disk',
    authType: 'oauth2',
    supported: true
  },
  'mail_ru': {
    name: 'Облако Mail.ru',
    logo: 'mail-ru',
    authType: 'oauth2',
    supported: true
  },
  'sber_disk': {
    name: 'СберДиск',
    logo: 'sber-disk',
    authType: 'oauth2',
    supported: true
  },
  'mts_cloud': {
    name: 'МТС Облако',
    logo: 'mts',
    authType: 'oauth2',
    supported: true
  },
  'beeline_cloud': {
    name: 'Облако Билайн', 
    logo: 'beeline',
    authType: 'oauth2',
    supported: true
  },

  // 🔹 Специализированные
  'icloud': {
    name: 'iCloud Drive',
    logo: 'icloud',
    authType: 'apple',
    supported: false // сложно для Android
  },
  'nextcloud': {
    name: 'NextCloud',
    logo: 'nextcloud',
    authType: 'webdav',
    supported: true
  },
  'owncloud': {
    name: 'ownCloud',
    logo: 'owncloud',
    authType: 'webdav',
    supported: true
  },

  // 🔹 Социальные и другие
  'vk_workdisk': {
    name: 'VK WorkDisk',
    logo: 'vk',
    authType: 'oauth2',
    supported: true
  },
  'mediafire': {
    name: 'MediaFire',
    logo: 'mediafire',
    authType: 'oauth2',
    supported: true
  },
  'degoo': {
    name: 'Degoo',
    logo: 'degoo',
    authType: 'oauth2',
    supported: true
  }
};

// Классификация по категориям
export const CLOUD_CATEGORIES = {
  popular: ['google_drive', 'dropbox', 'onedrive', 'yandex_disk', 'mail_ru'],
  russian: ['yandex_disk', 'mail_ru', 'sber_disk', 'mts_cloud', 'beeline_cloud'],
  international: ['google_drive', 'dropbox', 'onedrive', 'mega', 'terabox', 'box', 'pcloud'],
  self_hosted: ['nextcloud', 'owncloud'],
  other: ['mediafire', 'degoo', 'vk_workdisk']
};
