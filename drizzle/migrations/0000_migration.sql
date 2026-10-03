
CREATE TABLE public.babies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  birthdate date NOT NULL,
  gender text NOT NULL DEFAULT 'other',
  invite_code text NOT NULL UNIQUE DEFAULT upper(substr(md5(random()::text),1,6)),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.babies TO authenticated;
GRANT ALL ON public.babies TO service_role;
ALTER TABLE public.babies ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id uuid NOT NULL REFERENCES public.babies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role_label text NOT NULL DEFAULT 'הורה',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (baby_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_members TO authenticated;
GRANT ALL ON public.family_members TO service_role;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id uuid NOT NULL REFERENCES public.babies(id) ON DELETE CASCADE,
  type text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX events_baby_started_idx ON public.events(baby_id, started_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_family_member(_baby_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.family_members WHERE baby_id = _baby_id AND user_id = auth.uid())
$$;

CREATE POLICY "members read baby" ON public.babies FOR SELECT TO authenticated USING (public.is_family_member(id));
CREATE POLICY "members update baby" ON public.babies FOR UPDATE TO authenticated USING (public.is_family_member(id));

CREATE POLICY "members read family" ON public.family_members FOR SELECT TO authenticated USING (public.is_family_member(baby_id));
CREATE POLICY "update own membership" ON public.family_members FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "leave family" ON public.family_members FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "members read events" ON public.events FOR SELECT TO authenticated USING (public.is_family_member(baby_id));
CREATE POLICY "members insert events" ON public.events FOR INSERT TO authenticated WITH CHECK (public.is_family_member(baby_id) AND created_by = auth.uid());
CREATE POLICY "members update events" ON public.events FOR UPDATE TO authenticated USING (public.is_family_member(baby_id));
CREATE POLICY "members delete events" ON public.events FOR DELETE TO authenticated USING (public.is_family_member(baby_id));

CREATE OR REPLACE FUNCTION public.create_baby(_name text, _birthdate date, _gender text, _role_label text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.babies(name, birthdate, gender, created_by) VALUES (_name, _birthdate, _gender, auth.uid()) RETURNING id INTO _id;
  INSERT INTO public.family_members(baby_id, user_id, role_label) VALUES (_id, auth.uid(), _role_label);
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.join_family(_code text, _role_label text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT id INTO _id FROM public.babies WHERE invite_code = upper(trim(_code));
  IF _id IS NULL THEN RAISE EXCEPTION 'invalid code'; END IF;
  INSERT INTO public.family_members(baby_id, user_id, role_label) VALUES (_id, auth.uid(), _role_label)
  ON CONFLICT (baby_id, user_id) DO UPDATE SET role_label = EXCLUDED.role_label;
  RETURN _id;
END $$;

REVOKE EXECUTE ON FUNCTION public.create_baby(text,date,text,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.join_family(text,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_baby(text,date,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_family(text,text) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
ALTER TABLE public.events REPLICA IDENTITY FULL;
