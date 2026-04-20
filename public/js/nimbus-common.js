// ========== nimbus-common.js ==========
// Универсальные функции для всего проекта
// Версия 1.0 - только общие функции, без API-запросов

// ========== ФОРМАТИРОВАНИЕ И ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
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

function getColorForPercent(percent) {
    if (percent <= 50) {
        const r = Math.floor(255 * (percent / 50));
        return `rgb(${r}, 255, 0)`;
    } else {
        const g = Math.floor(255 * (1 - (percent - 50) / 50));
        return `rgb(255, ${g}, 0)`;
    }
}

// ========== ОПРЕДЕЛЕНИЕ ТИПОВ ФАЙЛОВ ==========

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

// ========== ИКОНКИ ДЛЯ ФАЙЛОВ (универсальные, для обоих облаков) ==========

function getItemIcon(item) {
    // Для Google: mimeType, для Яндекс: mimeType или type
    const isFolder = item.mimeType === 'application/vnd.google-apps.folder' || 
                     item.mimeType === 'application/vnd.yandex.folder' || 
                     item.type === 'dir';
    if (isFolder) return '📁';
    
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

function getItemDisplaySize(item, folderSizes = {}) {
    const isFolder = item.mimeType === 'application/vnd.google-apps.folder' || 
                     item.mimeType === 'application/vnd.yandex.folder' || 
                     item.type === 'dir';
    if (isFolder) {
        const cachedSize = folderSizes[item.id];
        if (cachedSize) return formatFileSize(cachedSize);
        return '—';
    }
    return formatFileSize(item.size);
}

// ========== СОРТИРОВКА ==========

function sortItems(items, sortType, sortDirection) {
    const sorted = [...items];
    switch(sortType) {
        case 'name':
            sorted.sort((a, b) => {
                if (sortDirection === 'asc') return a.name.localeCompare(b.name);
                else return b.name.localeCompare(a.name);
            });
            break;
        case 'size':
            sorted.sort((a, b) => {
                const sizeA = parseInt(a.size) || 0;
                const sizeB = parseInt(b.size) || 0;
                if (sortDirection === 'asc') return sizeA - sizeB;
                else return sizeB - sizeA;
            });
            break;
        case 'date':
            sorted.sort((a, b) => {
                const dateA = new Date(a.modifiedTime || a.createdTime);
                const dateB = new Date(b.modifiedTime || b.createdTime);
                if (sortDirection === 'asc') return dateA - dateB;
                else return dateB - dateA;
            });
            break;
        default:
            sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    return sorted;
}

// ========== ФУНКЦИИ ДЛЯ ПОИСКА ==========

function filterItemsBySearch(items, searchTerm) {
    if (!searchTerm) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(item => item.name.toLowerCase().includes(term));
}

console.log('nimbus-common.js loaded - универсальные функции готовы');