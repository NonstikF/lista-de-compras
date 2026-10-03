-- Telegram notifications: the group the bot posts to and the weekly reminders
-- for each order day. The bot token is an env var (TELEGRAM_BOT_TOKEN).
CREATE TABLE "TelegramSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "chatId" TEXT,
    "chatTitle" TEXT NOT NULL DEFAULT '',
    "notifyNewOrders" BOOLEAN NOT NULL DEFAULT true,
    "highlightSupplierIds" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderReminder" (
    "id" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "time" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "followUpTime" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSentOn" TEXT,
    "lastFollowUpOn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderReminder_pkey" PRIMARY KEY ("id")
);

-- The purchasing schedule as it runs today. Nothing is sent until a group is
-- linked in Configuración; days, times and wording are editable there.
INSERT INTO "OrderReminder" ("id", "weekday", "time", "message", "followUpTime") VALUES
    ('reminder_sunday_general', 0, '08:00', 'Hoy domingo se hace el pedido general de todos los proveedores para toda la semana. Agreguen los faltantes durante el día.', '22:00'),
    ('reminder_tuesday_usa', 2, '08:00', 'Hoy martes se hace el pedido al proveedor de USA. Agreguen los faltantes durante el día.', '22:00'),
    ('reminder_friday_perishables', 5, '08:00', 'Hoy viernes se hace el pedido de perecederos y café para que lo traigan el sábado. Agreguen los faltantes durante el día.', '22:00');
