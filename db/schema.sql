-- FinCrime Control Lab Database Schema
-- Database: fincrime_lab
-- Host: 89.167.95.173:5432
-- User: fincrime_app

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Typologies reference data
CREATE TABLE IF NOT EXISTS typologies (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(100) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  risk_theme VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  applicable_firm_types JSONB NOT NULL DEFAULT '[]',
  applicable_products JSONB NOT NULL DEFAULT '[]',
  applicable_customer_types JSONB NOT NULL DEFAULT '[]',
  control_objective TEXT NOT NULL,
  data_required JSONB NOT NULL DEFAULT '[]',
  detection_logic JSONB NOT NULL DEFAULT '[]',
  workflow_steps JSONB NOT NULL DEFAULT '[]',
  metrics JSONB NOT NULL DEFAULT '{}',
  governance_checklist JSONB NOT NULL DEFAULT '[]',
  sources JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partner flow reference data
CREATE TABLE IF NOT EXISTS partner_flows (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(100) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  model_type VARCHAR(50) NOT NULL,
  flow_type VARCHAR(50) NOT NULL,
  default_actors JSONB NOT NULL DEFAULT '[]',
  control_ownership_template JSONB NOT NULL DEFAULT '{}',
  data_fields_template JSONB NOT NULL DEFAULT '[]',
  raci_template JSONB NOT NULL DEFAULT '{}',
  pre_launch_conditions JSONB NOT NULL DEFAULT '[]',
  governance_pack JSONB NOT NULL DEFAULT '[]',
  sources JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Assessment records
CREATE TABLE IF NOT EXISTS assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  module VARCHAR(30) NOT NULL CHECK (module IN ('typology_iq', 'partner_control_map')),
  answers JSONB NOT NULL DEFAULT '{}',
  results JSONB NOT NULL DEFAULT '{}',
  ai_narrative TEXT,
  risk_score INTEGER,
  risk_rating VARCHAR(20),
  typology_id INTEGER REFERENCES typologies(id),
  partner_flow_id INTEGER REFERENCES partner_flows(id),
  session_id VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lead capture for PDF downloads
CREATE TABLE IF NOT EXISTS lead_capture (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  firm_name VARCHAR(255),
  job_title VARCHAR(255),
  assessment_id UUID REFERENCES assessments(id),
  module VARCHAR(30) NOT NULL,
  pdf_sent BOOLEAN NOT NULL DEFAULT FALSE,
  opt_in_newsletter BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_assessments_module ON assessments(module);
CREATE INDEX idx_assessments_session ON assessments(session_id);
CREATE INDEX idx_assessments_created ON assessments(created_at DESC);
CREATE INDEX idx_lead_capture_email ON lead_capture(email);
CREATE INDEX idx_lead_capture_created ON lead_capture(created_at DESC);
CREATE INDEX idx_typologies_slug ON typologies(slug);
CREATE INDEX idx_partner_flows_slug ON partner_flows(slug);
