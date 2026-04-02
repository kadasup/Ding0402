import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix for __dirname in ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'db.json');

app.use(cors());
app.use(bodyParser.json());

// Helper to read DB
const readDB = () => {
    if (!fs.existsSync(DB_FILE)) {
        const initialData = {
            members: ['aa', 'bb'],
            orders: [],
            menu: { items: [], posted: false, lastUpdated: null },
            announcement: "歡迎來到 Ding 訂便當系統！🍱 (來自後端 API)"
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
        return initialData;
    }
    return JSON.parse(fs.readFileSync(DB_FILE));
};

// Helper to write DB
const writeDB = (data) => {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
};

// --- APIs ---

// 1. Get All Data
app.get('/api/ding-data', (req, res) => {
    const data = readDB();
    res.json(data);
});

// 2. Add Order
app.post('/api/orders', (req, res) => {
    const data = readDB();
    const newOrder = {
        ...req.body,
        id: Date.now(),
        date: new Date().toISOString()
    };
    data.orders.push(newOrder);
    writeDB(data);
    res.json(newOrder);
});

// 3. Update Menu
app.post('/api/menu', (req, res) => {
    const data = readDB();
    data.menu = {
        ...req.body,
        lastUpdated: new Date().toISOString()
    };
    writeDB(data);
    res.json(data.menu);
});

// 4. Update Announcement
app.post('/api/announcement', (req, res) => {
    const data = readDB();
    data.announcement = req.body.text;
    writeDB(data);
    res.json({ success: true, text: req.body.text });
});

// 5. Add Member
app.post('/api/members', (req, res) => {
    const data = readDB();
    const { name } = req.body;
    if (name && !data.members.includes(name)) {
        data.members.push(name);
        writeDB(data);
    }
    res.json(data.members);
});

// 6. Remove Member
app.delete('/api/members/:name', (req, res) => {
    const data = readDB();
    const { name } = req.params;
    data.members = data.members.filter(m => m !== name);
    writeDB(data);
    res.json(data.members);
});

app.listen(PORT, () => {
    console.log(`Backend Server running at http://localhost:${PORT}`);
    console.log(`API Endpoint: http://localhost:${PORT}/api/ding-data`);
});
