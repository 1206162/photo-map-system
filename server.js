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
    cb(null, `${timestamp}${ext}`);
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
  const ext = path.extname(req.file.originalname).toLowerCase();
  let finalFilename;

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
  const newFilename = `${Date.now()}.jpg`;  // ★ 常に新規タイムスタンプ名で保存
  const outputPath = path.join(__dirname, 'uploads', newFilename);

  fs.writeFileSync(outputPath, outputBuffer);
  fs.unlinkSync(req.file.path); // 元のHEICを削除
  
} else {
  finalFilename = `${Date.now()}${ext}`;
      const filepath = path.join(__dirname, 'uploads', finalFilename);
      const tempPath = filepath + '_resized';

      await sharp(req.file.path)
        .rotate()
        .resize({ width: 800 })
        .toFile(tempPath);

      fs.unlinkSync(req.file.path);
      fs.renameSync(tempPath, filepath);
}

    const photo = {
      id: Date.now(),
      url: `/uploads/${finalFilename}`,
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
  res.json(photoDB.filter(p => p.approved && p.room && p.floor));
});

// 管理者画面：すべて取得
app.get('/admin/photos', (_, res) => {
  res.json(photoDB);
});

// 管理者：部屋割りと承認を設定
app.post('/admin/assign', (req, res) => {
  const { id, room, approved, floor } = req.body;
  console.log('受信:', req.body); // ← デバッグログ

  const photo = photoDB.find(p => p.id == id);
  if (photo) {
    photo.room = room;
    photo.approved = approved ?? (room !== 'none');
    photo.floor = floor;
    res.json({ success: true });
  } else {
    console.warn('該当写真が見つかりません');
    res.status(404).json({ error: '該当写真が見つかりません' });
  }
});
app.listen(port, () => {
  console.log(`サーバー起動: http://localhost:${port}`);
});

