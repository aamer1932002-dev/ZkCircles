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
    max_members SMALLINT NOT NULL CHECK (max_members >= 2 AND max_members <= 12),
    cycle_duration_blocks INTEGER NOT NULL,
    total_cycles SMALLINT NOT NULL,
    salt TEXT, -- Salt used for circle ID generation
    transaction_id TEXT, -- Creation transaction ID
    status SMALLINT NOT NULL DEFAULT 0, -- 0: Forming, 1: Active, 2: Completed, 3: Cancelled
    current_cycle SMALLINT NOT NULL DEFAULT 0,
    members_joined SMALLINT NOT NULL DEFAULT 0,
    start_block INTEGER, -- Block when circle started
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
