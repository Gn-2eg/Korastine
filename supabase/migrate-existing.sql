-- KORASTINE safe migration for the existing Supabase schema.
-- Run once in Supabase SQL Editor. Preserves auth.users and public.profiles.
BEGIN;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.predictions) <> 0 THEN
    RAISE EXCEPTION 'Migration stopped: predictions is not empty. No changes made.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='username')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='predictions' AND column_name='settled_at') THEN
    RAISE EXCEPTION 'Migration stopped: unexpected table layout. No changes made.';
  END IF;
END $$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'fan';
UPDATE public.profiles SET display_name=coalesce(nullif(left(trim(username),40),''),'مشجع كورهسطين') WHERE display_name IS NULL;
ALTER TABLE public.profiles ALTER COLUMN display_name SET DEFAULT 'مشجع كورهسطين';
ALTER TABLE public.profiles ALTER COLUMN display_name SET NOT NULL;

-- The existing predictions table was confirmed empty; convert its text ID safely.
-- The legacy foreign key points to a text-based fixtures table. The API validates real fixture IDs before saving.
-- Predictions were verified empty, so remove only this obsolete constraint before converting the ID.
ALTER TABLE public.predictions DROP CONSTRAINT IF EXISTS predictions_fixture_id_fkey;
ALTER TABLE public.predictions ALTER COLUMN fixture_id TYPE bigint USING fixture_id::bigint;
ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS league_id integer;
ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS kickoff timestamptz;
ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS settled boolean NOT NULL DEFAULT false;
ALTER TABLE public.predictions ALTER COLUMN league_id SET NOT NULL;
ALTER TABLE public.predictions ALTER COLUMN kickoff SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS predictions_user_fixture_unique ON public.predictions(user_id,fixture_id);
CREATE INDEX IF NOT EXISTS predictions_pending_fixture_idx ON public.predictions(fixture_id) WHERE settled=false;
CREATE INDEX IF NOT EXISTS predictions_user_idx ON public.predictions(user_id);

-- Keep existing users; automatically create profiles for future sign-ups.
CREATE OR REPLACE FUNCTION public.korastine_create_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.profiles(id,display_name)
  VALUES (NEW.id, coalesce(nullif(left(trim(NEW.raw_user_meta_data->>'full_name'),40),''),
                          nullif(left(trim(NEW.raw_user_meta_data->>'name'),40),''),
                          nullif(left(trim(NEW.raw_user_meta_data->>'display_name'),40),''),
                          'مشجع كورهسطين'))
  ON CONFLICT(id) DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS korastine_profile_on_signup ON auth.users;
CREATE TRIGGER korastine_profile_on_signup AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.korastine_create_profile();
INSERT INTO public.profiles(id,display_name)
SELECT id,coalesce(nullif(left(trim(raw_user_meta_data->>'full_name'),40),''),'مشجع كورهسطين')
FROM auth.users ON CONFLICT(id) DO NOTHING;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS korastine_profile_self_read ON public.profiles;
CREATE POLICY korastine_profile_self_read ON public.profiles FOR SELECT TO authenticated USING (id=auth.uid());
DROP POLICY IF EXISTS korastine_prediction_self_read ON public.predictions;
CREATE POLICY korastine_prediction_self_read ON public.predictions FOR SELECT TO authenticated USING (user_id=auth.uid());
GRANT SELECT ON public.profiles,public.predictions TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_prediction(
  p_user_id uuid,p_fixture_id bigint,p_league_id integer,p_kickoff timestamptz,p_home integer,p_away integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF p_kickoff <= now() THEN RAISE EXCEPTION 'Kickoff has passed'; END IF;
  IF p_home NOT BETWEEN 0 AND 20 OR p_away NOT BETWEEN 0 AND 20 THEN RAISE EXCEPTION 'Invalid score'; END IF;
  INSERT INTO public.predictions(user_id,fixture_id,league_id,kickoff,home_score,away_score)
  VALUES(p_user_id,p_fixture_id,p_league_id,p_kickoff,p_home,p_away)
  ON CONFLICT(user_id,fixture_id) DO UPDATE SET
    home_score=excluded.home_score,away_score=excluded.away_score,created_at=now()
  WHERE predictions.settled=false AND predictions.kickoff>now();
  IF NOT FOUND THEN RAISE EXCEPTION 'Prediction locked'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.settle_fixture(p_fixture_id bigint,p_home integer,p_away integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE affected integer;
BEGIN
  IF p_home NOT BETWEEN 0 AND 30 OR p_away NOT BETWEEN 0 AND 30 THEN RAISE EXCEPTION 'Invalid final score'; END IF;
  UPDATE public.predictions p SET points=CASE
    WHEN p.home_score=p_home AND p.away_score=p_away THEN 100
    WHEN sign(p.home_score-p.away_score)=sign(p_home-p_away) THEN 40
    WHEN p.home_score+p.away_score=p_home+p_away THEN 20
    ELSE 0 END,settled=true,settled_at=now()
  WHERE p.fixture_id=p_fixture_id AND p.settled=false AND p.created_at<p.kickoff;
  GET DIAGNOSTICS affected=ROW_COUNT;
  RETURN affected;
END $$;

-- Security-definer leaderboard is necessary so RLS doesn't hide other players' XP.
CREATE OR REPLACE FUNCTION public.korastine_leaderboard()
RETURNS TABLE(id uuid,display_name text,xp bigint,settled_predictions bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT p.id,p.display_name,coalesce(sum(pr.points),0)::bigint,
         count(pr.id) FILTER(WHERE pr.settled)::bigint
  FROM public.profiles p LEFT JOIN public.predictions pr ON pr.user_id=p.id
  GROUP BY p.id,p.display_name
  ORDER BY coalesce(sum(pr.points),0) DESC,p.display_name
  LIMIT 50;
$$;

REVOKE ALL ON FUNCTION public.submit_prediction(uuid,bigint,integer,timestamptz,integer,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.settle_fixture(bigint,integer,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.korastine_leaderboard() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_prediction(uuid,bigint,integer,timestamptz,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_fixture(bigint,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.korastine_leaderboard() TO authenticated;
COMMIT;

-- Verify after running:
SELECT to_regprocedure('public.submit_prediction(uuid,bigint,integer,timestamptz,integer,integer)') AS prediction_function,
       to_regprocedure('public.settle_fixture(bigint,integer,integer)') AS scoring_function,
       to_regprocedure('public.korastine_leaderboard()') AS leaderboard_function;
