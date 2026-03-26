-- AddIndex: Driver(status)
CREATE INDEX "Driver_status_idx" ON "Driver"("status");

-- AddIndex: Order(storeId)
CREATE INDEX "Order_storeId_idx" ON "Order"("storeId");

-- AddIndex: Order(driverId)
CREATE INDEX "Order_driverId_idx" ON "Order"("driverId");

-- AddIndex: Order(status)
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- AddIndex: Order(createdAt)
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- AddIndex: Order(storeId, status) composite
CREATE INDEX "Order_storeId_status_idx" ON "Order"("storeId", "status");

-- AddIndex: Order(driverId, status) composite
CREATE INDEX "Order_driverId_status_idx" ON "Order"("driverId", "status");

-- AddIndex: Notification(userId)
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- AddIndex: Notification(userId, isRead) composite
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");
