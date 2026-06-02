CREATE INDEX IF NOT EXISTS idx_users_email_lower
  ON public.users (LOWER(email));

CREATE INDEX IF NOT EXISTS idx_achievements_sort_order_id
  ON public.achievements (sort_order, id);

CREATE INDEX IF NOT EXISTS idx_levels_required_points_number
  ON public.levels (required_points, level_number);

DELETE FROM public.blocked_apps a
USING public.blocked_apps b
WHERE a.ctid < b.ctid
  AND a.user_id = b.user_id
  AND a.package_name IS NOT NULL
  AND a.package_name = b.package_name;

DELETE FROM public.blocked_apps a
USING public.blocked_apps b
WHERE a.ctid < b.ctid
  AND a.user_id = b.user_id
  AND LOWER(a.app_name) = LOWER(b.app_name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_blocked_apps_user_package_unique
  ON public.blocked_apps (user_id, package_name)
  WHERE package_name IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_blocked_apps_user_app_name_unique
  ON public.blocked_apps (user_id, LOWER(app_name));

CREATE INDEX IF NOT EXISTS idx_blocked_apps_user_active
  ON public.blocked_apps (user_id, is_active);
