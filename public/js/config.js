// ========== config.js ==========
// Единый конфигурационный файл для всего проекта
// Версия 1.1 (для деплоя на Render)

// Глобальный конфиг
const CONFIG = {
    // API endpoints — используем относительный путь (фронтенд и прокси на одном домене)
    PROXY_URL: '/token',
    
    // OAuth Client IDs
    GOOGLE_CLIENT_ID: '944030768816-dknh5820s2knnbnrlde52q4hg2evcl2u.apps.googleusercontent.com',
    YANDEX_CLIENT_ID: '2dad4c5424324e1c8a7240b3d2a0f6c0',
    
    // Redirect URIs для OAuth (автоматически определяются)
    get GOOGLE_REDIRECT_URI() {
        return `${window.location.origin}/index.html`;
    },
    get YANDEX_REDIRECT_URI() {
        return `${window.location.origin}/index.html`;
    },
    
    APP_NAME: 'Nimbus',
    VERSION: '1.0.0',
    DEFAULT_GOOGLE_LIMIT_GB: 15,
    DEFAULT_YANDEX_LIMIT_GB: 5,
    LIMIT_CACHE_TTL: 24 * 60 * 60 * 1000
};

// Функция для получения URL авторизации Google
function getGoogleAuthUrl() {
    const params = new URLSearchParams({
        client_id: CONFIG.GOOGLE_CLIENT_ID,
        redirect_uri: CONFIG.GOOGLE_REDIRECT_URI,
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.email',
        access_type: 'offline',
        prompt: 'consent'
    });
    return `https://accounts.google.com/o/oauth2/auth?${params}`;
}

// Функция для получения URL авторизации Яндекс
function getYandexAuthUrl() {
    const redirectWithService = encodeURIComponent(CONFIG.YANDEX_REDIRECT_URI + '?service=yandex');
    return `https://oauth.yandex.ru/authorize?response_type=code&client_id=${CONFIG.YANDEX_CLIENT_ID}&redirect_uri=${redirectWithService}&force_confirm=true`;
}

window.CONFIG = CONFIG;
window.getGoogleAuthUrl = getGoogleAuthUrl;
window.getYandexAuthUrl = getYandexAuthUrl;

console.log('config.js loaded - окружение:', window.location.hostname);
console.log('PROXY_URL:', CONFIG.PROXY_URL);
