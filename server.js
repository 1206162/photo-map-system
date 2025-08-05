// server.js
require('dotenv').config(); // ← .env を読み込む

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Cloudinary 設定
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Cloudinaryストレージ設定
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'uploads',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 800, crop: "limit" }]
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// メモリ上の仮DB（本番運用ではDBに置き換えるべき）
let photoDB = [];

// 📤 写真アップロード処理
app.post('/upload', upload.single('photo'), async (req, res) => {
  try {
    const { comment } = req.body;

    if (!req.file || !req.file.path) {
      throw new Error('ファイルが正しくアップロードされませんでした');
    }

    const photo = {
      id: Date.now(),
      url: CLOUDINARY_URL,         // CloudinaryのURL
      comment,
      room: null,
      floor: null,
      approved: false,
      timestamp: new Date()
    };

    photoDB.push(photo);
    console.log('✅ アップロード完了:', photo);
    res.redirect('/thanks.html');

  } catch (err) {
    console.error('❌ アップロードエラー:', err);
    res.status(500).send('アップロードに失敗しました');
  }
});

// ✅ 承認済み写真の取得
app.get('/photos', (_, res) => {
  const approvedPhotos = photoDB.filter(p => p.approved && p.room && p.floor);
  res.json(approvedPhotos);
});

// 👨‍💼 管理者画面用：全写真取得
app.get('/admin/photos', (_, res) => {
  res.json(photoDB);
});

// 👨‍💼 管理者：部屋/階割り当て + 承認
app.post('/admin/assign', (req, res) => {
  const { id, room, floor, approved } = req.body;
  const photo = photoDB.find(p => p.id == id);

  if (photo) {
    photo.room = room;
    photo.floor = floor;
    photo.approved = approved ?? (room !== 'none');
    res.json({ success: true });
  } else {
    res.status(404).json({ error: '該当写真が見つかりません' });
  }
});

// ✅ サーバー起動
app.listen(port, () => {
  console.log(`🚀 サーバー起動: http://localhost:${port}`);
});
