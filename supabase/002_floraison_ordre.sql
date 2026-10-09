-- La Serre · Migration Floraison V2
-- À exécuter UNE FOIS dans le SQL Editor du projet Hub writing.
-- Ajoute uniquement un ordre d'affichage aux liens jalon/semaine.
-- Ne supprime aucun jalon, ne change aucune date, ne modifie aucune politique RLS.
BEGIN;
ALTER TABLE public.serre_milestone_weeks
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Attribuer une position stable aux jalons déjà répartis.
WITH positions AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY owner_id, week_start
           ORDER BY created_at, id
         ) - 1 AS position
  FROM public.serre_milestone_weeks
)
UPDATE public.serre_milestone_weeks AS w
SET sort_order = positions.position
FROM positions
WHERE w.id = positions.id
  AND w.sort_order = 0;
CREATE INDEX IF NOT EXISTS serre_weeks_order_idx
  ON public.serre_milestone_weeks (owner_id, week_start, sort_order);
COMMIT;
