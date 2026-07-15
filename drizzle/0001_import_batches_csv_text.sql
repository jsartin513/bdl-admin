ALTER TABLE "import_batches" ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'teamlinkt' NOT NULL;
ALTER TABLE "import_batches" ADD COLUMN IF NOT EXISTS "csv_text" text;
