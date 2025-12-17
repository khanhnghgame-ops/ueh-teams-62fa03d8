import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { UEHLogo } from '@/components/UEHLogo';
import { Loader2, Lock, Shield } from 'lucide-react';
import { z } from 'zod';

const LEADER_PASSWORD = '14092005';
const DEPUTY_PASSWORD = '123456';
const LEADER_EMAIL = 'khanhngh.ueh@gmail.com';
const DEPUTY_EMAIL = 'deputy@taskflow.ueh.local';

const passwordSchema = z.object({
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

export function AdminAuthForm() {
  const navigate = useNavigate();
  const { signIn, user, roles } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [password, setPassword] = useState('');

  const isAdminOrLeader = roles.includes('admin') || roles.includes('leader');

  useEffect(() => {
    if (user && isAdminOrLeader) {
      navigate('/dashboard');
    }
  }, [user, isAdminOrLeader, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = passwordSchema.safeParse({ password });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    // Xác định vai trò dựa trên mật khẩu
    let email = '';
    let roleLabel = '';

    if (password === LEADER_PASSWORD) {
      email = LEADER_EMAIL;
      roleLabel = 'Leader';
    } else if (password === DEPUTY_PASSWORD) {
      email = DEPUTY_EMAIL;
      roleLabel = 'Nhóm phó';
    } else {
      setIsLoading(false);
      toast({
        title: 'Mật khẩu không hợp lệ',
        description: 'Mật khẩu không đúng. Vui lòng kiểm tra lại.',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await signIn(email, password);
    setIsLoading(false);

    if (error) {
      toast({
        title: 'Đăng nhập thất bại',
        description: 'Không thể đăng nhập. Vui lòng liên hệ quản trị viên.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Đăng nhập thành công',
      description: `Chào mừng ${roleLabel}!`,
    });
    navigate('/dashboard');
  };

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 flex flex-col items-center gap-2">
        <UEHLogo width={100} />
        <span className="font-heading font-semibold text-primary flex items-center gap-1">
          <Shield className="w-4 h-4" /> TaskFlow UEH - Leader/Nhóm phó
        </span>
      </div>
      <Card className="w-full shadow-card-lg border-border/50">
        <CardHeader className="text-center pb-2">
          <CardTitle className="font-heading text-2xl">Đăng nhập Leader / Nhóm phó</CardTitle>
          <CardDescription>
            Chỉ dành cho Leader và Nhóm phó. Nhập mật khẩu để đăng nhập.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-password">Mật khẩu</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="admin-password"
                  type="password"
                  placeholder="Nhập mật khẩu Leader hoặc Nhóm phó"
                  className="pl-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  autoFocus
                />
              </div>
              {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
            </div>
            <Button type="submit" className="w-full font-semibold" disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Đăng nhập
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Vai trò được xác định tự động dựa trên mật khẩu
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
