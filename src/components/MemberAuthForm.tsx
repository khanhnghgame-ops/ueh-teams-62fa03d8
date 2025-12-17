import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { UEHLogo } from '@/components/UEHLogo';
import { Loader2, Mail, Lock, Users } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';

const loginSchema = z.object({
  identifier: z.string().min(1, 'Vui lòng nhập Email UEH hoặc MSSV'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
});

export function MemberAuthForm() {
  const navigate = useNavigate();
  const { signIn, user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = loginSchema.safeParse({ identifier, password });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    // Tìm email từ MSSV nếu không phải email
    let email = identifier;

    if (!identifier.includes('@')) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('email')
        .eq('student_id', identifier)
        .maybeSingle();

      if (profileData?.email) {
        email = profileData.email;
      } else {
        setIsLoading(false);
        toast({
          title: 'Tài khoản không tồn tại',
          description: 'MSSV này chưa được Leader/Nhóm phó thêm vào hệ thống.',
          variant: 'destructive',
        });
        return;
      }
    }

    const { error } = await signIn(email, password);
    setIsLoading(false);

    if (error) {
      toast({
        title: 'Đăng nhập thất bại',
        description:
          error.message === 'Invalid login credentials'
            ? 'Email/MSSV hoặc mật khẩu không đúng'
            : error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Đăng nhập thành công',
        description: 'Chào mừng bạn quay lại!',
      });
      navigate('/dashboard');
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 flex flex-col items-center gap-2">
        <UEHLogo width={100} />
        <span className="font-heading font-semibold text-primary flex items-center gap-1">
          <Users className="w-4 h-4" /> TaskFlow UEH - Thành viên
        </span>
      </div>
      <Card className="w-full shadow-card-lg border-border/50">
        <CardHeader className="text-center pb-2">
          <CardTitle className="font-heading text-2xl">Đăng nhập thành viên</CardTitle>
          <CardDescription>
            Dành cho thành viên đã được Leader/Nhóm phó thêm vào hệ thống
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-identifier">Email UEH hoặc MSSV</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="login-identifier"
                  type="text"
                  placeholder="email@ueh.edu.vn hoặc MSSV"
                  className="pl-10"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={isLoading}
                  autoFocus
                />
              </div>
              {errors.identifier && <p className="text-sm text-destructive">{errors.identifier}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Mật khẩu</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
            </div>
            <Button type="submit" className="w-full font-semibold" disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Đăng nhập
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Chưa có tài khoản? Liên hệ Leader hoặc Nhóm phó để được thêm vào hệ thống.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
