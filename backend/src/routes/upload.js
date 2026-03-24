const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const { uploadDriverDocument, uploadAvatar, uploadCargoPhoto } = require('../controllers/uploadController');

// Store files in memory buffer (sharp processes them)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, and HEIC images are allowed'));
    }
  },
});

router.use(authenticate);

// Driver documents
router.post('/driver/document/:docType', upload.single('file'), uploadDriverDocument);

// Avatar
router.post('/avatar', upload.single('file'), uploadAvatar);

// Cargo photo
router.post('/order/:orderId/cargo', upload.single('file'), uploadCargoPhoto);

module.exports = router;
