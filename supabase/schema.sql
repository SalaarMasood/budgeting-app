-- ============================================
-- Personal Budgeting App - Database Schema
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Users table (single user for now)
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT,
  currency TEXT NOT NULL DEFAULT 'PKR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Monthly budgets
-- ============================================
CREATE TABLE monthly_budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INT NOT NULL CHECK (year >= 2020 AND year <= 2100),
  month INT NOT NULL CHECK (month >= 1 AND month <= 12),
  budget_amount DECIMAL(12,2) NOT NULL CHECK (budget_amount >= 0),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, year, month)
);

CREATE INDEX idx_monthly_budgets_year_month ON monthly_budgets(year, month);

-- ============================================
-- Daily entries (one per day per budget)
-- ============================================
CREATE TABLE daily_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  budget_id UUID NOT NULL REFERENCES monthly_budgets(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(budget_id, entry_date)
);

CREATE INDEX idx_daily_entries_date ON daily_entries(entry_date);

-- ============================================
-- Expense items (many per daily entry)
-- ============================================
CREATE TABLE expense_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  daily_entry_id UUID NOT NULL REFERENCES daily_entries(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expense_items_entry ON expense_items(daily_entry_id);

-- ============================================
-- Debts (credit / debit tracker)
-- ============================================
CREATE TABLE debts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  person_name TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'settled')),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  settled_date DATE,
  source_expense_id UUID REFERENCES public.expense_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_debts_user_status ON debts(user_id, status);
CREATE INDEX idx_debts_type ON debts(type);

-- ============================================
-- Seed: create default user
-- ============================================
INSERT INTO users (id, name, email, currency)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Salaar',
  'salaar@budget.app',
  'PKR'
);

-- ============================================
-- RLS Policies (Row Level Security)
-- ============================================
-- For a single-user app, we disable RLS for simplicity
-- If auth is added later, enable RLS and add policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anon key (single user, no auth)
CREATE POLICY "Allow all on users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on monthly_budgets" ON monthly_budgets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on daily_entries" ON daily_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on expense_items" ON expense_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on debts" ON debts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Users can delete their own debts" ON public.debts
    FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- STORED PROCEDURES (RPC)
-- ==========================================

-- Atomic insertion of an expense and credit splits if total_paid > my_share.
CREATE OR REPLACE FUNCTION public.log_expense_with_splits(
    p_user_id UUID,
    p_daily_entry_id UUID,
    p_category TEXT,
    p_description TEXT,
    p_my_share NUMERIC,
    p_total_paid NUMERIC,
    p_splits JSON,
    p_entry_date DATE
) RETURNS public.expense_items
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_expense public.expense_items;
    split_record RECORD;
    normalized_name TEXT;
BEGIN
    -- 1. Insert the exact personal share as the expense item
    INSERT INTO public.expense_items (daily_entry_id, category, description, amount)
    VALUES (p_daily_entry_id, p_category, p_description, p_my_share)
    RETURNING * INTO new_expense;

    -- 2. Insert a credit for each person in the splits array
    IF p_total_paid > p_my_share THEN
        FOR split_record IN SELECT * FROM json_to_recordset(p_splits) AS x(person_name TEXT, amount NUMERIC)
        LOOP
            normalized_name := lower(trim(split_record.person_name));
            
            INSERT INTO public.debts (user_id, person_name, amount, type, note, entry_date, status, source_expense_id)
            VALUES (
                p_user_id, 
                normalized_name, 
                split_record.amount, 
                'credit', 
                'Owed for ' || p_category || ' expense', 
                COALESCE(p_entry_date, CURRENT_DATE), 
                'open', 
                new_expense.id
            );
        END LOOP;
    END IF;

    -- Return the newly created expense
    RETURN new_expense;
END;
$$;
