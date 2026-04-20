require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Мидлвары ---
app.use(express.json()); // Чтобы парсить JSON-тело запросов

// --- Конфигурация ---
const GOOGLE_CLIENT_ID = '944030768816-dknh5820s2knnbnrlde52q4hg2evcl2u.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const YANDEX_CLIENT_ID = '2dad4c5424324e1c8a7240b3d2a0f6c0';
const YANDEX_CLIENT_SECRET = process.env.YANDEX_CLIENT_SECRET;

// --- Вспомогательная функция для Redirect URI ---
const getRedirectUri = (req) => {
    // Она нужна, чтобы правильно формировать адрес возврата для OAuth
    const host = req.get('host');
    const protocol = req.protocol;
    return `${protocol}://${host}/index.html`;
};

// ==============================================
// === ТВОЙ ГЛАВНЫЙ ЭНДПОИНТ ДЛЯ OAuth (POST) ===
// ==============================================
app.post('/token', async (req, res) => {
    const { code, service, refresh_token, grant_type } = req.body;
    const redirect_uri = getRedirectUri(req);

    console.log(`[Token] Request received. Service: ${service}, Grant type: ${grant_type}`);

    // --- СЛУЧАЙ 1: Обновление токена (refresh) ---
    if (grant_type === 'refresh_token' && refresh_token) {
        console.log(`[Token] Refreshing token for ${service}...`);
        if (service === 'google') {
            try {
                const response = await axios.post('https://oauth2.googleapis.com/token', null, {
                    params: {
                        refresh_token: refresh_token,
                        client_id: GOOGLE_CLIENT_ID,
                        client_secret: GOOGLE_CLIENT_SECRET,
                        grant_type: 'refresh_token'
                    }
                });
                console.log(`[Token] Google token refreshed successfully.`);
                return res.json(response.data);
            } catch (error) {
                console.error(`[Token] Google refresh failed:`, error.response?.data || error.message);
                return res.status(500).json({ error: 'Google refresh failed' });
            }
        } else if (service === 'yandex') {
            try {
                const params = new URLSearchParams();
                params.append('grant_type', 'refresh_token');
                params.append('refresh_token', refresh_token);
                params.append('client_id', YANDEX_CLIENT_ID);
                params.append('client_secret', YANDEX_CLIENT_SECRET);
                const response = await axios.post('https://oauth.yandex.ru/token', params, {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                });
                console.log(`[Token] Yandex token refreshed successfully.`);
                return res.json(response.data);
            } catch (error) {
                console.error(`[Token] Yandex refresh failed:`, error.response?.data || error.message);
                return res.status(500).json({ error: 'Yandex refresh failed' });
            }
        }
    }

    // --- СЛУЧАЙ 2: Обмен кода на токен (authorization) ---
    if (!code) {
        console.log(`[Token] Error: No code provided.`);
        return res.status(400).json({ error: 'No code provided' });
    }

    if (service === 'google') {
        console.log(`[Token] Exchanging code for Google token...`);
        try {
            const response = await axios.post('https://oauth2.googleapis.com/token', null, {
                params: {
                    code: code,
                    client_id: GOOGLE_CLIENT_ID,
                    client_secret: GOOGLE_CLIENT_SECRET,
                    redirect_uri: redirect_uri,
                    grant_type: 'authorization_code'
                }
            });
            console.log(`[Token] Google token exchanged successfully.`);
            return res.json(response.data);
        } catch (error) {
            console.error(`[Token] Google exchange failed:`, error.response?.data || error.message);
            return res.status(500).json({ error: 'Google token exchange failed' });
        }
    }

    if (service === 'yandex') {
        console.log(`[Token] Exchanging code for Yandex token...`);
        try {
            const params = new URLSearchParams();
            params.append('grant_type', 'authorization_code');
            params.append('code', code);
            params.append('client_id', YANDEX_CLIENT_ID);
            params.append('client_secret', YANDEX_CLIENT_SECRET);
            const response = await axios.post('https://oauth.yandex.ru/token', params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            console.log(`[Token] Yandex token exchanged successfully.`);
            return res.json(response.data);
        } catch (error) {
            console.error(`[Token] Yandex exchange failed:`, error.response?.data || error.message);
            return res.status(500).json({ error: 'Yandex token exchange failed' });
        }
    }

    console.log(`[Token] Error: Unknown service ${service}`);
    return res.status(400).json({ error: 'Unknown service' });
});

// ==============================================
// === ПРОКСИ ДЛЯ ЗАГРУЗКИ ФАЙЛОВ (GET) ===
// ==============================================
app.get('/fetch-file', async (req, res) => {
    const fileUrl = req.query.url;
    if (!fileUrl) {
        return res.status(400).json({ error: 'No URL provided' });
    }
    console.log(`[Fetch] Downloading file from: ${fileUrl}`);
    try {
        const response = await axios({
            method: 'GET',
            url: fileUrl,
            responseType: 'stream',
            headers: { 'User-Agent': 'Nimbus-Proxy/1.0' }
        });
        res.setHeader('Content-Disposition', response.headers['content-disposition'] || `attachment; filename="downloaded_file"`);
        res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
        res.setHeader('Access-Control-Allow-Origin', '*');
        response.data.pipe(res);
    } catch (error) {
        console.error(`[Fetch] Error:`, error.message);
        res.status(500).json({ error: 'Failed to fetch file' });
    }
});

// ==============================================
// === ТЕСТОВЫЙ МАРШРУТ, ЧТОБЫ ПРОВЕРИТЬ, ЧТО СЕРВЕР ЖИВ ===
// ==============================================
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Nimbus proxy server is running' });
});

// --- ЗАПУСК СЕРВЕРА ---
app.listen(PORT, () => {
    console.log(`✅ Nimbus proxy server is running on port ${PORT}`);
});
