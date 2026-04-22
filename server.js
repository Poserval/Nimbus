require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Мидлвары
app.use(express.json());

// Универсальная настройка статики: проверяем наличие папки public
const publicPath = path.join(__dirname, 'public');
if (fs.existsSync(publicPath)) {
    // На сервере (GitHub) — используем папку public
    app.use(express.static(publicPath));
    console.log('📁 Serving static files from: public/');
} else {
    // Локально — используем корневую папку
    app.use(express.static(__dirname));
    console.log('📁 Serving static files from: root directory');
}

// Конфигурация OAuth
const GOOGLE_CLIENT_ID = '944030768816-dknh5820s2knnbnrlde52q4hg2evcl2u.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const YANDEX_CLIENT_ID = '2dad4c5424324e1c8a7240b3d2a0f6c0';
const YANDEX_CLIENT_SECRET = process.env.YANDEX_CLIENT_SECRET;

// Определяем redirect_uri (динамически)
const getRedirectUri = (req) => {
    const host = req.get('host');
    const protocol = req.protocol;
    return `${protocol}://${host}/index.html`;
};

// Эндпоинт для обмена кода на токен
app.post('/token', async (req, res) => {
    console.log('=== POST /token RAW BODY ===');
    console.log(req.body);
    
    const { code, service, refresh_token, grant_type } = req.body;
    const redirect_uri = getRedirectUri(req);
    
    console.log('Request received:', { service, grant_type, codeExists: !!code, refreshExists: !!refresh_token });
    console.log('Redirect URI:', redirect_uri);
    
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
                console.log('Google token refresh successful');
                return res.json(response.data);
            } catch (error) {
                console.error('Google refresh failed:', error.response?.data || error.message);
                return res.status(500).json({ error: 'Refresh failed', details: error.response?.data });
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
                console.log('Yandex token refresh successful');
                return res.json(response.data);
            } catch (error) {
                console.error('Yandex refresh failed:', error.response?.data || error.message);
                return res.status(500).json({ error: 'Refresh failed', details: error.response?.data });
            }
        }
    }
    
    // Обмен кода на токен (AUTHORIZATION)
    if (!code) {
        console.log('No code provided');
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
            console.log('Google token exchange successful');
            return res.json(response.data);
        } catch (error) {
            console.error('Google token exchange failed:', error.response?.data || error.message);
            return res.status(500).json({ 
                error: 'Token exchange failed', 
                details: error.response?.data 
            });
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
            console.log('Yandex token exchange successful');
            return res.json(response.data);
        } catch (error) {
            console.error('Yandex token exchange failed:', error.response?.data || error.message);
            return res.status(500).json({ 
                error: 'Token exchange failed', 
                details: error.response?.data 
            });
        }
    }
    
    console.log('Unknown service:', service);
    return res.status(400).json({ error: 'Unknown service', service });
});

// Прокси для загрузки файлов по ссылке
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

// Запуск сервера
app.listen(PORT, () => {
    console.log(`✅ Nimbus server running on port ${PORT}`);
    console.log(`   Frontend: http://localhost:${PORT}/index.html`);
    console.log(`   Proxy: http://localhost:${PORT}/token`);
});
