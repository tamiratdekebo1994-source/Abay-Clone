ALTER TABLE "Driver"
  ADD COLUMN IF NOT EXISTS "dateOfBirth"             TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "gender"                  TEXT,
  ADD COLUMN IF NOT EXISTS "nationalId"              TEXT,
  ADD COLUMN IF NOT EXISTS "emergencyContactName"    TEXT,
  ADD COLUMN IF NOT EXISTS "emergencyContactPhone"   TEXT,
  ADD COLUMN IF NOT EXISTS "homeAddress"             TEXT,
  ADD COLUMN IF NOT EXISTS "profilePhotoUrl"         TEXT,
  ADD COLUMN IF NOT EXISTS "licenseClass"            TEXT,
  ADD COLUMN IF NOT EXISTS "nationalIdPhotoUrl"      TEXT,
  ADD COLUMN IF NOT EXISTS "vehicleMake"             TEXT;
