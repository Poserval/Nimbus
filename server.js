require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase клиент
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Мидлвары
app.use(express.json());
app.use(express.static('public'));

// Конфигурация OAuth
const GOOGLE_CLIENT_ID = '944030768816-dknh5820s2knnbnrlde52q4hg2evcl2u.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const YANDEX_CLIENT_ID = '2dad4c5424324e1c8a7240b3d2a0f6c0';
const YANDEX_CLIENT_SECRET = process.env.YANDEX_CLIENT_SECRET;

// Определяем redirect_uri (принудительно HTTPS)
const getRedirectUri = (req) => {
    const host = req.get('host');
    return `https://${host}/index.html`;
};

// ========== АВТОРИЗАЦИЯ (РЕГИСТРАЦИЯ И ВХОД) ==========

// Регистрация нового пользователя
app.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Все поля обязательны' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
    }
    
    try {
        // Проверяем, существует ли пользователь
        const { data: existing, error: checkError } = await supabase
            .from('users')
            .select('email')
            .eq('email', email)
            .single();
        
        if (existing) {
            return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
        }
        
        // Хешируем пароль (простейший вариант, для продакшена используйте bcrypt)
        const { data, error } = await supabase
            .from('users')
            .insert([{ 
                email, 
                password: btoa(password),  // Внимание! Для продакшена используйте bcrypt
                name: name,
                created_at: new Date()
            }]);
        
        if (error) throw error;
        
        res.json({ success: true, message: 'Регистрация успешна' });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Вход пользователя
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email и пароль обязательны' });
    }
    
    try {
        const { data, error } = await supabase
            .from('users')
            .select('email, name, password')
            .eq('email', email)
            .single();
        
        if (error || !data) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }
        
        if (data.password !== btoa(password)) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }
        
        res.json({ success: true, name: data.name, email: data.email });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ========== ХРАНИЛИЩЕ АККАУНТОВ (для синхронизации облаков) ==========

// Получить все аккаунты пользователя
app.get('/accounts', async (req, res) => {
    const userEmail = req.query.email;
    if (!userEmail) {
        return res.status(400).json({ error: 'Email required' });
    }
    
    try {
        const { data, error } = await supabase
            .from('user_accounts')
            .select('*')
            .eq('user_email', userEmail)
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        const accounts = data.map(acc => ({
            id: acc.account_id,
            service: acc.service,
            name: acc.name,
            accessToken: acc.access_token,
            refreshToken: acc.refresh_token,
            email: acc.email
        }));
        
        res.json(accounts);
    } catch (err) {
        console.error('Get accounts error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Сохранить аккаунт
app.post('/accounts', async (req, res) => {
    const { userEmail, account } = req.body;
    if (!userEmail || !account) {
        return res.status(400).json({ error: 'User email and account required' });
    }
    
    try {
        const { data, error } = await supabase
            .from('user_accounts')
            .upsert({
                user_email: userEmail,
                account_id: account.id,
                service: account.service,
                name: account.name,
                access_token: account.accessToken,
                refresh_token: account.refreshToken || null,
                email: account.email,
                updated_at: new Date()
            }, {
                onConflict: 'user_email, account_id'
            });
        
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('Save account error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Удалить аккаунт
app.delete('/accounts', async (req, res) => {
    const { userEmail, accountId } = req.body;
    if (!userEmail || !accountId) {
        return res.status(400).json({ error: 'User email and account ID required' });
    }
    
    try {
        const { error } = await supabase
            .from('user_accounts')
            .delete()
            .eq('user_email', userEmail)
            .eq('account_id', accountId);
        
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('Delete account error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Обновить порядок аккаунтов
app.put('/accounts/order', async (req, res) => {
    const { userEmail, accounts } = req.body;
    if (!userEmail || !accounts) {
        return res.status(400).json({ error: 'User email and accounts required' });
    }
    
    try {
        for (let i = 0; i < accounts.length; i++) {
            const acc = accounts[i];
            await supabase
                .from('user_accounts')
                .update({ updated_at: new Date(), sort_order: i })
                .eq('user_email', userEmail)
                .eq('account_id', acc.id);
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Update order error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ========== OAuth ЭНДПОИНТЫ ==========

app.post('/token', async (req, res) => {
    console.log('=== POST /token RAW BODY ===');
    console.log(req.body);
    
    const { code, service, refresh_token, grant_type } = req.body;
    const redirect_uri = getRedirectUri(req);
    
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
    console.log(`   Frontend: https://localhost:${PORT}/index.html`);
    console.log(`   Proxy: https://localhost:${PORT}/token`);
    console.log(`   Supabase: connected`);
});
