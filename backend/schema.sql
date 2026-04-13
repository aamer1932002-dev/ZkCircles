-- ZkCircles Database Schema for Supabase
-- Run this in the Supabase SQL Editor to set up your database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Circles table
CREATE TABLE circles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    circle_id TEXT UNIQUE NOT NULL, -- Aleo field identifier
    name TEXT, -- Encrypted circle name
    name_hash TEXT, -- Hash of the name for lookups
    creator TEXT NOT NULL, -- Encrypted creator address
    contribution_amount BIGINT NOT NULL, -- In microcredits
    max_members SMALLINT NOT NULL CHECK (max_members >= 2 AND max_members <= 20),
    cycle_duration_blocks INTEGER NOT NULL,
    total_cycles SMALLINT NOT NULL,
    salt TEXT, -- Salt used for circle ID generation
    transaction_id TEXT, -- Creation transaction ID
    status SMALLINT NOT NULL DEFAULT 0, -- 0: Forming, 1: Active, 2: Completed, 3: Cancelled
    current_cycle SMALLINT NOT NULL DEFAULT 0,
    members_joined SMALLINT NOT NULL DEFAULT 0,
    start_block INTEGER, -- Block when circle started
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- v8: ARC-20 token support via token_registry.aleo
    -- '0field' = Aleo native credits; non-zero field = ARC-20 token_id
    token_id TEXT NOT NULL DEFAULT '0field'
);

-- Members table
CREATE TABLE members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    circle_id TEXT NOT NULL REFERENCES circles(circle_id) ON DELETE CASCADE,
    member_address TEXT NOT NULL, -- Encrypted member address
    join_order SMALLINT NOT NULL,
    total_contributed BIGINT DEFAULT 0,
    has_received_payout BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,
    salt TEXT, -- Salt for membership record
    transaction_id TEXT, -- Join transaction ID
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(circle_id, member_address),
    UNIQUE(circle_id, join_order)
);

-- Contributions table
CREATE TABLE contributions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    circle_id TEXT NOT NULL REFERENCES circles(circle_id) ON DELETE CASCADE,
    member_address TEXT NOT NULL, -- Encrypted member address
    cycle SMALLINT NOT NULL,
    amount BIGINT NOT NULL,
    transaction_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(circle_id, member_address, cycle)
);

-- Payouts table
CREATE TABLE payouts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    circle_id TEXT NOT NULL REFERENCES circles(circle_id) ON DELETE CASCADE,
    member_address TEXT NOT NULL, -- Encrypted member address
    cycle SMALLINT NOT NULL,
    amount BIGINT NOT NULL,
    transaction_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(circle_id, cycle)
);

-- Indexes for faster queries
CREATE INDEX idx_circles_status ON circles(status);
CREATE INDEX idx_circles_creator ON circles(creator);
CREATE INDEX idx_circles_created_at ON circles(created_at DESC);
CREATE INDEX idx_members_circle_id ON members(circle_id);
CREATE INDEX idx_members_address ON members(member_address);
CREATE INDEX idx_contributions_circle_id ON contributions(circle_id);
CREATE INDEX idx_contributions_cycle ON contributions(circle_id, cycle);
CREATE INDEX idx_payouts_circle_id ON payouts(circle_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for circles table
CREATE TRIGGER update_circles_updated_at
    BEFORE UPDATE ON circles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to get circle statistics
CREATE OR REPLACE FUNCTION get_circle_stats()
RETURNS TABLE(
    totalCircles BIGINT,
    activeMembers BIGINT,
    totalVolume BIGINT,
    completedCircles BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM circles)::BIGINT as totalCircles,
        (SELECT COUNT(DISTINCT member_address) FROM members WHERE active = true)::BIGINT as activeMembers,
        (SELECT COALESCE(SUM(amount), 0) FROM contributions)::BIGINT as totalVolume,
        (SELECT COUNT(*) FROM circles WHERE status = 2)::BIGINT as completedCircles;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS) policies
-- Enable RLS
ALTER TABLE circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

-- Allow public read access (data is encrypted anyway)
CREATE POLICY "Allow public read access on circles"
    ON circles FOR SELECT
    USING (true);

CREATE POLICY "Allow public read access on members"
    ON members FOR SELECT
    USING (true);

CREATE POLICY "Allow public read access on contributions"
    ON contributions FOR SELECT
    USING (true);

CREATE POLICY "Allow public read access on payouts"
    ON payouts FOR SELECT
    USING (true);

-- Allow insert/update via service role (backend)
CREATE POLICY "Allow backend insert on circles"
    ON circles FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow backend update on circles"
    ON circles FOR UPDATE
    USING (true);

CREATE POLICY "Allow backend insert on members"
    ON members FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow backend update on members"
    ON members FOR UPDATE
    USING (true);

CREATE POLICY "Allow backend insert on contributions"
    ON contributions FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow backend insert on payouts"
    ON payouts FOR INSERT
    WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════
-- v11 additions: Invites, Disputes, Schedules, Email Verification
-- ══════════════════════════════════════════════════════════════════════════

-- Circle invite links table
CREATE TABLE invites (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,              -- short invite code (8 chars)
    circle_id TEXT NOT NULL REFERENCES circles(circle_id) ON DELETE CASCADE,
    created_by TEXT NOT NULL,               -- encrypted creator address
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    max_uses SMALLINT NOT NULL DEFAULT 0,   -- 0 = unlimited
    use_count SMALLINT NOT NULL DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_invites_code ON invites(code);
CREATE INDEX idx_invites_circle_id ON invites(circle_id);

ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access on invites"
    ON invites FOR SELECT USING (true);
CREATE POLICY "Allow backend insert on invites"
    ON invites FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow backend update on invites"
    ON invites FOR UPDATE USING (true);

-- Disputes table (off-chain indexing of on-chain disputes)
CREATE TABLE disputes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    dispute_id TEXT UNIQUE NOT NULL,        -- on-chain dispute field hash
    circle_id TEXT NOT NULL,                -- no FK: circle format may differ
    accused TEXT NOT NULL,                  -- encrypted address
    reporter TEXT NOT NULL,                 -- encrypted address
    reason SMALLINT NOT NULL DEFAULT 0,     -- 0=missed, 1=suspicious, 2=collusion
    votes_for SMALLINT NOT NULL DEFAULT 1,
    votes_against SMALLINT NOT NULL DEFAULT 0,
    status SMALLINT NOT NULL DEFAULT 0,     -- 0=open, 1=guilty, 2=innocent
    cycle SMALLINT NOT NULL,
    transaction_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_disputes_circle_id ON disputes(circle_id);
CREATE INDEX idx_disputes_status ON disputes(status);

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access on disputes"
    ON disputes FOR SELECT USING (true);
CREATE POLICY "Allow backend insert on disputes"
    ON disputes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow backend update on disputes"
    ON disputes FOR UPDATE USING (true);

-- Dispute votes table
CREATE TABLE dispute_votes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    dispute_id TEXT NOT NULL,              -- no FK: avoids cascade issues
    voter TEXT NOT NULL,                    -- encrypted address
    vote_for BOOLEAN NOT NULL,             -- true=guilty, false=innocent
    transaction_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(dispute_id, voter)
);

ALTER TABLE dispute_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access on dispute_votes"
    ON dispute_votes FOR SELECT USING (true);
CREATE POLICY "Allow backend insert on dispute_votes"
    ON dispute_votes FOR INSERT WITH CHECK (true);

-- Auto-contribution schedules table
CREATE TABLE contribution_schedules (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    circle_id TEXT NOT NULL REFERENCES circles(circle_id) ON DELETE CASCADE,
    member_address TEXT NOT NULL,           -- encrypted address
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    notify_before_minutes INTEGER NOT NULL DEFAULT 60,
    last_notified_cycle SMALLINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(circle_id, member_address)
);

CREATE INDEX idx_schedules_member ON contribution_schedules(member_address);

ALTER TABLE contribution_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access on contribution_schedules"
    ON contribution_schedules FOR SELECT USING (true);
CREATE POLICY "Allow backend insert on contribution_schedules"
    ON contribution_schedules FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow backend update on contribution_schedules"
    ON contribution_schedules FOR UPDATE USING (true);
CREATE POLICY "Allow backend delete on contribution_schedules"
    ON contribution_schedules FOR DELETE USING (true);

-- Email verification table
CREATE TABLE email_verifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    address TEXT NOT NULL,                      -- encrypted Aleo address
    email_hash TEXT NOT NULL,                   -- hash of email (never store raw email)
    email TEXT,                                 -- encrypted email (for sending verification codes)
    verification_code_hash TEXT,                -- hash of the verification code
    status SMALLINT NOT NULL DEFAULT 0,         -- 0=pending, 1=code_sent, 2=verified
    on_chain_tx TEXT,                           -- tx id for register_email_commitment
    verify_chain_tx TEXT,                       -- tx id for verify_email_commitment
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verified_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(address)
);

CREATE INDEX idx_email_verifications_address ON email_verifications(address);
CREATE INDEX idx_email_verifications_status ON email_verifications(status);

ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access on email_verifications"
    ON email_verifications FOR SELECT USING (true);
CREATE POLICY "Allow backend insert on email_verifications"
    ON email_verifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow backend update on email_verifications"
    ON email_verifications FOR UPDATE USING (true);
