// server.js
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const heicConvert = require('heic-convert');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// 仮DB（永続化していない）
let photoDB = [];

// --- multer 設定 ---
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const timestamp = Date.now();
    cb(null, `${timestamp}${ext}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (_, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/heic',
      'image/heif', 'image/webp'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('許可されていないファイル形式です'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// --- アップロード処理 ---
app.post('/upload', upload.single('photo'), async (req, res) => {
  const { comment } = req.body;
  const mimetype = req.file.mimetype;
  const originalExt = path.extname(req.file.originalname).toLowerCase();

  let finalFilename = `${Date.now()}.jpg`;
  const outputPath = path.join(__dirname, 'uploads', finalFilename);

  try {
    if (['.heic', '.heif'].includes(originalExt) || ['image/heic', 'image/heif'].includes(mimetype)) {
      const inputBuffer = fs.readFileSync(req.file.path);
      const outputBuffer = await heicConvert({
        buffer: inputBuffer,
        format: 'JPEG',
        quality: 1
      });

      fs.writeFileSync(outputPath, outputBuffer);
      fs.unlinkSync(req.file.path); // 元ファイル削除
    } else {
      const tempPath = outputPath + '_resized';

      await sharp(req.file.path)
        .rotate()
        .resize({ width: 800, height: 800, fit: 'cover' }) // 正方形に切り出し
        .toFile(tempPath);

      fs.unlinkSync(req.file.path);
      fs.renameSync(tempPath, outputPath);
    }

    // 写真情報を仮DBに保存
    const photo = {
      id: Date.now(),
      url: `/uploads/${finalFilename}`,
      comment,
      room: null,
      floor: null,
      approved: false,
      timestamp: new Date()
    };

    photoDB.push(photo);
    res.redirect('/thanks.html');
  } catch (err) {
    console.error('アップロード失敗:', err);
    res.status(500).send('アップロードに失敗しました');
  }
});

// --- 表示対象の写真だけ取得 ---
app.get('/photos', (_, res) => {
  const filtered = photoDB.filter(p => p.approved && p.room && p.floor);
  res.json(filtered);
});

// --- 管理者：全件取得 ---
app.get('/admin/photos', (_, res) => {
  res.json(photoDB);
});

// --- 管理者：承認・割当処理 ---
app.post('/admin/assign', (req, res) => {
  const { id, room, approved, floor } = req.body;
  console.log('受信:', req.body);

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

app.listen(port, () => {
  console.log(`サーバー起動: http://localhost:${port}`);
});
