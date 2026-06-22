-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- ============================================
-- TABLE: solar_farms (Green Dots)
-- ============================================
CREATE TABLE IF NOT EXISTS solar_farms (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200),
    state           VARCHAR(100) NOT NULL,
    district        VARCHAR(100),
    geometry        GEOMETRY(MULTIPOLYGON, 4326) NOT NULL,
    area_ha         FLOAT,
    capacity_mw     FLOAT,
    detected_date   DATE DEFAULT CURRENT_DATE,
    confidence      FLOAT CHECK (confidence >= 0 AND confidence <= 1),
    satellite_source VARCHAR(50) DEFAULT 'Sentinel-2',
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- TABLE: suitable_sites (Orange Dots)
-- ============================================
CREATE TABLE IF NOT EXISTS suitable_sites (
    id                      SERIAL PRIMARY KEY,
    state                   VARCHAR(100) NOT NULL,
    district                VARCHAR(100),
    geometry                GEOMETRY(POINT, 4326) NOT NULL,
    suitability_score       FLOAT CHECK (suitability_score >= 0 AND suitability_score <= 1),
    solar_irradiance        FLOAT,
    slope_deg               FLOAT,
    land_use                VARCHAR(100),
    grid_distance_km        FLOAT,
    road_distance_km        FLOAT,
    water_body_distance_km  FLOAT,
    recommended_capacity_mw FLOAT,
    created_at              TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- TABLE: india_states
-- ============================================
CREATE TABLE IF NOT EXISTS india_states (
    id       SERIAL PRIMARY KEY,
    name     VARCHAR(100) UNIQUE NOT NULL,
    code     VARCHAR(10),
    geometry GEOMETRY(MULTIPOLYGON, 4326)
);

-- ============================================
-- SPATIAL INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_solar_farms_geom   ON solar_farms USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_solar_farms_state  ON solar_farms(LOWER(state));
CREATE INDEX IF NOT EXISTS idx_suitable_sites_geom  ON suitable_sites USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_suitable_sites_state ON suitable_sites(LOWER(state));

-- ============================================
-- SEED: Indian States + UTs
-- ============================================
INSERT INTO india_states (name, code) VALUES
('Andhra Pradesh','AP'),('Arunachal Pradesh','AR'),('Assam','AS'),
('Bihar','BR'),('Chhattisgarh','CG'),('Goa','GA'),('Gujarat','GJ'),
('Haryana','HR'),('Himachal Pradesh','HP'),('Jharkhand','JH'),
('Karnataka','KA'),('Kerala','KL'),('Madhya Pradesh','MP'),
('Maharashtra','MH'),('Manipur','MN'),('Meghalaya','ML'),
('Mizoram','MZ'),('Nagaland','NL'),('Odisha','OD'),('Punjab','PB'),
('Rajasthan','RJ'),('Sikkim','SK'),('Tamil Nadu','TN'),
('Telangana','TS'),('Tripura','TR'),('Uttar Pradesh','UP'),
('Uttarakhand','UK'),('West Bengal','WB'),
('Delhi','DL'),('Jammu and Kashmir','JK'),('Ladakh','LA'),
('Puducherry','PY'),('Chandigarh','CH'),('Lakshadweep','LD'),
('Andaman and Nicobar Islands','AN'),('Dadra and Nagar Haveli','DN')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- SEED: Sample solar farm data for testing
-- ============================================
INSERT INTO solar_farms (name, state, district, geometry, area_ha, capacity_mw, confidence, satellite_source) VALUES
('Bhadla Solar Park Phase I',  'Rajasthan', 'Jodhpur',   ST_GeomFromText('MULTIPOLYGON(((72.5 27.5, 72.6 27.5, 72.6 27.6, 72.5 27.6, 72.5 27.5)))', 4326), 1000, 220, 0.97, 'Sentinel-2'),
('Bhadla Solar Park Phase II', 'Rajasthan', 'Jodhpur',   ST_GeomFromText('MULTIPOLYGON(((72.6 27.5, 72.7 27.5, 72.7 27.6, 72.6 27.6, 72.6 27.5)))', 4326), 1200, 250, 0.96, 'Sentinel-2'),
('Charanka Solar Park',        'Gujarat',   'Patan',     ST_GeomFromText('MULTIPOLYGON(((71.2 23.9, 71.3 23.9, 71.3 24.0, 71.2 24.0, 71.2 23.9)))', 4326), 600,  220, 0.94, 'Sentinel-2'),
('Pavagada Solar Park',        'Karnataka', 'Tumkur',    ST_GeomFromText('MULTIPOLYGON(((77.3 14.1, 77.4 14.1, 77.4 14.2, 77.3 14.2, 77.3 14.1)))', 4326), 1300, 2050,0.95, 'Sentinel-2'),
('Kamuthi Solar Power',        'Tamil Nadu','Ramanathapuram', ST_GeomFromText('MULTIPOLYGON(((78.4 9.3, 78.5 9.3, 78.5 9.4, 78.4 9.4, 78.4 9.3)))', 4326), 1040, 648, 0.93, 'Sentinel-2'),
('Rewa Ultra Mega Solar',      'Madhya Pradesh','Rewa',  ST_GeomFromText('MULTIPOLYGON(((81.3 24.5, 81.4 24.5, 81.4 24.6, 81.3 24.6, 81.3 24.5)))', 4326), 1500, 750, 0.96, 'Sentinel-2'),
('Kurnool Ultra Mega',         'Andhra Pradesh','Kurnool', ST_GeomFromText('MULTIPOLYGON(((78.3 15.7, 78.4 15.7, 78.4 15.8, 78.3 15.8, 78.3 15.7)))', 4326), 1200, 1000,0.94, 'Sentinel-2'),
('Pokhran Solar',              'Rajasthan', 'Jaisalmer', ST_GeomFromText('MULTIPOLYGON(((71.9 26.9, 72.0 26.9, 72.0 27.0, 71.9 27.0, 71.9 26.9)))', 4326), 450,  100, 0.91, 'Sentinel-2'),
('Neemuch Solar',              'Madhya Pradesh','Neemuch', ST_GeomFromText('MULTIPOLYGON(((74.8 24.4, 74.9 24.4, 74.9 24.5, 74.8 24.5, 74.8 24.4)))', 4326), 300, 150, 0.89, 'Sentinel-2'),
('Ananthapuramu Solar',        'Andhra Pradesh','Anantapur', ST_GeomFromText('MULTIPOLYGON(((77.6 14.6, 77.7 14.6, 77.7 14.7, 77.6 14.7, 77.6 14.6)))', 4326), 800, 500, 0.92, 'Sentinel-2')
ON CONFLICT DO NOTHING;

-- ============================================
-- SEED: Sample suitable sites
-- ============================================
INSERT INTO suitable_sites (state, district, geometry, suitability_score, solar_irradiance, slope_deg, land_use, grid_distance_km, recommended_capacity_mw) VALUES
('Rajasthan','Jaisalmer',    ST_SetSRID(ST_MakePoint(70.9, 27.1), 4326), 0.95, 6.8, 0.8, 'wasteland', 12.0, 500),
('Rajasthan','Barmer',       ST_SetSRID(ST_MakePoint(71.4, 25.7), 4326), 0.92, 6.7, 1.2, 'barren',    18.0, 400),
('Gujarat','Kutch',          ST_SetSRID(ST_MakePoint(69.8, 23.5), 4326), 0.90, 6.2, 0.5, 'wasteland', 25.0, 350),
('Gujarat','Banaskantha',    ST_SetSRID(ST_MakePoint(71.8, 24.2), 4326), 0.87, 6.1, 1.0, 'scrubland', 20.0, 300),
('Andhra Pradesh','Anantapur', ST_SetSRID(ST_MakePoint(77.5, 14.4), 4326), 0.85, 5.9, 1.5, 'barren',  15.0, 250),
('Tamil Nadu','Tirunelveli', ST_SetSRID(ST_MakePoint(77.7, 9.1),  4326), 0.83, 5.8, 2.0, 'wasteland', 10.0, 200),
('Madhya Pradesh','Neemuch', ST_SetSRID(ST_MakePoint(75.0, 24.5), 4326), 0.81, 5.6, 1.8, 'scrubland', 22.0, 180),
('Karnataka','Bellary',      ST_SetSRID(ST_MakePoint(76.9, 15.1), 4326), 0.80, 5.7, 1.2, 'barren',    30.0, 220),
('Telangana','Nalgonda',     ST_SetSRID(ST_MakePoint(79.2, 16.9), 4326), 0.78, 5.5, 2.5, 'scrubland', 18.0, 160),
('Maharashtra','Osmanabad',  ST_SetSRID(ST_MakePoint(76.1, 18.2), 4326), 0.76, 5.4, 2.2, 'wasteland', 35.0, 140)
ON CONFLICT DO NOTHING;
