ALTER TABLE "User" ADD COLUMN "permissions" JSONB NOT NULL DEFAULT '{}';

UPDATE "User"
SET "permissions" = '{
  "dashboard": true,
  "orders": true,
  "recipes": true,
  "articles": true,
  "store": true,
  "suppliers": true,
  "users": true,
  "inventory": true,
  "settings": true
}'::jsonb;
