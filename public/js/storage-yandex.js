// ========== ЯНДЕКС.ДИСК СПЕЦИФИЧНЫЕ ФУНКЦИИ ==========

// Хранилище размеров папок и количества файлов
if (!window.yandexFolderSizes) window.yandexFolderSizes = {};
if (!window.yandexFolderFileCounts) window.yandexFolderFileCounts = {};

// Базовый URL API Яндекс.Диска
const YANDEX_API_URL = 'https://cloud-api.yandex.net/v1/disk';

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

// Нормализация пути (убирает префикс disk:, двойные слеши)
function normalizeYandexPath(path) {
    if (!path) return '/';
    let normalized = path;
    if (normalized.startsWith('disk:')) {
        normalized = normalized.substring(5);
    }
    normalized = normalized.replace(/\/+/g, '/');
    if (normalized !== '/' && normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
    }
    if (!normalized.startsWith('/')) {
        normalized = '/' + normalized;
    }
    return normalized;
}

function getParentYandexPath(fullPath) {
    if (!fullPath || fullPath === '/') return '/';
    const normalized = normalizeYandexPath(fullPath);
    const lastSlash = normalized.lastIndexOf('/');
    if (lastSlash <= 0) return '/';
    return normalized.substring(0, lastSlash);
}

function getNameFromYandexPath(fullPath) {
    if (!fullPath || fullPath === '/') return '';
    const normalized = normalizeYandexPath(fullPath);
    const lastSlash = normalized.lastIndexOf('/');
    return normalized.substring(lastSlash + 1);
}

// ========== ОСНОВНЫЕ ФУНКЦИИ ==========

// Получение списка файлов в папке
async function getItems(folderPath = '/') {
    let all = [];
    let limit = 100;
    let offset = 0;
    const normalizedPath = normalizeYandexPath(folderPath);
    
    try {
        while (true) {
            let url = `${YANDEX_API_URL}/resources?path=${encodeURIComponent(normalizedPath)}&limit=${limit}&offset=${offset}&fields=_embedded.items,name,path,created,modified,size,mime_type,type,resource_id`;
            
            let response = await fetch(url, {
                headers: { 'Authorization': `OAuth ${accessToken}` }
            });
            
            if (response.status === 401) {
                const newToken = await refreshAccessToken();
                if (newToken) {
                    accessToken = newToken;
                    response = await fetch(url, {
                        headers: { 'Authorization': `OAuth ${accessToken}` }
                    });
                } else {
                    throw new Error('Token expired');
                }
            }
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data._embedded && data._embedded.items) {
                const items = data._embedded.items.map(item => {
                    let cleanPath = item.path || '';
                    if (cleanPath.startsWith('disk:')) {
                        cleanPath = cleanPath.substring(5);
                    }
                    if (!cleanPath.startsWith('/')) {
                        cleanPath = '/' + cleanPath;
                    }
                    
                    return {
                        id: item.resource_id,
                        name: item.name,
                        size: item.size || 0,
                        mimeType: item.mime_type || (item.type === 'dir' ? 'application/vnd.yandex.folder' : 'application/octet-stream'),
                        createdTime: item.created,
                        modifiedTime: item.modified,
                        path: cleanPath,
                        type: item.type
                    };
                });
                all = all.concat(items);
            }
            
            if (data._embedded && data._embedded.items && data._embedded.items.length === limit) {
                offset += limit;
            } else {
                break;
            }
        }
    } catch (err) {
        console.error('Yandex API Error:', err);
        throw err;
    }
    
    return all;
}

// Получение удалённых файлов (корзина)
async function getTrashFiles() {
    let all = [];
    let limit = 100;
    let offset = 0;
    
    try {
        while (true) {
            let url = `${YANDEX_API_URL}/trash/resources?limit=${limit}&offset=${offset}&fields=items,name,path,created,modified,size,mime_type,type,resource_id`;
            
            let response = await fetch(url, {
                headers: { 'Authorization': `OAuth ${accessToken}` }
            });
            
            if (response.status === 401) {
                const newToken = await refreshAccessToken();
                if (newToken) {
                    accessToken = newToken;
                    response = await fetch(url, {
                        headers: { 'Authorization': `OAuth ${accessToken}` }
                    });
                } else {
                    throw new Error('Token expired');
                }
            }
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            
            if (data.items && data.items.length > 0) {
                const items = data.items.map(item => {
                    let cleanPath = item.path || '';
                    if (cleanPath.startsWith('disk:')) {
                        cleanPath = cleanPath.substring(5);
                    }
                    if (!cleanPath.startsWith('/')) {
                        cleanPath = '/' + cleanPath;
                    }
                    
                    return {
                        id: item.resource_id,
                        name: item.name,
                        size: item.size || 0,
                        mimeType: item.mime_type || (item.type === 'dir' ? 'application/vnd.yandex.folder' : 'application/octet-stream'),
                        createdTime: item.created,
                        modifiedTime: item.modified,
                        path: cleanPath,
                        type: item.type
                    };
                });
                all = all.concat(items);
            }
            
            if (data.items && data.items.length === limit) {
                offset += limit;
            } else {
                break;
            }
        }
    } catch (err) {
        console.error('Yandex API Error:', err);
        throw err;
    }
    
    return all;
}

// Получение размера папки (рекурсивно)
async function getFolderSize(folderPath) {
    let totalSize = 0;
    let limit = 100;
    let offset = 0;
    const normalizedPath = normalizeYandexPath(folderPath);
    
    try {
        while (true) {
            let url = `${YANDEX_API_URL}/resources?path=${encodeURIComponent(normalizedPath)}&limit=${limit}&offset=${offset}&fields=_embedded.items.size,_embedded.items.type,_embedded.items.resource_id`;
            
            let response = await fetch(url, {
                headers: { 'Authorization': `OAuth ${accessToken}` }
            });
            
            if (response.status === 401) {
                const newToken = await refreshAccessToken();
                if (newToken) {
                    accessToken = newToken;
                    response = await fetch(url, {
                        headers: { 'Authorization': `OAuth ${accessToken}` }
                    });
                } else {
                    throw new Error('Token expired');
                }
            }
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            
            if (data._embedded && data._embedded.items) {
                for (const item of data._embedded.items) {
                    if (item.type === 'dir') {
                        totalSize += await getFolderSize(`${normalizedPath}/${item.name}`);
                    } else {
                        totalSize += item.size || 0;
                    }
                }
            }
            
            if (data._embedded && data._embedded.items && data._embedded.items.length === limit) {
                offset += limit;
            } else {
                break;
            }
        }
    } catch (err) {
        console.error('Yandex API Error:', err);
    }
    
    return totalSize;
}

// Получение количества файлов в папке
async function getFolderFileCount(folderPath) {
    let fileCount = 0;
    let limit = 100;
    let offset = 0;
    const normalizedPath = normalizeYandexPath(folderPath);
    
    try {
        while (true) {
            let url = `${YANDEX_API_URL}/resources?path=${encodeURIComponent(normalizedPath)}&limit=${limit}&offset=${offset}&fields=_embedded.items.type`;
            
            let response = await fetch(url, {
                headers: { 'Authorization': `OAuth ${accessToken}` }
            });
            
            if (response.status === 401) {
                const newToken = await refreshAccessToken();
                if (newToken) {
                    accessToken = newToken;
                    response = await fetch(url, {
                        headers: { 'Authorization': `OAuth ${accessToken}` }
                    });
                } else {
                    throw new Error('Token expired');
                }
            }
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            
            if (data._embedded && data._embedded.items) {
                for (const item of data._embedded.items) {
                    if (item.type !== 'dir') {
                        fileCount++;
                    }
                }
            }
            
            if (data._embedded && data._embedded.items && data._embedded.items.length === limit) {
                offset += limit;
            } else {
                break;
            }
        }
    } catch (err) {
        console.error('Yandex API Error:', err);
    }
    
    return fileCount;
}

// ========== ОПЕРАЦИИ С ФАЙЛАМИ ==========

// Восстановление файла из корзины
async function restoreFile(fileId) {
    const item = window.trashFiles?.find(i => i.id === fileId);
    if (!item) {
        console.error('File not found in trash:', fileId);
        return false;
    }
    const cleanPath = normalizeYandexPath(item.path);
    try {
        let response = await fetch(`${YANDEX_API_URL}/trash/resources/${encodeURIComponent(cleanPath)}/restore`, {
            method: 'PUT',
            headers: { 'Authorization': `OAuth ${accessToken}` }
        });
        
        if (response.status === 401) {
            const newToken = await refreshAccessToken();
            if (newToken) {
                accessToken = newToken;
                response = await fetch(`${YANDEX_API_URL}/trash/resources/${encodeURIComponent(cleanPath)}/restore`, {
                    method: 'PUT',
                    headers: { 'Authorization': `OAuth ${accessToken}` }
                });
            } else {
                throw new Error('Token expired');
            }
        }
        
        return response.ok;
    } catch (err) {
        console.error('Restore error:', err);
        throw err;
    }
}

// Полное удаление файла
async function permanentDeleteFile(fileId) {
    const item = window.trashFiles?.find(i => i.id === fileId);
    if (!item) {
        console.error('File not found in trash:', fileId);
        return false;
    }
    const cleanPath = normalizeYandexPath(item.path);
    try {
        let response = await fetch(`${YANDEX_API_URL}/trash/resources/${encodeURIComponent(cleanPath)}`, {
            method: 'DELETE',
            headers: { 'Authorization': `OAuth ${accessToken}` }
        });
        
        if (response.status === 401) {
            const newToken = await refreshAccessToken();
            if (newToken) {
                accessToken = newToken;
                response = await fetch(`${YANDEX_API_URL}/trash/resources/${encodeURIComponent(cleanPath)}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `OAuth ${accessToken}` }
                });
            } else {
                throw new Error('Token expired');
            }
        }
        
        return response.ok;
    } catch (err) {
        console.error('Permanent delete error:', err);
        throw err;
    }
}

// Перемещение в корзину
async function moveToTrash(itemId) {
    const item = window.allItems?.find(i => i.id === itemId);
    if (!item) {
        console.error('Item not found:', itemId);
        return false;
    }
    const cleanPath = normalizeYandexPath(item.path);
    try {
        if (!cleanPath || cleanPath === '/') {
            console.error('Cannot move root to trash');
            return false;
        }
        
        let response = await fetch(`${YANDEX_API_URL}/resources/${encodeURIComponent(cleanPath)}?force_async=false&permanently=false`, {
            method: 'DELETE',
            headers: { 'Authorization': `OAuth ${accessToken}` }
        });
        
        if (response.status === 401) {
            const newToken = await refreshAccessToken();
            if (newToken) {
                accessToken = newToken;
                response = await fetch(`${YANDEX_API_URL}/resources/${encodeURIComponent(cleanPath)}?force_async=false&permanently=false`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `OAuth ${accessToken}` }
                });
            } else {
                throw new Error('Token expired');
            }
        }
        
        if (response.status === 404) {
            console.warn('File not found:', cleanPath);
            return false;
        }
        
        return response.ok;
    } catch (err) {
        console.error('Move to trash error:', err);
        throw err;
    }
}

// Переименование (через перемещение)
async function renameItem(itemId, oldFullName, newNameWithoutExt, isFolder) {
    const item = window.allItems?.find(i => i.id === itemId);
    if (!item) {
        console.error('Item not found:', itemId);
        return false;
    }
    
    let newFullName;
    if (isFolder) {
        newFullName = newNameWithoutExt;
    } else {
        const lastDot = oldFullName.lastIndexOf('.');
        const ext = lastDot !== -1 ? oldFullName.substring(lastDot) : '';
        newFullName = newNameWithoutExt + ext;
    }
    
    try {
        const cleanOldPath = normalizeYandexPath(item.path);
        const parentPath = getParentYandexPath(cleanOldPath);
        
        let newPath;
        if (parentPath === '/') {
            newPath = `/${newFullName}`;
        } else {
            newPath = `${parentPath}/${newFullName}`;
        }
        newPath = normalizeYandexPath(newPath);
        
        let checkResponse = await fetch(`${YANDEX_API_URL}/resources?path=${encodeURIComponent(newPath)}`, {
            headers: { 'Authorization': `OAuth ${accessToken}` }
        });
        
        if (checkResponse.status === 200) {
            throw new Error(`Файл с именем "${newFullName}" уже существует`);
        }
        
        let response = await fetch(`${YANDEX_API_URL}/resources/move`, {
            method: 'POST',
            headers: {
                'Authorization': `OAuth ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: cleanOldPath,
                path: newPath,
                overwrite: false
            })
        });
        
        if (response.status === 401) {
            const newToken = await refreshAccessToken();
            if (newToken) {
                accessToken = newToken;
                response = await fetch(`${YANDEX_API_URL}/resources/move`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `OAuth ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        from: cleanOldPath,
                        path: newPath,
                        overwrite: false
                    })
                });
            } else {
                throw new Error('Token expired');
            }
        }
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP ${response.status}`);
        }
        
        return true;
    } catch (err) {
        console.error('Rename error:', err);
        throw err;
    }
}

// Копирование файла
async function copyFile(fileId, fileName) {
    const item = window.allItems?.find(i => i.id === fileId);
    if (!item) {
        console.error('Item not found:', fileId);
        return false;
    }
    
    try {
        const lastDot = fileName.lastIndexOf('.');
        const name = lastDot !== -1 ? fileName.substring(0, lastDot) : fileName;
        const ext = lastDot !== -1 ? fileName.substring(lastDot) : '';
        const newName = name + ' (Копия)' + ext;
        const cleanOldPath = normalizeYandexPath(item.path);
        const parentPath = getParentYandexPath(cleanOldPath);
        
        let newPath;
        if (parentPath === '/') {
            newPath = `/${newName}`;
        } else {
            newPath = `${parentPath}/${newName}`;
        }
        newPath = normalizeYandexPath(newPath);
        
        let checkResponse = await fetch(`${YANDEX_API_URL}/resources?path=${encodeURIComponent(newPath)}`, {
            headers: { 'Authorization': `OAuth ${accessToken}` }
        });
        
        if (checkResponse.status === 200) {
            let counter = 1;
            let uniqueName;
            do {
                uniqueName = name + ` (Копия ${counter})` + ext;
                if (parentPath === '/') {
                    newPath = `/${uniqueName}`;
                } else {
                    newPath = `${parentPath}/${uniqueName}`;
                }
                newPath = normalizeYandexPath(newPath);
                checkResponse = await fetch(`${YANDEX_API_URL}/resources?path=${encodeURIComponent(newPath)}`, {
                    headers: { 'Authorization': `OAuth ${accessToken}` }
                });
                counter++;
            } while (checkResponse.status === 200);
        }
        
        let response = await fetch(`${YANDEX_API_URL}/resources/copy`, {
            method: 'POST',
            headers: {
                'Authorization': `OAuth ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: cleanOldPath,
                path: newPath,
                overwrite: false
            })
        });
        
        if (response.status === 401) {
            const newToken = await refreshAccessToken();
            if (newToken) {
                accessToken = newToken;
                response = await fetch(`${YANDEX_API_URL}/resources/copy`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `OAuth ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        from: cleanOldPath,
                        path: newPath,
                        overwrite: false
                    })
                });
            }
        }
        
        return response.ok;
    } catch (err) {
        console.error('Copy error:', err);
        throw err;
    }
}

// Получение ссылки на файл
async function getFileLink(fileId) {
    const item = window.allItems?.find(i => i.id === fileId);
    if (!item) {
        throw new Error('Файл не найден');
    }
    const cleanPath = normalizeYandexPath(item.path);
    try {
        let response = await fetch(`${YANDEX_API_URL}/resources/download?path=${encodeURIComponent(cleanPath)}`, {
            headers: { 'Authorization': `OAuth ${accessToken}` }
        });
        
        if (response.status === 401) {
            const newToken = await refreshAccessToken();
            if (newToken) {
                accessToken = newToken;
                response = await fetch(`${YANDEX_API_URL}/resources/download?path=${encodeURIComponent(cleanPath)}`, {
                    headers: { 'Authorization': `OAuth ${accessToken}` }
                });
            } else {
                throw new Error('Token expired');
            }
        }
        
        const data = await response.json();
        return data.href;
    } catch (err) {
        console.error('Get link error:', err);
        throw err;
    }
}

// Загрузка файла
async function uploadFile(file, parentFolderId = currentFolderId) {
    try {
        const normalizedParent = normalizeYandexPath(parentFolderId || '/');
        const targetPath = normalizedParent === '/' ? `/${file.name}` : `${normalizedParent}/${file.name}`;
        const encodedPath = encodeURIComponent(targetPath);
        
        let uploadUrlResponse = await fetch(`${YANDEX_API_URL}/resources/upload?path=${encodedPath}&overwrite=true`, {
            method: 'GET',
            headers: { 'Authorization': `OAuth ${accessToken}` }
        });
        
        if (uploadUrlResponse.status === 401) {
            const newToken = await refreshAccessToken();
            if (newToken) {
                accessToken = newToken;
                uploadUrlResponse = await fetch(`${YANDEX_API_URL}/resources/upload?path=${encodedPath}&overwrite=true`, {
                    method: 'GET',
                    headers: { 'Authorization': `OAuth ${accessToken}` }
                });
            } else {
                throw new Error('Token expired');
            }
        }
        
        const uploadData = await uploadUrlResponse.json();
        const uploadUrl = uploadData.href;
        
        let uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            body: file
        });
        
        return uploadResponse.ok;
    } catch (err) {
        console.error('Upload error:', err);
        throw err;
    }
}

// Создание папки
async function createFolder(folderName, parentFolderId = currentFolderId) {
    try {
        const normalizedParent = normalizeYandexPath(parentFolderId || '/');
        let newPath;
        if (normalizedParent === '/') {
            newPath = `/${folderName}`;
        } else {
            newPath = `${normalizedParent}/${folderName}`;
        }
        newPath = normalizeYandexPath(newPath);
        
        let checkResponse = await fetch(`${YANDEX_API_URL}/resources?path=${encodeURIComponent(newPath)}`, {
            headers: { 'Authorization': `OAuth ${accessToken}` }
        });
        
        if (checkResponse.status === 200) {
            throw new Error(`Папка с именем "${folderName}" уже существует`);
        }
        
        let response = await fetch(`${YANDEX_API_URL}/resources?path=${encodeURIComponent(newPath)}`, {
            method: 'PUT',
            headers: { 'Authorization': `OAuth ${accessToken}` }
        });
        
        if (response.status === 401) {
            const newToken = await refreshAccessToken();
            if (newToken) {
                accessToken = newToken;
                response = await fetch(`${YANDEX_API_URL}/resources?path=${encodeURIComponent(newPath)}`, {
                    method: 'PUT',
                    headers: { 'Authorization': `OAuth ${accessToken}` }
                });
            } else {
                throw new Error('Token expired');
            }
        }
        
        return response.ok;
    } catch (err) {
        console.error('Create folder error:', err);
        throw err;
    }
}

// Скачивание файла
async function downloadFile(fileId, fileName) {
    const item = window.allItems?.find(i => i.id === fileId);
    if (!item) {
        throw new Error('Файл не найден');
    }
    const cleanPath = normalizeYandexPath(item.path);
    try {
        let response = await fetch(`${YANDEX_API_URL}/resources/download?path=${encodeURIComponent(cleanPath)}`, {
            headers: { 'Authorization': `OAuth ${accessToken}` }
        });
        
        if (response.status === 401) {
            const newToken = await refreshAccessToken();
            if (newToken) {
                accessToken = newToken;
                response = await fetch(`${YANDEX_API_URL}/resources/download?path=${encodeURIComponent(cleanPath)}`, {
                    headers: { 'Authorization': `OAuth ${accessToken}` }
                });
            } else {
                throw new Error('Token expired');
            }
        }
        
        const data = await response.json();
        const downloadUrl = data.href;
        
        const downloadResponse = await fetch(downloadUrl);
        const blob = await downloadResponse.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        return true;
    } catch (err) {
        console.error('Download error:', err);
        throw err;
    }
}

// Скачивание файла как Blob
async function downloadFileAsBlob(fileId) {
    const item = window.allItems?.find(i => i.id === fileId);
    if (!item) {
        throw new Error('Файл не найден');
    }
    const cleanPath = normalizeYandexPath(item.path);
    
    // Получаем прямую ссылку от Яндекс
    const response = await fetch(`${YANDEX_API_URL}/resources/download?path=${encodeURIComponent(cleanPath)}`, {
        headers: { 'Authorization': `OAuth ${accessToken}` }
    });
    const data = await response.json();
    const directUrl = data.href;
    
    // Скачиваем через свой прокси (обходим CORS)
    const proxyUrl = `/fetch-file?url=${encodeURIComponent(directUrl)}`;
    const proxyResponse = await fetch(proxyUrl);
    
    if (!proxyResponse.ok) {
        throw new Error(`Failed to download via proxy: ${proxyResponse.status}`);
    }
    
    return await proxyResponse.blob();
}

async function downloadFileAsBlobWithCancel(fileId, signal) {
    const item = window.allItems?.find(i => i.id === fileId);
    if (!item) {
        throw new Error('Файл не найден');
    }
    const cleanPath = normalizeYandexPath(item.path);
    
    const response = await fetch(`${YANDEX_API_URL}/resources/download?path=${encodeURIComponent(cleanPath)}`, {
        headers: { 'Authorization': `OAuth ${accessToken}` },
        signal: signal
    });
    const data = await response.json();
    const directUrl = data.href;
    
    const proxyUrl = `/fetch-file?url=${encodeURIComponent(directUrl)}`;
    const proxyResponse = await fetch(proxyUrl, { signal: signal });
    
    if (!proxyResponse.ok) {
        throw new Error(`Failed to download via proxy: ${proxyResponse.status}`);
    }
    
    return await proxyResponse.blob();
}

// ========== ИНФОРМАЦИЯ О ХРАНИЛИЩЕ ==========

async function getYandexStorageInfo() {
    try {
        let response = await fetch(`${YANDEX_API_URL}/`, {
            headers: { 'Authorization': `OAuth ${accessToken}` }
        });
        
        if (response.status === 401) {
            const newToken = await refreshAccessToken();
            if (newToken) {
                accessToken = newToken;
                response = await fetch(`${YANDEX_API_URL}/`, {
                    headers: { 'Authorization': `OAuth ${accessToken}` }
                });
            } else {
                throw new Error('Token expired');
            }
        }
        
        const data = await response.json();
        const usedBytes = data.used_space || 0;
        const totalBytes = data.total_space || (15 * 1024 * 1024 * 1024);
        const usedGB = usedBytes / (1024 * 1024 * 1024);
        const percent = (usedBytes / totalBytes) * 100;
        
        return { usedBytes, usedGB, percent, totalBytes };
    } catch (err) {
        console.error('Storage info error:', err);
        return null;
    }
}

async function updateStats() {
    if (isTrashMode) return;
    try {
        const info = await getYandexStorageInfo();
        if (info) {
            usedBytes = info.usedBytes;
            const usedGB = info.usedGB;
            const percent = (usedGB / limitGB) * 100;
            const percentFormatted = percent.toFixed(1);
            
            document.getElementById('usedValue').innerHTML = `${usedGB.toFixed(2)} ГБ`;
            const percentElem = document.getElementById('percentValue');
            percentElem.innerHTML = `${percentFormatted}%`;
            const bgColor = getColorForPercent(Math.min(100, percent));
            percentElem.style.backgroundColor = bgColor;
            percentElem.style.color = percent > 50 ? 'white' : '#1a237e';
            
            return info;
        }
        return null;
    } catch (err) {
        console.error(err);
        document.getElementById('usedValue').innerHTML = '— ГБ';
        document.getElementById('percentValue').innerHTML = '—%';
        return null;
    }
}

async function refreshAccessToken() {
    try {
        const accounts = JSON.parse(localStorage.getItem('nimbus_accounts') || '[]');
        const account = accounts.find(acc => acc.email === email && acc.service === 'yandex');
        if (!account || !account.refreshToken) return null;
        
        const response = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                refresh_token: account.refreshToken, 
                grant_type: 'refresh_token',
                service: 'yandex'
            })
        });
        const data = await response.json();
        if (data.access_token) {
            account.accessToken = data.access_token;
            localStorage.setItem('nimbus_accounts', JSON.stringify(accounts));
            return data.access_token;
        }
        return null;
    } catch (err) {
        console.error('Refresh error:', err);
        return null;
    }
}

// ========== ОСНОВНАЯ ФУНКЦИЯ ЗАГРУЗКИ ==========

async function loadItems() {
    const container = document.getElementById('filesContainer');
    container.innerHTML = '<div class="loading">Загрузка...</div>';
    try {
        window.allItems = await getItems(currentFolderId);
        
        window.yandexFolderFileCounts = {};
        for (const item of window.allItems) {
            if (item.mimeType === 'application/vnd.yandex.folder') {
                const fileCount = await getFolderFileCount(item.path);
                window.yandexFolderFileCounts[item.id] = fileCount;
                const folderSize = await getFolderSize(item.path);
                window.yandexFolderSizes[item.id] = folderSize;
            }
        }
        
        if (typeof renderItemsList === 'function') {
            renderItemsList(window.allItems);
        }
        await updateStats();
        console.log(`Загружено элементов: ${window.allItems.length}`);
    } catch (err) {
        console.error(err);
        if (err.message === 'Token expired') {
            alert('Сессия истекла. Пожалуйста, переподключите аккаунт.');
            let accounts = JSON.parse(localStorage.getItem('nimbus_accounts') || '[]');
            accounts = accounts.filter(acc => acc.email !== email);
            localStorage.setItem('nimbus_accounts', JSON.stringify(accounts));
            window.location.href = 'index.html';
        } else {
            container.innerHTML = `<div class="loading">Ошибка загрузки: ${err.message}</div>`;
        }
    }
}

async function showTrashMode() {
    isTrashMode = true;
    document.getElementById('trashBadge').style.display = 'inline-block';
    if (document.getElementById('headerCenter')) {
        document.getElementById('headerCenter').classList.add('trash-mode');
    }
    
    const container = document.getElementById('filesContainer');
    container.innerHTML = '<div class="loading">Загрузка корзины...</div>';
    
    try {
        window.trashFiles = await getTrashFiles();
        if (typeof renderTrashList === 'function') {
            renderTrashList();
        } else {
            container.innerHTML = '<div class="loading">Функция корзины загружается...</div>';
        }
    } catch (err) {
        container.innerHTML = `<div class="loading">Ошибка загрузки корзины: ${err.message}</div>`;
    }
}

// ========== АЛИАСЫ ДЛЯ СОВМЕСТИМОСТИ С storage-core-yandex.js ==========

// Оригинальные функции (короткие имена)
window.loadItems = loadItems;
window.showTrashMode = showTrashMode;
window.getItems = getItems;
window.getTrashFiles = getTrashFiles;
window.getFolderSize = getFolderSize;
window.getFolderFileCount = getFolderFileCount;
window.restoreFile = restoreFile;
window.permanentDeleteFile = permanentDeleteFile;
window.moveToTrash = moveToTrash;
window.renameItem = renameItem;
window.copyFile = copyFile;
window.uploadFile = uploadFile;
window.createFolder = createFolder;
window.downloadFile = downloadFile;
window.downloadFileAsBlob = downloadFileAsBlob;
window.getFileLink = getFileLink;
window.refreshAccessToken = refreshAccessToken;
window.updateStats = updateStats;

// Алиасы для Яндекс-специфичных имён (которые вызывает storage-core-yandex.js)
window.loadYandexItems = loadItems;
window.showYandexTrashMode = showTrashMode;
window.getYandexItems = getItems;
window.getYandexTrashFiles = getTrashFiles;
window.getYandexFolderSize = getFolderSize;
window.getYandexFolderFileCount = getFolderFileCount;
window.restoreYandexFile = restoreFile;
window.permanentDeleteYandexFile = permanentDeleteFile;
window.moveToYandexTrash = moveToTrash;
window.renameYandexItem = renameItem;
window.copyYandexFile = copyFile;
window.uploadYandexFile = uploadFile;
window.createYandexFolder = createFolder;
window.downloadYandexFile = downloadFile;
window.downloadYandexFileAsBlob = downloadFileAsBlob;
window.getYandexFileLink = getFileLink;
window.refreshYandexToken = refreshAccessToken;
window.updateYandexStats = updateStats;

console.log('Yandex API functions loaded with aliases for compatibility');
