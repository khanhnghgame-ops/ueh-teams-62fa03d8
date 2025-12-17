import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { UEHLogo } from '@/components/UEHLogo';
import { Loader2, Mail, User, Lock, Hash } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';

const loginSchema = z.object({
  identifier: z.string().min(1, 'Vui lòng nhập Email hoặc MSSV'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
});

const signupSchema = z
  .object({
    studentId: z.string().min(1, 'Vui lòng nhập MSSV').max(20, 'MSSV quá dài'),
    fullName: z.string().min(1, 'Vui lòng nhập họ tên').max(100, 'Họ tên quá dài'),
    email: z.string().email('Email không hợp lệ'),
    password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });

export function MemberAuthForm() {
  const navigate = useNavigate();
  const { signIn, signUp, user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [signupStudentId, setSignupStudentId] = useState('');
  const [signupFullName, setSignupFullName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = loginSchema.safeParse({ identifier: loginIdentifier, password: loginPassword });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    // Đăng nhập thông thường dùng email hoặc MSSV (chỉ cho thành viên)
    let email = loginIdentifier;

    if (!loginIdentifier.includes('@')) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('email')
        .eq('student_id', loginIdentifier)
        .maybeSingle();

      if (profileData?.email) {
        email = profileData.email;
      } else {
        setIsLoading(false);
        toast({
          title: 'Không tìm thấy tài khoản',
          description: 'MSSV này chưa được đăng ký trong hệ thống',
          variant: 'destructive',
        });
        return;
      }
    }

    const { error } = await signIn(email, loginPassword);
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = signupSchema.safeParse({
      studentId: signupStudentId,
      fullName: signupFullName,
      email: signupEmail,
      password: signupPassword,
      confirmPassword: signupConfirmPassword,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(signupEmail, signupPassword, signupStudentId, signupFullName);
    setIsLoading(false);

    if (error) {
      if (error.message.includes('already registered')) {
        toast({
          title: 'Đăng ký thất bại',
          description: 'Email này đã được đăng ký. Vui lòng đăng nhập.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Đăng ký thất bại',
          description: error.message,
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: 'Đăng ký thành công',
        description: 'Tài khoản của bạn đang chờ Admin duyệt.',
      });
      navigate('/dashboard');
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 flex flex-col items-center gap-2">
        <UEHLogo width={100} />
        <span className="font-heading font-semibold text-primary">TaskFlow UEH - Thành viên</span>
      </div>
      <Card className="w-full shadow-card-lg border-border/50">
        <CardHeader className="text-center pb-2">
          <CardTitle className="font-heading text-2xl">Đăng nhập thành viên</CardTitle>
          <CardDescription>Đăng nhập hoặc đăng ký tài khoản sinh viên UEH</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login" className="font-medium">
                Đăng nhập
              </TabsTrigger>
              <TabsTrigger value="signup" className="font-medium">
                Đăng ký
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-identifier">Email hoặc MSSV</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="login-identifier"
                      type="text"
                      placeholder="email@ueh.edu.vn hoặc MSSV"
                      className="pl-10"
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      disabled={isLoading}
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
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>
                <Button type="submit" className="w-full font-semibold" disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Đăng nhập
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-studentId">Mã số sinh viên</Label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="signup-studentId"
                      placeholder="31241234567"
                      className="pl-10"
                      value={signupStudentId}
                      onChange={(e) => setSignupStudentId(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.studentId && <p className="text-sm text-destructive">{errors.studentId}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-fullName">Họ và tên</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="signup-fullName"
                      placeholder="Nguyễn Văn A"
                      className="pl-10"
                      value={signupFullName}
                      onChange={(e) => setSignupFullName(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email UEH</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="email@ueh.edu.vn"
                      className="pl-10"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Mật khẩu</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      className="pl-10"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirmPassword">Xác nhận mật khẩu</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="signup-confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      className="pl-10"
                      value={signupConfirmPassword}
                      onChange={(e) => setSignupConfirmPassword(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                  )}
                </div>
                <Button type="submit" className="w-full font-semibold" disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Đăng ký
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Tài khoản sẽ cần Admin duyệt trước khi sử dụng
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
