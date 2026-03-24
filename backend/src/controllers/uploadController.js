const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const prisma = require('../config/database');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Ensure upload directories exist
['documents', 'avatars', 'cargo'].forEach((dir) => {
  const p = path.join(UPLOADS_DIR, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

/**
 * Upload driver document (license photo, ID card)
 */
const uploadDriverDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { docType } = req.params; // 'license' | 'id_card' | 'vehicle'
    const validTypes = ['license', 'id_card', 'vehicle'];
    if (!validTypes.includes(docType)) {
      return res.status(400).json({ success: false, message: 'Invalid document type' });
    }

    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver profile not found' });
    }

    // Optimize image with sharp
    const filename = `${driver.id}_${docType}_${Date.now()}.webp`;
    const outputPath = path.join(UPLOADS_DIR, 'documents', filename);

    await sharp(req.file.buffer)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(outputPath);

    const fileUrl = `/uploads/documents/${filename}`;

    // Update driver record
    const updateField = {
      license: 'licensePhotoUrl',
      id_card: 'idCardUrl',
      vehicle: 'vehiclePhotoUrl',
    }[docType];

    await prisma.driver.update({
      where: { id: driver.id },
      data: { [updateField]: fileUrl },
    });

    res.json({ success: true, message: 'Document uploaded successfully', data: { url: fileUrl } });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload user avatar
 */
const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const filename = `avatar_${req.user.id}_${Date.now()}.webp`;
    const outputPath = path.join(UPLOADS_DIR, 'avatars', filename);

    await sharp(req.file.buffer)
      .resize(400, 400, { fit: 'cover' })
      .webp({ quality: 90 })
      .toFile(outputPath);

    const avatarUrl = `/uploads/avatars/${filename}`;

    await prisma.user.update({
      where: { id: req.user.id },
      data: { avatarUrl },
    });

    res.json({ success: true, data: { avatarUrl } });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload order/cargo photo
 */
const uploadCargoPhoto = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { orderId } = req.params;
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const filename = `cargo_${orderId}_${Date.now()}.webp`;
    const outputPath = path.join(UPLOADS_DIR, 'cargo', filename);

    await sharp(req.file.buffer)
      .resize({ width: 800, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(outputPath);

    const photoUrl = `/uploads/cargo/${filename}`;

    await prisma.order.update({ where: { id: orderId }, data: { photoUrl } });

    res.json({ success: true, data: { photoUrl } });
  } catch (error) {
    next(error);
  }
};

module.exports = { uploadDriverDocument, uploadAvatar, uploadCargoPhoto };
