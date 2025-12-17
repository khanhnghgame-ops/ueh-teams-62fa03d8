import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { UEHLogo } from '@/components/UEHLogo';
import { Loader2, Mail, Lock, Shield } from 'lucide-react';
import { z } from 'zod';

const adminLoginSchema = z.object({
  identifier: z.string().min(1, 'Vui lòng nhập Email UEH hoặc MSSV admin'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
});

export function AdminAuthForm() {
  const navigate = useNavigate();
  const { signIn, user, roles } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const isAdminOrLeader = roles.includes('admin') || roles.includes('leader');

  useEffect(() => {
    if (user && isAdminOrLeader) {
      navigate('/dashboard');
    }
  }, [user, isAdminOrLeader, navigate]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = adminLoginSchema.safeParse({ identifier, password });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    // Trường hợp admin đặc biệt: đăng nhập chỉ cần đúng MSSV + mật khẩu, không cần đăng ký
    if (identifier === '31241570562' && password === '14092005') {
      const adminEmail = 'khanhngh.ueh@gmail.com';
      const { error } = await signIn(adminEmail, password);
      setIsLoading(false);

      if (error) {
        toast({
          title: 'Đăng nhập admin thất bại',
          description: 'Vui lòng liên hệ Admin để kiểm tra lại tài khoản.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Đăng nhập thành công',
          description: 'Chào mừng Admin Nguyễn Hoàng Khánh!',
        });
        navigate('/dashboard');
      }
      return;
    }

    // Đăng nhập Leader/Admin thông thường bằng email UEH
    const email = identifier;
    const { error } = await signIn(email, password);
    setIsLoading(false);

    if (error) {
      toast({
        title: 'Đăng nhập thất bại',
        description:
          error.message === 'Invalid login credentials'
            ? 'Email hoặc mật khẩu không đúng'
            : error.message,
        variant: 'destructive',
      });
      return;
    }

    if (!roles.includes('admin') && !roles.includes('leader')) {
      toast({
        title: 'Tài khoản không có quyền Leader/Admin',
        description: 'Vui lòng đăng nhập bằng tài khoản được phân quyền hoặc sử dụng trang thành viên.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Đăng nhập thành công',
      description: 'Chào mừng Leader/Admin quay lại!',
    });
    navigate('/dashboard');
  };

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 flex flex-col items-center gap-2">
        <UEHLogo width={100} />
        <span className="font-heading font-semibold text-primary flex items-center gap-1">
          <Shield className="w-4 h-4" /> TaskFlow UEH - Leader/Admin
        </span>
      </div>
      <Card className="w-full shadow-card-lg border-border/50">
        <CardHeader className="text-center pb-2">
          <CardTitle className="font-heading text-2xl">Đăng nhập Leader / Admin</CardTitle>
          <CardDescription>
            Chỉ dành cho các tài khoản được phân quyền Leader/Admin trong hệ thống
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-identifier">Email UEH hoặc MSSV admin</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="admin-identifier"
                  type="text"
                  placeholder="email@ueh.edu.vn hoặc MSSV admin"
                  className="pl-10"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              {errors.identifier && <p className="text-sm text-destructive">{errors.identifier}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Mật khẩu</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="admin-password"
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
              Đăng nhập Leader/Admin
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
