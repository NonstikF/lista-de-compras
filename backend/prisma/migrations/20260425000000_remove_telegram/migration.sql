-- Remove Telegram tables (IF EXISTS for safety — may not exist in all environments)
DROP TABLE IF EXISTS "TelegramKnownChat";
DROP TABLE IF EXISTS "TelegramConfig";
