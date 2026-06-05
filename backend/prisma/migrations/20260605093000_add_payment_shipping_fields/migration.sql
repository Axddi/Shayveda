-- Align persisted orders with Razorpay verification and Shiprocket fulfilment.
ALTER TABLE `Order`
  ADD COLUMN `orderNumber` VARCHAR(191) NULL,
  ADD COLUMN `deliveryCharge` DOUBLE NOT NULL DEFAULT 55,
  ADD COLUMN `razorpayOrderId` VARCHAR(191) NULL,
  ADD COLUMN `razorpayPaymentId` VARCHAR(191) NULL,
  ADD COLUMN `razorpaySignature` VARCHAR(191) NULL,
  ADD COLUMN `shiprocketOrderId` VARCHAR(191) NULL,
  ADD COLUMN `shiprocketShipmentId` VARCHAR(191) NULL,
  ADD COLUMN `shiprocketAwbCode` VARCHAR(191) NULL,
  ADD COLUMN `shiprocketCourierName` VARCHAR(191) NULL,
  ADD COLUMN `shiprocketStatus` VARCHAR(191) NULL,
  ADD COLUMN `shiprocketTrackingUrl` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `Order_orderNumber_key` ON `Order`(`orderNumber`);
