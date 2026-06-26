-- Add fixed_slots column to subjects if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subjects' AND column_name = 'fixed_slots') THEN
        ALTER TABLE subjects ADD COLUMN "fixed_slots" JSONB DEFAULT NULL;
    END IF;
    
    -- Also ensure we have a 'room' column just in case we want to store it later, though not used yet
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subjects' AND column_name = 'room') THEN
        ALTER TABLE subjects ADD COLUMN "room" TEXT DEFAULT NULL;
    END IF;
END $$;
