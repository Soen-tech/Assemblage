-- 1. Create Profiles Table (extends auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('member', 'admin', 'guest', 'master_admin')),
  club_id TEXT,
  club_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Events Table
CREATE TABLE events (
  id TEXT DEFAULT gen_random_uuid()::TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  location TEXT,
  price TEXT,
  image TEXT,
  category TEXT CHECK (category IN ('masterclass', 'tasting', 'rare', 'lounge', 'dinner', 'special')),
  club_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Boutique Table
CREATE TABLE boutique (
  id TEXT DEFAULT gen_random_uuid()::TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price TEXT NOT NULL,
  image TEXT,
  category TEXT CHECK (category IN ('whisky', 'blend', 'rare', 'accessories')),
  club_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE clubs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  location TEXT,
  description TEXT,
  image TEXT,
  payfast_merchant_id TEXT,
  joining_fee_monthly NUMERIC(10,2),
  joining_fee_annual NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clubs are viewable by everyone." ON clubs
  FOR SELECT USING (true);

CREATE POLICY "Only master_admins can manage clubs." ON clubs
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'master_admin'
    )
  );

-- 4. Set up Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE boutique ENABLE ROW LEVEL SECURITY;

-- 5. Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone." ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile." ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile." ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- 6. Events Policies
CREATE POLICY "Events are viewable by club members." ON events
  FOR SELECT USING (
    club_id IS NULL OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.club_id = events.club_id
    ) OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.role = 'master_admin')
    )
  );

CREATE POLICY "Admins can manage events." ON events
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.role = 'master_admin')
    )
  );

-- 7. Boutique Policies
CREATE POLICY "Items are viewable by club members." ON boutique
  FOR SELECT USING (
    club_id IS NULL OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.club_id = boutique.club_id
    ) OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.role = 'master_admin')
    )
  );

CREATE POLICY "Admins can manage boutique items." ON boutique
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.role = 'master_admin')
    )
  );

-- 8. Trigger for automatic profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, club_id, club_name)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'role', CASE WHEN new.email = 'proofadmin@gmail.com' THEN 'master_admin' ELSE 'member' END),
    new.raw_user_meta_data->>'club_id',
    CASE
      WHEN new.email = 'proofadmin@gmail.com' THEN 'Underground Whisky Club Cape Town'
      ELSE NULL
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==========================================
-- 9. Storage Bucket Setup & Security Policies
-- ==========================================
-- Execute the following statements in your Supabase SQL Editor to create 
-- the 'vault-images' bucket and grant proper Row Level Security (RLS) 
-- permissions so that image uploads can sync successfully.

-- A. Insert bucket details into storage.buckets if not already present
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vault-images',
  'vault-images',
  true,
  5242880, -- 5MB LIMIT
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE 
SET public = true, file_size_limit = 5242880;

-- B. Clean up old policies to avoid duplicates or row-level conflicts
DROP POLICY IF EXISTS "Public Read Access on vault-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to vault-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update objects in vault-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete objects in vault-images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can select vault-images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can insert vault-images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update vault-images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete vault-images" ON storage.objects;

-- C. Create permissive RLS policies for SELECT (public read access)
CREATE POLICY "Anyone can select vault-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vault-images');

-- D. Create permissive RLS policies for INSERT (allowing all users to upload)
CREATE POLICY "Anyone can insert vault-images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'vault-images');

-- E. Create permissive RLS policies for UPDATE (allowing file management)
CREATE POLICY "Anyone can update vault-images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'vault-images');

-- F. Create permissive RLS policies for DELETE (allowing file management)
CREATE POLICY "Anyone can delete vault-images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'vault-images');

-- ==========================================
-- 10. Journals Table Setup & Security Policies
-- ==========================================
CREATE TABLE IF NOT EXISTS public.journals (
  id TEXT DEFAULT gen_random_uuid()::TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  distillery TEXT,
  region TEXT,
  age TEXT,
  abv TEXT,
  description TEXT,
  tasting_notes TEXT[],
  swri_profile JSONB,
  image TEXT,
  rating INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for journals
ALTER TABLE public.journals ENABLE ROW LEVEL SECURITY;

-- Journals security policies
DROP POLICY IF EXISTS "Users can check their own journal entries" ON public.journals;
CREATE POLICY "Users can check their own journal entries" ON public.journals
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own journal entries" ON public.journals;
CREATE POLICY "Users can insert their own journal entries" ON public.journals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own journal entries" ON public.journals;
CREATE POLICY "Users can update their own journal entries" ON public.journals
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own journal entries" ON public.journals;
CREATE POLICY "Users can delete their own journal entries" ON public.journals
  FOR DELETE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- PROOF WHISKY — Orders & Subscriptions Schema
-- ─────────────────────────────────────────────────────────────

-- 1. ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               UUID REFERENCES profiles(id) ON DELETE SET NULL,
  club_id               TEXT,                      -- References clubs.id (using text for broad compatibility)
  item_type             TEXT NOT NULL CHECK (item_type IN (
                          'event_ticket',
                          'product',
                          'club_membership',
                          'subscription'
                        )),
  item_id               TEXT NOT NULL,
  item_name             TEXT,
  quantity              INTEGER DEFAULT 1,
  unit_price            NUMERIC(10,2),
  amount_gross          NUMERIC(10,2),        -- total paid by customer
  amount_fee            NUMERIC(10,2),        -- PayFast fee
  amount_net            NUMERIC(10,2),        -- net received
  platform_commission   NUMERIC(10,2),        -- 5% to Proof admin
  club_payout           NUMERIC(10,2),        -- 95% to club
  status                TEXT DEFAULT 'pending' CHECK (status IN (
                          'pending',
                          'complete',
                          'cancelled',
                          'refunded',
                          'failed'
                        )),
  payfast_payment_id    TEXT,                 -- your m_payment_id
  payfast_pf_payment_id TEXT,                 -- PayFast's own reference
  payfast_token         TEXT,                 -- subscription token if recurring
  receipt_number        TEXT UNIQUE,          -- printable receipt ref
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- 2. SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS subscriptions (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  plan              TEXT CHECK (plan IN ('monthly', 'annual')),
  status            TEXT DEFAULT 'pending' CHECK (status IN (
                      'active',
                      'pending',
                      'cancelled',
                      'paused',
                      'expired'
                    )),
  payfast_token     TEXT,                     -- used to cancel/pause via API
  amount            NUMERIC(10,2),
  billing_date      DATE,
  next_billing_date DATE,
  cancelled_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 3. EVENT TICKETS TABLE
CREATE TABLE IF NOT EXISTS event_tickets (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id        UUID REFERENCES orders(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  event_id        TEXT NOT NULL,              -- references events.id (text type compatible)
  event_name      TEXT,
  event_date      DATE,
  club_id         TEXT,                       -- references clubs.id
  ticket_ref      TEXT UNIQUE,               -- human-readable e.g. EVT-2024-0042
  status          TEXT DEFAULT 'valid' CHECK (status IN (
                    'valid',
                    'used',
                    'cancelled',
                    'refunded'
                  )),
  checked_in_at   TIMESTAMPTZ,               -- for door check-in scanning
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PRODUCT ORDERS TABLE
CREATE TABLE IF NOT EXISTS product_orders (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id          UUID REFERENCES orders(id) ON DELETE CASCADE,
  user_id           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  product_id        TEXT NOT NULL,            -- references boutique.id
  product_name      TEXT,
  club_id           TEXT,                     -- references clubs.id
  quantity          INTEGER DEFAULT 1,
  unit_price        NUMERIC(10,2),
  fulfilment_status TEXT DEFAULT 'pending' CHECK (fulfilment_status IN (
                      'pending',
                      'processing',
                      'shipped',
                      'delivered',
                      'cancelled',
                      'refunded'
                    )),
  tracking_number   TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 4.5 CLUB MEMBERS TABLE
CREATE TABLE IF NOT EXISTS club_members (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  club_id         TEXT REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  role            TEXT DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'suspended')),
  membership_type TEXT DEFAULT 'free' CHECK (membership_type IN ('free', 'paid')),
  order_id        UUID REFERENCES orders(id) ON DELETE SET NULL, -- references orders.id
  paid_at         TIMESTAMPTZ,
  joined_at       TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_club UNIQUE (user_id, club_id)
);

-- 5. INDEXES — speeds up common dashboard queries
CREATE INDEX IF NOT EXISTS idx_orders_user_id       ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_club_id       ON orders(club_id);
CREATE INDEX IF NOT EXISTS idx_orders_item_type     ON orders(item_type);
CREATE INDEX IF NOT EXISTS idx_orders_status        ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at    ON orders(created_at desc);
CREATE INDEX IF NOT EXISTS idx_orders_payfast_id    ON orders(payfast_payment_id);

CREATE INDEX IF NOT EXISTS idx_tickets_user_id      ON event_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_event_id     ON event_tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_order_id     ON event_tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_tickets_ref          ON event_tickets(ticket_ref);

CREATE INDEX IF NOT EXISTS idx_product_orders_user  ON product_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_product_orders_prod  ON product_orders(product_id);
CREATE INDEX IF NOT EXISTS idx_product_orders_order ON product_orders(order_id);

CREATE INDEX IF NOT EXISTS idx_club_members_user    ON club_members(user_id);
CREATE INDEX IF NOT EXISTS idx_club_members_club    ON club_members(club_id);
CREATE INDEX IF NOT EXISTS idx_club_members_order   ON club_members(order_id);

CREATE INDEX IF NOT EXISTS idx_subs_user_id         ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subs_status          ON subscriptions(status);

-- 6. AUTO-UPDATE updated_at TRIGGERS
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER product_orders_updated_at
  BEFORE UPDATE ON product_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 7. RECEIPT NUMBER GENERATOR
CREATE SEQUENCE IF NOT EXISTS receipt_seq START 1;

CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS trigger AS $$
BEGIN
  new.receipt_number := 'PRF-' ||
    to_char(now(), 'YYYYMMDD') || '-' ||
    lpad(nextval('receipt_seq')::text, 4, '0');
  RETURN new;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER orders_receipt_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  WHEN (new.receipt_number IS NULL)
  EXECUTE FUNCTION generate_receipt_number();

-- 8. TICKET REF GENERATOR
CREATE SEQUENCE IF NOT EXISTS ticket_seq START 1;

CREATE OR REPLACE FUNCTION generate_ticket_ref()
RETURNS trigger AS $$
BEGIN
  new.ticket_ref := 'TKT-' ||
    to_char(now(), 'YYYYMMDD') || '-' ||
    lpad(nextval('ticket_seq')::text, 4, '0');
  RETURN new;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER event_tickets_ref
  BEFORE INSERT ON event_tickets
  FOR EACH ROW
  WHEN (new.ticket_ref IS NULL)
  EXECUTE FUNCTION generate_ticket_ref();

-- 9. ROW LEVEL SECURITY
ALTER TABLE orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_tickets    ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_orders   ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_members     ENABLE ROW LEVEL SECURITY;

-- Members see only their own records
CREATE POLICY "members_own_orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "members_own_subscriptions" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "members_own_tickets" ON event_tickets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "members_own_product_orders" ON product_orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "members_own_club_memberships" ON club_members
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "members_join_clubs" ON club_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "members_update_clubs" ON club_members
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "members_resign_clubs" ON club_members
  FOR DELETE USING (auth.uid() = user_id);

-- Club admins see all orders for their club
CREATE POLICY "club_admin_orders" ON orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.club_id = orders.club_id
      AND profiles.role IN ('admin', 'master_admin')
    )
  );

CREATE POLICY "club_admin_tickets" ON event_tickets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.club_id = event_tickets.club_id
      AND profiles.role IN ('admin', 'master_admin')
    )
  );

CREATE POLICY "club_admin_product_orders" ON product_orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.club_id = product_orders.club_id
      AND profiles.role IN ('admin', 'master_admin')
    )
  );

-- Master admin sees everything
CREATE POLICY "master_admin_orders" ON orders
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master_admin'
    )
  );

CREATE POLICY "master_admin_subscriptions" ON subscriptions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master_admin'
    )
  );

CREATE POLICY "master_admin_tickets" ON event_tickets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master_admin'
    )
  );

CREATE POLICY "master_admin_product_orders" ON product_orders
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master_admin'
    )
  );

CREATE POLICY "master_admin_club_members" ON club_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master_admin'
    )
  );

-- Service role bypass for ITN webhook writes
CREATE POLICY "service_role_orders" ON orders
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_subscriptions" ON subscriptions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_tickets" ON event_tickets
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_product_orders" ON product_orders
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_club_members" ON club_members
  FOR ALL USING (auth.role() = 'service_role');


-- Store pending event invites
CREATE TABLE IF NOT EXISTS event_invites (
  id          uuid default gen_random_uuid() primary key,
  event_id    text not null,
  club_id     text references clubs(id),
  created_by  uuid references profiles(id),
  token       text unique not null default gen_random_uuid()::text,
  uses_limit  integer default 50,
  uses_count  integer default 0,
  expires_at  timestamptz default now() + interval '7 days',
  created_at  timestamptz default now()
);

-- Enable RLS for event_invites
ALTER TABLE event_invites ENABLE ROW LEVEL SECURITY;

-- Allow public read of invites (token acts as the secret)
CREATE POLICY "public_read_invites" ON event_invites
  FOR SELECT USING (true);

-- Allow public read of a single event via invite
CREATE POLICY "public_read_events_via_invite" ON events
  FOR SELECT USING (true);

-- Allow authenticated users or admins to insert and manage invites
CREATE POLICY "admins_manage_invites" ON event_invites
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'master_admin')
    )
  );


-- Notifications table for in-app feed and push triggers
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  club_id TEXT REFERENCES public.clubs ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'ticket_confirmed',
    'order_confirmed',
    'order_shipped',
    'order_delivered',
    'new_event',
    'new_product',
    'new_club',
    'club_announcement'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  url TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- user_id NULL = broadcast to club members or all users
-- club_id NULL = broadcast to all users globally
-- new_club type always has both user_id and club_id NULL
--   since it targets all users across all clubs

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Members see their own notifications and club broadcasts
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
USING (
  auth.uid() = user_id
  OR (
    user_id IS NULL
    AND (
      club_id IS NULL  -- global broadcast (e.g. new_club)
      OR club_id IN (
        SELECT club_id FROM public.club_members
        WHERE user_id = auth.uid()
        AND status = 'active'
      )
    )
  )
);

-- Service role inserts via webhook
CREATE POLICY "Service role can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- Users can mark their own as read
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

-- Admins can insert announcements and club notifications
CREATE POLICY "Admins can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'master_admin')
  )
);

-- Enable Realtime on notifications table
ALTER PUBLICATION supabase_realtime
ADD TABLE public.notifications;

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS notifications_user_id_idx
  ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_club_id_idx
  ON public.notifications(club_id);
CREATE INDEX IF NOT EXISTS notifications_type_idx
  ON public.notifications(type);
CREATE INDEX IF NOT EXISTS notifications_read_idx
  ON public.notifications(read);


-- Tracks which notifications each user has dismissed
CREATE TABLE IF NOT EXISTS public.notification_dismissals (
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  notification_id UUID REFERENCES public.notifications 
    ON DELETE CASCADE NOT NULL,
  dismissed_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, notification_id)
);

ALTER TABLE public.notification_dismissals 
  ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own dismissals
CREATE POLICY "Users can insert own dismissals"
ON public.notification_dismissals FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own dismissals"
ON public.notification_dismissals FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own dismissals"
ON public.notification_dismissals FOR DELETE
USING (auth.uid() = user_id);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS dismissals_user_id_idx
  ON public.notification_dismissals(user_id);
CREATE INDEX IF NOT EXISTS dismissals_notification_id_idx
  ON public.notification_dismissals(notification_id);

-- Postgres view that filters dismissed notifications
-- per authenticated user using auth.uid()
CREATE OR REPLACE VIEW public.user_visible_notifications AS
SELECT n.*
FROM public.notifications n
WHERE NOT EXISTS (
  SELECT 1 
  FROM public.notification_dismissals d
  WHERE d.notification_id = n.id
  AND d.user_id = auth.uid()
);

-- Create a notification_dismissal cleanup function in Supabse
CREATE OR REPLACE FUNCTION delete_expired_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Enable pg_cron (run once) for cleanup of notification_dismissals
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule cleanup to run daily at midnight
SELECT cron.schedule(
  'delete-expired-notifications',  -- job name
  '0 0 * * *',                     -- every day at 00:00
  'SELECT delete_expired_notifications()'
);



-- Drop the existing view for the security of user_visible_notifications view-object
DROP VIEW IF EXISTS public.user_visible_notifications;

-- Recreate with SECURITY INVOKER
-- This makes the view respect RLS policies of the 
-- querying user rather than the view creator
CREATE OR REPLACE VIEW public.user_visible_notifications
WITH (security_invoker = true)
AS
SELECT n.*
FROM public.notifications n
WHERE NOT EXISTS (
  SELECT 1 
  FROM public.notification_dismissals d
  WHERE d.notification_id = n.id
  AND d.user_id = auth.uid()
);

-- Revoke public access of user_visible_notifications view-object
REVOKE ALL ON public.user_visible_notifications 
  FROM PUBLIC, anon;

-- Grant to authenticated users only of user_visible_notifications view-object
GRANT SELECT ON public.user_visible_notifications 
  TO authenticated;


-- Store pending boutique invites
CREATE TABLE IF NOT EXISTS public.boutique_invites (
  id          uuid default gen_random_uuid() primary key,
  boutique_id text not null,
  club_id     text references clubs(id),
  created_by  uuid references profiles(id),
  token       text unique not null default gen_random_uuid()::text,
  uses_limit  integer default 50,
  uses_count  integer default 0,
  expires_at  timestamptz default now() + interval '7 days',
  created_at  timestamptz default now()
);

-- Enable RLS for boutique_invites
ALTER TABLE public.boutique_invites ENABLE ROW LEVEL SECURITY;

-- Allow public read of boutique invites (token acts as key)
CREATE POLICY "public_read_boutique_invites" ON public.boutique_invites
  FOR SELECT USING (true);

-- Allow public read of boutique items via invite
CREATE POLICY "public_read_boutique_via_invite" ON public.boutique
  FOR SELECT USING (true);

-- Allow admins to manage boutique invites
CREATE POLICY "admins_manage_boutique_invites" ON public.boutique_invites
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'master_admin')
    )
  );
