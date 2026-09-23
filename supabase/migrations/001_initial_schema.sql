-- ============================================================
-- SpareHub — Initial Database Schema + Seed Data
-- Run this in the Supabase SQL Editor after creating your project
-- ============================================================

-- Clean reset if re-running
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TABLE IF EXISTS part_compatibility CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS parts CASCADE;
DROP TABLE IF EXISTS bike_models CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS part_requests CASCADE;
DROP TABLE IF EXISTS contact_enquiries CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 1. Profiles (linked to Supabase Auth users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Categories
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  icon_name TEXT NOT NULL DEFAULT 'package',
  description TEXT DEFAULT ''
);

-- 3. Suppliers
CREATE TABLE suppliers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  address TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  payment_terms TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Bike Models
CREATE TABLE bike_models (
  id SERIAL PRIMARY KEY,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  variant TEXT DEFAULT '',
  year_from INT,
  year_to INT
);

-- 5. Parts
CREATE TABLE parts (
  id SERIAL PRIMARY KEY,
  part_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category_id INT REFERENCES categories(id) ON DELETE SET NULL,
  supplier_id INT REFERENCES suppliers(id) ON DELETE SET NULL,
  mrp NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock_quantity INT NOT NULL DEFAULT 0,
  low_stock_threshold INT NOT NULL DEFAULT 5,
  image_url TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  last_restocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Part Compatibility (many-to-many: parts <-> bike_models)
CREATE TABLE part_compatibility (
  id SERIAL PRIMARY KEY,
  part_id INT NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  bike_model_id INT NOT NULL REFERENCES bike_models(id) ON DELETE CASCADE,
  UNIQUE(part_id, bike_model_id)
);

-- 7. Sales
CREATE TABLE sales (
  id SERIAL PRIMARY KEY,
  part_id INT NOT NULL REFERENCES parts(id) ON DELETE RESTRICT,
  quantity INT NOT NULL DEFAULT 1,
  selling_price NUMERIC(10,2) NOT NULL,
  cost_price_snapshot NUMERIC(10,2) NOT NULL,
  profit NUMERIC(10,2) GENERATED ALWAYS AS (selling_price - cost_price_snapshot) STORED,
  customer_name TEXT DEFAULT '',
  customer_phone TEXT DEFAULT '',
  sold_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sold_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Part Requests (from customers)
CREATE TABLE part_requests (
  id SERIAL PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  bike_model_text TEXT DEFAULT '',
  part_description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'fulfilled', 'closed')),
  admin_notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Alerts
CREATE TABLE alerts (
  id SERIAL PRIMARY KEY,
  part_id INT NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('warning', 'critical')),
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  snoozed_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ
);

-- 10. Contact Enquiries
CREATE TABLE contact_enquiries (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Indexes for performance
-- ============================================================
CREATE INDEX idx_parts_part_number ON parts(part_number);
CREATE INDEX idx_parts_name ON parts USING gin(to_tsvector('english', name));
CREATE INDEX idx_parts_category ON parts(category_id);
CREATE INDEX idx_parts_supplier ON parts(supplier_id);
CREATE INDEX idx_parts_stock ON parts(stock_quantity);
CREATE INDEX idx_part_compat_part ON part_compatibility(part_id);
CREATE INDEX idx_part_compat_model ON part_compatibility(bike_model_id);
CREATE INDEX idx_sales_part ON sales(part_id);
CREATE INDEX idx_sales_date ON sales(sold_at);
CREATE INDEX idx_alerts_part ON alerts(part_id);
CREATE INDEX idx_bike_models_brand ON bike_models(brand);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bike_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE part_compatibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE part_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_enquiries ENABLE ROW LEVEL SECURITY;

-- Helper function: check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Profiles: users can read their own, admins can read all
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING (is_admin());
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Categories: public read, admin write
CREATE POLICY "Anyone can view categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage categories" ON categories FOR ALL USING (is_admin());

-- Suppliers: admin only
CREATE POLICY "Admins can manage suppliers" ON suppliers FOR ALL USING (is_admin());

-- Bike Models: public read, admin write
CREATE POLICY "Anyone can view bike models" ON bike_models FOR SELECT USING (true);
CREATE POLICY "Admins can manage bike models" ON bike_models FOR ALL USING (is_admin());

-- Parts: public can read (limited columns handled in app), admin full access
CREATE POLICY "Anyone can view parts" ON parts FOR SELECT USING (true);
CREATE POLICY "Admins can manage parts" ON parts FOR ALL USING (is_admin());

-- Part Compatibility: public read, admin write
CREATE POLICY "Anyone can view compatibility" ON part_compatibility FOR SELECT USING (true);
CREATE POLICY "Admins can manage compatibility" ON part_compatibility FOR ALL USING (is_admin());

-- Sales: admin only
CREATE POLICY "Admins can manage sales" ON sales FOR ALL USING (is_admin());

-- Part Requests: anyone can insert, admins can read/update
CREATE POLICY "Anyone can submit part requests" ON part_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage part requests" ON part_requests FOR SELECT USING (is_admin());
CREATE POLICY "Admins can update part requests" ON part_requests FOR UPDATE USING (is_admin());

-- Alerts: admin only
CREATE POLICY "Admins can manage alerts" ON alerts FOR ALL USING (is_admin());

-- Contact Enquiries: anyone can insert, admins can read/update
CREATE POLICY "Anyone can submit enquiries" ON contact_enquiries FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage enquiries" ON contact_enquiries FOR SELECT USING (is_admin());
CREATE POLICY "Admins can update enquiries" ON contact_enquiries FOR UPDATE USING (is_admin());

-- ============================================================
-- Auto-create profile on signup trigger
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'viewer')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- Function: auto-generate alerts when stock is low
-- ============================================================
CREATE OR REPLACE FUNCTION check_stock_alerts()
RETURNS TRIGGER AS $$
BEGIN
  -- Remove existing unacknowledged alerts for this part
  DELETE FROM alerts WHERE part_id = NEW.id AND acknowledged = false;

  -- Create alert if stock is at or below threshold
  IF NEW.stock_quantity <= NEW.low_stock_threshold THEN
    INSERT INTO alerts (part_id, severity)
    VALUES (
      NEW.id,
      CASE WHEN NEW.stock_quantity = 0 THEN 'critical' ELSE 'warning' END
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_stock_change
  AFTER INSERT OR UPDATE OF stock_quantity ON parts
  FOR EACH ROW EXECUTE FUNCTION check_stock_alerts();

-- ============================================================
-- SEED DATA
-- ============================================================

-- Categories
INSERT INTO categories (name, icon_name, description) VALUES
  ('Engine Parts', 'cog', 'Pistons, rings, gaskets, valves, timing chains, and engine internals'),
  ('Brakes', 'disc', 'Brake pads, shoes, discs, drums, cables, and levers'),
  ('Electrical', 'zap', 'Bulbs, wiring harness, CDI units, regulators, batteries, and switches'),
  ('Body Parts', 'shield', 'Mudguards, side panels, fairings, mirrors, and seats'),
  ('Suspension', 'arrow-up-down', 'Front forks, rear shocks, bushings, and bearings'),
  ('Tyres & Tubes', 'circle', 'Tyres, tubes, rim tapes, and valve cores');

-- Suppliers
INSERT INTO suppliers (name, contact_person, phone, email, address, payment_terms) VALUES
  ('Sharma Auto Parts', 'Rajesh Sharma', '9876543210', 'rajesh@sharmaauto.com', '12, Industrial Area, Phase 2, Delhi', 'Net 30'),
  ('Patel Spares Distributors', 'Amit Patel', '9876543211', 'amit@patelspares.com', '45, MIDC, Pune', 'Net 15'),
  ('Southern Motors Supply', 'Karthik R.', '9876543212', 'karthik@southernmotors.com', '78, Anna Salai, Chennai', 'COD'),
  ('Gupta Brake Systems', 'Sunil Gupta', '9876543213', 'sunil@guptabrakes.com', '23, Karol Bagh, Delhi', 'Net 30'),
  ('Royal Parts India', 'Vikram Singh', '9876543214', 'vikram@royalparts.in', '56, Jhotwara, Jaipur', 'Net 45');

-- Bike Models
INSERT INTO bike_models (brand, model, variant, year_from, year_to) VALUES
  ('Hero', 'Splendor Plus', 'BS6', 2020, NULL),
  ('Hero', 'Splendor Plus', 'i3S', 2017, 2020),
  ('Hero', 'HF Deluxe', 'BS6', 2020, NULL),
  ('Hero', 'Passion Pro', 'BS6', 2020, NULL),
  ('Hero', 'Super Splendor', 'BS6', 2020, NULL),
  ('Hero', 'Glamour', 'BS6', 2020, NULL),
  ('Bajaj', 'Pulsar 150', 'BS6', 2020, NULL),
  ('Bajaj', 'Pulsar 125', 'BS6', 2020, NULL),
  ('Bajaj', 'CT100', 'BS6', 2020, NULL),
  ('Bajaj', 'Platina 110', 'H-Gear', 2020, NULL),
  ('Honda', 'Activa 6G', 'STD', 2020, NULL),
  ('Honda', 'Activa 6G', 'DLX', 2020, NULL),
  ('Honda', 'Shine', 'BS6', 2020, NULL),
  ('Honda', 'SP 125', 'BS6', 2020, NULL),
  ('Honda', 'CB Unicorn', '160', 2015, 2020),
  ('TVS', 'Apache RTR 160', '4V BS6', 2020, NULL),
  ('TVS', 'Apache RTR 200', '4V BS6', 2020, NULL),
  ('TVS', 'Jupiter', 'BS6', 2020, NULL),
  ('TVS', 'XL100', 'BS6', 2020, NULL),
  ('TVS', 'Raider 125', '', 2021, NULL),
  ('Royal Enfield', 'Classic 350', 'BS6', 2020, NULL),
  ('Royal Enfield', 'Bullet 350', 'BS6', 2020, NULL),
  ('Royal Enfield', 'Meteor 350', '', 2020, NULL),
  ('Yamaha', 'FZ-S FI', 'V4', 2022, NULL),
  ('Yamaha', 'R15 V4', '', 2022, NULL),
  ('Yamaha', 'MT-15 V2', '', 2022, NULL),
  ('Suzuki', 'Access 125', 'BS6', 2020, NULL),
  ('Suzuki', 'Gixxer 150', 'BS6', 2020, NULL);

-- Parts (50 parts across all categories)
-- ENGINE PARTS
INSERT INTO parts (part_number, name, category_id, supplier_id, mrp, cost_price, stock_quantity, low_stock_threshold, last_restocked_at) VALUES
  ('ENG-001', 'Piston Kit 100cc', 1, 1, 450.00, 280.00, 25, 5, now() - interval '10 days'),
  ('ENG-002', 'Piston Kit 125cc', 1, 1, 520.00, 320.00, 18, 5, now() - interval '15 days'),
  ('ENG-003', 'Piston Kit 150cc', 1, 1, 620.00, 380.00, 12, 5, now() - interval '8 days'),
  ('ENG-004', 'Cylinder Head Gasket 100cc', 1, 1, 85.00, 45.00, 40, 10, now() - interval '5 days'),
  ('ENG-005', 'Cylinder Head Gasket 150cc', 1, 1, 120.00, 65.00, 30, 10, now() - interval '5 days'),
  ('ENG-006', 'Timing Chain', 1, 2, 180.00, 95.00, 22, 5, now() - interval '20 days'),
  ('ENG-007', 'Clutch Plate Set', 1, 2, 350.00, 190.00, 15, 5, now() - interval '12 days'),
  ('ENG-008', 'Valve Set (Inlet + Exhaust)', 1, 1, 280.00, 150.00, 3, 5, now() - interval '30 days'),
  ('ENG-009', 'Piston Ring Set 100cc', 1, 1, 120.00, 60.00, 35, 10, now() - interval '7 days'),
  ('ENG-010', 'Cam Chain Tensioner', 1, 2, 220.00, 120.00, 8, 5, now() - interval '25 days'),

-- BRAKES
  ('BRK-001', 'Front Brake Pad Set (Disc)', 2, 4, 280.00, 150.00, 30, 8, now() - interval '6 days'),
  ('BRK-002', 'Rear Brake Shoe Set', 2, 4, 180.00, 90.00, 35, 8, now() - interval '6 days'),
  ('BRK-003', 'Front Brake Disc', 2, 4, 850.00, 480.00, 6, 3, now() - interval '20 days'),
  ('BRK-004', 'Brake Cable (Front)', 2, 4, 95.00, 45.00, 20, 5, now() - interval '10 days'),
  ('BRK-005', 'Brake Cable (Rear)', 2, 4, 85.00, 40.00, 22, 5, now() - interval '10 days'),
  ('BRK-006', 'Brake Lever (Right)', 2, 4, 120.00, 55.00, 15, 5, now() - interval '15 days'),
  ('BRK-007', 'Brake Lever (Left)', 2, 4, 110.00, 50.00, 15, 5, now() - interval '15 days'),
  ('BRK-008', 'Rear Brake Drum', 2, 4, 650.00, 380.00, 2, 3, now() - interval '45 days'),

-- ELECTRICAL
  ('ELC-001', 'Headlight Bulb 12V 35W', 3, 3, 65.00, 25.00, 50, 15, now() - interval '3 days'),
  ('ELC-002', 'Tail Light Bulb 12V', 3, 3, 30.00, 12.00, 60, 15, now() - interval '3 days'),
  ('ELC-003', 'CDI Unit (Universal 100-110cc)', 3, 3, 380.00, 200.00, 8, 3, now() - interval '25 days'),
  ('ELC-004', 'Voltage Regulator Rectifier', 3, 3, 320.00, 170.00, 10, 3, now() - interval '18 days'),
  ('ELC-005', 'Ignition Coil', 3, 3, 250.00, 130.00, 12, 5, now() - interval '12 days'),
  ('ELC-006', 'Indicator Bulb 12V (Set of 4)', 3, 3, 80.00, 30.00, 0, 10, now() - interval '40 days'),
  ('ELC-007', 'Battery 12V 5Ah (MF)', 3, 3, 1200.00, 750.00, 5, 3, now() - interval '30 days'),
  ('ELC-008', 'Main Wiring Harness', 3, 3, 850.00, 480.00, 4, 3, now() - interval '35 days'),
  ('ELC-009', 'Horn 12V', 3, 3, 150.00, 70.00, 18, 5, now() - interval '8 days'),
  ('ELC-010', 'Starter Motor', 3, 1, 1800.00, 1050.00, 2, 2, now() - interval '50 days'),

-- BODY PARTS
  ('BDY-001', 'Side Mirror (Left)', 4, 5, 180.00, 85.00, 14, 5, now() - interval '10 days'),
  ('BDY-002', 'Side Mirror (Right)', 4, 5, 180.00, 85.00, 14, 5, now() - interval '10 days'),
  ('BDY-003', 'Front Mudguard', 4, 5, 450.00, 240.00, 6, 3, now() - interval '22 days'),
  ('BDY-004', 'Rear Mudguard', 4, 5, 380.00, 200.00, 7, 3, now() - interval '22 days'),
  ('BDY-005', 'Seat Cover (Universal)', 4, 5, 250.00, 130.00, 20, 5, now() - interval '5 days'),
  ('BDY-006', 'Chain Cover', 4, 5, 220.00, 110.00, 10, 5, now() - interval '14 days'),
  ('BDY-007', 'Kick Lever', 4, 2, 280.00, 140.00, 8, 3, now() - interval '18 days'),
  ('BDY-008', 'Foot Rest (Pair)', 4, 2, 320.00, 160.00, 12, 5, now() - interval '10 days'),

-- SUSPENSION
  ('SUS-001', 'Front Fork Oil Seal Set', 5, 2, 180.00, 85.00, 16, 5, now() - interval '12 days'),
  ('SUS-002', 'Rear Shock Absorber (Pair)', 5, 2, 950.00, 550.00, 4, 3, now() - interval '30 days'),
  ('SUS-003', 'Steering Bearing Set', 5, 2, 220.00, 110.00, 10, 5, now() - interval '15 days'),
  ('SUS-004', 'Wheel Bearing (Front)', 5, 2, 120.00, 55.00, 20, 5, now() - interval '8 days'),
  ('SUS-005', 'Wheel Bearing (Rear)', 5, 2, 130.00, 60.00, 18, 5, now() - interval '8 days'),
  ('SUS-006', 'Swing Arm Bush Set', 5, 2, 160.00, 75.00, 0, 5, now() - interval '45 days'),

-- TYRES & TUBES
  ('TYR-001', 'Front Tyre 2.75-18', 6, 3, 1100.00, 680.00, 8, 3, now() - interval '20 days'),
  ('TYR-002', 'Rear Tyre 3.00-18', 6, 3, 1350.00, 820.00, 6, 3, now() - interval '20 days'),
  ('TYR-003', 'Front Tube 2.75-18', 6, 3, 180.00, 90.00, 15, 5, now() - interval '10 days'),
  ('TYR-004', 'Rear Tube 3.00-18', 6, 3, 200.00, 100.00, 12, 5, now() - interval '10 days'),
  ('TYR-005', 'Scooter Tyre 90/100-10', 6, 3, 850.00, 520.00, 10, 3, now() - interval '15 days'),
  ('TYR-006', 'Scooter Tube 90/100-10', 6, 3, 150.00, 70.00, 18, 5, now() - interval '8 days'),
  ('TYR-007', 'Rim Tape (Pair)', 6, 3, 40.00, 15.00, 30, 10, now() - interval '5 days'),
  ('TYR-008', 'Valve Core (Pack of 5)', 6, 3, 25.00, 8.00, 50, 15, now() - interval '3 days');

-- Part Compatibility (mapping parts to bike models)
-- Engine 100cc parts → Hero Splendor, HF Deluxe, Bajaj CT100
INSERT INTO part_compatibility (part_id, bike_model_id) VALUES
  (1, 1), (1, 2), (1, 3), (1, 9),     -- Piston Kit 100cc
  (4, 1), (4, 2), (4, 3), (4, 9),     -- Head Gasket 100cc
  (9, 1), (9, 2), (9, 3), (9, 9);     -- Ring Set 100cc

-- Engine 125cc parts → Honda Shine, SP125, Bajaj Pulsar 125, TVS Raider
INSERT INTO part_compatibility (part_id, bike_model_id) VALUES
  (2, 13), (2, 14), (2, 8), (2, 20);  -- Piston Kit 125cc

-- Engine 150cc parts → Bajaj Pulsar 150, TVS Apache 160, Honda Unicorn
INSERT INTO part_compatibility (part_id, bike_model_id) VALUES
  (3, 7), (3, 16), (3, 15),           -- Piston Kit 150cc
  (5, 7), (5, 16), (5, 15);           -- Head Gasket 150cc

-- Universal engine parts → all models
INSERT INTO part_compatibility (part_id, bike_model_id)
  SELECT p.id, bm.id FROM parts p CROSS JOIN bike_models bm
  WHERE p.part_number IN ('ENG-006', 'ENG-007', 'ENG-008', 'ENG-010');

-- Brake parts → broad compatibility
INSERT INTO part_compatibility (part_id, bike_model_id)
  SELECT p.id, bm.id FROM parts p CROSS JOIN bike_models bm
  WHERE p.part_number IN ('BRK-001', 'BRK-002', 'BRK-004', 'BRK-005', 'BRK-006', 'BRK-007')
  AND bm.brand IN ('Hero', 'Bajaj', 'Honda', 'TVS', 'Yamaha');

-- Disc brake specific → disc-equipped bikes
INSERT INTO part_compatibility (part_id, bike_model_id) VALUES
  (13, 7), (13, 16), (13, 17), (13, 24), (13, 25), (13, 26), (13, 28); -- Front Disc

-- Electrical → broad compatibility
INSERT INTO part_compatibility (part_id, bike_model_id)
  SELECT p.id, bm.id FROM parts p CROSS JOIN bike_models bm
  WHERE p.part_number IN ('ELC-001', 'ELC-002', 'ELC-005', 'ELC-006', 'ELC-009');

-- CDI for 100-110cc
INSERT INTO part_compatibility (part_id, bike_model_id) VALUES
  (21, 1), (21, 2), (21, 3), (21, 9), (21, 10); -- CDI

-- Battery → all models
INSERT INTO part_compatibility (part_id, bike_model_id)
  SELECT p.id, bm.id FROM parts p CROSS JOIN bike_models bm
  WHERE p.part_number = 'ELC-007';

-- Body parts → universal
INSERT INTO part_compatibility (part_id, bike_model_id)
  SELECT p.id, bm.id FROM parts p CROSS JOIN bike_models bm
  WHERE p.part_number IN ('BDY-001', 'BDY-002', 'BDY-005', 'BDY-008');

-- Mudguards → Hero bikes
INSERT INTO part_compatibility (part_id, bike_model_id) VALUES
  (31, 1), (31, 2), (31, 3), (31, 4), (31, 5),
  (32, 1), (32, 2), (32, 3), (32, 4), (32, 5);

-- Suspension → universal for regular bikes
INSERT INTO part_compatibility (part_id, bike_model_id)
  SELECT p.id, bm.id FROM parts p CROSS JOIN bike_models bm
  WHERE p.part_number IN ('SUS-001', 'SUS-003', 'SUS-004', 'SUS-005', 'SUS-006')
  AND bm.brand NOT IN ('Royal Enfield');

-- Rear shocks → Hero, Bajaj, Honda
INSERT INTO part_compatibility (part_id, bike_model_id) VALUES
  (38, 1), (38, 2), (38, 3), (38, 4), (38, 5), (38, 7), (38, 8), (38, 9), (38, 13);

-- Tyres (18 inch) → motorcycles
INSERT INTO part_compatibility (part_id, bike_model_id)
  SELECT p.id, bm.id FROM parts p CROSS JOIN bike_models bm
  WHERE p.part_number IN ('TYR-001', 'TYR-002', 'TYR-003', 'TYR-004')
  AND bm.brand IN ('Hero', 'Bajaj', 'Yamaha', 'Royal Enfield')
  AND bm.model NOT LIKE '%XL%';

-- Scooter tyres → scooters
INSERT INTO part_compatibility (part_id, bike_model_id) VALUES
  (47, 11), (47, 12), (47, 18), (47, 27), -- Scooter Tyre
  (48, 11), (48, 12), (48, 18), (48, 27); -- Scooter Tube

-- Rim tape + valve cores → universal
INSERT INTO part_compatibility (part_id, bike_model_id)
  SELECT p.id, bm.id FROM parts p CROSS JOIN bike_models bm
  WHERE p.part_number IN ('TYR-007', 'TYR-008');
