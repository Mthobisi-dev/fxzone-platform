-- Harden legacy counter triggers without changing their business logic.
--
-- These functions update denormalized follow and post-like counts. They run
-- as SECURITY DEFINER, so a fixed search path is required to prevent objects
-- supplied through a caller-controlled schema from shadowing trusted names.

BEGIN;

ALTER FUNCTION public.handle_follow()
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.handle_post_like()
  SET search_path = pg_catalog, public, pg_temp;

COMMIT;
