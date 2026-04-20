require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Конфигурация
const GOOGLE_CLIENT_ID = '944030768816-dknh5820s2knnbnrlde52q4hg2evcl2u.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const YANDEX_CLIENT_ID = '2dad4c5424324e1c8a7240b3d2a0f6c0';
const YANDEX_CLIENT_SECRET = process.env.YANDEX_CLIENT_SECRET;

// Динамический redirect_uri
const getRedirectUri = (req) => {
    const host = req.get('host');
    const protocol = req.protocol;
    return `${protocol}://${host}/index.html`;
};

// ========== ТЕСТОВЫЙ МАРШРУТ (проверка что сервер жив) ==========
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Nimbus proxy server is running' });
});

// ========== МАРШРУТ ДЛЯ ПРОВЕРКИ /token ==========
app.get('/token', (req, res) => {
    res.json({ error: 'No code provided', message: 'Use POST request with code parameter' });
});

// ========== ОСНОВНОЙ ЭНДПОИНТ ДЛЯ OAuth ==========
app.post('/token', async (req, res) => {
    const { code, service, refresh_token, grant_type } = req.body;
    const redirect_uri = getRedirectUri(req);
    
    console.log('Request received:', { service, grant_type, codeExists: !!code, refreshExists: !!refresh_token });
    
    // Обновление токена (REFRESH)
    if (grant_type === 'refresh_token' && refresh_token) {
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
                return res.json(response.data);
            } catch (error) {
                return res.status(500).json({ error: 'Refresh failed' });
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
                return res.json(response.data);
            } catch (error) {
                return res.status(500).json({ error: 'Refresh failed' });
            }
        }
    }
    
    // Обмен кода на токен
    if (!code) {
        return res.status(400).json({ error: 'No code provided' });
    }
    
    if (service === 'google') {
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
            return res.json(response.data);
        } catch (error) {
            return res.status(500).json({ error: 'Token exchange failed' });
        }
    }
    
    if (service === 'yandex') {
        try {
            const params = new URLSearchParams();
            params.append('grant_type', 'authorization_code');
            params.append('code', code);
            params.append('client_id', YANDEX_CLIENT_ID);
            params.append('client_secret', YANDEX_CLIENT_SECRET);
            
            const response = await axios.post('https://oauth.yandex.ru/token', params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            return res.json(response.data);
        } catch (error) {
            return res.status(500).json({ error: 'Token exchange failed' });
        }
    }
    
    return res.status(400).json({ error: 'Unknown service' });
});

// ========== ПРОКСИ ДЛЯ ЗАГРУЗКИ ФАЙЛОВ ПО ССЫЛКЕ ==========
app.get('/fetch-file', async (req, res) => {
    const fileUrl = req.query.url;
    
    if (!fileUrl) {
        return res.status(400).json({ error: 'No URL provided' });
    }
    
    console.log('[Fetch] Загрузка файла:', fileUrl);
    
    try {
        const response = await axios({
            method: 'GET',
            url: fileUrl,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        res.setHeader('Content-Disposition', response.headers['content-disposition'] || `attachment; filename="downloaded_file"`);
        res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        response.data.pipe(res);
        
    } catch (error) {
        console.error('[Fetch] Ошибка:', error.message);
        res.status(500).json({ error: 'Failed to fetch file', details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Nimbus proxy server running at http://localhost:${PORT}`);
});
