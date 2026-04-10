const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

app.post('/token', async (req, res) => {
    res.header('Access-Control-Allow-Origin', 'https://poserval.github.io');
    const { code } = req.body;
    try {
        const response = await axios.post('https://oauth2.googleapis.com/token', null, {
            params: {
                code,
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                redirect_uri: 'https://poserval.github.io/Nimbus/aggregators.html',
                grant_type: 'authorization_code'
            }
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Token exchange failed' });
    }
});

app.listen(3000, () => console.log('Proxy running'));
