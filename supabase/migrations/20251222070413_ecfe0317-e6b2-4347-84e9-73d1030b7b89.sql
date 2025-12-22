-- Update the check_admin_user function to only add admin role, not leader
CREATE OR REPLACE FUNCTION public.check_admin_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Nếu là tài khoản admin đặc biệt theo email cố định
  IF NEW.email = 'khanhngh.ueh@gmail.com' THEN
    -- Đảm bảo hồ sơ được duyệt và đồng bộ thông tin cơ bản
    UPDATE public.profiles
    SET 
      is_approved = true,
      full_name = COALESCE(full_name, 'Nguyễn Hoàng Khánh'),
      email = NEW.email
    WHERE id = NEW.id;

    -- Chỉ cấp quyền admin (không cần leader vì admin đã bao gồm quyền cao nhất)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;