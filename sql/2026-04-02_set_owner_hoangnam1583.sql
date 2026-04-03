-- Promote shop owner account by email
-- Run in Supabase SQL Editor with privileged role.

BEGIN;

DO $$
DECLARE
  target_email text := 'hoangnam1583@gmail.com';
  target_user_id uuid;
BEGIN
  SELECT u.id
  INTO target_user_id
  FROM auth.users u
  WHERE lower(u.email) = lower(target_email)
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE NOTICE 'Khong tim thay % trong auth.users cua project nay', target_email;
    RAISE NOTICE 'Hay tao user trong Authentication > Users roi chay lai script';
    RETURN;
  END IF;

  IF to_regclass('public.profiles') IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, role)
    VALUES (target_user_id, target_email, 'owner')
    ON CONFLICT (id)
    DO UPDATE SET
      email = EXCLUDED.email,
      role = 'owner';
  END IF;

  IF to_regclass('public.user_profiles') IS NOT NULL THEN
    UPDATE public.user_profiles up
    SET role = 'owner'
    FROM auth.users u
    WHERE up.id = u.id
      AND lower(u.email) = lower(target_email);
  END IF;
END $$;

COMMIT;
