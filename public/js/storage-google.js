// ========== GOOGLE DRIVE СПЕЦИФИЧНЫЕ ФУНКЦИИ ==========

// Хранилище размеров папок и количества файлов
if (!window.folderSizes) window.folderSizes = {};
if (!window.folderFileCounts) window.folderFileCounts = {};

async function getItems(folderId = 'root') {
    let all = [];
    let pageToken = '';
    try {
        while (true) {
            let url = `https://www.googleapis.com/drive/v3/files?fields=files(id,name,size,mimeType,createdTime,modifiedTime)&pageSize=1000&q=trashed=false`;
            if (folderId !== 'root') {
                url += ` and '${folderId}' in parents`;
            } else {
                url += ` and 'root' in parents`;
            }
            if (pageToken) url += `&pageToken=${pageToken}`;
            let response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
            
            if (response.status === 401) {
                const newToken = await refreshAccessToken();
                if (newToken) {
                    accessToken = newToken;
                    response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
                } else {
                    throw new Error('Token expired');
                }
            }
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (data.files && data.files.length > 0) {
                all = all.concat(data.files);
            }
            if (data.nextPageToken) pageToken = data.nextPageToken;
            else break;
        }
    } catch (err) {
        console.error('API Error:', err);
        throw err;
    }
    return all;
}

async function getTrashFiles() {
    let all = [];
    let pageToken = '';
    try {
        while (true) {
            let url = `https://www.googleapis.com/drive/v3/files?fields=files(id,name,size,mimeType,createdTime,modifiedTime)&pageSize=1000&q=trashed=true`;
            if (pageToken) url += `&pageToken=${pageToken}`;
            let response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
            
            if (response.status === 401) {
                const newToken = await refreshAccessToken();
                if (newToken) {
                    accessToken = newToken;
                    response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
                } else {
                    throw new Error('Token expired');
                }
            }
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (data.files && data.files.length > 0) {
                all = all.concat(data.files);
            }
            if (data.nextPageToken) pageToken = data.nextPageToken;
            else break;
        }
    } catch (err) {
        console.error('API Error:', err);
        throw err;
    }
    return all;
}

async function getFolderSize(folderId) {
    let totalSize = 0;
    let pageToken = '';
    try {
        while (true) {
            let url = `https://www.googleapis.com/drive/v3/files?fields=files(id,name,size,mimeType)&pageSize=1000&q='${folderId}' in parents and trashed=false`;
            if (pageToken) url += `&pageToken=${pageToken}`;
            let response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
            
            if (response.status === 401) {
                const newToken = await refreshAccessToken();
                if (newToken) {
                    accessToken = newToken;
                    response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
                } else {
                    throw new Error('Token expired');
                }
            }
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (data.files && data.files.length > 0) {
                for (const item of data.files) {
                    if (item.mimeType === 'application/vnd.google-apps.folder') {
                        totalSize += await getFolderSize(item.id);
                    } else {
                        totalSize += parseInt(item.size) || 0;
                    }
                }
            }
            if (data.nextPageToken) pageToken = data.nextPageToken;
            else break;
        }
    } catch (err) {
        console.error('API Error:', err);
    }
    return totalSize;
}

async function getFolderFileCount(folderId) {
    let fileCount = 0;
    let pageToken = '';
    try {
        while (true) {
            let url = `https://www.googleapis.com/drive/v3/files?fields=files(id,name,size,mimeType)&pageSize=1000&q='${folderId}' in parents and trashed=false`;
            if (pageToken) url += `&pageToken=${pageToken}`;
            let response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
            
            if (response.status === 401) {
                const newToken = await refreshAccessToken();
                if (newToken) {
                    accessToken = newToken;
                    response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
                } else {
                    throw new Error('Token expired');
                }
            }
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (data.files && data.files.length > 0) {
                for (const item of data.files) {
                    if (item.mimeType !== 'application/vnd.google-apps.folder') {
                        fileCount++;
                    }
                }
            }
            if (data.nextPageToken) pageToken = data.nextPageToken;
            else break;
        }
    } catch (err) {
        console.error('API Error:', err);
    }
    return fileCount;
}

async function restoreFile(fileId) {
    try {
        let response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ trashed: false })
        });
        
        if (response.status === 401) {
            const newToken = await refreshAccessToken();
            if (newToken) {
                accessToken = newToken;
                response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ trashed: false })
                });
            }
        }
        
        if (response.ok) {
            alert('Файл восстановлен!');
            await showTrashMode();
        } else {
            alert('Ошибка восстановления');
        }
    } catch (err) {
        alert('Ошибка: ' + err.message);
    }
}

async function permanentDeleteFile(fileId) {
    if (confirm('Удалить файл навсегда? Это действие необратимо.')) {
        try {
            let response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            
            if (response.status === 401) {
                const newToken = await refreshAccessToken();
                if (newToken) {
                    accessToken = newToken;
                    response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${accessToken}` }
                    });
                }
            }
            
            if (response.ok) {
                alert('Файл удалён навсегда!');
                await showTrashMode();
            } else {
                alert('Ошибка удаления');
            }
        } catch (err) {
            alert('Ошибка: ' + err.message);
        }
    }
}

async function moveToTrash(itemId) {
    if (confirm('Переместить в корзину?')) {
        try {
            let response = await fetch(`https://www.googleapis.com/drive/v3/files/${itemId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ trashed: true })
            });
            
            if (response.status === 401) {
                const newToken = await refreshAccessToken();
                if (newToken) {
                    accessToken = newToken;
                    response = await fetch(`https://www.googleapis.com/drive/v3/files/${itemId}`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ trashed: true })
                    });
                }
            }
            
            if (response.ok) {
                alert('Перемещено в корзину');
                if (isTrashMode) {
                    await showTrashMode();
                } else {
                    await loadItems();
                }
            } else {
                alert('Ошибка');
            }
        } catch (err) {
            alert('Ошибка: ' + err.message);
        }
    }
}

async function renameItem(itemId, oldFullName, newNameWithoutExt, isFolder) {
    let newFullName;
    if (isFolder) {
        newFullName = newNameWithoutExt;
    } else {
        const { ext } = getBaseFileName(oldFullName);
        newFullName = newNameWithoutExt + ext;
    }
    try {
        let response = await fetch(`https://www.googleapis.com/drive/v3/files/${itemId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: newFullName })
        });
        
        if (response.status === 401) {
            const newToken = await refreshAccessToken();
            if (newToken) {
                accessToken = newToken;
                response = await fetch(`https://www.googleapis.com/drive/v3/files/${itemId}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ name: newFullName })
                });
            }
        }
        
        if (response.ok) {
            alert('Переименовано!');
            await loadItems();
        } else {
            alert('Ошибка переименования');
        }
    } catch (err) {
        alert('Ошибка: ' + err.message);
    }
}

async function copyFile(fileId, fileName) {
    const { name, ext } = getBaseFileName(fileName);
    const newName = name + ' (Копия)' + ext;
    try {
        let response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/copy`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: newName })
        });
        
        if (response.status === 401) {
            const newToken = await refreshAccessToken();
            if (newToken) {
                accessToken = newToken;
                response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/copy`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ name: newName })
                });
            }
        }
        
        if (response.ok) {
            alert(`Файл "${fileName}" скопирован!`);
            await loadItems();
        } else {
            const errData = await response.json();
            alert('Ошибка копирования: ' + (errData.error?.message || 'неизвестная ошибка'));
        }
    } catch (err) {
        alert('Ошибка: ' + err.message);
    }
}

async function showProperties(itemId) {
    try {
        let response = await fetch(`https://www.googleapis.com/drive/v3/files/${itemId}?fields=id,name,size,mimeType,createdTime,modifiedTime`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (response.status === 401) {
            const newToken = await refreshAccessToken();
            if (newToken) {
                accessToken = newToken;
                response = await fetch(`https://www.googleapis.com/drive/v3/files/${itemId}?fields=id,name,size,mimeType,createdTime,modifiedTime`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
            }
        }
        
        const item = await response.json();
        let displaySize = item.size ? formatFileSize(item.size) : '—';
        if (item.mimeType === 'application/vnd.google-apps.folder') {
            const folderSize = window.folderSizes[itemId];
            displaySize = folderSize ? formatFileSize(folderSize) : '—';
        }
        document.getElementById('propName').textContent = item.name;
        document.getElementById('propSize').textContent = displaySize;
        document.getElementById('propType').textContent = item.mimeType === 'application/vnd.google-apps.folder' ? 'Папка' : item.mimeType;
        document.getElementById('propCreated').textContent = new Date(item.createdTime).toLocaleString();
        document.getElementById('propModified').textContent = new Date(item.modifiedTime).toLocaleString();
        document.getElementById('propertiesModal').style.display = 'flex';
    } catch (err) {
        alert('Ошибка загрузки свойств');
    }
}

async function uploadFile(file, parentFolderId = currentFolderId) {
    const metadata = { name: file.name, mimeType: file.type, parents: parentFolderId === 'root' ? [] : [parentFolderId] };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);
    try {
        let response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}` },
            body: form
        });
        
        if (response.status === 401) {
            const newToken = await refreshAccessToken();
            if (newToken) {
                accessToken = newToken;
                response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${accessToken}` },
                    body: form
                });
            }
        }
        
        const result = await response.json();
        if (result.id) {
            alert(`Файл "${file.name}" загружен!`);
            await loadItems();
        } else {
            alert('Ошибка загрузки');
        }
    } catch (err) {
        alert('Ошибка: ' + err.message);
    }
}

async function createFolder(folderName, parentFolderId = currentFolderId) {
    const metadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentFolderId === 'root' ? [] : [parentFolderId]
    };
    try {
        let response = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(metadata)
        });
        
        if (response.status === 401) {
            const newToken = await refreshAccessToken();
            if (newToken) {
                accessToken = newToken;
                response = await fetch('https://www.googleapis.com/drive/v3/files', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(metadata)
                });
            }
        }
        
        if (response.ok) {
            alert(`Папка "${folderName}" создана!`);
            await loadItems();
        } else {
            alert('Ошибка создания папки');
        }
    } catch (err) {
        alert('Ошибка: ' + err.message);
    }
}

async function downloadFile(fileId, fileName) {
    try {
        let response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (response.status === 401) {
            const newToken = await refreshAccessToken();
            if (newToken) {
                accessToken = newToken;
                response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
            } else {
                throw new Error('Token expired');
            }
        }
        
        const blob = await response.blob();
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

async function getFileLink(fileId) {
    try {
        let response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=webViewLink`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (response.status === 401) {
            const newToken = await refreshAccessToken();
            if (newToken) {
                accessToken = newToken;
                response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=webViewLink`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
            } else {
                throw new Error('Token expired');
            }
        }
        
        const data = await response.json();
        return data.webViewLink;
    } catch (err) {
        console.error('Get link error:', err);
        throw err;
    }
}

async function loadItems() {
    const container = document.getElementById('filesContainer');
    container.innerHTML = '<div class="loading">Загрузка...</div>';
    try {
        allItems = await getItems(currentFolderId);
        
        // Подсчёт количества файлов в папках и размеров
        window.folderFileCounts = {};
        for (const item of allItems) {
            if (item.mimeType === 'application/vnd.google-apps.folder') {
                const fileCount = await getFolderFileCount(item.id);
                window.folderFileCounts[item.id] = fileCount;
                const folderSize = await getFolderSize(item.id);
                window.folderSizes[item.id] = folderSize;
            }
        }
        
        renderItemsList(allItems);
        await updateStats();
        console.log(`Загружено элементов: ${allItems.length}`);
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