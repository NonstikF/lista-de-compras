-- Smart Day reminders in Telegram: announced every day from the supplier's
-- lead days before the sale up to the day itself.
ALTER TABLE "TelegramSettings" ADD COLUMN "smartDayReminders" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "TelegramSettings" ADD COLUMN "smartDayTime" TEXT NOT NULL DEFAULT '09:00';

ALTER TABLE "Supplier" ADD COLUMN "smartDayNotifiedOn" TEXT;
