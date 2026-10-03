
CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id uuid NOT NULL REFERENCES public.babies(id) ON DELETE CASCADE,
  kind text NOT NULL,
  name text NOT NULL,
  unit text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  restock_amount integer NOT NULL DEFAULT 1,
  restock_label text NOT NULL DEFAULT '+1',
  low_threshold integer NOT NULL DEFAULT 20,
  critical_threshold integer NOT NULL DEFAULT 10,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (baby_id, kind)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read inventory" ON public.inventory_items FOR SELECT TO authenticated USING (public.is_family_member(baby_id));
CREATE POLICY "members update inventory" ON public.inventory_items FOR UPDATE TO authenticated USING (public.is_family_member(baby_id));

CREATE TABLE public.inventory_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  baby_id uuid NOT NULL REFERENCES public.babies(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inventory_log_item_idx ON public.inventory_log(item_id, created_at DESC);
GRANT SELECT ON public.inventory_log TO authenticated;
GRANT ALL ON public.inventory_log TO service_role;
ALTER TABLE public.inventory_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read inventory log" ON public.inventory_log FOR SELECT TO authenticated USING (public.is_family_member(baby_id));

CREATE TABLE public.shopping_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id uuid NOT NULL REFERENCES public.babies(id) ON DELETE CASCADE,
  name text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopping_list TO authenticated;
GRANT ALL ON public.shopping_list TO service_role;
ALTER TABLE public.shopping_list ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read list" ON public.shopping_list FOR SELECT TO authenticated USING (public.is_family_member(baby_id));
CREATE POLICY "members insert list" ON public.shopping_list FOR INSERT TO authenticated WITH CHECK (public.is_family_member(baby_id));
CREATE POLICY "members update list" ON public.shopping_list FOR UPDATE TO authenticated USING (public.is_family_member(baby_id));
CREATE POLICY "members delete list" ON public.shopping_list FOR DELETE TO authenticated USING (public.is_family_member(baby_id));

-- internal: apply a delta and log it
CREATE OR REPLACE FUNCTION public._apply_inventory_delta(_item_id uuid, _delta integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _baby uuid;
BEGIN
  UPDATE public.inventory_items SET quantity = GREATEST(0, quantity + _delta), updated_at = now()
  WHERE id = _item_id RETURNING baby_id INTO _baby;
  IF _baby IS NOT NULL THEN
    INSERT INTO public.inventory_log(item_id, baby_id, delta) VALUES (_item_id, _baby, _delta);
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public._apply_inventory_delta(uuid, integer) FROM anon, authenticated, public;

CREATE OR REPLACE FUNCTION public.adjust_inventory(_item_id uuid, _delta integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.inventory_items i WHERE i.id = _item_id AND public.is_family_member(i.baby_id)) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  PERFORM public._apply_inventory_delta(_item_id, _delta);
END $$;
REVOKE EXECUTE ON FUNCTION public.adjust_inventory(uuid, integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.adjust_inventory(uuid, integer) TO authenticated;

-- seed items for a baby
CREATE OR REPLACE FUNCTION public.seed_inventory(_baby_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.inventory_items(baby_id, kind, name, unit, restock_amount, restock_label, low_threshold, critical_threshold) VALUES
    (_baby_id, 'diapers', 'חיתולים', 'יחידות', 48, '+48 חיתולים', 20, 10),
    (_baby_id, 'wipes', 'מגבונים', 'חבילות', 1, '+ חבילה', 3, 1),
    (_baby_id, 'formula', 'תמ״ל', 'קופסאות', 1, '+ קופסה', 2, 1)
  ON CONFLICT (baby_id, kind) DO NOTHING;
$$;
REVOKE EXECUTE ON FUNCTION public.seed_inventory(uuid) FROM anon, authenticated, public;

CREATE OR REPLACE FUNCTION public.on_baby_created() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.seed_inventory(NEW.id); RETURN NEW; END $$;
CREATE TRIGGER babies_seed_inventory AFTER INSERT ON public.babies FOR EACH ROW EXECUTE FUNCTION public.on_baby_created();

SELECT public.seed_inventory(id) FROM public.babies;

-- automatic depletion: diaper events
CREATE OR REPLACE FUNCTION public.on_diaper_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _item uuid; _row public.events;
BEGIN
  _row := COALESCE(NEW, OLD);
  IF _row.type <> 'diaper' THEN RETURN _row; END IF;
  SELECT id INTO _item FROM public.inventory_items WHERE baby_id = _row.baby_id AND kind = 'diapers';
  IF _item IS NOT NULL THEN
    PERFORM public._apply_inventory_delta(_item, CASE WHEN TG_OP = 'INSERT' THEN -1 ELSE 1 END);
  END IF;
  RETURN _row;
END $$;
CREATE TRIGGER events_diaper_inventory AFTER INSERT OR DELETE ON public.events FOR EACH ROW EXECUTE FUNCTION public.on_diaper_event();

ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shopping_list;
ALTER TABLE public.shopping_list REPLICA IDENTITY FULL;
