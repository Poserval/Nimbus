// ========== ОБЩИЕ ПЕРЕМЕННЫЕ ==========
const PROXY_URL = 'http://localhost:3000/token';
let accessToken = new URLSearchParams(window.location.search).get('token');
const email = new URLSearchParams(window.location.search).get('email');
let allItems = [];
let usedBytes = 0;
let limitGB = 15;
let selectedFiles = new Set();
let currentSortType = 'name';
let currentSortDirection = 'asc';
let currentView = 'list';
let isTrashMode = false;
let trashFiles = [];
let currentFolderId = '/';
let folderPath = [{ id: '/', name: 'Корень' }];
let activeProgress = {};
let abortControllers = {};
let globalProgress = null;

// ========== ПЕРЕМЕННЫЕ ДЛЯ ПРОСМОТРА ИЗОБРАЖЕНИЙ ==========
let currentImageIndex = 0;
let currentImageList = [];

// ========== ПЕРЕМЕННЫЕ ДЛЯ ПРОСМОТРА ZIP ==========
let currentZipFiles = [];
let currentZipName = '';
let currentZipBlob = null;

// ========== ПЕРЕМЕННЫЕ ДЛЯ АУДИО/ВИДЕО ПЛЕЕРА ==========
let currentMediaIndex = 0;
let currentMediaList = [];
let currentMediaPlayer = null;
let mediaProgressInterval = null;

// ========== ПЕРЕМЕННЫЕ ДЛЯ ПЕРЕМЕЩЕНИЯ ВНУТРИ ХРАНИЛИЩА ==========
let moveInsideTargetFolderId = null;
let moveInsideItems = [];

// ========== ПЕРЕМЕННЫЕ ДЛЯ ЗАМОЧКА ==========
let isLimitLocked = false;
let limitUnit = 'GB';

// ========== СИСТЕМНЫЕ АССОЦИАЦИИ ==========
let fileAssociations = {};

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function loadAssociations() {
    const saved = localStorage.getItem(`nimbus_associations_${email}`);
    if (saved) {
        try {
            fileAssociations = JSON.parse(saved);
        } catch (e) {
            fileAssociations = {};
        }
    }
}

function saveAssociations() {
    localStorage.setItem(`nimbus_associations_${email}`, JSON.stringify(fileAssociations));
}

function setAssociation(extension, action) {
    fileAssociations[extension.toLowerCase()] = action;
    saveAssociations();
}

function getAssociation(extension) {
    return fileAssociations[extension.toLowerCase()];
}

function removeAssociation(extension) {
    delete fileAssociations[extension.toLowerCase()];
    saveAssociations();
}

function resetAllAssociations() {
    if (confirm('Сбросить все сохранённые ассоциации для файлов?')) {
        fileAssociations = {};
        saveAssociations();
        alert('Все ассоциации сброшены');
    }
}

function showAssociationsManager() {
    const extList = Object.keys(fileAssociations);
    if (extList.length === 0) {
        alert('Нет сохранённых ассоциаций');
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'share-modal';
    modal.style.display = 'flex';
    
    let html = `
        <div class="share-modal-content" style="width: 400px; max-height: 80vh; overflow-y: auto;">
            <h3>Управление ассоциациями файлов</h3>
            <div class="share-cloud-list">
    `;
    
    for (const ext of extList) {
        const action = fileAssociations[ext];
        let actionText = '';
        if (action === 'system') actionText = 'Системная программа';
        else if (action === 'browser') actionText = 'Встроенный просмотр';
        else if (action === 'download') actionText = 'Скачать и открыть';
        
        html += `
            <div class="share-cloud-item" data-ext="${ext}">
                <div class="share-cloud-icon" style="font-size: 24px;">📄</div>
                <div class="share-cloud-info">
                    <div class="share-cloud-name">.${ext}</div>
                    <div class="share-cloud-email">${actionText}</div>
                </div>
                <button class="remove-assoc-btn" data-ext="${ext}" style="background: #f44336; color: white; border: none; border-radius: 20px; padding: 6px 12px; cursor: pointer;">Сбросить</button>
            </div>
        `;
    }
    
    html += `
            </div>
            <button id="closeAssocModalBtn" class="share-cancel-btn" style="margin-top: 15px;">Закрыть</button>
        </div>
    `;
    
    modal.innerHTML = html;
    document.body.appendChild(modal);
    
    modal.querySelectorAll('.remove-assoc-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const ext = btn.dataset.ext;
            removeAssociation(ext);
            modal.remove();
            showAssociationsManager();
        });
    });
    
    modal.querySelector('#closeAssocModalBtn').onclick = () => modal.remove();
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

function getColorForPercent(percent) {
    if (percent <= 50) {
        const r = Math.floor(255 * (percent / 50));
        return `rgb(${r}, 255, 0)`;
    } else {
        const g = Math.floor(255 * (1 - (percent - 50) / 50));
        return `rgb(255, ${g}, 0)`;
    }
}

function updateHeaderButtonsState() {
    const hasSelected = selectedFiles.size > 0;
    const conditionalButtons = ['renameBtn', 'copyBtn', 'printBtn', 'linkBtn', 'shareBtn', 'archiveBtn', 'saveBtn', 'viewBtnAction'];
    conditionalButtons.forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
            if (hasSelected) {
                btn.classList.remove('disabled');
            } else {
                btn.classList.add('disabled');
            }
        }
    });
    
    const trashBtn = document.getElementById('trashBtn');
    if (trashBtn) {
        trashBtn.classList.remove('disabled');
    }
}

function sortItems(items) {
    const sorted = [...items];
    switch(currentSortType) {
        case 'name':
            sorted.sort((a, b) => {
                if (currentSortDirection === 'asc') return a.name.localeCompare(b.name);
                else return b.name.localeCompare(a.name);
            });
            break;
        case 'size':
            sorted.sort((a, b) => {
                const sizeA = parseInt(a.size) || 0;
                const sizeB = parseInt(b.size) || 0;
                if (currentSortDirection === 'asc') return sizeA - sizeB;
                else return sizeB - sizeA;
            });
            break;
        case 'date':
            sorted.sort((a, b) => {
                const dateA = new Date(a.modifiedTime || a.createdTime);
                const dateB = new Date(b.modifiedTime || b.createdTime);
                if (currentSortDirection === 'asc') return dateA - dateB;
                else return dateB - dateA;
            });
            break;
        default:
            sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    return sorted;
}

function updateSortArrows() {
    document.querySelectorAll('.sort-arrow').forEach(arrow => {
        arrow.classList.remove('active');
    });
    const activeArrows = document.querySelectorAll(`.sort-arrow[data-sort-type="${currentSortType}"][data-direction="${currentSortDirection}"]`);
    activeArrows.forEach(arrow => arrow.classList.add('active'));
}

function updateViewMenuActive() {
    document.querySelectorAll('.view-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeItem = document.querySelector(`.view-item[data-view="${currentView}"]`);
    if (activeItem) activeItem.classList.add('active');
}

function getBaseFileName(fullName) {
    const lastDot = fullName.lastIndexOf('.');
    if (lastDot === -1) return { name: fullName, ext: '' };
    return { name: fullName.substring(0, lastDot), ext: fullName.substring(lastDot) };
}

function formatFileSize(bytes) {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function formatDate(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getFileExtension(filename) {
    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1) return '';
    return filename.substring(lastDot + 1).toUpperCase();
}

// Получение подписи типа файла вместо формата
function getFileTypeLabel(extension) {
    const ext = extension.toLowerCase();
    
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'ico', 'svg'];
    if (imageExts.includes(ext)) return 'Изображение';
    
    const videoExts = ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v'];
    if (videoExts.includes(ext)) return 'Видео';
    
    const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'opus'];
    if (audioExts.includes(ext)) return 'Аудио';
    
    const docExts = ['doc', 'docx', 'txt', 'rtf', 'odt', 'md'];
    if (docExts.includes(ext)) return 'Текст';
    
    if (ext === 'pdf') return 'PDF';
    
    const sheetExts = ['xls', 'xlsx', 'csv', 'ods'];
    if (sheetExts.includes(ext)) return 'Таблица';
    
    const presExts = ['ppt', 'pptx', 'odp'];
    if (presExts.includes(ext)) return 'Презентация';
    
    const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz'];
    if (archiveExts.includes(ext)) return 'Архив';
    
    return 'Файл';
}

function getItemIcon(item) {
    if (item.mimeType === 'application/vnd.yandex.folder' || item.type === 'dir') return '📁';
    const ext = item.name.split('.').pop().toLowerCase();
    if (item.mimeType?.includes('image') || ['jpg','jpeg','png','gif','webp','bmp'].includes(ext)) return '🖼️';
    if (item.mimeType?.includes('pdf') || ext === 'pdf') return '📑';
    if (item.mimeType?.includes('zip') || ['zip','rar','7z','tar','gz'].includes(ext)) return '📦';
    if (item.mimeType?.includes('document') || ['doc','docx','txt','rtf','odt'].includes(ext)) return '📝';
    if (item.mimeType?.includes('spreadsheet') || ['xls','xlsx','csv','ods'].includes(ext)) return '📊';
    if (item.mimeType?.includes('presentation') || ['ppt','pptx','odp'].includes(ext)) return '📽️';
    if (item.mimeType?.includes('video') || ['mp4','avi','mkv','mov','wmv','flv','webm'].includes(ext)) return '🎬';
    if (item.mimeType?.includes('audio') || ['mp3','wav','flac','aac','ogg','m4a'].includes(ext)) return '🎵';
    return '📄';
}

function getItemDisplaySize(item) {
    if (item.mimeType === 'application/vnd.yandex.folder' || item.type === 'dir') {
        const cachedSize = window.yandexFolderSizes?.[item.id];
        if (cachedSize) return formatFileSize(cachedSize);
        return '—';
    }
    return formatFileSize(item.size);
}

function isImageFile(filename) {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.ico', '.svg'];
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return imageExtensions.includes(ext);
}

function isZipFile(filename) {
    const zipExtensions = ['.zip'];
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return zipExtensions.includes(ext);
}

function isAudioFile(filename) {
    const audioExtensions = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.opus'];
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return audioExtensions.includes(ext);
}

function isVideoFile(filename) {
    const videoExtensions = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v'];
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return videoExtensions.includes(ext);
}

function isMediaFile(filename) {
    return isAudioFile(filename) || isVideoFile(filename);
}

function updateBreadcrumb() {
    const headerCenter = document.getElementById('headerCenter');
    
    if (isTrashMode) {
        headerCenter.innerHTML = `<span id="trashBadge" class="trash-badge" style="display: inline-block;">Корзина</span>`;
    } else {
        // Получаем имя пользователя из email
        let userDisplayName = email ? email.split('@')[0] : '';
        // Ограничиваем длину имени
        if (userDisplayName.length > 20) {
            userDisplayName = userDisplayName.substring(0, 17) + '...';
        }
        
        headerCenter.innerHTML = `
            <div class="header-title-wrapper">
                <span class="title">Яндекс.Диск</span>
                <span class="user-subtitle">${escapeHtml(userDisplayName)}</span>
            </div>
            <span id="trashBadge" class="trash-badge" style="display: none;">Корзина</span>
        `;
    }
}

async function enterFolder(folderId, folderName) {
    let validPath = folderId;
    
    if (validPath && validPath.includes(':') && !validPath.startsWith('/')) {
        const foundItem = allItems.find(i => i.id === folderId);
        if (foundItem && foundItem.path) {
            validPath = foundItem.path;
        }
    }
    
    if (validPath && !validPath.startsWith('/')) {
        validPath = '/' + validPath;
    }
    
    currentFolderId = validPath;
    folderPath.push({ id: validPath, name: folderName });
    updateBreadcrumb();
    updateBreadcrumbNavigation();
    await loadItems();
}

async function goBack() {
    if (folderPath.length > 1) {
        folderPath.pop();
        currentFolderId = folderPath[folderPath.length - 1].id;
        updateBreadcrumb();
        updateBreadcrumbNavigation();
        await loadItems();
    }
}

// ========== ФУНКЦИИ ПРОСМОТРА ИЗОБРАЖЕНИЙ ==========
async function openImageViewer(itemId, itemName) {
    try {
        const item = allItems.find(i => i.id === itemId);
        if (!item) throw new Error('Файл не найден');
        const blob = await downloadFileAsBlob(itemId);
        const url = URL.createObjectURL(blob);
        
        currentImageList = allItems.filter(item => isImageFile(item.name));
        currentImageIndex = currentImageList.findIndex(img => img.id === itemId);
        
        const viewerModal = document.createElement('div');
        viewerModal.className = 'image-viewer-modal';
        viewerModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.95);
            z-index: 20000;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            cursor: default;
        `;
        
        viewerModal.innerHTML = `
            <div style="position: absolute; top: 20px; right: 20px; display: flex; gap: 10px; z-index: 20001;">
                <button id="viewerDownloadBtn" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 40px; height: 40px; border-radius: 20px; cursor: pointer; font-size: 20px;">💾</button>
                <button id="viewerCloseBtn" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 40px; height: 40px; border-radius: 20px; cursor: pointer; font-size: 20px;">✕</button>
            </div>
            <div style="position: absolute; top: 20px; left: 20px; color: white; font-size: 14px; background: rgba(0,0,0,0.5); padding: 8px 16px; border-radius: 20px; z-index: 20001;">
                ${escapeHtml(itemName)} (${currentImageIndex + 1} / ${currentImageList.length})
            </div>
            <button id="viewerPrevBtn" style="position: absolute; left: 20px; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.2); border: none; color: white; width: 50px; height: 50px; border-radius: 25px; cursor: pointer; font-size: 30px; z-index: 20001;">←</button>
            <button id="viewerNextBtn" style="position: absolute; right: 20px; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.2); border: none; color: white; width: 50px; height: 50px; border-radius: 25px; cursor: pointer; font-size: 30px; z-index: 20001;">→</button>
            <div style="max-width: 90%; max-height: 90%; display: flex; justify-content: center; align-items: center;">
                <img id="viewerImage" src="${url}" style="max-width: 100%; max-height: 90vh; object-fit: contain; cursor: default;">
            </div>
        `;
        
        document.body.appendChild(viewerModal);
        
        const updateImage = async (newIndex) => {
            if (newIndex < 0) newIndex = currentImageList.length - 1;
            if (newIndex >= currentImageList.length) newIndex = 0;
            
            currentImageIndex = newIndex;
            const newItem = currentImageList[currentImageIndex];
            
            const titleDiv = viewerModal.querySelector('div[style*="position: absolute; top: 20px; left: 20px"]');
            if (titleDiv) {
                titleDiv.innerHTML = `${escapeHtml(newItem.name)} (${currentImageIndex + 1} / ${currentImageList.length})`;
            }
            
            const newBlob = await downloadFileAsBlob(newItem.id);
            const newUrl = URL.createObjectURL(newBlob);
            const imgElement = viewerModal.querySelector('#viewerImage');
            const oldUrl = imgElement.src;
            URL.revokeObjectURL(oldUrl);
            imgElement.src = newUrl;
        };
        
        viewerModal.querySelector('#viewerCloseBtn').onclick = () => {
            const imgElement = viewerModal.querySelector('#viewerImage');
            URL.revokeObjectURL(imgElement.src);
            viewerModal.remove();
        };
        
        viewerModal.querySelector('#viewerPrevBtn').onclick = () => updateImage(currentImageIndex - 1);
        viewerModal.querySelector('#viewerNextBtn').onclick = () => updateImage(currentImageIndex + 1);
        
        viewerModal.querySelector('#viewerDownloadBtn').onclick = async () => {
            const currentItem = currentImageList[currentImageIndex];
            try {
                await downloadFile(currentItem.id, currentItem.name);
                alert(`Файл "${currentItem.name}" скачан`);
            } catch (err) {
                alert('Ошибка скачивания: ' + err.message);
            }
        };
        
        const keyHandler = (e) => {
            if (e.key === 'ArrowLeft') {
                updateImage(currentImageIndex - 1);
            } else if (e.key === 'ArrowRight') {
                updateImage(currentImageIndex + 1);
            } else if (e.key === 'Escape') {
                const imgElement = viewerModal.querySelector('#viewerImage');
                URL.revokeObjectURL(imgElement.src);
                viewerModal.remove();
                document.removeEventListener('keydown', keyHandler);
            }
        };
        document.addEventListener('keydown', keyHandler);
        
        viewerModal.addEventListener('click', (e) => {
            if (e.target === viewerModal) {
                const imgElement = viewerModal.querySelector('#viewerImage');
                URL.revokeObjectURL(imgElement.src);
                viewerModal.remove();
                document.removeEventListener('keydown', keyHandler);
            }
        });
        
    } catch (err) {
        alert('Ошибка открытия изображения: ' + err.message);
    }
}

// ========== ФУНКЦИИ ПРОСМОТРА ZIP АРХИВОВ ==========
async function openZipViewer(itemId, itemName) {
    try {
        const item = allItems.find(i => i.id === itemId);
        if (!item) throw new Error('Файл не найден');
        const blob = await downloadFileAsBlob(itemId);
        currentZipBlob = blob;
        currentZipName = itemName;
        
        const zip = new JSZip();
        const zipData = await zip.loadAsync(currentZipBlob);
        currentZipFiles = [];
        
        zipData.forEach((relativePath, file) => {
            if (!file.dir) {
                currentZipFiles.push({
                    name: relativePath,
                    size: file._data.uncompressedSize,
                    file: file
                });
            }
        });
        
        renderZipViewer();
    } catch (err) {
        alert('Ошибка открытия архива: ' + err.message);
    }
}

function renderZipViewer() {
    const viewerModal = document.createElement('div');
    viewerModal.className = 'zip-viewer-modal';
    viewerModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        z-index: 20000;
        display: flex;
        flex-direction: column;
        cursor: default;
    `;
    
    const sorted = [...currentZipFiles].sort((a, b) => a.name.localeCompare(b.name));
    
    let filesHtml = '<div style="flex: 1; overflow-y: auto; padding: 20px;">';
    filesHtml += '<div style="background: white; border-radius: 16px; overflow: hidden;">';
    
    for (const file of sorted) {
        const ext = file.name.split('.').pop().toLowerCase();
        let icon = '📄';
        if (['jpg','jpeg','png','gif','bmp','webp'].includes(ext)) icon = '🖼️';
        else if (['mp4','avi','mkv','mov'].includes(ext)) icon = '🎬';
        else if (['mp3','wav','flac','aac'].includes(ext)) icon = '🎵';
        else if (ext === 'pdf') icon = '📑';
        else if (['doc','docx'].includes(ext)) icon = '📝';
        else if (['xls','xlsx'].includes(ext)) icon = '📊';
        else if (['zip','rar','7z'].includes(ext)) icon = '📦';
        
        filesHtml += `
            <div class="zip-file-item" data-file-name="${escapeHtml(file.name)}" style="display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid #eee; cursor: pointer; transition: background 0.2s;">
                <div style="font-size: 24px; margin-right: 15px;">${icon}</div>
                <div style="flex: 1;">
                    <div style="font-weight: 500;">${escapeHtml(file.name)}</div>
                    <div style="font-size: 12px; color: #666;">${formatFileSize(file.size)}</div>
                </div>
                <button class="extract-file-btn" data-file-name="${escapeHtml(file.name)}" style="background: #4caf50; color: white; border: none; border-radius: 20px; padding: 6px 16px; cursor: pointer; margin-left: 10px;">📂 Распаковать</button>
            </div>
        `;
    }
    
    filesHtml += '</div></div>';
    
    viewerModal.innerHTML = `
        <div style="background: #1a237e; color: white; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <strong>📦 ${escapeHtml(currentZipName)}</strong>
                <span style="margin-left: 10px; font-size: 12px; opacity: 0.8;">${currentZipFiles.length} файлов</span>
            </div>
            <div>
                <button id="extractAllBtn" style="background: #4caf50; color: white; border: none; border-radius: 20px; padding: 8px 20px; cursor: pointer; margin-right: 10px;">📂 Распаковать всё</button>
                <button id="closeZipViewerBtn" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 36px; height: 36px; border-radius: 18px; cursor: pointer; font-size: 20px;">✕</button>
            </div>
        </div>
        ${filesHtml}
    `;
    
    document.body.appendChild(viewerModal);
    
    viewerModal.querySelector('#closeZipViewerBtn').onclick = () => {
        viewerModal.remove();
        currentZipFiles = [];
        currentZipBlob = null;
    };
    
    viewerModal.querySelector('#extractAllBtn').onclick = async () => {
        if (confirm(`Распаковать все ${currentZipFiles.length} файлов в текущую папку?`)) {
            await extractAllFilesFromZip();
            viewerModal.remove();
            currentZipFiles = [];
            currentZipBlob = null;
        }
    };
    
    viewerModal.querySelectorAll('.zip-file-item').forEach(item => {
        item.addEventListener('click', async (e) => {
            if (e.target.classList.contains('extract-file-btn')) return;
            const fileName = item.dataset.fileName;
            const fileData = currentZipFiles.find(f => f.name === fileName);
            if (fileData) {
                await extractSingleFileFromZip(fileData);
            }
        });
    });
    
    viewerModal.querySelectorAll('.extract-file-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const fileName = btn.dataset.fileName;
            const fileData = currentZipFiles.find(f => f.name === fileName);
            if (fileData) {
                await extractSingleFileFromZip(fileData);
            }
        });
    });
    
    viewerModal.addEventListener('click', (e) => {
        if (e.target === viewerModal) {
            viewerModal.remove();
            currentZipFiles = [];
            currentZipBlob = null;
        }
    });
}

async function extractSingleFileFromZip(fileData) {
    try {
        const fileBlob = await fileData.file.async('blob');
        const fileName = fileData.name;
        const uploadSuccess = await uploadFile(new File([fileBlob], fileName), currentFolderId);
        if (uploadSuccess) {
            alert(`Файл "${fileName}" распакован!`);
            await loadItems();
        } else {
            alert('Ошибка распаковки');
        }
    } catch (err) {
        alert('Ошибка: ' + err.message);
    }
}

async function extractAllFilesFromZip() {
    let successCount = 0;
    let failCount = 0;
    
    for (const fileData of currentZipFiles) {
        try {
            const fileBlob = await fileData.file.async('blob');
            const fileName = fileData.name;
            const uploadSuccess = await uploadFile(new File([fileBlob], fileName), currentFolderId);
            if (uploadSuccess) {
                successCount++;
            } else {
                failCount++;
            }
        } catch (err) {
            console.error(`Error extracting ${fileData.name}:`, err);
            failCount++;
        }
    }
    
    if (failCount === 0) {
        alert(`Распаковано ${successCount} файлов`);
    } else {
        alert(`Распаковано: ${successCount}, Ошибок: ${failCount}`);
    }
    await loadItems();
}

// ========== ФУНКЦИИ АУДИО/ВИДЕО ПЛЕЕРА ==========
async function openMediaPlayer(itemId, itemName) {
    try {
        const item = allItems.find(i => i.id === itemId);
        if (!item) throw new Error('Файл не найден');
        const blob = await downloadFileAsBlob(itemId);
        const url = URL.createObjectURL(blob);
        const isVideo = isVideoFile(itemName);
        
        currentMediaList = allItems.filter(item => isMediaFile(item.name));
        currentMediaIndex = currentMediaList.findIndex(media => media.id === itemId);
        
        renderMediaPlayer(url, itemName, isVideo);
    } catch (err) {
        alert('Ошибка открытия медиафайла: ' + err.message);
    }
}

function renderMediaPlayer(url, itemName, isVideo) {
    const savedVolume = localStorage.getItem('nimbus_volume') || 0.7;
    const savedPosition = localStorage.getItem(`nimbus_position_${currentMediaList[currentMediaIndex]?.id}`) || 0;
    
    const playerModal = document.createElement('div');
    playerModal.className = 'media-player-modal';
    playerModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.9);
        z-index: 20000;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        cursor: default;
    `;
    
    const mediaHtml = isVideo ? `
        <video id="mediaElement" src="${url}" style="max-width: 90%; max-height: 70vh; background: black; border-radius: 8px;" controlslist="nodownload"></video>
    ` : `
        <div style="background: #1a237e; width: 80%; max-width: 500px; border-radius: 20px; padding: 40px; text-align: center;">
            <div style="font-size: 80px; margin-bottom: 20px;">🎵</div>
            <audio id="mediaElement" src="${url}" controls style="width: 100%;"></audio>
        </div>
    `;
    
    playerModal.innerHTML = `
        <div style="position: absolute; top: 20px; right: 20px; z-index: 20001;">
            <button id="playerCloseBtn" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 40px; height: 40px; border-radius: 20px; cursor: pointer; font-size: 20px;">✕</button>
        </div>
        <div style="position: absolute; top: 20px; left: 20px; color: white; font-size: 14px; background: rgba(0,0,0,0.5); padding: 8px 16px; border-radius: 20px; z-index: 20001;">
            ${escapeHtml(itemName)} (${currentMediaIndex + 1} / ${currentMediaList.length})
        </div>
        <button id="playerPrevBtn" style="position: absolute; left: 20px; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.2); border: none; color: white; width: 50px; height: 50px; border-radius: 25px; cursor: pointer; font-size: 30px; z-index: 20001;">⏮</button>
        <button id="playerNextBtn" style="position: absolute; right: 20px; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.2); border: none; color: white; width: 50px; height: 50px; border-radius: 25px; cursor: pointer; font-size: 30px; z-index: 20001;">⏭</button>
        <div id="playerControls" style="position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.7); border-radius: 50px; padding: 15px 25px; display: flex; gap: 20px; align-items: center; z-index: 20001; flex-wrap: wrap; justify-content: center;">
            <button id="playPauseBtn" style="background: #1a237e; border: none; color: white; width: 50px; height: 50px; border-radius: 25px; cursor: pointer; font-size: 24px;">▶</button>
            <div style="display: flex; align-items: center; gap: 10px;">
                <span id="currentTime" style="color: white; font-size: 14px;">0:00</span>
                <input type="range" id="progressBar" min="0" max="100" value="0" style="width: 300px; cursor: pointer;">
                <span id="durationTime" style="color: white; font-size: 14px;">0:00</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="color: white; font-size: 14px;">🔊</span>
                <input type="range" id="volumeControl" min="0" max="100" value="${savedVolume * 100}" style="width: 100px; cursor: pointer;">
            </div>
            ${isVideo ? `<button id="fullscreenBtn" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 40px; height: 40px; border-radius: 20px; cursor: pointer; font-size: 18px;">⛶</button>` : ''}
            <button id="downloadMediaBtn" style="background: #4caf50; border: none; color: white; width: 40px; height: 40px; border-radius: 20px; cursor: pointer; font-size: 18px;">💾</button>
        </div>
        ${mediaHtml}
    `;
    
    document.body.appendChild(playerModal);
    
    const mediaElement = document.getElementById('mediaElement');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const progressBar = document.getElementById('progressBar');
    const currentTimeSpan = document.getElementById('currentTime');
    const durationTimeSpan = document.getElementById('durationTime');
    const volumeControl = document.getElementById('volumeControl');
    const prevBtn = document.getElementById('playerPrevBtn');
    const nextBtn = document.getElementById('playerNextBtn');
    const closeBtn = document.getElementById('playerCloseBtn');
    const downloadBtn = document.getElementById('downloadMediaBtn');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    
    mediaElement.volume = savedVolume;
    if (savedPosition > 0 && savedPosition < mediaElement.duration) {
        mediaElement.currentTime = savedPosition;
    }
    
    const formatTime = (seconds) => {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    
    const updateProgress = () => {
        if (mediaElement.duration) {
            const percent = (mediaElement.currentTime / mediaElement.duration) * 100;
            progressBar.value = percent;
            currentTimeSpan.textContent = formatTime(mediaElement.currentTime);
            durationTimeSpan.textContent = formatTime(mediaElement.duration);
            localStorage.setItem(`nimbus_position_${currentMediaList[currentMediaIndex]?.id}`, mediaElement.currentTime);
        }
    };
    
    mediaElement.addEventListener('loadedmetadata', () => {
        durationTimeSpan.textContent = formatTime(mediaElement.duration);
        if (savedPosition > 0 && savedPosition < mediaElement.duration) {
            mediaElement.currentTime = savedPosition;
        }
    });
    
    mediaElement.addEventListener('timeupdate', updateProgress);
    mediaElement.addEventListener('ended', () => {
        playPauseBtn.textContent = '▶';
        if (currentMediaIndex < currentMediaList.length - 1) {
            setTimeout(() => loadMedia(currentMediaIndex + 1), 1000);
        }
    });
    
    playPauseBtn.onclick = () => {
        if (mediaElement.paused) {
            mediaElement.play();
            playPauseBtn.textContent = '⏸';
        } else {
            mediaElement.pause();
            playPauseBtn.textContent = '▶';
        }
    };
    
    progressBar.oninput = () => {
        if (mediaElement.duration) {
            mediaElement.currentTime = (progressBar.value / 100) * mediaElement.duration;
        }
    };
    
    volumeControl.oninput = () => {
        const volume = volumeControl.value / 100;
        mediaElement.volume = volume;
        localStorage.setItem('nimbus_volume', volume);
    };
    
    const loadMedia = async (newIndex) => {
        if (newIndex < 0) newIndex = currentMediaList.length - 1;
        if (newIndex >= currentMediaList.length) newIndex = 0;
        
        currentMediaIndex = newIndex;
        const newItem = currentMediaList[currentMediaIndex];
        
        const titleDiv = playerModal.querySelector('div[style*="position: absolute; top: 20px; left: 20px"]');
        if (titleDiv) {
            titleDiv.innerHTML = `${escapeHtml(newItem.name)} (${currentMediaIndex + 1} / ${currentMediaList.length})`;
        }
        
        const newBlob = await downloadFileAsBlob(newItem.id);
        const newUrl = URL.createObjectURL(newBlob);
        const oldUrl = mediaElement.src;
        mediaElement.src = newUrl;
        URL.revokeObjectURL(oldUrl);
        
        mediaElement.load();
        mediaElement.play();
        playPauseBtn.textContent = '⏸';
        
        const savedPos = localStorage.getItem(`nimbus_position_${newItem.id}`);
        if (savedPos && savedPos > 0) {
            mediaElement.addEventListener('loadedmetadata', () => {
                if (savedPos < mediaElement.duration) {
                    mediaElement.currentTime = savedPos;
                }
            }, { once: true });
        }
    };
    
    prevBtn.onclick = () => loadMedia(currentMediaIndex - 1);
    nextBtn.onclick = () => loadMedia(currentMediaIndex + 1);
    
    closeBtn.onclick = () => {
        if (mediaProgressInterval) clearInterval(mediaProgressInterval);
        URL.revokeObjectURL(mediaElement.src);
        playerModal.remove();
    };
    
    downloadBtn.onclick = async () => {
        const currentItem = currentMediaList[currentMediaIndex];
        try {
            await downloadFile(currentItem.id, currentItem.name);
            alert(`Файл "${currentItem.name}" скачан`);
        } catch (err) {
            alert('Ошибка скачивания: ' + err.message);
        }
    };
    
    if (fullscreenBtn) {
        fullscreenBtn.onclick = () => {
            if (mediaElement.requestFullscreen) {
                mediaElement.requestFullscreen();
            }
        };
    }
    
    const keyHandler = (e) => {
        if (e.key === 'ArrowLeft') {
            loadMedia(currentMediaIndex - 1);
        } else if (e.key === 'ArrowRight') {
            loadMedia(currentMediaIndex + 1);
        } else if (e.key === ' ' || e.key === 'Space') {
            e.preventDefault();
            if (mediaElement.paused) {
                mediaElement.play();
                playPauseBtn.textContent = '⏸';
            } else {
                mediaElement.pause();
                playPauseBtn.textContent = '▶';
            }
        } else if (e.key === 'Escape') {
            if (mediaProgressInterval) clearInterval(mediaProgressInterval);
            URL.revokeObjectURL(mediaElement.src);
            playerModal.remove();
            document.removeEventListener('keydown', keyHandler);
        }
    };
    document.addEventListener('keydown', keyHandler);
    
    playerModal.addEventListener('click', (e) => {
        if (e.target === playerModal) {
            if (mediaProgressInterval) clearInterval(mediaProgressInterval);
            URL.revokeObjectURL(mediaElement.src);
            playerModal.remove();
            document.removeEventListener('keydown', keyHandler);
        }
    });
}

// ========== ОСНОВНАЯ ФУНКЦИЯ ОТРИСОВКИ ==========
function renderItemsList(items) {
    const container = document.getElementById('filesContainer');
    if (!items || items.length === 0) {
        let emptyHtml = '';
        if (globalProgress) {
            emptyHtml = `
                <div class="global-progress" style="background: #e8eaf6; padding: 12px 16px; border-radius: 12px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between;">
                    <div style="flex: 1;">
                        <div style="font-size: 14px; font-weight: bold; margin-bottom: 5px;">${globalProgress.type === 'archive' ? '📦 Архивация' : '📦 Перемещение архива'}</div>
                        <div class="progress-container" style="height: 8px; background: #ddd; border-radius: 4px;">
                            <div class="progress-bar" style="width: ${globalProgress.percent}%; height: 100%; background: #4caf50; border-radius: 4px; transition: width 0.3s;"></div>
                        </div>
                        <div style="font-size: 12px; margin-top: 5px;">${globalProgress.percent}%</div>
                    </div>
                    <button id="cancelGlobalProgressBtn" style="background: #f44336; color: white; border: none; border-radius: 20px; padding: 6px 16px; cursor: pointer; margin-left: 15px;">Отмена</button>
                </div>
            `;
        }
        container.innerHTML = emptyHtml + '<div class="loading">Папка пуста</div>';
        if (globalProgress) {
            const cancelBtn = document.getElementById('cancelGlobalProgressBtn');
            if (cancelBtn && globalProgress.cancelController) {
                cancelBtn.onclick = () => {
                    globalProgress.cancelController.abort();
                    globalProgress = null;
                    renderItemsList(allItems);
                    alert('Операция отменена');
                };
            }
        }
        return;
    }
    
    const sorted = sortItems(items);
    
    let globalProgressHtml = '';
    if (globalProgress) {
        globalProgressHtml = `
            <div class="global-progress" style="background: #e8eaf6; padding: 12px 16px; border-radius: 12px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between;">
                <div style="flex: 1;">
                    <div style="font-size: 14px; font-weight: bold; margin-bottom: 5px;">${globalProgress.type === 'archive' ? '📦 Архивация' : '📦 Перемещение архива'}</div>
                    <div class="progress-container" style="height: 8px; background: #ddd; border-radius: 4px;">
                        <div class="progress-bar" style="width: ${globalProgress.percent}%; height: 100%; background: #4caf50; border-radius: 4px; transition: width 0.3s;"></div>
                    </div>
                    <div style="font-size: 12px; margin-top: 5px;">${globalProgress.percent}%</div>
                </div>
                <button id="cancelGlobalProgressBtn" style="background: #f44336; color: white; border: none; border-radius: 20px; padding: 6px 16px; cursor: pointer; margin-left: 15px;">Отмена</button>
            </div>
        `;
    }
    
    if (currentView === 'list') {
        let html = globalProgressHtml + '<div class="file-list">';
        for (const item of sorted) {
            const isChecked = selectedFiles.has(item.id);
            const displaySize = getItemDisplaySize(item);
            const progress = activeProgress[item.id];
            const fileExt = getFileExtension(item.name);
            const formattedDate = formatDate(item.modifiedTime || item.createdTime);
            const isFolder = item.mimeType === 'application/vnd.yandex.folder' || item.type === 'dir';
            
            let folderInfo = '';
            if (isFolder && window.yandexFolderFileCounts && window.yandexFolderFileCounts[item.id]) {
                folderInfo = ` • ${window.yandexFolderFileCounts[item.id]} файлов`;
            }
            
            html += `
                <div class="file-list-item" data-id="${item.id}" data-name="${escapeHtml(item.name)}" data-mime="${item.mimeType}" data-is-folder="${isFolder}">
                    <div class="file-check">
                        <input type="checkbox" class="file-checkbox" data-id="${item.id}" ${isChecked ? 'checked' : ''}>
                    </div>
                    <div class="file-icon file-click-area" data-id="${item.id}" data-name="${escapeHtml(item.name)}" data-mime="${item.mimeType}" data-is-folder="${isFolder}">${getItemIcon(item)}</div>
                    <div class="file-info">
                        <div class="file-name-row">
                            <span class="file-name-text" data-id="${item.id}" data-name="${escapeHtml(item.name)}" data-mime="${item.mimeType}" data-is-folder="${isFolder}" style="cursor: text; user-select: text;">${escapeHtml(item.name)}</span>
                            ${!isFolder ? `<span class="file-type-label"> (${getFileTypeLabel(fileExt)})</span>` : ''}
                            <span class="file-size">${displaySize}</span>
                            <span class="file-date">${formattedDate}</span>
                            ${isFolder ? `<span class="folder-info">${folderInfo}</span>` : ''}
                        </div>
                    </div>
                    ${progress ? `
                        <div class="progress-container">
                            <div class="progress-bar" style="width: ${progress.percent}%"></div>
                        </div>
                        <div class="progress-text">${progress.type === 'move' ? 'ПЕРЕМЕЩЕНИЕ' : ''} ${progress.percent}%</div>
                        <button class="cancel-progress-btn" data-id="${item.id}" style="margin-left: 10px; background: #f44336; color: white; border: none; border-radius: 10px; padding: 2px 8px; cursor: pointer;">Отмена</button>
                    ` : `
                        <div class="progress-container" style="opacity: 0;">
                            <div class="progress-bar" style="width: 0%"></div>
                        </div>
                        <div class="progress-text"></div>
                    `}
                </div>
            `;
        }
        html += '</div>';
        container.innerHTML = html;
    } else {
        let html = globalProgressHtml + '<div class="file-grid">';
        for (const item of sorted) {
            const isChecked = selectedFiles.has(item.id);
            const displaySize = getItemDisplaySize(item);
            const progress = activeProgress[item.id];
            const fileExt = getFileExtension(item.name);
            const formattedDate = formatDate(item.modifiedTime || item.createdTime);
            const isFolder = item.mimeType === 'application/vnd.yandex.folder' || item.type === 'dir';
            
            let folderInfo = '';
            if (isFolder && window.yandexFolderFileCounts && window.yandexFolderFileCounts[item.id]) {
                folderInfo = `<div class="folder-info">${window.yandexFolderFileCounts[item.id]} файлов</div>`;
            }
            
            html += `
                <div class="file-grid-item" data-id="${item.id}" data-name="${escapeHtml(item.name)}" data-mime="${item.mimeType}" data-is-folder="${isFolder}">
                    <div class="file-check">
                        <input type="checkbox" class="file-checkbox" data-id="${item.id}" ${isChecked ? 'checked' : ''}>
                    </div>
                    <div class="file-icon file-click-area" data-id="${item.id}" data-name="${escapeHtml(item.name)}" data-mime="${item.mimeType}" data-is-folder="${isFolder}">${getItemIcon(item)}</div>
                    <div class="file-name-text" data-id="${item.id}" data-name="${escapeHtml(item.name)}" data-mime="${item.mimeType}" data-is-folder="${isFolder}" style="cursor: text; user-select: text;">${escapeHtml(item.name)}</div>
                    ${!isFolder ? `<div class="file-type-label">${getFileTypeLabel(fileExt)}</div>` : ''}
                    <div class="file-size">${displaySize}</div>
                    <div class="file-date">${formattedDate}</div>
                    ${folderInfo}
                    ${progress ? `
                        <div class="progress-container">
                            <div class="progress-bar" style="width: ${progress.percent}%"></div>
                        </div>
                        <div class="progress-text">${progress.type === 'move' ? 'ПЕРЕМЕЩЕНИЕ' : ''} ${progress.percent}%</div>
                        <button class="cancel-progress-btn" data-id="${item.id}" style="margin-top: 5px; background: #f44336; color: white; border: none; border-radius: 10px; padding: 2px 8px; cursor: pointer;">Отмена</button>
                    ` : `
                        <div class="progress-container" style="opacity: 0;">
                            <div class="progress-bar" style="width: 0%"></div>
                        </div>
                        <div class="progress-text"></div>
                    `}
                </div>
            `;
        }
        html += '</div>';
        container.innerHTML = html;
    }
    
    attachItemEvents();
    
    const cancelGlobalBtn = document.getElementById('cancelGlobalProgressBtn');
    if (cancelGlobalBtn && globalProgress && globalProgress.cancelController) {
        cancelGlobalBtn.onclick = () => {
            globalProgress.cancelController.abort();
            globalProgress = null;
            renderItemsList(allItems);
            alert('Операция архивации отменена');
        };
    }
}

function attachItemEvents() {
    document.querySelectorAll('.file-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const itemId = cb.dataset.id;
            if (cb.checked) {
                selectedFiles.add(itemId);
            } else {
                selectedFiles.delete(itemId);
            }
            updateHeaderButtonsState();
        });
    });
    
    document.querySelectorAll('.file-click-area').forEach(area => {
        area.addEventListener('click', async (e) => {
            e.stopPropagation();
            const itemId = area.dataset.id;
            const isFolder = area.dataset.isFolder === 'true';
            const fileName = area.dataset.name;
            const fileItem = allItems.find(i => i.id === itemId);
            if (!fileItem) return;
            
            if (isFolder) {
                await enterFolder(fileItem.path, fileName);
            } else if (isImageFile(fileName)) {
                await openImageViewer(itemId, fileName);
            } else if (isZipFile(fileName)) {
                await openZipViewer(itemId, fileName);
            } else if (isMediaFile(fileName)) {
                await openMediaPlayer(itemId, fileName);
            } else {
                await openFileWithAssociation(fileItem);
            }
        });
    });
    
    document.querySelectorAll('.file-name-text').forEach(text => {
        text.addEventListener('click', async (e) => {
            e.stopPropagation();
            const itemId = text.dataset.id;
            const isFolder = text.dataset.isFolder === 'true';
            const fileName = text.dataset.name;
            const fileItem = allItems.find(i => i.id === itemId);
            if (!fileItem) return;
            
            if (isFolder) {
                await enterFolder(fileItem.path, fileName);
            } else if (isImageFile(fileName)) {
                await openImageViewer(itemId, fileName);
            } else if (isZipFile(fileName)) {
                await openZipViewer(itemId, fileName);
            } else if (isMediaFile(fileName)) {
                await openMediaPlayer(itemId, fileName);
            } else {
                await openFileWithAssociation(fileItem);
            }
        });
    });
    
    document.querySelectorAll('.cancel-progress-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const itemId = btn.dataset.id;
            if (abortControllers[itemId]) {
                abortControllers[itemId].abort();
                delete abortControllers[itemId];
            }
            if (activeProgress[itemId]) {
                delete activeProgress[itemId];
                renderItemsList(allItems);
                alert(`Процесс для элемента отменён`);
            }
        });
    });
}

// ========== ФУНКЦИИ ДЛЯ РАБОТЫ С ФАЙЛАМИ (ОСНОВНЫЕ ОПЕРАЦИИ) ==========

async function renameItem(itemId, oldFullName, newNameWithoutExt, isFolder) {
    const item = allItems.find(i => i.id === itemId);
    if (!item) return;
    
    let newFullName;
    if (isFolder) {
        newFullName = newNameWithoutExt;
    } else {
        const originalName = item.name;
        const lastDot = originalName.lastIndexOf('.');
        const ext = lastDot !== -1 ? originalName.substring(lastDot) : '';
        newFullName = newNameWithoutExt + ext;
    }
    
    let oldPath = item.path;
    if (!oldPath.startsWith('disk:')) {
        oldPath = 'disk:' + oldPath;
    }
    
    const lastSlash = item.path.lastIndexOf('/');
    const parentPath = lastSlash > 0 ? item.path.substring(0, lastSlash) : '';
    
    let newPath;
    if (parentPath === '' || parentPath === 'disk:') {
        newPath = `disk:/${newFullName}`;
    } else {
        newPath = `${parentPath}/${newFullName}`;
    }
    if (!newPath.startsWith('disk:')) {
        newPath = 'disk:' + newPath;
    }
    
    try {
        const url = `https://cloud-api.yandex.net/v1/disk/resources/move?from=${encodeURIComponent(oldPath)}&path=${encodeURIComponent(newPath)}&overwrite=false`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `OAuth ${accessToken}` }
        });
        
        if (response.ok || response.status === 202) {
            alert('Переименовано!');
            await loadItems();
        } else {
            const data = await response.json();
            alert('Ошибка переименования: ' + (data.message || data.description || 'неизвестная ошибка'));
        }
    } catch (err) {
        console.error('Rename error:', err);
        alert('Ошибка: ' + err.message);
    }
}

async function copyFile(fileId, fileName) {
    const item = allItems.find(i => i.id === fileId);
    if (!item) return;
    
    const lastDot = fileName.lastIndexOf('.');
    const name = lastDot !== -1 ? fileName.substring(0, lastDot) : fileName;
    const ext = lastDot !== -1 ? fileName.substring(lastDot) : '';
    const newName = name + ' (Копия)' + ext;
    
    let oldPath = item.path;
    if (!oldPath.startsWith('disk:')) {
        oldPath = 'disk:' + oldPath;
    }
    
    const lastSlash = item.path.lastIndexOf('/');
    const parentPath = lastSlash > 0 ? item.path.substring(0, lastSlash) : '';
    
    let newPath;
    if (parentPath === '' || parentPath === 'disk:') {
        newPath = `disk:/${newName}`;
    } else {
        newPath = `${parentPath}/${newName}`;
    }
    if (!newPath.startsWith('disk:')) {
        newPath = 'disk:' + newPath;
    }
    
    try {
        const url = `https://cloud-api.yandex.net/v1/disk/resources/copy?from=${encodeURIComponent(oldPath)}&path=${encodeURIComponent(newPath)}&overwrite=false`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `OAuth ${accessToken}` }
        });
        
        if (response.ok || response.status === 202) {
            alert(`Файл "${fileName}" скопирован!`);
            await loadItems();
        } else {
            const data = await response.json();
            alert('Ошибка копирования: ' + (data.message || data.description || 'неизвестная ошибка'));
        }
    } catch (err) {
        console.error('Copy error:', err);
        alert('Ошибка: ' + err.message);
    }
}

async function getFileLink(fileId) {
    const item = allItems.find(i => i.id === fileId);
    if (!item) throw new Error('Файл не найден');
    
    let path = item.path;
    if (!path.startsWith('disk:')) {
        path = 'disk:' + path;
    }
    
    try {
        const response = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/download?path=${encodeURIComponent(path)}`, {
            headers: { 'Authorization': `OAuth ${accessToken}` }
        });
        
        if (!response.ok) {
            throw new Error('Не удалось получить ссылку');
        }
        
        const data = await response.json();
        return data.href;
    } catch (err) {
        console.error('Get link error:', err);
        throw err;
    }
}

async function uploadFile(file, parentFolderId = currentFolderId) {
    try {
        let targetPath;
        if (parentFolderId === '/' || parentFolderId === 'disk:/') {
            targetPath = `disk:/${file.name}`;
        } else {
            let parent = parentFolderId;
            if (!parent.startsWith('disk:')) {
                parent = 'disk:' + parent;
            }
            targetPath = `${parent}/${file.name}`;
        }
        
        const uploadUrlResp = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/upload?path=${encodeURIComponent(targetPath)}&overwrite=true`, {
            method: 'GET',
            headers: { 'Authorization': `OAuth ${accessToken}` }
        });
        
        if (!uploadUrlResp.ok) {
            throw new Error('Не удалось получить URL для загрузки');
        }
        
        const uploadData = await uploadUrlResp.json();
        
        const response = await fetch(uploadData.href, {
            method: 'PUT',
            body: file
        });
        
        if (response.ok) {
            alert(`Файл "${file.name}" загружен!`);
            await loadItems();
            return true;
        } else {
            alert('Ошибка загрузки');
            return false;
        }
    } catch (err) {
        console.error('Upload error:', err);
        alert('Ошибка: ' + err.message);
        return false;
    }
}

async function createFolder(folderName, parentFolderId = currentFolderId) {
    try {
        let newPath;
        if (parentFolderId === '/' || parentFolderId === 'disk:/') {
            newPath = `disk:/${folderName}`;
        } else {
            let parent = parentFolderId;
            if (!parent.startsWith('disk:')) {
                parent = 'disk:' + parent;
            }
            newPath = `${parent}/${folderName}`;
        }
        
        const url = `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(newPath)}`;
        
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Authorization': `OAuth ${accessToken}` }
        });
        
        if (response.status === 201 || response.status === 200) {
            alert(`Папка "${folderName}" создана!`);
            await loadItems();
            return true;
        } else {
            const data = await response.json();
            alert('Ошибка создания папки: ' + (data.message || data.description));
            return false;
        }
    } catch (err) {
        console.error('Create folder error:', err);
        alert('Ошибка: ' + err.message);
        return false;
    }
}

async function downloadFile(fileId, fileName) {
    const item = allItems.find(i => i.id === fileId);
    if (!item) throw new Error('Файл не найден');
    
    let path = item.path;
    if (!path.startsWith('disk:')) {
        path = 'disk:' + path;
    }
    
    try {
        const response = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/download?path=${encodeURIComponent(path)}`, {
            headers: { 'Authorization': `OAuth ${accessToken}` }
        });
        
        if (!response.ok) {
            throw new Error('Не удалось получить ссылку для скачивания');
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


    const item = allItems.find(i => i.id === fileId);
    if (!item) throw new Error('Файл не найден');
    
    let path = item.path;
    if (!path.startsWith('disk:')) {
        path = 'disk:' + path;
    }
    
    // Получаем прямую ссылку на скачивание от Яндекс
    const response = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/download?path=${encodeURIComponent(path)}`, {
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

async function moveToTrash(itemId) {
    const item = allItems.find(i => i.id === itemId);
    if (!item) return false;
    
    let path = item.path;
    if (!path.startsWith('disk:')) {
        path = 'disk:' + path;
    }
    
    const url = `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(path)}`;
    
    try {
        const response = await fetch(url, {
            method: 'DELETE',
            headers: { 'Authorization': `OAuth ${accessToken}` }
        });
        
        if (response.status === 202 || response.status === 204) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            return true;
        } else {
            const error = await response.json();
            console.error('Move to trash error:', error);
            return false;
        }
    } catch (err) {
        console.error('Move to trash error:', err);
        return false;
    }
}

async function restoreFile(fileId) {
    const item = trashFiles.find(i => i.id === fileId);
    if (!item) return false;
    
    let path = item.path;
    if (!path.startsWith('trash:')) {
        path = 'trash:' + path;
    }
    
    const url = `https://cloud-api.yandex.net/v1/disk/trash/resources/restore?path=${encodeURIComponent(path)}`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `OAuth ${accessToken}` }
        });
        
        if (response.status === 202 || response.status === 200 || response.status === 204 || response.status === 201) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            return true;
        } else if (response.status === 409) {
            return true;
        } else {
            setTimeout(() => showTrashMode(), 2000);
            return true;
        }
    } catch (err) {
        setTimeout(() => showTrashMode(), 2000);
        return true;
    }
}

async function permanentDeleteFile(fileId) {
    const item = trashFiles.find(i => i.id === fileId);
    if (!item) return false;
    
    let path = item.path;
    if (!path.startsWith('trash:')) {
        path = 'trash:' + path;
    }
    
    const url = `https://cloud-api.yandex.net/v1/disk/trash/resources?path=${encodeURIComponent(path)}`;
    
    try {
        const response = await fetch(url, {
            method: 'DELETE',
            headers: { 'Authorization': `OAuth ${accessToken}` }
        });
        
        if (response.status === 202 || response.status === 204) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            return true;
        } else {
            return false;
        }
    } catch (err) {
        console.error('Permanent delete error:', err);
        return false;
    }
}

async function moveMultipleToTrash(items) {
    let successCount = 0;
    let failCount = 0;
    
    for (const item of items) {
        try {
            const result = await moveToTrash(item.id);
            if (result) {
                successCount++;
            } else {
                failCount++;
            }
        } catch (err) {
            failCount++;
        }
    }
    
    if (failCount === 0) {
        alert(`Удалено в корзину: ${successCount} элементов`);
    } else {
        alert(`Удалено: ${successCount}, Ошибок: ${failCount}`);
    }
    
    selectedFiles.clear();
    updateHeaderButtonsState();
    await loadItems();
}

async function restoreMultipleFiles(files) {
    let successCount = 0;
    let failCount = 0;
    
    for (const file of files) {
        try {
            const success = await restoreFile(file.id);
            if (success) {
                successCount++;
            } else {
                failCount++;
            }
        } catch (err) {
            failCount++;
        }
    }
    
    await showTrashMode();
    
    if (failCount === 0) {
        alert(`Восстановлено: ${successCount} элементов`);
    } else {
        alert(`Восстановлено: ${successCount}, Ошибок: ${failCount}`);
    }
    
    selectedFiles.clear();
    updateHeaderButtonsState();
}

async function permanentDeleteMultipleFiles(files) {
    let successCount = 0;
    let failCount = 0;
    
    for (const file of files) {
        try {
            const success = await permanentDeleteFile(file.id);
            if (success) {
                successCount++;
            } else {
                failCount++;
            }
        } catch (err) {
            failCount++;
        }
    }
    
    await showTrashMode();
    
    if (failCount === 0) {
        alert(`Удалено навсегда: ${successCount} элементов`);
    } else {
        alert(`Удалено: ${successCount}, Ошибок: ${failCount}`);
    }
    
    selectedFiles.clear();
    updateHeaderButtonsState();
}

// ========== ФУНКЦИИ API ЯНДЕКС.ДИСКА ==========

async function getItems(folderPath = '/') {
    let all = [];
    let limit = 100;
    let offset = 0;
    
    let cleanPath = folderPath;
    if (!cleanPath.startsWith('disk:')) {
        cleanPath = 'disk:' + cleanPath;
    }
    
    try {
        while (true) {
            let url = `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(cleanPath)}&limit=${limit}&offset=${offset}&fields=_embedded.items.name,_embedded.items.path,_embedded.items.created,_embedded.items.modified,_embedded.items.size,_embedded.items.type,_embedded.items.resource_id`;
            
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
                    let cleanItemPath = item.path || '';
                    if (cleanItemPath.startsWith('disk:')) {
                        cleanItemPath = cleanItemPath.substring(5);
                    }
                    if (!cleanItemPath.startsWith('/')) {
                        cleanItemPath = '/' + cleanItemPath;
                    }
                    
                    return {
                        id: item.resource_id,
                        name: item.name,
                        size: item.size || 0,
                        mimeType: item.type === 'dir' ? 'application/vnd.yandex.folder' : 'application/octet-stream',
                        createdTime: item.created,
                        modifiedTime: item.modified,
                        path: cleanItemPath,
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

async function getTrashFiles() {
    let all = [];
    let limit = 100;
    let offset = 0;
    
    try {
        while (true) {
            const url = `https://cloud-api.yandex.net/v1/disk/trash/resources?limit=${limit}&offset=${offset}`;
            
            const response = await fetch(url, {
                headers: { 'Authorization': `OAuth ${accessToken}` }
            });
            
            if (response.status === 401) {
                const newToken = await refreshAccessToken();
                if (newToken) {
                    accessToken = newToken;
                    continue;
                } else {
                    throw new Error('Token expired');
                }
            }
            
            if (response.status === 200) {
                const data = await response.json();
                const items = data._embedded?.items || [];
                
                for (const item of items) {
                    let originalPath = item.path || '';
                    
                    let displayPath = originalPath;
                    if (displayPath.startsWith('trash:')) {
                        displayPath = displayPath.substring(6);
                    }
                    if (!displayPath.startsWith('/')) {
                        displayPath = '/' + displayPath;
                    }
                    
                    all.push({
                        id: item.resource_id,
                        name: item.name,
                        size: item.size || 0,
                        mimeType: item.type === 'dir' ? 'application/vnd.yandex.folder' : 'application/octet-stream',
                        createdTime: item.created,
                        modifiedTime: item.modified,
                        path: originalPath,
                        displayPath: displayPath,
                        type: item.type
                    });
                }
                
                if (items.length === limit) {
                    offset += limit;
                } else {
                    break;
                }
            } else {
                break;
            }
        }
    } catch (err) {
        console.error('Yandex API Error:', err);
    }
    
    return all;
}

async function getFolderSize(folderPath) {
    let totalSize = 0;
    const items = await getItems(folderPath);
    
    for (const item of items) {
        if (item.mimeType === 'application/vnd.yandex.folder' || item.type === 'dir') {
            totalSize += await getFolderSize(item.path);
        } else {
            totalSize += parseInt(item.size) || 0;
        }
    }
    
    return totalSize;
}

async function getFolderFileCount(folderPath) {
    let fileCount = 0;
    const items = await getItems(folderPath);
    
    for (const item of items) {
        if (item.mimeType !== 'application/vnd.yandex.folder' && item.type !== 'dir') {
            fileCount++;
        }
    }
    
    return fileCount;
}

function renderTrashList() {
    const container = document.getElementById('filesContainer');
    
    if (!trashFiles || trashFiles.length === 0) {
        container.innerHTML = '<div class="loading">Корзина пуста</div>';
        return;
    }
    
    const sorted = sortItems(trashFiles);
    
    if (currentView === 'list') {
        let html = '<div class="file-list">';
        for (const file of sorted) {
            const isChecked = selectedFiles.has(file.id);
            const displaySize = formatFileSize(file.size);
            const formattedDate = formatDate(file.modifiedTime || file.createdTime);
            const fileExt = getFileExtension(file.name);
            const isFolder = file.mimeType === 'application/vnd.yandex.folder' || file.type === 'dir';
            
            html += `
                <div class="file-list-item" data-id="${file.id}">
                    <div class="file-check">
                        <input type="checkbox" class="file-checkbox" data-id="${file.id}" ${isChecked ? 'checked' : ''}>
                    </div>
                    <div class="file-icon">${getItemIcon(file)}</div>
                    <div class="file-info">
                        <div class="file-name-row">
                            <span class="file-name">${escapeHtml(file.name)}</span>
                            ${!isFolder ? `<span class="file-type-label"> (${getFileTypeLabel(fileExt)})</span>` : ''}
                            <span class="file-size">${displaySize}</span>
                            <span class="file-date">${formattedDate}</span>
                        </div>
                    </div>
                </div>
            `;
        }
        html += '</div>';
        container.innerHTML = html;
    } else {
        let html = '<div class="file-grid">';
        for (const file of sorted) {
            const isChecked = selectedFiles.has(file.id);
            const displaySize = formatFileSize(file.size);
            const formattedDate = formatDate(file.modifiedTime || file.createdTime);
            const fileExt = getFileExtension(file.name);
            const isFolder = file.mimeType === 'application/vnd.yandex.folder' || file.type === 'dir';
            
            html += `
                <div class="file-grid-item" data-id="${file.id}">
                    <div class="file-check">
                        <input type="checkbox" class="file-checkbox" data-id="${file.id}" ${isChecked ? 'checked' : ''}>
                    </div>
                    <div class="file-icon">${getItemIcon(file)}</div>
                    <div class="file-name">${escapeHtml(file.name)}</div>
                    ${!isFolder ? `<div class="file-type-label">${getFileTypeLabel(fileExt)}</div>` : ''}
                    <div class="file-size">${displaySize}</div>
                    <div class="file-date">${formattedDate}</div>
                </div>
            `;
        }
        html += '</div>';
        container.innerHTML = html;
    }
    
    attachTrashEvents();
}

function attachTrashEvents() {
    document.querySelectorAll('.file-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const fileId = cb.dataset.id;
            if (cb.checked) {
                selectedFiles.add(fileId);
            } else {
                selectedFiles.delete(fileId);
            }
            updateHeaderButtonsState();
        });
    });
}

async function exitTrashMode() {
    isTrashMode = false;
    selectedFiles.clear();
    folderPath = [{ id: '/', name: 'Корень' }];
    currentFolderId = '/';
    updateBreadcrumb();
    updateBreadcrumbNavigation();
    await loadItems();
}

async function showTrashMode() {
    isTrashMode = true;
    folderPath = [{ id: 'trash', name: 'Корзина' }];
    updateBreadcrumb();
    updateBreadcrumbNavigation();
    
    const container = document.getElementById('filesContainer');
    container.innerHTML = '<div class="loading">Загрузка корзины...</div>';
    
    try {
        trashFiles = await getTrashFiles();
        renderTrashList();
    } catch (err) {
        container.innerHTML = `<div class="loading">Ошибка загрузки корзины: ${err.message}</div>`;
    }
}

// ========== ФУНКЦИИ ДЛЯ ПЕРЕМЕЩЕНИЯ ВНУТРИ ХРАНИЛИЩА ==========
async function showMoveToFolderModal() {
    if (selectedFiles.size === 0) {
        alert('Выберите элементы для перемещения');
        return;
    }
    
    moveInsideItems = [];
    for (const id of selectedFiles) {
        const item = allItems.find(i => i.id === id);
        if (item) {
            moveInsideItems.push(item);
        }
    }
    
    moveInsideTargetFolderId = currentFolderId;
    
    const folders = await getFoldersList();
    renderMoveToFolderSelect(folders);
    document.getElementById('moveInsideModal').style.display = 'flex';
}

async function getFoldersList() {
    let all = [];
    let limit = 100;
    let offset = 0;
    
    try {
        while (true) {
            let url = `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent('disk:/')}&limit=${limit}&offset=${offset}&fields=_embedded.items.name,_embedded.items.path,_embedded.items.type,_embedded.items.resource_id`;
            
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
            
            if (!response.ok) break;
            
            const data = await response.json();
            
            if (data._embedded && data._embedded.items) {
                for (const item of data._embedded.items) {
                    if (item.type === 'dir') {
                        let cleanPath = item.path || '';
                        if (cleanPath.startsWith('disk:')) {
                            cleanPath = cleanPath.substring(5);
                        }
                        all.push({
                            id: item.resource_id,
                            name: item.name,
                            path: cleanPath
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
    } catch (err) {
        console.error('API Error:', err);
    }
    return all;
}

function renderMoveToFolderSelect(folders) {
    const body = document.getElementById('moveInsideBody');
    
    let html = '<div class="new-folder-input">';
    html += '<input type="text" id="moveInsideNewFolderName" placeholder="Название новой папки">';
    html += '<button id="moveInsideCreateFolderBtn">Создать</button>';
    html += '</div>';
    
    if (!folders || folders.length === 0) {
        html += '<div class="loading">Папки не найдены</div>';
    } else {
        folders.forEach(folder => {
            html += `
                <div class="folder-item" data-id="${folder.id}" data-path="${folder.path}">
                    <div class="folder-icon">📁</div>
                    <div class="folder-name">${escapeHtml(folder.name)}</div>
                </div>
            `;
        });
    }
    
    html += `
        <div class="folder-item" data-id="root" data-path="/">
            <div class="folder-icon">📁</div>
            <div class="folder-name">Корень</div>
        </div>
    `;
    
    body.innerHTML = html;
    
    document.querySelectorAll('#moveInsideBody .folder-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('#moveInsideBody .folder-item').forEach(i => i.style.background = '');
            item.style.background = '#e8eaf6';
            moveInsideTargetFolderId = item.dataset.path;
        });
    });
    
    const createBtn = document.getElementById('moveInsideCreateFolderBtn');
    if (createBtn) {
        createBtn.onclick = async () => {
            const newFolderName = document.getElementById('moveInsideNewFolderName').value.trim();
            if (!newFolderName) {
                alert('Введите название папки');
                return;
            }
            try {
                const newFolderPath = await createFolderInCurrent(newFolderName, moveInsideTargetFolderId);
                alert(`Папка "${newFolderName}" создана!`);
                document.getElementById('moveInsideNewFolderName').value = '';
                const updatedFolders = await getFoldersList();
                renderMoveToFolderSelect(updatedFolders);
                setTimeout(() => {
                    const newFolderItem = document.querySelector(`#moveInsideBody .folder-item[data-path="${newFolderPath}"]`);
                    if (newFolderItem) {
                        document.querySelectorAll('#moveInsideBody .folder-item').forEach(i => i.style.background = '');
                        newFolderItem.style.background = '#e8eaf6';
                        moveInsideTargetFolderId = newFolderPath;
                    }
                }, 100);
            } catch (err) {
                alert('Ошибка создания папки: ' + err.message);
            }
        };
    }
}

async function createFolderInCurrent(folderName, parentPath) {
    let newPath;
    if (parentPath === '/' || parentPath === 'disk:/') {
        newPath = `/${folderName}`;
    } else {
        let cleanParent = parentPath.replace('disk:', '');
        newPath = `${cleanParent}/${folderName}`;
    }
    
    const url = `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent('disk:' + newPath)}`;
    
    const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Authorization': `OAuth ${accessToken}` }
    });
    
    if (!response.ok) {
        throw new Error('Не удалось создать папку');
    }
    
    return newPath;
}

async function moveItemsToFolder(targetFolderPath) {
    if (moveInsideItems.length === 0) return;
    
    let successCount = 0;
    let failCount = 0;
    
    for (const item of moveInsideItems) {
        try {
            let oldPath = item.path;
            if (!oldPath.startsWith('disk:')) {
                oldPath = 'disk:' + oldPath;
            }
            
            let targetPath = targetFolderPath;
            if (!targetPath.startsWith('disk:')) {
                targetPath = 'disk:' + targetPath;
            }
            
            let newPath;
            if (targetPath === 'disk:/' || targetPath === 'disk:') {
                newPath = `disk:/${item.name}`;
            } else {
                newPath = `${targetPath}/${item.name}`;
            }
            
            const url = `https://cloud-api.yandex.net/v1/disk/resources/move?from=${encodeURIComponent(oldPath)}&path=${encodeURIComponent(newPath)}&overwrite=false`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Authorization': `OAuth ${accessToken}` }
            });
            
            if (response.ok || response.status === 202) {
                successCount++;
            } else {
                const error = await response.json();
                console.error('Move error:', error);
                failCount++;
            }
        } catch (err) {
            console.error(`Error moving ${item.name}:`, err);
            failCount++;
        }
    }
    
    if (failCount === 0) {
        alert(`Перемещено ${successCount} элементов`);
    } else {
        alert(`Перемещено: ${successCount}, Ошибок: ${failCount}`);
    }
    
    moveInsideItems = [];
    selectedFiles.clear();
    updateHeaderButtonsState();
    
    if (targetFolderPath && !targetFolderPath.startsWith('disk:')) {
        currentFolderId = targetFolderPath;
    }
    
    await loadItems();
}

// ========== ФУНКЦИИ ДЛЯ ПРОСМОТРА ФАЙЛОВ С АССОЦИАЦИЯМИ ==========
async function showProgramChooser(fileItem) {
    const ext = getFileExtension(fileItem.name).toLowerCase();
    const fileName = fileItem.name;
    const fileId = fileItem.id;
    
    const modal = document.createElement('div');
    modal.className = 'share-modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="share-modal-content" style="width: 400px;">
            <h3>Открыть файл "${escapeHtml(fileName)}"</h3>
            <div class="share-cloud-list" style="margin-bottom: 10px;">
                <div class="share-cloud-item" data-action="system">
                    <div class="share-cloud-icon" style="font-size: 32px;">💻</div>
                    <div class="share-cloud-info">
                        <div class="share-cloud-name">Системная программа по умолчанию</div>
                        <div class="share-cloud-email">Открыть в программе, назначенной в системе для .${ext}</div>
                    </div>
                </div>
                <div class="share-cloud-item" data-action="browser">
                    <div class="share-cloud-icon" style="font-size: 32px;">🌐</div>
                    <div class="share-cloud-info">
                        <div class="share-cloud-name">Встроенный просмотр</div>
                        <div class="share-cloud-email">Если поддерживается браузером</div>
                    </div>
                </div>
                <div class="share-cloud-item" data-action="download">
                    <div class="share-cloud-icon" style="font-size: 32px;">📥</div>
                    <div class="share-cloud-info">
                        <div class="share-cloud-name">Скачать и открыть</div>
                        <div class="share-cloud-email">Скачать файл и открыть в системе</div>
                    </div>
                </div>
            </div>
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #eee;">
                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                    <input type="checkbox" id="rememberChoice" style="width: 18px; height: 18px;">
                    <span>Запомнить выбор для всех файлов .${ext}</span>
                </label>
            </div>
            <button class="share-cancel-btn" id="programChooserCancelBtn" style="margin-top: 15px;">Отмена</button>
        </div>
    `;
    document.body.appendChild(modal);
    
    const handleChoice = async (action) => {
        const remember = modal.querySelector('#rememberChoice').checked;
        if (remember && action !== 'cancel') {
            setAssociation(ext, action);
        }
        modal.remove();
        
        if (action === 'system') {
            await openWithSystemDefault(fileId, fileName);
        } else if (action === 'browser') {
            await openInBrowser(fileId, fileName);
        } else if (action === 'download') {
            await downloadAndOpen(fileId, fileName);
        }
    };
    
    modal.querySelectorAll('.share-cloud-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            handleChoice(action);
        });
    });
    
    modal.querySelector('#programChooserCancelBtn').onclick = () => {
        modal.remove();
    };
}

async function openWithSystemDefault(fileId, fileName) {
    try {
        await downloadFile(fileId, fileName);
        alert(`Файл "${fileName}" скачан. Откройте его в папке "Загрузки"`);
    } catch (err) {
        alert('Ошибка: ' + err.message);
    }
}

async function openInBrowser(fileId, fileName) {
    try {
        const blob = await downloadFileAsBlob(fileId);
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
        alert('Ошибка: ' + err.message);
    }
}

async function downloadAndOpen(fileId, fileName) {
    await openWithSystemDefault(fileId, fileName);
}

async function openFileWithAssociation(fileItem) {
    const fileName = fileItem.name;
    const fileId = fileItem.id;
    const ext = getFileExtension(fileName).toLowerCase();
    
    const association = getAssociation(ext);
    
    if (association === 'system') {
        await openWithSystemDefault(fileId, fileName);
    } else if (association === 'browser') {
        await openInBrowser(fileId, fileName);
    } else if (association === 'download') {
        await downloadAndOpen(fileId, fileName);
    } else {
        await showProgramChooser(fileItem);
    }
}

// ========== ФУНКЦИИ ДЛЯ ОБНОВЛЕНИЯ СТАТИСТИКИ И ТОКЕНА ==========
async function updateStats() {
    if (isTrashMode) return;
    try {
        let response = await fetch(`https://cloud-api.yandex.net/v1/disk/`, {
            headers: { 'Authorization': `OAuth ${accessToken}` }
        });
        
        if (response.status === 401) {
            const newToken = await refreshAccessToken();
            if (newToken) {
                accessToken = newToken;
                response = await fetch(`https://cloud-api.yandex.net/v1/disk/`, {
                    headers: { 'Authorization': `OAuth ${accessToken}` }
                });
            } else {
                throw new Error('Token expired');
            }
        }
        
        const data = await response.json();
        usedBytes = data.used_space || 0;
        const usedGB = usedBytes / (1024 * 1024 * 1024);
        const percent = (usedGB / limitGB) * 100;
        const percentFormatted = percent.toFixed(1);
        
        document.getElementById('usedValue').innerHTML = `${usedGB.toFixed(2)} ГБ`;
        const percentElem = document.getElementById('percentValue');
        percentElem.innerHTML = `${percentFormatted}%`;
        const bgColor = getColorForPercent(Math.min(100, percent));
        percentElem.style.backgroundColor = bgColor;
        percentElem.style.color = percent > 50 ? 'white' : '#1a237e';
        
        return { usedBytes, usedGB, percent };
    } catch (err) {
        console.error(err);
        document.getElementById('usedValue').innerHTML = '— ГБ';
        document.getElementById('percentValue').innerHTML = '—%';
        return null;
    }
}

async function saveLimit(newLimit) {
    if (newLimit < 1) newLimit = 1;
    limitGB = newLimit;
    document.getElementById('limitInput').value = limitGB;
    localStorage.setItem(`limit_${email}`, limitGB);
    await updateStats();
    alert(`Лимит установлен: ${limitGB} ГБ`);
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
    if (!container) return;
    
    container.innerHTML = '<div class="loading">Загрузка...</div>';
    try {
        allItems = await getItems(currentFolderId);
        
        window.yandexFolderFileCounts = {};
        window.yandexFolderSizes = {};
        
        for (const item of allItems) {
            if (item.mimeType === 'application/vnd.yandex.folder' || item.type === 'dir') {
                const fileCount = await getFolderFileCount(item.path);
                window.yandexFolderFileCounts[item.id] = fileCount;
                const folderSize = await getFolderSize(item.path);
                window.yandexFolderSizes[item.id] = folderSize;
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

// ========== ФУНКЦИИ ДЛЯ АРХИВИРОВАНИЯ ==========
async function downloadFileAsBlobWithCancel(fileId, signal) {
    const item = allItems.find(i => i.id === fileId);
    if (!item) throw new Error('Файл не найден');
    
    let path = item.path;
    if (!path.startsWith('disk:')) {
        path = 'disk:' + path;
    }
    
    const response = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/download?path=${encodeURIComponent(path)}`, {
        headers: { 'Authorization': `OAuth ${accessToken}` },
        signal: signal
    });
    
    const data = await response.json();
    const downloadResponse = await fetch(data.href, { signal: signal });
    return await downloadResponse.blob();
}

async function downloadFileAsBlob(fileId) {
    const item = allItems.find(i => i.id === fileId);
    if (!item) throw new Error('Файл не найден');
    
    let path = item.path;
    if (!path.startsWith('disk:')) {
        path = 'disk:' + path;
    }
    
    const response = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/download?path=${encodeURIComponent(path)}`, {
        headers: { 'Authorization': `OAuth ${accessToken}` }
    });
    const data = await response.json();
    const downloadResponse = await fetch(data.href);
    return await downloadResponse.blob();
}

async function addFolderToZipWithCancel(zip, folderId, folderName, signal, onProgress, totalSize, processedSize) {
    if (signal && signal.aborted) throw new Error('Cancelled');
    
    const folderZip = zip.folder(folderName);
    const folderItem = allItems.find(i => i.id === folderId);
    if (!folderItem) return;
    
    const items = await getItems(folderItem.path);
    
    for (const item of items) {
        if (signal && signal.aborted) throw new Error('Cancelled');
        
        if (item.mimeType === 'application/vnd.yandex.folder' || item.type === 'dir') {
            await addFolderToZipWithCancel(folderZip, item.id, item.name, signal, onProgress, totalSize, processedSize);
        } else {
            const fileBlob = await downloadFileAsBlob(item.id);
            folderZip.file(item.name, fileBlob);
            processedSize.current += parseInt(item.size) || 0;
            if (onProgress && totalSize && totalSize > 0) {
                const percent = Math.min(100, Math.round((processedSize.current / totalSize) * 100));
                onProgress(percent);
            }
        }
    }
}

async function archiveAndDownloadWithProgress(items) {
    const abortController = new AbortController();
    globalProgress = {
        type: 'archive',
        percent: 0,
        cancelController: abortController
    };
    renderItemsList(allItems);
    
    try {
        const zip = new JSZip();
        let totalSize = 0;
        
        for (const item of items) {
            if (abortController.signal.aborted) throw new Error('Cancelled');
            if (item.mimeType === 'application/vnd.yandex.folder' || item.type === 'dir') {
                totalSize += await getFolderSize(item.path);
            } else {
                totalSize += parseInt(item.size) || 0;
            }
        }
        
        let processedSize = { current: 0 };
        
        const updateProgress = (percent) => {
            if (globalProgress) {
                globalProgress.percent = percent;
                renderItemsList(allItems);
            }
        };
        
        for (const item of items) {
            if (abortController.signal.aborted) throw new Error('Cancelled');
            
            if (item.mimeType === 'application/vnd.yandex.folder' || item.type === 'dir') {
                await addFolderToZipWithCancel(zip, item.id, item.name, abortController.signal, updateProgress, totalSize, processedSize);
            } else {
                const fileBlob = await downloadFileAsBlob(item.id);
                zip.file(item.name, fileBlob);
                processedSize.current += parseInt(item.size) || 0;
                if (totalSize > 0) {
                    const percent = Math.min(100, Math.round((processedSize.current / totalSize) * 100));
                    updateProgress(percent);
                }
            }
        }
        
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `archive_${Date.now()}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        globalProgress = null;
        renderItemsList(allItems);
        alert(`Архив создан и скачан! Содержит ${items.length} элементов.`);
    } catch (err) {
        if (err.message === 'Cancelled') {
            globalProgress = null;
            renderItemsList(allItems);
            alert(`Архивация отменена`);
        } else {
            alert('Ошибка создания архива: ' + err.message);
            globalProgress = null;
            renderItemsList(allItems);
        }
    }
}

async function archiveAndSaveWithProgress(items) {
    const abortController = new AbortController();
    globalProgress = {
        type: 'archive',
        percent: 0,
        cancelController: abortController
    };
    renderItemsList(allItems);
    
    try {
        const zip = new JSZip();
        let totalSize = 0;
        
        for (const item of items) {
            if (abortController.signal.aborted) throw new Error('Cancelled');
            if (item.mimeType === 'application/vnd.yandex.folder' || item.type === 'dir') {
                totalSize += await getFolderSize(item.path);
            } else {
                totalSize += parseInt(item.size) || 0;
            }
        }
        
        let processedSize = { current: 0 };
        
        const updateProgress = (percent) => {
            if (globalProgress) {
                globalProgress.percent = percent;
                renderItemsList(allItems);
            }
        };
        
        for (const item of items) {
            if (abortController.signal.aborted) throw new Error('Cancelled');
            
            if (item.mimeType === 'application/vnd.yandex.folder' || item.type === 'dir') {
                await addFolderToZipWithCancel(zip, item.id, item.name, abortController.signal, updateProgress, totalSize, processedSize);
            } else {
                const fileBlob = await downloadFileAsBlob(item.id);
                zip.file(item.name, fileBlob);
                processedSize.current += parseInt(item.size) || 0;
                if (totalSize > 0) {
                    const percent = Math.min(100, Math.round((processedSize.current / totalSize) * 100));
                    updateProgress(percent);
                }
            }
        }
        
        const content = await zip.generateAsync({ type: 'blob' });
        const archiveName = `archive_${Date.now()}.zip`;
        const archiveSize = content.size;
        
        const currentUsed = usedBytes;
        const newTotal = currentUsed + archiveSize;
        const limitBytes = limitGB * 1024 * 1024 * 1024;
        
        if (newTotal > limitBytes) {
            const needGB = (newTotal - limitBytes) / (1024 * 1024 * 1024);
            const userChoice = confirm(
                `Недостаточно места в хранилище!\n\n` +
                `Текущее использование: ${formatFileSize(currentUsed)}\n` +
                `Лимит: ${limitGB} ГБ\n` +
                `Необходимо дополнительно: ~${needGB.toFixed(2)} ГБ\n\n` +
                `Хотите перейти в меню агрегатора для увеличения хранилища?`
            );
            if (userChoice) {
                window.open('https://disk.yandex.ru/client', '_blank');
            }
            globalProgress = null;
            renderItemsList(allItems);
            return;
        }
        
        const uploadSuccess = await uploadFile(new File([content], archiveName), currentFolderId);
        
        if (uploadSuccess) {
            alert(`Архив "${archiveName}" сохранён в хранилище! Содержит ${items.length} элементов.`);
            globalProgress = null;
            await loadItems();
        } else {
            alert('Ошибка сохранения архива');
            globalProgress = null;
            renderItemsList(allItems);
        }
    } catch (err) {
        if (err.message === 'Cancelled') {
            globalProgress = null;
            renderItemsList(allItems);
            alert(`Архивация отменена`);
        } else {
            alert('Ошибка: ' + err.message);
            globalProgress = null;
            renderItemsList(allItems);
        }
    }
}

async function archiveAndShareWithProgress(items, targetToken, targetName, targetFolderId, targetService) {
    const abortController = new AbortController();
    globalProgress = {
        type: 'move',
        percent: 0,
        cancelController: abortController
    };
    renderItemsList(allItems);
    
    try {
        const zip = new JSZip();
        let totalSize = 0;
        
        for (const item of items) {
            if (abortController.signal.aborted) throw new Error('Cancelled');
            if (item.mimeType === 'application/vnd.yandex.folder' || item.type === 'dir') {
                totalSize += await getFolderSize(item.path);
            } else {
                totalSize += parseInt(item.size) || 0;
            }
        }
        
        let processedSize = { current: 0 };
        
        const updateProgress = (percent) => {
            if (globalProgress) {
                globalProgress.percent = percent;
                renderItemsList(allItems);
            }
        };
        
        for (const item of items) {
            if (abortController.signal.aborted) throw new Error('Cancelled');
            
            if (item.mimeType === 'application/vnd.yandex.folder' || item.type === 'dir') {
                await addFolderToZipWithCancel(zip, item.id, item.name, abortController.signal, updateProgress, totalSize, processedSize);
            } else {
                const fileBlob = await downloadFileAsBlob(item.id);
                zip.file(item.name, fileBlob);
                processedSize.current += parseInt(item.size) || 0;
                if (totalSize > 0) {
                    const percent = Math.min(100, Math.round((processedSize.current / totalSize) * 100));
                    updateProgress(percent);
                }
            }
        }
        
        const content = await zip.generateAsync({ type: 'blob' });
        const archiveName = `archive_${Date.now()}.zip`;
        
        let uploadSuccess = false;
        let currentToken = targetToken;
        
        if (targetService === 'google') {
            const metadata = {
                name: archiveName,
                mimeType: 'application/zip',
                parents: targetFolderId === 'root' ? [] : [targetFolderId]
            };
            
            const formData = new FormData();
            formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            formData.append('file', content, archiveName);
            
            let response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${currentToken}` },
                body: formData,
                signal: abortController.signal
            });
            
            if (response.status === 401) {
                console.log('Google token expired, refreshing...');
                const newToken = await refreshTargetToken('google', currentToken);
                if (newToken) {
                    currentToken = newToken;
                    response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${currentToken}` },
                        body: formData,
                        signal: abortController.signal
                    });
                } else {
                    throw new Error('Token expired');
                }
            }
            
            const result = await response.json();
            uploadSuccess = !!result.id;
            
        } else if (targetService === 'yandex') {
            let targetPath = targetFolderId === '/' ? `/${archiveName}` : `${targetFolderId}/${archiveName}`;
            
            let uploadUrlResponse = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/upload?path=${encodeURIComponent(targetPath)}&overwrite=true`, {
                method: 'GET',
                headers: { 'Authorization': `OAuth ${currentToken}` }
            });
            
            if (uploadUrlResponse.status === 401) {
                console.log('Yandex token expired, refreshing...');
                const newToken = await refreshTargetToken('yandex', currentToken);
                if (newToken) {
                    currentToken = newToken;
                    uploadUrlResponse = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/upload?path=${encodeURIComponent(targetPath)}&overwrite=true`, {
                        method: 'GET',
                        headers: { 'Authorization': `OAuth ${currentToken}` }
                    });
                } else {
                    throw new Error('Token expired');
                }
            }
            
            const uploadData = await uploadUrlResponse.json();
            const uploadUrl = uploadData.href;
            
            let uploadResponse = await fetch(uploadUrl, {
                method: 'PUT',
                body: content,
                signal: abortController.signal
            });
            
            uploadSuccess = uploadResponse.ok;
        }
        
        if (uploadSuccess) {
            globalProgress = null;
            renderItemsList(allItems);
            alert(`Архив "${archiveName}" перемещён в облако "${targetName}"! Содержит ${items.length} элементов.`);
            await loadItems();
        } else {
            throw new Error('Upload failed');
        }
    } catch (err) {
        if (err.message === 'Cancelled') {
            globalProgress = null;
            renderItemsList(allItems);
            alert(`Перемещение архива отменено`);
        } else {
            console.error('Archive share error:', err);
            alert('Ошибка перемещения архива: ' + err.message);
            globalProgress = null;
            renderItemsList(allItems);
        }
    }
}

async function showArchiveMenuForItems(items) {
    const modal = document.createElement('div');
    modal.className = 'share-modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="share-modal-content" style="width: 350px;">
            <h3>Архивировать (${items.length} элементов)</h3>
            <div class="share-cloud-list" style="margin-bottom: 10px;">
                <div class="share-cloud-item" data-action="download">
                    <div class="share-cloud-icon" style="font-size: 32px;">📥</div>
                    <div class="share-cloud-info">
                        <div class="share-cloud-name">Архивировать и скачать</div>
                        <div class="share-cloud-email">Создать архив и скачать на устройство</div>
                    </div>
                </div>
                <div class="share-cloud-item" data-action="save">
                    <div class="share-cloud-icon" style="font-size: 32px;">💾</div>
                    <div class="share-cloud-info">
                        <div class="share-cloud-name">Архивировать и сохранить</div>
                        <div class="share-cloud-email">Создать архив и сохранить в хранилище</div>
                    </div>
                </div>
                <div class="share-cloud-item" data-action="share">
                    <div class="share-cloud-icon" style="font-size: 32px;">☁️</div>
                    <div class="share-cloud-info">
                        <div class="share-cloud-name">Архивировать и переместить</div>
                        <div class="share-cloud-email">Создать архив и переместить в другое облако</div>
                    </div>
                </div>
            </div>
            <button class="share-cancel-btn" id="archiveMenuCancelBtn">Отмена</button>
        </div>
    `;
    document.body.appendChild(modal);
    
    const handleCancel = () => modal.remove();
    modal.querySelector('#archiveMenuCancelBtn').onclick = handleCancel;
    
    modal.querySelectorAll('.share-cloud-item').forEach(btn => {
        btn.addEventListener('click', async () => {
            const action = btn.dataset.action;
            modal.remove();
            
            if (action === 'download') {
                await archiveAndDownloadWithProgress(items);
            } else if (action === 'save') {
                await archiveAndSaveWithProgress(items);
            } else if (action === 'share') {
                const allAccounts = JSON.parse(localStorage.getItem('nimbus_accounts') || '[]');
                const otherAccounts = allAccounts.filter(acc => acc.email !== email);
                
                if (otherAccounts.length === 0) {
                    alert('Нет других подключенных облаков. Сначала подключите хотя бы одно другое облако.');
                    return;
                }
                
                const cloudModal = document.createElement('div');
                cloudModal.className = 'share-modal';
                cloudModal.style.display = 'flex';
                cloudModal.innerHTML = `
                    <div class="share-modal-content" style="width: 400px;">
                        <h3>Выберите облако для перемещения архива</h3>
                        <div class="share-cloud-list" id="archiveShareCloudsList"></div>
                        <button class="share-cancel-btn" id="archiveShareCancelBtn">Отмена</button>
                    </div>
                `;
                document.body.appendChild(cloudModal);
                
                const container = cloudModal.querySelector('#archiveShareCloudsList');
                let selectedTarget = null;
                
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
                        selectedTarget = acc;
                        cloudModal.remove();
                        
                        const folders = await loadFoldersForTargetUniversal(acc.accessToken, acc.service);
                        
                        const folderModal = document.createElement('div');
                        folderModal.className = 'folder-select-modal';
                        folderModal.style.display = 'flex';
                        folderModal.innerHTML = `
                            <div class="folder-select-content">
                                <div class="folder-select-header">
                                    <h3>Выберите папку для перемещения архива</h3>
                                    <button class="folder-select-close" id="folderSelectCloseBtn">×</button>
                                </div>
                                <div class="folder-select-body" id="folderSelectBody">
                                    <div class="loading">Загрузка папок...</div>
                                </div>
                                <div class="folder-select-footer">
                                    <button class="folder-select-btn cancel" id="folderSelectCancelBtn">Отмена</button>
                                    <button class="folder-select-btn create" id="folderSelectCreateBtn">➕ Создать папку</button>
                                    <button class="folder-select-btn" id="folderSelectConfirmBtn">Переместить сюда</button>
                                </div>
                            </div>
                        `;
                        document.body.appendChild(folderModal);
                        
                        let selectedFolderId = acc.service === 'yandex' ? '/' : 'root';
                        
                        const renderFolderSelect = (foldersList) => {
                            const body = folderModal.querySelector('#folderSelectBody');
                            
                            let html = '<div class="new-folder-input">';
                            html += '<input type="text" id="newFolderNameInput" placeholder="Название новой папки">';
                            html += '<button id="createNewFolderBtn">Создать</button>';
                            html += '</div>';
                            
                            if (!foldersList || foldersList.length === 0) {
                                html += '<div class="loading">Папки не найдены</div>';
                            } else {
                                foldersList.forEach(folder => {
                                    const folderValue = folder.path || folder.id;
                                    html += `
                                        <div class="folder-item" data-id="${folderValue}" data-path="${folderValue}">
                                            <div class="folder-icon">📁</div>
                                            <div class="folder-name">${escapeHtml(folder.name)}</div>
                                        </div>
                                    `;
                                });
                            }
                            
                            if (acc.service === 'yandex') {
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
                            
                            body.querySelectorAll('.folder-item').forEach(folderItem => {
                                folderItem.addEventListener('click', () => {
                                    body.querySelectorAll('.folder-item').forEach(i => i.style.background = '');
                                    folderItem.style.background = '#e8eaf6';
                                    selectedFolderId = folderItem.dataset.path || folderItem.dataset.id;
                                });
                            });
                            
                            const createNewBtn = body.querySelector('#createNewFolderBtn');
                            if (createNewBtn) {
                                createNewBtn.onclick = async () => {
                                    const newFolderName = body.querySelector('#newFolderNameInput').value.trim();
                                    if (!newFolderName) {
                                        alert('Введите название папки');
                                        return;
                                    }
                                    try {
                                        const newFolderId = await createFolderInTargetUniversal(selectedTarget.accessToken, newFolderName, selectedFolderId, selectedTarget.service);
                                        alert(`Папка "${newFolderName}" создана!`);
                                        const updatedFolders = await loadFoldersForTargetUniversal(selectedTarget.accessToken, selectedTarget.service);
                                        renderFolderSelect(updatedFolders);
                                        setTimeout(() => {
                                            const newFolderItem = body.querySelector(`.folder-item[data-id="${newFolderId}"]`);
                                            if (newFolderItem) {
                                                body.querySelectorAll('.folder-item').forEach(i => i.style.background = '');
                                                newFolderItem.style.background = '#e8eaf6';
                                                selectedFolderId = newFolderId;
                                            }
                                        }, 100);
                                    } catch (err) {
                                        alert('Ошибка создания папки: ' + err.message);
                                    }
                                };
                            }
                        };
                        
                        const foldersList = await loadFoldersForTargetUniversal(acc.accessToken, acc.service);
                        renderFolderSelect(foldersList);
                        
                        folderModal.querySelector('#folderSelectCloseBtn').onclick = () => folderModal.remove();
                        folderModal.querySelector('#folderSelectCancelBtn').onclick = () => folderModal.remove();
                        folderModal.querySelector('#folderSelectConfirmBtn').onclick = async () => {
                            folderModal.remove();
                            await archiveAndShareWithProgress(items, selectedTarget.accessToken, selectedTarget.name, selectedFolderId, selectedTarget.service);
                        };
                    });
                    container.appendChild(item);
                });
                
                cloudModal.querySelector('#archiveShareCancelBtn').onclick = () => cloudModal.remove();
            }
        });
    });
}

// ========== ХЛЕБНЫЕ КРОШКИ (НАВИГАЦИЯ) ==========

function updateBreadcrumbNavigation() {
    const container = document.getElementById('breadcrumbContainer');
    if (!container) return;
    
    if (typeof isTrashMode === 'undefined') return;
    if (typeof folderPath === 'undefined') return;
    
    if (isTrashMode) {
        container.innerHTML = '';
        return;
    }
    
    let html = '';
    
    folderPath.forEach((folder, index) => {
        const isLast = index === folderPath.length - 1;
        const folderName = folder.name === 'Корень' ? 'Хранилище' : folder.name;
        
        if (isLast) {
            html += `<span class="breadcrumb-current">${escapeHtml(folderName)}</span>`;
        } else {
            html += `<a class="breadcrumb-item" data-folder-id="${folder.id}" data-folder-name="${folder.name}">${escapeHtml(folderName)}</a>`;
            html += `<span class="breadcrumb-separator">›</span>`;
        }
    });
    
    container.innerHTML = html;
    
    container.querySelectorAll('.breadcrumb-item').forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            const folderId = link.dataset.folderId;
            
            const index = folderPath.findIndex(f => f.id === folderId);
            if (index !== -1) {
                folderPath = folderPath.slice(0, index + 1);
                currentFolderId = folderId;
                updateBreadcrumb();
                updateBreadcrumbNavigation();
                await loadItems();
            }
        });
    });
}

// ========== ОБРАБОТЧИКИ КНОПОК ХЕДЕРА ==========

document.getElementById('renameBtn').onclick = () => {
    if (selectedFiles.size === 0) {
        alert('Выберите файл для переименования');
        return;
    }
    if (selectedFiles.size > 1) {
        alert('Переименовать можно только один файл за раз');
        return;
    }
    
    const itemId = Array.from(selectedFiles)[0];
    const item = allItems.find(i => i.id === itemId);
    if (!item) return;
    
    const isFolder = item.mimeType === 'application/vnd.yandex.folder' || item.type === 'dir';
    const oldName = item.name;
    let oldNameWithoutExt = oldName;
    let ext = '';
    
    if (!isFolder) {
        const lastDot = oldName.lastIndexOf('.');
        if (lastDot !== -1) {
            oldNameWithoutExt = oldName.substring(0, lastDot);
            ext = oldName.substring(lastDot);
        }
    }
    
    const newName = prompt(`Введите новое имя ${isFolder ? 'папки' : 'файла'}:`, oldNameWithoutExt);
    if (!newName || newName.trim() === '') return;
    
    renameItem(itemId, oldName, newName.trim(), isFolder);
};

document.getElementById('copyBtn').onclick = async () => {
    if (selectedFiles.size === 0) {
        alert('Выберите файлы или папки для копирования');
        return;
    }
    
    const itemsToCopy = [];
    for (const id of selectedFiles) {
        const item = allItems.find(i => i.id === id);
        if (item) {
            itemsToCopy.push(item);
        }
    }
    
    for (const item of itemsToCopy) {
        const isFolder = item.mimeType === 'application/vnd.yandex.folder' || item.type === 'dir';
        if (isFolder) {
            alert(`Копирование папок будет добавлено в следующей версии. Папка "${item.name}" не скопирована.`);
            continue;
        }
        await copyFile(item.id, item.name);
    }
    
    selectedFiles.clear();
    updateHeaderButtonsState();
    await loadItems();
};

document.getElementById('printBtn').onclick = async () => {
    if (selectedFiles.size === 0) {
        alert('Выберите файл для печати');
        return;
    }
    
    if (selectedFiles.size > 1) {
        alert('Для печати можно выбрать только один файл');
        return;
    }
    
    const itemId = Array.from(selectedFiles)[0];
    const item = allItems.find(i => i.id === itemId);
    if (!item) return;
    
    const isFolder = item.mimeType === 'application/vnd.yandex.folder' || item.type === 'dir';
    if (isFolder) {
        alert('Папку нельзя распечатать');
        return;
    }
    
    const fileName = item.name.toLowerCase();
    const printFormats = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.pdf', '.txt'];
    
    const isPrintFormat = printFormats.some(ext => fileName.endsWith(ext));
    if (!isPrintFormat) {
        alert('Печать доступна только для изображений и текстовых документов');
        return;
    }
    
    try {
        const blob = await downloadFileAsBlob(itemId);
        const url = URL.createObjectURL(blob);
        
        if (fileName.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/)) {
            const img = new Image();
            img.onload = () => {
                const printWindow = window.open('', '_blank');
                printWindow.document.write(`
                    <html>
                        <head><title>Печать: ${escapeHtml(item.name)}</title></head>
                        <body style="margin:0; display:flex; justify-content:center; align-items:center; min-height:100vh;">
                            <img src="${url}" style="max-width:100%; max-height:100%;">
                        </body>
                    </html>
                `);
                printWindow.document.close();
                printWindow.print();
                URL.revokeObjectURL(url);
            };
            img.src = url;
        } else {
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                    <head><title>Печать: ${escapeHtml(item.name)}</title></head>
                    <body>
                        <iframe src="${url}" style="width:100%; height:100%; border:none;"></iframe>
                    </body>
                </html>
            `);
            printWindow.document.close();
            setTimeout(() => {
                printWindow.print();
            }, 1000);
            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 5000);
        }
    } catch (err) {
        alert('Ошибка при подготовке файла к печати: ' + err.message);
    }
};

document.getElementById('linkBtn').onclick = async () => {
    if (selectedFiles.size === 0) {
        alert('Выберите файл для получения ссылки');
        return;
    }
    
    if (selectedFiles.size > 1) {
        alert('Ссылку можно получить только для одного файла');
        return;
    }
    
    const itemId = Array.from(selectedFiles)[0];
    const item = allItems.find(i => i.id === itemId);
    if (!item) return;
    
    const isFolder = item.mimeType === 'application/vnd.yandex.folder' || item.type === 'dir';
    if (isFolder) {
        alert('Для папок ссылка недоступна');
        return;
    }
    
    try {
        const link = await getFileLink(itemId);
        await navigator.clipboard.writeText(link);
        alert('Ссылка на файл скопирована в буфер обмена!');
    } catch (err) {
        alert('Ошибка получения ссылки: ' + err.message);
    }
};

document.getElementById('shareBtn').onclick = () => {
    if (selectedFiles.size === 0) {
        alert('Выберите файлы или папки для перемещения');
        return;
    }
    
    const allAccounts = JSON.parse(localStorage.getItem('nimbus_accounts') || '[]');
    const otherAccounts = allAccounts.filter(acc => acc.email !== email);
    
    if (otherAccounts.length === 0) {
        alert('Нет других подключенных облаков. Сначала подключите хотя бы одно другое облако.');
        return;
    }
    
    if (typeof showShareCloudModal === 'function') {
        const itemId = Array.from(selectedFiles)[0];
        const item = allItems.find(i => i.id === itemId);
        if (item) {
            let size = 0;
            if (item.mimeType === 'application/vnd.yandex.folder' || item.type === 'dir') {
                size = window.yandexFolderSizes?.[itemId] || 0;
            } else {
                size = parseInt(item.size) || 0;
            }
            showShareCloudModal(itemId, item.name, item.mimeType === 'application/vnd.yandex.folder' || item.type === 'dir', size, item.path, 'yandex');
        }
    } else {
        alert('Функция перемещения между облаками временно недоступна');
    }
};

document.getElementById('archiveBtn').onclick = async () => {
    if (selectedFiles.size === 0) {
        alert('Выберите файлы или папки для архивации');
        return;
    }
    
    const itemsToArchive = [];
    for (const id of selectedFiles) {
        const item = allItems.find(i => i.id === id);
        if (item) {
            itemsToArchive.push(item);
        }
    }
    
    await showArchiveMenuForItems(itemsToArchive);
};

document.getElementById('saveBtn').onclick = async () => {
    if (selectedFiles.size === 0) {
        alert('Выберите файлы для скачивания');
        return;
    }
    
    const itemsToDownload = [];
    let hasFolder = false;
    
    for (const id of selectedFiles) {
        const item = allItems.find(i => i.id === id);
        if (item) {
            if (item.mimeType === 'application/vnd.yandex.folder' || item.type === 'dir') {
                hasFolder = true;
            } else {
                itemsToDownload.push(item);
            }
        }
    }
    
    if (hasFolder) {
        alert('Папки нельзя скачать. Для скачивания папок используйте архивацию.');
    }
    
    if (itemsToDownload.length === 0) {
        if (!hasFolder) alert('Нет файлов для скачивания');
        return;
    }
    
    if (itemsToDownload.length === 1) {
        try {
            await downloadFile(itemsToDownload[0].id, itemsToDownload[0].name);
            alert(`Файл "${itemsToDownload[0].name}" скачан`);
        } catch (err) {
            alert('Ошибка скачивания: ' + err.message);
        }
    } else {
        for (const file of itemsToDownload) {
            try {
                await downloadFile(file.id, file.name);
            } catch (err) {
                console.error(`Ошибка скачивания ${file.name}:`, err);
            }
        }
        alert(`Скачано ${itemsToDownload.length} файлов`);
    }
    
    selectedFiles.clear();
    updateHeaderButtonsState();
};

document.getElementById('folderBtn').onclick = async () => {
    await showMoveToFolderModal();
};

document.getElementById('viewBtnAction')?.addEventListener('click', async () => {
    if (selectedFiles.size !== 1) {
        alert('Выберите один файл для просмотра');
        return;
    }
    
    const itemId = Array.from(selectedFiles)[0];
    const item = allItems.find(i => i.id === itemId);
    if (!item) return;
    
    if (item.mimeType === 'application/vnd.yandex.folder' || item.type === 'dir') {
        alert('Папку нельзя просмотреть');
        return;
    }
    
    if (isImageFile(item.name)) {
        await openImageViewer(itemId, item.name);
    } else if (isZipFile(item.name)) {
        await openZipViewer(itemId, item.name);
    } else if (isMediaFile(item.name)) {
        await openMediaPlayer(itemId, item.name);
    } else {
        await openFileWithAssociation(item);
    }
});

document.getElementById('trashBtn').onclick = async () => {
    if (isTrashMode) {
        if (selectedFiles.size > 0) {
            const selectedItems = [];
            for (const id of selectedFiles) {
                const item = trashFiles.find(i => i.id === id);
                if (item) {
                    selectedItems.push(item);
                }
            }
            
            const modal = document.createElement('div');
            modal.className = 'share-modal';
            modal.style.display = 'flex';
            modal.innerHTML = `
                <div class="share-modal-content" style="width: 350px;">
                    <h3>Действия с выбранными элементами (${selectedItems.length})</h3>
                    <div class="share-cloud-list" style="margin-bottom: 10px;">
                        <div class="share-cloud-item" data-action="restore">
                            <div class="share-cloud-icon" style="font-size: 32px;">🔄</div>
                            <div class="share-cloud-info">
                                <div class="share-cloud-name">Восстановить</div>
                                <div class="share-cloud-email">Восстановить файлы из корзины</div>
                            </div>
                        </div>
                        <div class="share-cloud-item" data-action="delete">
                            <div class="share-cloud-icon" style="font-size: 32px;">🗑️</div>
                            <div class="share-cloud-info">
                                <div class="share-cloud-name">Удалить навсегда</div>
                                <div class="share-cloud-email">Безвозвратно удалить файлы</div>
                            </div>
                        </div>
                    </div>
                    <button class="share-cancel-btn" id="trashActionCancelBtn">Отмена</button>
                </div>
            `;
            document.body.appendChild(modal);
            
            modal.querySelector('#trashActionCancelBtn').onclick = () => modal.remove();
            
            modal.querySelectorAll('.share-cloud-item').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const action = btn.dataset.action;
                    modal.remove();
                    
                    if (action === 'restore') {
                        if (confirm(`Восстановить ${selectedItems.length} элемент(ов) из корзины?`)) {
                            await restoreMultipleFiles(selectedItems);
                        }
                    } else if (action === 'delete') {
                        if (confirm(`Удалить навсегда ${selectedItems.length} элемент(ов)? Это действие необратимо!`)) {
                            await permanentDeleteMultipleFiles(selectedItems);
                        }
                    }
                });
            });
        } else {
            exitTrashMode();
        }
        return;
    }
    
    if (selectedFiles.size > 0) {
        const itemsToDelete = [];
        for (const id of selectedFiles) {
            const item = allItems.find(i => i.id === id);
            if (item) {
                itemsToDelete.push(item);
            }
        }
        
        if (confirm(`Удалить ${itemsToDelete.length} элемент(ов) в корзину?`)) {
            await moveMultipleToTrash(itemsToDelete);
        }
    } else {
        await showTrashMode();
    }
};

document.getElementById('uploadBtn').onclick = () => document.getElementById('fileInput').click();
document.getElementById('fileInput').onchange = (e) => {
    if (e.target.files.length) {
        uploadFile(e.target.files[0]);
        e.target.value = '';
    }
};

document.getElementById('backBtn').onclick = () => {
    if (isTrashMode) {
        exitTrashMode();
    } else if (folderPath.length > 1) {
        goBack();
    } else {
        window.location.href = 'index.html';
    }
};

document.getElementById('limitMinus').onclick = () => {
    const newVal = limitGB - 1;
    if (newVal >= 1) saveLimit(newVal);
};
document.getElementById('limitPlus').onclick = () => saveLimit(limitGB + 1);
document.getElementById('limitInput').onchange = (e) => {
    let val = parseFloat(e.target.value);
    if (isNaN(val)) val = 15;
    if (val < 1) val = 1;
    saveLimit(val);
};

document.getElementById('searchInput').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    if (!searchTerm) { 
        if (isTrashMode) {
            renderTrashList();
        } else {
            renderItemsList(allItems);
        }
        return; 
    }
    if (isTrashMode) {
        const filtered = trashFiles.filter(item => item.name.toLowerCase().includes(searchTerm));
        if (currentView === 'list') {
            let html = '<div class="file-list">';
            filtered.forEach(file => {
                const displaySize = formatFileSize(file.size);
                const formattedDate = formatDate(file.modifiedTime || file.createdTime);
                const fileExt = getFileExtension(file.name);
                const isFolder = file.mimeType === 'application/vnd.yandex.folder' || file.type === 'dir';
                
                html += `
                    <div class="file-list-item" data-id="${file.id}">
                        <div class="file-check"><input type="checkbox" class="file-checkbox" data-id="${file.id}"></div>
                        <div class="file-icon">${getItemIcon(file)}</div>
                        <div class="file-info">
                            <div class="file-name-row">
                                <span class="file-name">${escapeHtml(file.name)}</span>
                                ${!isFolder ? `<span class="file-type-label"> (${getFileTypeLabel(fileExt)})</span>` : ''}
                                <span class="file-size">${displaySize}</span>
                                <span class="file-date">${formattedDate}</span>
                            </div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            document.getElementById('filesContainer').innerHTML = html;
            attachTrashEvents();
        } else {
            let html = '<div class="file-grid">';
            filtered.forEach(file => {
                const displaySize = formatFileSize(file.size);
                const formattedDate = formatDate(file.modifiedTime || file.createdTime);
                const fileExt = getFileExtension(file.name);
                const isFolder = file.mimeType === 'application/vnd.yandex.folder' || file.type === 'dir';
                
                html += `
                    <div class="file-grid-item" data-id="${file.id}">
                        <div class="file-check"><input type="checkbox" class="file-checkbox" data-id="${file.id}"></div>
                        <div class="file-icon">${getItemIcon(file)}</div>
                        <div class="file-name">${escapeHtml(file.name)}</div>
                        ${!isFolder ? `<div class="file-type-label">${getFileTypeLabel(fileExt)}</div>` : ''}
                        <div class="file-size">${displaySize}</div>
                        <div class="file-date">${formattedDate}</div>
                    </div>
                `;
            });
            html += '</div>';
            document.getElementById('filesContainer').innerHTML = html;
            attachTrashEvents();
        }
    } else {
        const filtered = allItems.filter(item => item.name.toLowerCase().includes(searchTerm));
        renderItemsList(filtered);
    }
});

document.getElementById('closeModalBtn').onclick = () => {
    document.getElementById('propertiesModal').style.display = 'none';
};

document.getElementById('cancelShareBtn').onclick = () => {
    document.getElementById('shareCloudModal').style.display = 'none';
};

document.getElementById('folderSelectCancelBtn').onclick = () => {
    document.getElementById('folderSelectModal').style.display = 'none';
};

document.getElementById('folderSelectCloseBtn').onclick = () => {
    document.getElementById('folderSelectModal').style.display = 'none';
};

document.getElementById('folderSelectCreateBtn').onclick = () => {
    document.getElementById('createFolderModal').style.display = 'flex';
};

document.getElementById('createFolderConfirmBtn').onclick = async () => {
    const newFolderName = document.getElementById('newFolderName').value.trim();
    if (!newFolderName) {
        alert('Введите название папки');
        return;
    }
    try {
        const newFolderPath = await createFolderInCurrent(newFolderName, currentFolderId);
        alert(`Папка "${newFolderName}" создана!`);
        document.getElementById('createFolderModal').style.display = 'none';
        document.getElementById('newFolderName').value = '';
        await loadItems();
    } catch (err) {
        alert('Ошибка создания папки: ' + err.message);
    }
};

document.getElementById('createFolderCancelBtn').onclick = () => {
    document.getElementById('createFolderModal').style.display = 'none';
    document.getElementById('newFolderName').value = '';
};

document.getElementById('moveInsideCloseBtn').onclick = () => {
    document.getElementById('moveInsideModal').style.display = 'none';
    moveInsideItems = [];
};

document.getElementById('moveInsideCancelBtn').onclick = () => {
    document.getElementById('moveInsideModal').style.display = 'none';
    moveInsideItems = [];
};

document.getElementById('moveInsideConfirmBtn').onclick = async () => {
    document.getElementById('moveInsideModal').style.display = 'none';
    await moveItemsToFolder(moveInsideTargetFolderId);
};

document.addEventListener('click', (e) => {
    if (e.target === document.getElementById('shareCloudModal')) {
        document.getElementById('shareCloudModal').style.display = 'none';
    }
    if (e.target === document.getElementById('folderSelectModal')) {
        document.getElementById('folderSelectModal').style.display = 'none';
    }
    if (e.target === document.getElementById('createFolderModal')) {
        document.getElementById('createFolderModal').style.display = 'none';
        document.getElementById('newFolderName').value = '';
    }
    if (e.target === document.getElementById('moveInsideModal')) {
        document.getElementById('moveInsideModal').style.display = 'none';
        moveInsideItems = [];
    }
});

document.querySelectorAll('.sort-arrow').forEach(arrow => {
    arrow.addEventListener('click', (e) => {
        e.stopPropagation();
        const sortType = arrow.dataset.sortType;
        const direction = arrow.dataset.direction;
        currentSortType = sortType;
        currentSortDirection = direction;
        updateSortArrows();
        if (isTrashMode) {
            renderTrashList();
        } else {
            renderItemsList(allItems);
        }
    });
});

document.querySelectorAll('.view-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.stopPropagation();
        currentView = item.dataset.view;
        updateViewMenuActive();
        if (isTrashMode) {
            renderTrashList();
        } else {
            renderItemsList(allItems);
        }
        document.getElementById('viewMenu').classList.remove('show');
    });
});

document.getElementById('sortBtn').onclick = (e) => {
    e.stopPropagation();
    document.getElementById('sortMenu').classList.toggle('show');
    document.getElementById('viewMenu').classList.remove('show');
};

document.getElementById('viewBtn').onclick = (e) => {
    e.stopPropagation();
    document.getElementById('viewMenu').classList.toggle('show');
    document.getElementById('sortMenu').classList.remove('show');
};

document.addEventListener('click', () => {
    document.getElementById('sortMenu').classList.remove('show');
    document.getElementById('viewMenu').classList.remove('show');
});

// ========== ЗАМОЧЕК И ПЕРЕКЛЮЧЕНИЕ ГБ/ТБ ==========

function loadLimitLockState() {
    const saved = localStorage.getItem(`nimbus_limit_locked_${email}`);
    const lockBtn = document.getElementById('limitLockBtn');
    const unitSpan = document.getElementById('limitUnit');
    const input = document.getElementById('limitInput');
    const minusBtn = document.getElementById('limitMinus');
    const plusBtn = document.getElementById('limitPlus');
    
    if (!lockBtn) return;
    
    if (saved === 'true') {
        isLimitLocked = true;
        lockBtn.classList.add('locked');
        lockBtn.style.opacity = '1';
        input.disabled = true;
        if (minusBtn) minusBtn.disabled = true;
        if (plusBtn) plusBtn.disabled = true;
        if (unitSpan) unitSpan.classList.add('disabled');
    } else {
        isLimitLocked = false;
        lockBtn.classList.remove('locked');
        lockBtn.style.opacity = '0.6';
        input.disabled = false;
        if (minusBtn) minusBtn.disabled = false;
        if (plusBtn) plusBtn.disabled = false;
        if (unitSpan) unitSpan.classList.remove('disabled');
    }
}

function saveLimitLockState(locked) {
    localStorage.setItem(`nimbus_limit_locked_${email}`, locked);
}

function toggleLimitLock() {
    const lockBtn = document.getElementById('limitLockBtn');
    const unitSpan = document.getElementById('limitUnit');
    const input = document.getElementById('limitInput');
    const minusBtn = document.getElementById('limitMinus');
    const plusBtn = document.getElementById('limitPlus');
    
    if (!lockBtn) return;
    
    isLimitLocked = !isLimitLocked;
    saveLimitLockState(isLimitLocked);
    
    if (isLimitLocked) {
        lockBtn.classList.add('locked');
        lockBtn.style.opacity = '1';
        input.disabled = true;
        if (minusBtn) minusBtn.disabled = true;
        if (plusBtn) plusBtn.disabled = true;
        if (unitSpan) unitSpan.classList.add('disabled');
        localStorage.setItem(`nimbus_custom_limit_${email}`, limitGB);
    } else {
        lockBtn.classList.remove('locked');
        lockBtn.style.opacity = '0.6';
        input.disabled = false;
        if (minusBtn) minusBtn.disabled = false;
        if (plusBtn) plusBtn.disabled = false;
        if (unitSpan) unitSpan.classList.remove('disabled');
    }
}

function toggleLimitUnit() {
    if (isLimitLocked) return;
    
    const unitSpan = document.getElementById('limitUnit');
    const input = document.getElementById('limitInput');
    if (!unitSpan || !input) return;
    
    const currentValue = parseFloat(input.value);
    
    if (limitUnit === 'GB') {
        limitUnit = 'TB';
        unitSpan.textContent = 'ТБ';
        input.value = (currentValue / 1024).toFixed(2);
        input.step = '0.1';
    } else {
        limitUnit = 'GB';
        unitSpan.textContent = 'ГБ';
        input.value = (currentValue * 1024).toFixed(0);
        input.step = '1';
    }
}

const lockBtn = document.getElementById('limitLockBtn');
if (lockBtn) {
    lockBtn.onclick = toggleLimitLock;
}

const unitSpan = document.getElementById('limitUnit');
if (unitSpan) {
    unitSpan.onclick = toggleLimitUnit;
}

loadLimitLockState();

const customLimit = localStorage.getItem(`nimbus_custom_limit_${email}`);
if (isLimitLocked && customLimit) {
    limitGB = parseFloat(customLimit);
    document.getElementById('limitInput').value = limitGB;
    updateStats();
}

async function initRealLimit() {
    const realLimit = await getRealLimit('yandex', accessToken);
    if (realLimit) {
        limitGB = realLimit;
        document.getElementById('limitInput').value = realLimit.toFixed(1);
        await updateStats();
    } else {
        limitGB = 5;  // ← если API не ответил, ставим 5 ГБ
        document.getElementById('limitInput').value = 5;
        await updateStats();
    }
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
if (!accessToken) {
    alert('Ошибка: токен не найден');
    window.location.href = 'index.html';
}

const savedLimit = localStorage.getItem(`limit_${email}`);
if (savedLimit) {
    limitGB = parseFloat(savedLimit);
    document.getElementById('limitInput').value = limitGB;
}

loadAssociations();
initRealLimit();  // ← ДОБАВИТЬ ЭТУ СТРОКУ
updateSortArrows();
updateViewMenuActive();
updateHeaderButtonsState();
updateBreadcrumb();  // ← ДОБАВИТЬ ЭТУ СТРОКУ

// Вызываем обновление хлебных крошек после загрузки
setTimeout(() => {
    updateBreadcrumbNavigation();
}, 100);

// Добавляем алиасы для совместимости
window.loadItems = loadItems;
window.loadYandexItems = loadItems;
window.showTrashMode = showTrashMode;
window.showYandexTrashMode = showTrashMode;
window.getItems = getItems;
window.getYandexItems = getItems;

// Добавляем глобальные стили для курсоров
const style = document.createElement('style');
style.textContent = `
    * { cursor: default; }
    button, .action-btn, .back-btn, .limit-arrow-btn, .share-cloud-item, .folder-item, .file-click-area, 
    .zip-file-item, .extract-file-btn, #extractAllBtn, #closeZipViewerBtn, #viewerPrevBtn, 
    #viewerNextBtn, #viewerCloseBtn, #viewerDownloadBtn, .cancel-progress-btn, #playPauseBtn,
    #playerPrevBtn, #playerNextBtn, #fullscreenBtn, #downloadMediaBtn, #playerCloseBtn { cursor: pointer; }
    .file-name-text, .file-name { cursor: text; user-select: text; }
    input, textarea, .search-box, .limit-input, #progressBar, #volumeControl { cursor: pointer; }
    input[type="checkbox"] { cursor: pointer; }
    .disabled, .action-btn.disabled { cursor: not-allowed !important; opacity: 0.5; }
    .file-list-item, .file-grid-item { cursor: default; }
    
    /* Стили для хлебных крошек */
    .breadcrumb-container {
        padding: 4px 16px;
        margin-bottom: 8px;
        border-bottom: 1px solid #e0e0e0;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 4px;
    }
    
    .breadcrumb-item {
        display: inline-flex;
        align-items: center;
        font-size: 14px;
        color: #1a237e;
        text-decoration: none;
        cursor: pointer;
        transition: color 0.2s;
    }
    
    .breadcrumb-item:hover {
        color: #4caf50;
        text-decoration: underline;
    }
    
    .breadcrumb-separator {
        color: #999;
        font-size: 14px;
        margin: 0 4px;
    }
    
    .breadcrumb-current {
        font-size: 14px;
        color: #333;
        font-weight: 500;
    }
    
    /* Стили для типа файла */
    .file-type-label {
        font-size: 12px;
        color: #666;
        margin-left: 5px;
    }
    
    .file-grid-item .file-type-label {
        font-size: 11px;
        display: block;
        margin-top: 2px;
        margin-left: 0;
    }
`;
document.head.appendChild(style);

window.allItems = allItems;
console.log('storage-core-yandex.js fully loaded');
