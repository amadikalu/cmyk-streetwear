DROP TABLE IF EXISTS bespoke_orders;
DROP TABLE IF EXISTS products;

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  base_price REAL NOT NULL,
  r2_image_key TEXT NOT NULL,
  is_bespoke BOOLEAN DEFAULT 1
);

CREATE TABLE bespoke_orders (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  product_id TEXT REFERENCES products(id),
  fabric_choice TEXT,
  measurements JSON NOT NULL,
  delivery_location TEXT NOT NULL,
  payment_reference TEXT UNIQUE,
  status TEXT DEFAULT 'LAB_PROCESSING',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
