const sharp = require('sharp');
const prisma = require('../config/database');
const { storeFile } = require('../config/storage');

/**
 * Upload driver document (license photo, ID card, vehicle photo)
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

    const filename = `${driver.id}_${docType}_${Date.now()}.webp`;
    const buffer = await sharp(req.file.buffer)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    const fileUrl = await storeFile(buffer, `documents/${filename}`);

    const updateField = {
      license: 'licensePhotoUrl',
      id_card: 'idCardUrl',
      vehicle: 'vehiclePhotoUrl',
    }[docType];

    await prisma.driver.update({ where: { id: driver.id }, data: { [updateField]: fileUrl } });

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
    const buffer = await sharp(req.file.buffer)
      .resize(400, 400, { fit: 'cover' })
      .webp({ quality: 90 })
      .toBuffer();
    const avatarUrl = await storeFile(buffer, `avatars/${filename}`);

    await prisma.user.update({ where: { id: req.user.id }, data: { avatarUrl } });
    res.json({ success: true, data: { avatarUrl } });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload order/cargo photo — only the store owner or assigned driver may upload
 */
const uploadCargoPhoto = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { orderId } = req.params;
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { store: { select: { userId: true } }, driver: { select: { userId: true } } },
    });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const isStoreOwner = order.store?.userId === req.user.id;
    const isAssignedDriver = order.driver?.userId === req.user.id;
    if (!isStoreOwner && !isAssignedDriver) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const filename = `cargo_${orderId}_${Date.now()}.webp`;
    const buffer = await sharp(req.file.buffer)
      .resize({ width: 800, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    const photoUrl = await storeFile(buffer, `cargo/${filename}`);

    await prisma.order.update({ where: { id: orderId }, data: { photoUrl } });
    res.json({ success: true, data: { photoUrl } });
  } catch (error) {
    next(error);
  }
};

module.exports = { uploadDriverDocument, uploadAvatar, uploadCargoPhoto };
