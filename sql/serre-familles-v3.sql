-- La Serre : projets parents/enfants (migration additive, sans suppression)
ALTER TABLE public.serre_projects
 ADD COLUMN IF NOT EXISTS parent_id uuid NULL;
CREATE UNIQUE INDEX IF NOT EXISTS serre_projects_id_owner_unique
 ON public.serre_projects (id, owner_id);
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='serre_projects_parent_fk') THEN
  ALTER TABLE public.serre_projects
   ADD CONSTRAINT serre_projects_parent_fk
   FOREIGN KEY (parent_id, owner_id)
   REFERENCES public.serre_projects (id, owner_id)
   ON DELETE RESTRICT;
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS serre_projects_parent_idx
 ON public.serre_projects(parent_id);
ALTER TABLE public.serre_projects
 DROP CONSTRAINT IF EXISTS serre_projects_not_self_parent;
ALTER TABLE public.serre_projects
 ADD CONSTRAINT serre_projects_not_self_parent
 CHECK (parent_id IS NULL OR parent_id <> id);
-- Un seul niveau d'enfants ; empêche également les cycles.
CREATE OR REPLACE FUNCTION public.serre_check_project_parent()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.parent_id IS NOT NULL THEN
  IF EXISTS(SELECT 1 FROM public.serre_projects p
            WHERE p.id=NEW.parent_id AND p.parent_id IS NOT NULL) THEN
   RAISE EXCEPTION 'Un sous-projet ne peut pas devenir parent.';
  END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM public.serre_projects c
           WHERE c.parent_id=NEW.id) AND NEW.parent_id IS NOT NULL THEN
  RAISE EXCEPTION 'Un projet qui possède des enfants ne peut pas devenir enfant.';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS serre_project_parent_guard ON public.serre_projects;
CREATE TRIGGER serre_project_parent_guard
 BEFORE INSERT OR UPDATE OF parent_id ON public.serre_projects
 FOR EACH ROW EXECUTE FUNCTION public.serre_check_project_parent();
-- RLS existant préservé.
