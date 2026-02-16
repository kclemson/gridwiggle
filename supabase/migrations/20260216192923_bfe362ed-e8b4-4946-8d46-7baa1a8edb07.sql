CREATE TABLE public.photo_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  session_id text NOT NULL,
  photo_count smallint NOT NULL,
  aspect_ratios real[] NOT NULL DEFAULT '{}',
  hero_count smallint NOT NULL DEFAULT 0,
  is_dev boolean NOT NULL DEFAULT false
);

ALTER TABLE public.photo_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny_select" ON public.photo_sessions FOR SELECT USING (false);
CREATE POLICY "deny_insert" ON public.photo_sessions FOR INSERT WITH CHECK (false);
CREATE POLICY "deny_update" ON public.photo_sessions FOR UPDATE USING (false);
CREATE POLICY "deny_delete" ON public.photo_sessions FOR DELETE USING (false);