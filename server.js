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

// uploads フォルダが存在しない場合は作成
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// メモリ上の仮DB
let photoDB = [];

// multer 設定
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
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/heic',
      'image/heif',
      'image/webp'
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('許可されていないファイル形式です'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

// アップロード処理
app.post('/upload', upload.single('photo'), async (req, res) => {
  const { comment } = req.body;
  const ext = path.extname(req.file.originalname).toLowerCase();
  const mimetype = req.file.mimetype;

  const timestamp = Date.now();
  let finalFilename = `${timestamp}.jpg`; // 全形式JPEGに統一
  const outputPath = path.join(__dirname, 'uploads', finalFilename);

  try {
    if (['.heic', '.heif'].includes(ext) || ['image/heic', 'image/heif'].includes(mimetype)) {
      const inputBuffer = fs.readFileSync(req.file.path);
      const outputBuffer = await heicConvert({
        buffer: inputBuffer,
        format: 'JPEG',
        quality: 1
      });
      fs.writeFileSync(outputPath, outputBuffer);
      fs.unlinkSync(req.file.path);
    } else {
      const tempPath = outputPath + '_tmp';
      await sharp(req.file.path)
        .rotate()
        .resize({ width: 800, height: 800, fit: 'cover' }) // 正方形に切り出し
        .toFile(tempPath);

      fs.unlinkSync(req.file.path);
      fs.renameSync(tempPath, outputPath);
    }

    const photo = {
      id: timestamp,
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

// 写真表示用API
app.get('/photos', (_, res) => {
  const approvedPhotos = photoDB.filter(p => p.approved && p.room && p.floor);
  res.json(approvedPhotos);
});

// 管理者取得
app.get('/admin/photos', (_, res) => {
  res.json(photoDB);
});

// 管理者：部屋・階の割り当て
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

// 起動
app.listen(port, () => {
  console.log(`✅ サーバー起動: http://localhost:${port}`);
});
