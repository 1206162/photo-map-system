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

// メモリ上の仮DB
let photoDB = [];

// multerによるアップロード設定
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (_, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/\s/g, '_');
    cb(null, `${timestamp}-${safeName}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (_, file, cb) => {
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/heic',
      'image/heif',
      'image/webp' // ← Androidスクショ用
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('許可されていないファイル形式です'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});


// アップロード処理
app.post('/upload', upload.single('photo'), async (req, res) => {
  const { comment } = req.body;
  let filename = req.file.filename;
  const filepath = path.join(__dirname, 'uploads', filename);
  const ext = path.extname(filename).toLowerCase();

  try {
    if (ext === '.heic' || ext === '.heif' ||
  req.file.mimetype === 'image/heic' ||
  req.file.mimetype === 'image/heif'
) {
  const inputBuffer = fs.readFileSync(filepath);
  const outputBuffer = await heicConvert({
    buffer: inputBuffer,
    format: 'JPEG',
    quality: 1
  });
  filename = filename.replace(/\.(heic|heif)$/i, '.jpg');
  const outputPath = path.join(__dirname, 'uploads', filename);
  fs.writeFileSync(outputPath, outputBuffer);
  fs.unlinkSync(filepath);
} else {
      const resizedPath = path.join(__dirname, 'uploads', filename);
      await sharp(filepath).resize({ width: 800 }).toFile(resizedPath);
    }

    const photo = {
      id: Date.now(),
      url: `/uploads/${filename}`,
      comment,
      room: null,
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

// 承認された写真だけ取得
app.get('/photos', (_, res) => {
  res.json(photoDB.filter(p => p.approved));
});

// 管理者画面：すべて取得
app.get('/admin/photos', (_, res) => {
  res.json(photoDB);
});

// 管理者：部屋割りと承認を設定
app.post('/admin/assign', (req, res) => {
  const { id, room, approved } = req.body;
  const photo = photoDB.find(p => p.id == id);
  if (photo) {
    photo.room = room;
    photo.approved = approved;
    res.json({ success: true });
  } else {
    res.status(404).json({ error: '該当写真が見つかりません' });
  }
});

app.listen(port, () => {
  console.log(`サーバー起動: http://localhost:${port}`);
});
