-- La Serre V1. A REVOIR avant exécution sur Supabase Hub writing.
-- Tables autonomes préfixées serre_. Requiert Supabase Auth.
BEGIN;

CREATE TABLE IF NOT EXISTS public.serre_projects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 160),
 description text,
 color_hex text NOT NULL DEFAULT '#C4B3E8' CHECK (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
 icon_name text NOT NULL DEFAULT 'sprout',
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','archived')),
 sort_order integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (id,owner_id)
);

CREATE TABLE IF NOT EXISTS public.serre_horizons (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
 project_id uuid NOT NULL,
 year integer NOT NULL CHECK (year BETWEEN 2020 AND 2100),
 quarter integer NOT NULL CHECK (quarter BETWEEN 1 AND 4),
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
 desired_outcome text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (id,owner_id,project_id),
 FOREIGN KEY (project_id,owner_id) REFERENCES public.serre_projects(id,owner_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.serre_milestones (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
 project_id uuid NOT NULL,
 horizon_id uuid,
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 240),
 details text,
 target_month date NOT NULL CHECK (EXTRACT(DAY FROM target_month)=1),
 hard_deadline date,
 progress_status text NOT NULL DEFAULT 'planned' CHECK (progress_status IN ('planned','in_progress','completed')),
 planning_status text NOT NULL DEFAULT 'reserve' CHECK (planning_status IN ('reserve','selected','deferred')),
 completed_at timestamptz,
 sort_order integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (id,owner_id),
 FOREIGN KEY (project_id,owner_id) REFERENCES public.serre_projects(id,owner_id) ON DELETE CASCADE,
 FOREIGN KEY (horizon_id,owner_id,project_id) REFERENCES public.serre_horizons(id,owner_id,project_id) ON DELETE NO ACTION,
 CONSTRAINT serre_completion_consistent CHECK ((progress_status='completed') = (completed_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS public.serre_milestone_weeks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
 milestone_id uuid NOT NULL,
 week_start date NOT NULL CHECK (EXTRACT(ISODOW FROM week_start)=1),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (milestone_id,week_start),
 FOREIGN KEY (milestone_id,owner_id) REFERENCES public.serre_milestones(id,owner_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.serre_project_notes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
 project_id uuid NOT NULL,
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
 body text,
 sort_order integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (project_id,owner_id) REFERENCES public.serre_projects(id,owner_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.serre_month_focus (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
 month_start date NOT NULL CHECK (EXTRACT(DAY FROM month_start)=1),
 project_id uuid,
 focus_note text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (owner_id,month_start),
 FOREIGN KEY (project_id,owner_id) REFERENCES public.serre_projects(id,owner_id) ON DELETE SET NULL (project_id)
);

CREATE TABLE IF NOT EXISTS public.serre_milestone_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 milestone_id uuid NOT NULL,
 changed_at timestamptz NOT NULL DEFAULT now(),
 previous_target_month date NOT NULL,
 new_target_month date NOT NULL,
 FOREIGN KEY (milestone_id,owner_id) REFERENCES public.serre_milestones(id,owner_id) ON DELETE CASCADE
);

CREATE OR REPLACE FUNCTION public.serre_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.serre_track_month_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NEW.target_month IS DISTINCT FROM OLD.target_month THEN
  INSERT INTO public.serre_milestone_history(owner_id,milestone_id,previous_target_month,new_target_month)
  VALUES(OLD.owner_id,OLD.id,OLD.target_month,NEW.target_month);
 END IF;
 RETURN NEW;
END; $$;

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['serre_projects','serre_horizons','serre_milestones','serre_project_notes','serre_month_focus'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS serre_touch ON public.%I',t);
  EXECUTE format('CREATE TRIGGER serre_touch BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.serre_touch_updated_at()',t);
 END LOOP;
END $$;
DROP TRIGGER IF EXISTS serre_track_month ON public.serre_milestones;
CREATE TRIGGER serre_track_month AFTER UPDATE OF target_month ON public.serre_milestones
FOR EACH ROW EXECUTE FUNCTION public.serre_track_month_change();

CREATE OR REPLACE FUNCTION public.serre_preserve_owner() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
  RAISE EXCEPTION 'Changing owner_id is forbidden';
 END IF;
 RETURN NEW;
END; $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['serre_projects','serre_horizons','serre_milestones','serre_milestone_weeks','serre_project_notes','serre_month_focus','serre_milestone_history'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS serre_owner_immutable ON public.%I',t);
  EXECUTE format('CREATE TRIGGER serre_owner_immutable BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.serre_preserve_owner()',t);
 END LOOP;
END $$;

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['serre_projects','serre_horizons','serre_milestones','serre_milestone_weeks','serre_project_notes','serre_month_focus','serre_milestone_history'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('DROP POLICY IF EXISTS serre_owner_select ON public.%I',t);
  EXECUTE format('DROP POLICY IF EXISTS serre_owner_insert ON public.%I',t);
  EXECUTE format('DROP POLICY IF EXISTS serre_owner_update ON public.%I',t);
  EXECUTE format('DROP POLICY IF EXISTS serre_owner_delete ON public.%I',t);
  EXECUTE format('CREATE POLICY serre_owner_select ON public.%I FOR SELECT TO authenticated USING (owner_id = (select auth.uid()))',t);
  EXECUTE format('CREATE POLICY serre_owner_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (owner_id = (select auth.uid()))',t);
  EXECUTE format('CREATE POLICY serre_owner_update ON public.%I FOR UPDATE TO authenticated USING (owner_id = (select auth.uid())) WITH CHECK (owner_id = (select auth.uid()))',t);
  EXECUTE format('CREATE POLICY serre_owner_delete ON public.%I FOR DELETE TO authenticated USING (owner_id = (select auth.uid()))',t);
 END LOOP;
END $$;
DROP POLICY IF EXISTS serre_owner_insert ON public.serre_milestone_history;
DROP POLICY IF EXISTS serre_owner_update ON public.serre_milestone_history;
DROP POLICY IF EXISTS serre_owner_delete ON public.serre_milestone_history;

CREATE INDEX IF NOT EXISTS serre_milestones_month_idx ON public.serre_milestones(owner_id,target_month);
CREATE INDEX IF NOT EXISTS serre_milestones_project_idx ON public.serre_milestones(project_id);
CREATE INDEX IF NOT EXISTS serre_weeks_week_idx ON public.serre_milestone_weeks(owner_id,week_start);
CREATE INDEX IF NOT EXISTS serre_horizons_quarter_idx ON public.serre_horizons(owner_id,year,quarter);
CREATE INDEX IF NOT EXISTS serre_history_milestone_idx ON public.serre_milestone_history(milestone_id,changed_at DESC);

COMMIT;
