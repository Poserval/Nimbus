// ========== ФУНКЦИИ ДЛЯ ПЕРЕМЕЩЕНИЯ МЕЖДУ ОБЛАКАМИ ==========

let pendingMoveTarget = null;
let pendingMoveTargetToken = null;
let pendingMoveItemId = null;
let pendingMoveItemName = null;
let pendingMoveItemIsFolder = false;
let pendingMoveItemSize = 0;
let pendingMoveFolderId = null; // 'root' для Google, '/' для Яндекс
let pendingMoveSourceService = null;
let currentFolders = [];

// ========== УНИВЕРСАЛЬНЫЕ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

// Определение сервиса текущего облака по глобальным переменным
function getCurrentService() {
    if (typeof window.currentService !== 'undefined') {
        return window.currentService;
    }
    if (typeof getYandexItems === 'function') {
        return 'yandex';
    }
    return 'google';
}

// Универсальная функция загрузки папок для целевого облака
async function loadFoldersForTarget(targetToken, targetService) {
    if (targetService === 'google') {
        try {
            const response = await fetch('https://www.googleapis.com/drive/v3/files?fields=files(id,name,mimeType)&q=mimeType=\'application/vnd.google-apps.folder\' and trashed=false', {
                headers: { 'Authorization': `Bearer ${targetToken}` }
            });
            const data = await response.json();
            return data.files || [];
        } catch (err) {
            console.error('Load Google folders error:', err);
            return [];
        }
    } else if (targetService === 'yandex') {
        try {
            let all = [];
            let limit = 100;
            let offset = 0;
            const YANDEX_API_URL = 'https://cloud-api.yandex.net/v1/disk';
            
            while (true) {
                let url = `${YANDEX_API_URL}/resources?path=${encodeURIComponent('/')}&limit=${limit}&offset=${offset}&fields=_embedded.items.name,_embedded.items.path,_embedded.items.type,_embedded.items.resource_id`;
                
                let response = await fetch(url, {
                    headers: { 'Authorization': `OAuth ${targetToken}` }
                });
                
                if (response.status === 401) {
                    const newToken = await refreshTargetToken('yandex', targetToken);
                    if (newToken) {
                        targetToken = newToken;
                        response = await fetch(url, {
                            headers: { 'Authorization': `OAuth ${targetToken}` }
                        });
                    }
                }
                
                if (!response.ok) break;
                
                const data = await response.json();
                if (data._embedded && data._embedded.items) {
                    for (const item of data._embedded.items) {
                        if (item.type === 'dir') {
                            all.push({
                                id: item.resource_id,
                                name: item.name,
                                path: item.path
                            });
                        }
                    }
                }
                
                if (data._embedded && data._embedded.items && data._embedded.items.length === limit) {
                    offset += limit;
                } else {
                    break;
                }
            }
            return all;
        } catch (err) {
            console.error('Load Yandex folders error:', err);
            return [];
        }
    }
    return [];
}

// Универсальная функция создания папки в целевом облаке
async function createFolderInTarget(targetToken, folderName, parentId, targetService) {
    if (targetService === 'google') {
        try {
            const metadata = {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
                parents: parentId === 'root' ? [] : [parentId]
            };
            const response = await fetch('https://www.googleapis.com/drive/v3/files', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${targetToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(metadata)
            });
            const data = await response.json();
            return data.id;
        } catch (err) {
            console.error('Create folder in Google error:', err);
            throw err;
        }
    } else if (targetService === 'yandex') {
        try {
            const parentPath = (parentId === '/' || parentId === 'root') ? '/' : parentId;
            const newPath = parentPath === '/' ? `/${folderName}` : `${parentPath}/${folderName}`;
            
            let response = await fetch(`https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(newPath)}`, {
                method: 'PUT',
                headers: { 'Authorization': `OAuth ${targetToken}` }
            });
            
            if (response.status === 401) {
                const newToken = await refreshTargetToken('yandex', targetToken);
                if (newToken) {
                    targetToken = newToken;
                    response = await fetch(`https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(newPath)}`, {
                        method: 'PUT',
                        headers: { 'Authorization': `OAuth ${targetToken}` }
                    });
                }
            }
            
            const data = await response.json();
            return data.resource_id || data.id;
        } catch (err) {
            console.error('Create folder in Yandex error:', err);
            throw err;
        }
    }
    throw new Error('Unknown service');
}

// Обновление токена целевого облака
async function refreshTargetToken(service, oldToken) {
    try {
        const accounts = JSON.parse(localStorage.getItem('nimbus_accounts') || '[]');
        const account = accounts.find(acc => acc.accessToken === oldToken && acc.service === service);
        if (!account || !account.refreshToken) return null;
        
        const response = await fetch('http://localhost:3000/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                refresh_token: account.refreshToken, 
                grant_type: 'refresh_token',
                service: service
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
        console.error('Refresh target token error:', err);
        return null;
    }
}

// ========== ФУНКЦИИ ДЛЯ ЗАГРУЗКИ ФАЙЛОВ ИЗ ИСХОДНОГО ОБЛАКА ==========

// Универсальная загрузка файла как Blob из исходного облака
async function downloadSourceFileAsBlob(sourceService, sourceToken, itemId, itemPath) {
    console.log('[downloadSourceFileAsBlob] Called:', { sourceService, itemId, itemPath });
    
    if (sourceService === 'google') {
        let response = await fetch(`https://www.googleapis.com/drive/v3/files/${itemId}?alt=media`, {
            headers: { 'Authorization': `Bearer ${sourceToken}` }
        });
        
        if (response.status === 401) {
            const newToken = await refreshSourceToken('google', sourceToken);
            if (newToken) {
                sourceToken = newToken;
                response = await fetch(`https://www.googleapis.com/drive/v3/files/${itemId}?alt=media`, {
                    headers: { 'Authorization': `Bearer ${sourceToken}` }
                });
            } else {
                throw new Error('Token expired');
            }
        }
        
        return await response.blob();
        
    } else if (sourceService === 'yandex') {
        // ПОЛУЧАЕМ ССЫЛКУ НА СКАЧИВАНИЕ
        let downloadUrlResponse = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/download?path=${encodeURIComponent(itemPath)}`, {
            headers: { 'Authorization': `OAuth ${sourceToken}` }
        });
        
        if (downloadUrlResponse.status === 401) {
            const newToken = await refreshSourceToken('yandex', sourceToken);
            if (newToken) {
                sourceToken = newToken;
                downloadUrlResponse = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/download?path=${encodeURIComponent(itemPath)}`, {
                    headers: { 'Authorization': `OAuth ${sourceToken}` }
                });
            } else {
                throw new Error('Token expired');
            }
        }
        
        const downloadData = await downloadUrlResponse.json();
        const directUrl = downloadData.href;
        
        // СКАЧИВАЕМ ФАЙЛ ЧЕРЕЗ ПРОКСИ (обходим CORS)
        const proxyUrl = `/fetch-file?url=${encodeURIComponent(directUrl)}`;
        const proxyResponse = await fetch(proxyUrl);
        
        if (!proxyResponse.ok) {
            throw new Error(`Failed to download via proxy: ${proxyResponse.status}`);
        }
        
        return await proxyResponse.blob();
        
    } else {
        throw new Error('Unknown source service');
    }
}

// Обновление токена исходного облака
async function refreshSourceToken(service, oldToken) {
    try {
        const accounts = JSON.parse(localStorage.getItem('nimbus_accounts') || '[]');
        const account = accounts.find(acc => acc.accessToken === oldToken && acc.service === service);
        if (!account || !account.refreshToken) return null;
        
        const response = await fetch('http://localhost:3000/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                refresh_token: account.refreshToken, 
                grant_type: 'refresh_token',
                service: service
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
        console.error('Refresh source token error:', err);
        return null;
    }
}

// ========== ОСНОВНАЯ ФУНКЦИЯ ПЕРЕМЕЩЕНИЯ (С ПРОГРЕССОМ) ==========

async function moveItemToFolder(targetToken, targetFolderId, sourceItemId, sourceItemName, sourceItemPath, isFolder, totalSize, updateProgress, sourceService, targetService) {
    console.log('moveItemToFolder called:', { targetToken, targetFolderId, sourceItemId, sourceItemName, sourceItemPath, isFolder, sourceService, targetService });
    
    // Определяем имя файла
    let fileName = sourceItemName;
    if (!fileName && sourceItemPath) {
        fileName = sourceItemPath.split('/').pop();
    }
    if (!fileName) {
        fileName = sourceItemId;
    }
    console.log('File name for upload:', fileName);
    
    try {
        if (!isFolder) {
            // Перемещение файла
            const fileBlob = await downloadSourceFileAsBlob(sourceService, accessToken, sourceItemId, sourceItemPath);
            
            if (targetService === 'google') {
                const metadata = {
                    name: fileName,  // ← ИСПОЛЬЗУЕМ fileName
                    parents: targetFolderId === 'root' ? [] : [targetFolderId]
                };
                
                const formData = new FormData();
                formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
                formData.append('file', fileBlob, fileName);
                
                // Используем XMLHttpRequest для отслеживания прогресса
                const uploadPromise = new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.upload.addEventListener('progress', (e) => {
                        if (e.lengthComputable && updateProgress) {
                            const percent = Math.round((e.loaded / e.total) * 100);
                            updateProgress(percent);
                        }
                    });
                    xhr.addEventListener('load', () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            try {
                                const result = JSON.parse(xhr.responseText);
                                resolve(result);
                            } catch (e) {
                                resolve({ id: true });
                            }
                        } else {
                            reject(new Error(`Upload to Google failed: ${xhr.status}`));
                        }
                    });
                    xhr.addEventListener('error', () => reject(new Error('Network error')));
                    xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart');
                    xhr.setRequestHeader('Authorization', `Bearer ${targetToken}`);
                    xhr.send(formData);
                });
                
                const result = await uploadPromise;
                const uploadSuccess = !!result.id;
                
                if (!uploadSuccess) {
                    throw new Error('Upload to Google failed');
                }
                
            } else if (targetService === 'yandex') {
                // Для Яндекс используем fileName
                let targetPath;
                if (targetFolderId === '/' || targetFolderId === 'root') {
                    targetPath = `disk:/${fileName}`;
                } else {
                    let cleanPath = targetFolderId.replace(/^disk:/, '');
                    if (!cleanPath.startsWith('/')) {
                        cleanPath = '/' + cleanPath;
                    }
                    targetPath = `disk:${cleanPath}/${fileName}`;
                }
                
                console.log('[Yandex Upload] Target path:', targetPath);
                
                let uploadUrlResponse = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/upload?path=${encodeURIComponent(targetPath)}&overwrite=true`, {
                    method: 'GET',
                    headers: { 'Authorization': `OAuth ${targetToken}` }
                });
                
                if (uploadUrlResponse.status === 401) {
                    const newToken = await refreshTargetToken('yandex', targetToken);
                    if (newToken) {
                        targetToken = newToken;
                        uploadUrlResponse = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/upload?path=${encodeURIComponent(targetPath)}&overwrite=true`, {
                            method: 'GET',
                            headers: { 'Authorization': `OAuth ${targetToken}` }
                        });
                    } else {
                        throw new Error('Token expired');
                    }
                }
                
                if (!uploadUrlResponse.ok) {
                    const errorText = await uploadUrlResponse.text();
                    console.error('[Yandex Upload] Failed to get upload URL:', errorText);
                    throw new Error(`Failed to get upload URL: ${uploadUrlResponse.status}`);
                }
                
                const uploadData = await uploadUrlResponse.json();
                const uploadUrl = uploadData.href;
                
                if (!uploadUrl) {
                    throw new Error('Upload URL is empty');
                }
                
                console.log('[Yandex Upload] Upload URL received, uploading...');
                
                // Используем XMLHttpRequest для отслеживания прогресса
                const uploadPromise = new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.upload.addEventListener('progress', (e) => {
                        if (e.lengthComputable && updateProgress) {
                            const percent = Math.round((e.loaded / e.total) * 100);
                            updateProgress(percent);
                        }
                    });
                    xhr.addEventListener('load', () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            resolve();
                        } else {
                            reject(new Error(`Upload to Yandex failed: ${xhr.status}`));
                        }
                    });
                    xhr.addEventListener('error', () => reject(new Error('Network error')));
                    xhr.open('PUT', uploadUrl);
                    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
                    xhr.send(fileBlob);
                });
                
                await uploadPromise;
                console.log('[Yandex Upload] File uploaded successfully');
            }
            
            // Удаляем исходный файл
            if (sourceService === 'google') {
                let deleteResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${sourceItemId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                
                if (deleteResponse.status === 401) {
                    const newToken = await refreshSourceToken('google', accessToken);
                    if (newToken) {
                        accessToken = newToken;
                        deleteResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${sourceItemId}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${accessToken}` }
                        });
                    }
                }
                
                if (!deleteResponse.ok) {
                    throw new Error('Delete from Google failed');
                }
            } else if (sourceService === 'yandex') {
                let deleteResponse = await fetch(`https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(sourceItemPath)}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `OAuth ${accessToken}` }
                });
                
                if (deleteResponse.status === 401) {
                    const newToken = await refreshSourceToken('yandex', accessToken);
                    if (newToken) {
                        accessToken = newToken;
                        deleteResponse = await fetch(`https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(sourceItemPath)}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `OAuth ${accessToken}` }
                        });
                    }
                }
                
                if (!deleteResponse.ok && deleteResponse.status !== 404) {
                    throw new Error('Delete from Yandex failed');
                }
            }
            
        } else {
            // Перемещение папки (рекурсивно)
            let newFolderId;
            let folderName = sourceItemPath ? sourceItemPath.split('/').pop() : sourceItemId;
            
            if (targetService === 'google') {
                const metadata = {
                    name: folderName,
                    mimeType: 'application/vnd.google-apps.folder',
                    parents: targetFolderId === 'root' ? [] : [targetFolderId]
                };
                
                let createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${targetToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(metadata)
                });
                
                if (createResponse.status === 401) {
                    const newToken = await refreshTargetToken('google', targetToken);
                    if (newToken) {
                        targetToken = newToken;
                        createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${targetToken}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(metadata)
                        });
                    }
                }
                
                const newFolder = await createResponse.json();
                newFolderId = newFolder.id;
            } else if (targetService === 'yandex') {
                let parentPath = targetFolderId;
                if (parentPath === 'root') parentPath = '/';
                if (!parentPath.startsWith('/')) parentPath = '/' + parentPath;
                
                const newPath = parentPath === '/' ? `/${folderName}` : `${parentPath}/${folderName}`;
                
                let createResponse = await fetch(`https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(newPath)}`, {
                    method: 'PUT',
                    headers: { 'Authorization': `OAuth ${targetToken}` }
                });
                
                if (createResponse.status === 401) {
                    const newToken = await refreshTargetToken('yandex', targetToken);
                    if (newToken) {
                        targetToken = newToken;
                        createResponse = await fetch(`https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(newPath)}`, {
                            method: 'PUT',
                            headers: { 'Authorization': `OAuth ${targetToken}` }
                        });
                    }
                }
                
                const data = await createResponse.json();
                newFolderId = data.resource_id || data.id;
            }
            
            // Получаем содержимое исходной папки
            let itemsInFolder = [];
            if (sourceService === 'google') {
                let response = await fetch(`https://www.googleapis.com/drive/v3/files?q='${sourceItemId}'+in+parents+and+trashed=false&fields=files(id,name,size,mimeType)`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                
                if (response.status === 401) {
                    const newToken = await refreshSourceToken('google', accessToken);
                    if (newToken) {
                        accessToken = newToken;
                        response = await fetch(`https://www.googleapis.com/drive/v3/files?q='${sourceItemId}'+in+parents+and+trashed=false&fields=files(id,name,size,mimeType)`, {
                            headers: { 'Authorization': `Bearer ${accessToken}` }
                        });
                    }
                }
                
                const data = await response.json();
                itemsInFolder = data.files || [];
            } else if (sourceService === 'yandex') {
                let response = await fetch(`https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(sourceItemPath)}&fields=_embedded.items.name,_embedded.items.path,_embedded.items.type,_embedded.items.resource_id,_embedded.items.size`, {
                    headers: { 'Authorization': `OAuth ${accessToken}` }
                });
                
                if (response.status === 401) {
                    const newToken = await refreshSourceToken('yandex', accessToken);
                    if (newToken) {
                        accessToken = newToken;
                        response = await fetch(`https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(sourceItemPath)}&fields=_embedded.items.name,_embedded.items.path,_embedded.items.type,_embedded.items.resource_id,_embedded.items.size`, {
                            headers: { 'Authorization': `OAuth ${accessToken}` }
                        });
                    }
                }
                
                const data = await response.json();
                if (data._embedded && data._embedded.items) {
                    itemsInFolder = data._embedded.items.map(item => ({
                        id: item.resource_id,
                        name: item.name,
                        size: item.size || 0,
                        mimeType: item.type === 'dir' ? 'application/vnd.google-apps.folder' : 'application/octet-stream',
                        path: item.path,
                        type: item.type
                    }));
                }
            }
            
            // Рекурсивно перемещаем каждый элемент
            for (const item of itemsInFolder) {
                const itemIsFolder = (sourceService === 'google') 
                    ? (item.mimeType === 'application/vnd.google-apps.folder')
                    : (item.type === 'dir');
                
                let itemPath = sourceService === 'yandex' ? item.path : null;
                let itemSize = parseInt(item.size) || 0;
                
                await moveItemToFolder(
                    targetToken, 
                    newFolderId, 
                    item.id, 
                    itemPath, 
                    itemIsFolder, 
                    itemSize, 
                    updateProgress, 
                    sourceService, 
                    targetService
                );
            }
            
            // Удаляем исходную папку
            if (sourceService === 'google') {
                let deleteResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${sourceItemId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                
                if (deleteResponse.status === 401) {
                    const newToken = await refreshSourceToken('google', accessToken);
                    if (newToken) {
                        accessToken = newToken;
                        deleteResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${sourceItemId}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${accessToken}` }
                        });
                    }
                }
                
                if (!deleteResponse.ok) {
                    throw new Error('Delete folder from Google failed');
                }
            } else if (sourceService === 'yandex') {
                let deleteResponse = await fetch(`https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(sourceItemPath)}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `OAuth ${accessToken}` }
                });
                
                if (deleteResponse.status === 401) {
                    const newToken = await refreshSourceToken('yandex', accessToken);
                    if (newToken) {
                        accessToken = newToken;
                        deleteResponse = await fetch(`https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(sourceItemPath)}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `OAuth ${accessToken}` }
                        });
                    }
                }
                
                if (!deleteResponse.ok && deleteResponse.status !== 404) {
                    throw new Error('Delete folder from Yandex failed');
                }
            }
        }
        
        return true;
    } catch (err) {
        console.error('Move error:', err);
        throw err;
    }
}

// ========== ФУНКЦИИ ДЛЯ ОТОБРАЖЕНИЯ МОДАЛЬНЫХ ОКОН ==========

function renderFolderSelect(folders, targetService) {
    const body = document.getElementById('folderSelectBody');
    currentFolders = folders;
    
    let html = '<div class="new-folder-input">';
    html += '<input type="text" id="newFolderNameInput" placeholder="Название новой папки">';
    html += '<button id="createNewFolderBtn">Создать</button>';
    html += '</div>';
    
    if (!folders || folders.length === 0) {
        html += '<div class="loading">Папки не найдены</div>';
    } else {
        folders.forEach(folder => {
            const folderValue = folder.path || folder.id;
            html += `
                <div class="folder-item" data-id="${folderValue}" data-path="${folderValue}">
                    <div class="folder-icon">📁</div>
                    <div class="folder-name">${escapeHtml(folder.name)}</div>
                </div>
            `;
        });
    }
    
    if (targetService === 'yandex') {
        html += `
            <div class="folder-item" data-id="/" data-path="/">
                <div class="folder-icon">📁</div>
                <div class="folder-name">Корень</div>
            </div>
        `;
    } else {
        html += `
            <div class="folder-item" data-id="root" data-path="root">
                <div class="folder-icon">📁</div>
                <div class="folder-name">Корень (Root)</div>
            </div>
        `;
    }
    
    body.innerHTML = html;
    
    document.querySelectorAll('.folder-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.folder-item').forEach(i => i.style.background = '');
            item.style.background = '#e8eaf6';
            const selectedValue = item.dataset.path || item.dataset.id;
            pendingMoveFolderId = selectedValue;
            console.log('Selected folder:', pendingMoveFolderId);
        });
    });
    
    const createBtn = document.getElementById('createNewFolderBtn');
    if (createBtn) {
        createBtn.onclick = async () => {
            const newFolderName = document.getElementById('newFolderNameInput').value.trim();
            if (!newFolderName) {
                alert('Введите название папки');
                return;
            }
            try {
                const newFolderId = await createFolderInTarget(pendingMoveTargetToken, newFolderName, pendingMoveFolderId, pendingMoveTarget.service);
                alert(`Папка "${newFolderName}" создана!`);
                const updatedFolders = await loadFoldersForTarget(pendingMoveTargetToken, pendingMoveTarget.service);
                renderFolderSelect(updatedFolders, pendingMoveTarget.service);
                setTimeout(() => {
                    const newFolderItem = document.querySelector(`.folder-item[data-id="${newFolderId}"]`);
                    if (newFolderItem) {
                        document.querySelectorAll('.folder-item').forEach(i => i.style.background = '');
                        newFolderItem.style.background = '#e8eaf6';
                        pendingMoveFolderId = newFolderId;
                    }
                }, 100);
            } catch (err) {
                alert('Ошибка создания папки: ' + err.message);
            }
        };
    }
}

function showShareCloudModal(itemId, itemName, isFolder, itemSize, itemPath, sourceService) {
    console.log('showShareCloudModal called:', { itemId, itemName, isFolder, itemSize, itemPath, sourceService });
    
    const allAccounts = JSON.parse(localStorage.getItem('nimbus_accounts') || '[]');
    const otherAccounts = allAccounts.filter(acc => acc.email !== email);
    
    if (otherAccounts.length === 0) {
        alert('Нет других подключенных облаков. Сначала подключите хотя бы одно другое облако.');
        return;
    }
    
    const container = document.getElementById('shareCloudsList');
    if (!container) {
        console.error('shareCloudsList element not found');
        return;
    }
    container.innerHTML = '';
    
    otherAccounts.forEach(acc => {
        const item = document.createElement('div');
        item.className = 'share-cloud-item';
        item.innerHTML = `
            <img src="assets/cloud-icon-${acc.service}.png" class="share-cloud-icon" alt="${acc.service}">
            <div class="share-cloud-info">
                <div class="share-cloud-name">${escapeHtml(acc.name)}</div>
                <div class="share-cloud-email">${escapeHtml(acc.email)}</div>
            </div>
        `;
        item.addEventListener('click', async () => {
            console.log('Selected target cloud:', acc);
            document.getElementById('shareCloudModal').style.display = 'none';
            pendingMoveTarget = acc;
            pendingMoveTargetToken = acc.accessToken;
            pendingMoveItemId = itemId;
            pendingMoveItemName = itemName;
            pendingMoveItemIsFolder = isFolder;
            pendingMoveItemSize = itemSize;
            pendingMoveFolderId = (acc.service === 'yandex') ? '/' : 'root';
            pendingMoveSourceService = sourceService;
            pendingMoveItemPath = itemPath;
            
            const folders = await loadFoldersForTarget(acc.accessToken, acc.service);
            console.log('Loaded folders:', folders);
            renderFolderSelect(folders, acc.service);
            document.getElementById('folderSelectModal').style.display = 'flex';
        });
        container.appendChild(item);
    });
    
    document.getElementById('shareCloudModal').style.display = 'flex';
}

// ========== ОБРАБОТЧИКИ ДЛЯ МОДАЛЬНЫХ ОКОН ==========

// Обработчик для кнопки "Поделиться" в хедере (универсальный)
function setupShareButton() {
    const shareBtn = document.getElementById('shareBtn');
    if (!shareBtn) return;
    
    shareBtn.onclick = () => {
        if (selectedFiles.size === 0) {
            alert('Выберите файлы или папки для перемещения');
            return;
        }
        
        const itemId = Array.from(selectedFiles)[0];
        const item = allItems.find(i => i.id === itemId);
        if (item) {
            let size = 0;
            let itemPath = null;
            let sourceService = getCurrentService();
            
            console.log('Source service detected:', sourceService);
            
            if (sourceService === 'yandex') {
                if (item.mimeType === 'application/vnd.yandex.folder' || item.type === 'dir') {
                    size = window.yandexFolderSizes?.[itemId] || 0;
                } else {
                    size = parseInt(item.size) || 0;
                }
                itemPath = item.path;
            } else {
                if (item.mimeType === 'application/vnd.google-apps.folder') {
                    size = window.folderSizes?.[itemId] || 0;
                } else {
                    size = parseInt(item.size) || 0;
                }
                itemPath = null;
            }
            
            showShareCloudModal(itemId, item.name, item.mimeType.includes('folder'), size, itemPath, sourceService);
        }
    };
}

// Обработчик для кнопки подтверждения перемещения
function setupFolderSelectConfirm() {
    const confirmBtn = document.getElementById('folderSelectConfirmBtn');
    if (!confirmBtn) return;
    
    confirmBtn.onclick = async () => {
        console.log('=== FOLDER SELECT CONFIRM START ===');
        console.log('pendingMoveTarget:', pendingMoveTarget);
        console.log('pendingMoveTargetToken:', pendingMoveTargetToken);
        console.log('pendingMoveItemId:', pendingMoveItemId);
        console.log('pendingMoveItemName:', pendingMoveItemName);
        console.log('pendingMoveItemIsFolder:', pendingMoveItemIsFolder);
        console.log('pendingMoveItemSize:', pendingMoveItemSize);
        console.log('pendingMoveFolderId:', pendingMoveFolderId);
        console.log('pendingMoveSourceService:', pendingMoveSourceService);
        console.log('pendingMoveItemPath:', pendingMoveItemPath);
        
        if (!pendingMoveTarget || !pendingMoveItemId) {
            alert('Ошибка: данные для перемещения не найдены');
            document.getElementById('folderSelectModal').style.display = 'none';
            return;
        }
        
        document.getElementById('folderSelectModal').style.display = 'none';
        
        const progressId = pendingMoveItemId;
        if (typeof activeProgress !== 'undefined') {
            activeProgress[progressId] = { type: 'move', percent: 0, totalSize: pendingMoveItemSize };
            if (typeof renderItemsList === 'function') {
                renderItemsList(allItems);
            }
        }
        
        try {
            await moveItemToFolder(
                pendingMoveTargetToken, 
                pendingMoveFolderId, 
                pendingMoveItemId, 
	pendingMoveItemName,  // ← ДОБАВИТЬ ЭТОТ ПАРАМЕТР
                pendingMoveItemPath, 
                pendingMoveItemIsFolder, 
                pendingMoveItemSize,
                (percent) => {
                    if (typeof activeProgress !== 'undefined' && activeProgress[progressId]) {
                        activeProgress[progressId].percent = percent;
                        if (typeof renderItemsList === 'function') {
                            renderItemsList(allItems);
                        }
                    }
                },
                pendingMoveSourceService,
                pendingMoveTarget.service
            );
            alert(`"${pendingMoveItemName}" успешно перемещён в облако "${pendingMoveTarget.name}"!`);
            if (typeof activeProgress !== 'undefined') {
                delete activeProgress[progressId];
            }
            if (typeof loadItems === 'function') {
                await loadItems();
            } else if (typeof loadYandexItems === 'function') {
                await loadYandexItems();
            }
        } catch (err) {
            alert('Ошибка перемещения: ' + err.message);
            if (typeof activeProgress !== 'undefined') {
                delete activeProgress[progressId];
            }
            if (typeof renderItemsList === 'function') {
                renderItemsList(allItems);
            }
        } finally {
            pendingMoveTarget = null;
            pendingMoveItemId = null;
            pendingMoveItemName = null;
            pendingMoveFolderId = null;
        }
    };
}

// Обработчик для кнопки создания папки в модальном окне
function setupFolderSelectCreate() {
    const createBtn = document.getElementById('folderSelectCreateBtn');
    if (!createBtn) return;
    
    createBtn.onclick = () => {
        const createFolderModal = document.getElementById('createFolderModal');
        if (createFolderModal) {
            createFolderModal.style.display = 'flex';
        }
    };
}

// Обработчики для закрытия модальных окон
function setupModalCloseHandlers() {
    const cancelShareBtn = document.getElementById('cancelShareBtn');
    if (cancelShareBtn) {
        cancelShareBtn.onclick = () => {
            document.getElementById('shareCloudModal').style.display = 'none';
        };
    }
    
    const folderSelectCancelBtn = document.getElementById('folderSelectCancelBtn');
    if (folderSelectCancelBtn) {
        folderSelectCancelBtn.onclick = () => {
            document.getElementById('folderSelectModal').style.display = 'none';
            pendingMoveTarget = null;
            pendingMoveItemId = null;
        };
    }
    
    const folderSelectCloseBtn = document.getElementById('folderSelectCloseBtn');
    if (folderSelectCloseBtn) {
        folderSelectCloseBtn.onclick = () => {
            document.getElementById('folderSelectModal').style.display = 'none';
            pendingMoveTarget = null;
            pendingMoveItemId = null;
        };
    }
    
    const createFolderConfirmBtn = document.getElementById('createFolderConfirmBtn');
    if (createFolderConfirmBtn) {
        createFolderConfirmBtn.onclick = async () => {
            const newFolderName = document.getElementById('newFolderName').value.trim();
            if (!newFolderName) {
                alert('Введите название папки');
                return;
            }
            try {
                const targetService = pendingMoveTarget ? pendingMoveTarget.service : 'google';
                const parentId = pendingMoveFolderId || (targetService === 'yandex' ? '/' : 'root');
                const newFolderId = await createFolderInTarget(pendingMoveTargetToken, newFolderName, parentId, targetService);
                alert(`Папка "${newFolderName}" создана!`);
                document.getElementById('createFolderModal').style.display = 'none';
                document.getElementById('newFolderName').value = '';
                
                const updatedFolders = await loadFoldersForTarget(pendingMoveTargetToken, targetService);
                renderFolderSelect(updatedFolders, targetService);
                setTimeout(() => {
                    const newFolderItem = document.querySelector(`.folder-item[data-id="${newFolderId}"]`);
                    if (newFolderItem) {
                        document.querySelectorAll('.folder-item').forEach(i => i.style.background = '');
                        newFolderItem.style.background = '#e8eaf6';
                        pendingMoveFolderId = newFolderId;
                    }
                }, 100);
            } catch (err) {
                alert('Ошибка создания папки: ' + err.message);
            }
        };
    }
    
    const createFolderCancelBtn = document.getElementById('createFolderCancelBtn');
    if (createFolderCancelBtn) {
        createFolderCancelBtn.onclick = () => {
            document.getElementById('createFolderModal').style.display = 'none';
            document.getElementById('newFolderName').value = '';
        };
    }
}

// Закрытие по клику вне модального окна
function setupOutsideClickHandlers() {
    document.addEventListener('click', (e) => {
        const shareModal = document.getElementById('shareCloudModal');
        if (shareModal && e.target === shareModal) {
            shareModal.style.display = 'none';
        }
        
        const folderSelectModal = document.getElementById('folderSelectModal');
        if (folderSelectModal && e.target === folderSelectModal) {
            folderSelectModal.style.display = 'none';
            pendingMoveTarget = null;
            pendingMoveItemId = null;
        }
        
        const createFolderModal = document.getElementById('createFolderModal');
        if (createFolderModal && e.target === createFolderModal) {
            createFolderModal.style.display = 'none';
            const newFolderNameInput = document.getElementById('newFolderName');
            if (newFolderNameInput) {
                newFolderNameInput.value = '';
            }
        }
    });
}

// ========== УНИВЕРСАЛЬНЫЕ ФУНКЦИИ ДЛЯ ЛИМИТОВ ==========

async function fetchRealLimit(service, token) {
    try {
        let totalBytes = 0;
        
        switch (service) {
            case 'google':
                const googleResponse = await fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const googleData = await googleResponse.json();
                totalBytes = parseInt(googleData.storageQuota.limit) || (15 * 1024 * 1024 * 1024);
                break;
                
            case 'yandex':
                const yandexResponse = await fetch('https://cloud-api.yandex.net/v1/disk/', {
                    headers: { 'Authorization': `OAuth ${token}` }
                });
                const yandexData = await yandexResponse.json();
                totalBytes = yandexData.total_space || (5 * 1024 * 1024 * 1024);
                break;
                
            default:
                console.error('Unknown service:', service);
                return null;
        }
        
        const limitGB = totalBytes / (1024 * 1024 * 1024);
        
        const storageKey = `nimbus_real_limit_${service}_${email}`;
        const timestampKey = `nimbus_limit_timestamp_${service}_${email}`;
        localStorage.setItem(storageKey, limitGB);
        localStorage.setItem(timestampKey, Date.now());
        
        console.log(`[Limit] ${service} real limit: ${limitGB.toFixed(2)} GB`);
        return limitGB;
        
    } catch (err) {
        console.error(`[Limit] Failed to fetch limit for ${service}:`, err);
        return null;
    }
}

async function getRealLimit(service, token, forceRefresh = false) {
    const storageKey = `nimbus_real_limit_${service}_${email}`;
    const timestampKey = `nimbus_limit_timestamp_${service}_${email}`;
    const oneDay = 24 * 60 * 60 * 1000;
    
    const savedLimit = localStorage.getItem(storageKey);
    const lastChecked = localStorage.getItem(timestampKey);
    
    if (!forceRefresh && savedLimit && lastChecked && (Date.now() - lastChecked) < oneDay) {
        console.log(`[Limit] Using cached limit for ${service}: ${savedLimit} GB`);
        return parseFloat(savedLimit);
    }
    
    return await fetchRealLimit(service, token);
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========

// Функция для экранирования HTML (если не определена глобально)
if (typeof escapeHtml === 'undefined') {
    window.escapeHtml = function(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
    };
}

// Экспортируем функции для использования в других модулях
window.showShareCloudModal = showShareCloudModal;
window.loadFoldersForTarget = loadFoldersForTarget;
window.createFolderInTarget = createFolderInTarget;
window.refreshTargetToken = refreshTargetToken;

// Алиасы для совместимости
window.loadFoldersForTargetUniversal = loadFoldersForTarget;
window.createFolderInTargetUniversal = createFolderInTarget;
window.refreshTargetTokenUniversal = refreshTargetToken;

// Экспорт функций для лимитов
window.fetchRealLimit = fetchRealLimit;
window.getRealLimit = getRealLimit;

// Настраиваем обработчики
setupShareButton();
setupFolderSelectConfirm();
setupFolderSelectCreate();
setupModalCloseHandlers();
setupOutsideClickHandlers();

console.log('storage-share.js fully loaded with universal cloud support and progress tracking');
