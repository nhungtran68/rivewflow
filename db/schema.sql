CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  product_name text NOT NULL,
  description text,
  price text,
  offer text,
  target_customer text,
  highlights text,
  cta text,
  forbidden_info text,
  target_duration integer NOT NULL DEFAULT 30 CHECK (target_duration IN (15,30,45,60,90)),
  style_key text NOT NULL DEFAULT 'natural_intro',
  selected_angle_id uuid,
  source_video_key text,
  normalized_video_key text,
  subtitles_enabled boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'UPLOADING',
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  status_message text NOT NULL DEFAULT 'Đang khởi tạo dự án',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_projects_user_created ON projects(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  storage_key text NOT NULL,
  kind text NOT NULL DEFAULT 'SOURCE',
  mime_type text,
  width integer,
  height integer,
  duration_seconds numeric,
  codec_name text,
  pix_fmt text,
  frame_rate text,
  time_base text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS video_frames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene_id text NOT NULL,
  timestamp_seconds numeric NOT NULL,
  storage_key text NOT NULL,
  visual_hash text,
  selected boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_video_frames_project ON video_frames(project_id, timestamp_seconds);

CREATE TABLE IF NOT EXISTS video_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  product_detected text,
  scenes jsonb NOT NULL DEFAULT '[]'::jsonb,
  visible_features jsonb NOT NULL DEFAULT '[]'::jsonb,
  possible_selling_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  interesting_visual_moments jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_hooks jsonb NOT NULL DEFAULT '[]'::jsonb,
  uncertain_information jsonb NOT NULL DEFAULT '[]'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_angles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  hook text NOT NULL,
  insight text NOT NULL,
  product_focus text NOT NULL,
  scene_suggestion text NOT NULL,
  cta text NOT NULL,
  ai_recommended boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_angles_project ON content_angles(project_id, sort_order);

CREATE TABLE IF NOT EXISTS scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  angle_id uuid REFERENCES content_angles(id) ON DELETE SET NULL,
  style_key text NOT NULL,
  target_duration integer NOT NULL,
  script_text text NOT NULL,
  segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  estimated_duration numeric,
  version integer NOT NULL DEFAULT 1,
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scripts_project_current ON scripts(project_id, is_current);

CREATE TABLE IF NOT EXISTS custom_styles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  prompt text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS voices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('VBEE','ELEVENLABS')),
  display_name text NOT NULL,
  external_voice_id text NOT NULL,
  speed numeric NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'READY',
  is_default boolean NOT NULL DEFAULT false,
  consent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider, external_voice_id)
);
CREATE INDEX IF NOT EXISTS idx_voices_user ON voices(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audio_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  script_id uuid NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  voice_id uuid NOT NULL REFERENCES voices(id) ON DELETE RESTRICT,
  provider text NOT NULL,
  provider_request_id text,
  input_hash text NOT NULL,
  storage_key text,
  duration_seconds numeric,
  codec_name text,
  sample_rate integer,
  channels integer,
  status text NOT NULL DEFAULT 'PENDING',
  error_code text,
  adjustment_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, input_hash)
);

CREATE TABLE IF NOT EXISTS render_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  audio_generation_id uuid NOT NULL REFERENCES audio_generations(id) ON DELETE RESTRICT,
  input_hash text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  attempt integer NOT NULL DEFAULT 0,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, input_hash)
);

CREATE TABLE IF NOT EXISTS render_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  render_job_id uuid NOT NULL REFERENCES render_jobs(id) ON DELETE CASCADE,
  storage_key text NOT NULL,
  duration_seconds numeric NOT NULL,
  validation jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provider_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  setting_key text NOT NULL,
  value text,
  secret_ref text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, setting_key)
);

CREATE TABLE IF NOT EXISTS job_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id text NOT NULL,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  provider text,
  step text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  status text NOT NULL,
  error_code text,
  message text
);
CREATE INDEX IF NOT EXISTS idx_job_logs_project ON job_logs(project_id, started_at DESC);

ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS fk_projects_selected_angle;
ALTER TABLE projects
  ADD CONSTRAINT fk_projects_selected_angle
  FOREIGN KEY (selected_angle_id) REFERENCES content_angles(id) ON DELETE SET NULL;
