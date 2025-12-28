const express = require('express');
const fs = require('fs');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;
const DB_FILE = 'database.json';
const TASKS_FILE = 'tasks.json';
const VIPS_FILE = 'vips.json'; // Yeni dosya

// --- AYARLAR ---
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Dosya Kontrolleri
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify([]));
if (!fs.existsSync(TASKS_FILE)) fs.writeFileSync(TASKS_FILE, JSON.stringify([]));

// Varsayılan VIP ayarlarını oluştur
if (!fs.existsSync(VIPS_FILE)) {
    const defaultVips = [
        { level: 1, price: 150, commission: "%15", img: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400" },
        { level: 2, price: 500, commission: "%18", img: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400" },
        { level: 3, price: 1500, commission: "%20", img: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400" },
        { level: 4, price: 3000, commission: "%22", img: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400" },
        { level: 5, price: 5000, commission: "%25", img: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=400" },
        { level: 6, price: 10000, commission: "%30", img: "https://images.unsplash.com/photo-1507582020474-9a35b7d455d9?w=400" }
    ];
    fs.writeFileSync(VIPS_FILE, JSON.stringify(defaultVips, null, 2));
}

// --- YARDIMCI FONKSİYONLAR ---
const readDB = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
const readTasks = () => JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
const writeTasks = (data) => fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2));
const readVips = () => JSON.parse(fs.readFileSync(VIPS_FILE, 'utf8'));
const writeVips = (data) => fs.writeFileSync(VIPS_FILE, JSON.stringify(data, null, 2));

// --- KULLANICI ROTALARI ---

app.post('/register', (req, res) => {
    const { phone, password, withdrawPassword } = req.body;
    let users = readDB();
    if (users.find(u => u.phone === phone)) return res.status(400).json({ success: false, message: 'Numara kayıtlı!' });

    const newUser = {
        phone, password, withdrawPassword,
        balance: 50.00,
        frozenBalance: 0.00,
        vipLevel: 0,
        completedTasks: []
    };
    users.push(newUser);
    writeDB(users);
    res.json({ success: true });
});

app.post('/login', (req, res) => {
    const { phone, password } = req.body;
    const user = readDB().find(u => u.phone === phone && u.password === password);
    if (user) {
        const { password, withdrawPassword, ...safeUser } = user;
        res.json({ success: true, user: safeUser });
    } else { res.status(400).json({ success: false }); }
});

app.post('/get-user', (req, res) => {
    const user = readDB().find(u => u.phone === req.body.phone);
    if (user) {
        const { password, withdrawPassword, ...safeUser } = user;
        res.json({ success: true, user: safeUser });
    } else { res.status(404).json({ success: false }); }
});

app.post('/update-user', (req, res) => {
    const { phone, balance, vipLevel, completedTasks, frozenBalance } = req.body;
    let users = readDB();
    const idx = users.findIndex(u => u.phone === phone);
    if (idx > -1) {
        if (balance !== undefined) users[idx].balance = parseFloat(balance);
        if (vipLevel !== undefined) users[idx].vipLevel = parseInt(vipLevel);
        if (completedTasks !== undefined) users[idx].completedTasks = completedTasks;
        if (frozenBalance !== undefined) users[idx].frozenBalance = parseFloat(frozenBalance);
        writeDB(users);
        res.json({ success: true });
    } else { res.status(404).json({ success: false }); }
});

// VIP Verilerini Çekme (Kullanıcı Sayfası İçin)
app.get('/api/get-vips', (req, res) => res.json(readVips()));

// --- ADMIN ROTALARI ---

app.get('/admin/search-users', (req, res) => {
    const query = req.query.q;
    const users = readDB();
    const results = users.filter(u => u.phone.includes(query)).slice(0, 5);
    res.json(results);
});

// Gelişmiş Kullanıcı Güncelleme (Bağımsız Manuel Mantık)
app.post('/admin/update-user-full', (req, res) => {
    const { phone, balance, vipLevel, frozenBalance } = req.body;
    let users = readDB();
    const idx = users.findIndex(u => u.phone === phone);

    if (idx > -1) {
        if (vipLevel !== undefined) users[idx].vipLevel = parseInt(vipLevel);
        if (balance !== undefined && balance !== "") users[idx].balance = parseFloat(balance);
        if (frozenBalance !== undefined && frozenBalance !== "") users[idx].frozenBalance = parseFloat(frozenBalance);

        writeDB(users);
        res.json({ success: true, message: 'Manuel güncelleme başarılı.' });
    } else { res.status(404).json({ success: false }); }
});

// VIP Fiyat Ayarlarını Güncelleme
app.post('/admin/update-vips', (req, res) => {
    writeVips(req.body);
    res.json({ success: true });
});

// GÖREV YÖNETİMİ
app.get('/admin/get-tasks', (req, res) => {
    res.json(readTasks());
});

app.post('/admin/add-task', (req, res) => {
    let tasks = readTasks();
    const newTask = { 
        id: Date.now(), 
        title: req.body.title,
        vip: parseInt(req.body.vip),
        image: req.body.image,
        price: parseFloat(req.body.price || 0),
        profit: parseFloat(req.body.profit || 0)
    };
    tasks.push(newTask);
    writeTasks(tasks);
    res.json({ success: true });
});

app.post('/admin/update-task', (req, res) => {
    const { id, title, vip, image, price, profit } = req.body;
    let tasks = readTasks();
    const idx = tasks.findIndex(t => t.id === id);
    if (idx > -1) {
        tasks[idx] = {
            id: id,
            title: title,
            vip: parseInt(vip),
            image: image,
            price: parseFloat(price || 0),
            profit: parseFloat(profit || 0)
        };
        writeTasks(tasks);
        res.json({ success: true });
    } else { res.status(404).json({ success: false }); }
});

app.post('/admin/delete-task', (req, res) => {
    let tasks = readTasks();
    tasks = tasks.filter(t => t.id !== req.body.id);
    writeTasks(tasks);
    res.json({ success: true });
});

app.listen(PORT, () => console.log(`Sunucu aktif: http://localhost:${PORT}`));