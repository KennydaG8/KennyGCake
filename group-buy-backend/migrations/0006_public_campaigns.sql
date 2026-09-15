ALTER TABLE campaigns ADD COLUMN public_access INTEGER NOT NULL DEFAULT 0 CHECK (public_access IN (0, 1));
CREATE INDEX idx_campaigns_public_access ON campaigns(public_access, status);
