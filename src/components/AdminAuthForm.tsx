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
import { Loader2, Lock, Shield, Crown, Users } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';

const LEADER_PASSWORD = '14092005';
const DEPUTY_PASSWORD = '123456';
const LEADER_EMAIL = 'khanhngh.ueh@gmail.com';
const DEPUTY_EMAIL = 'khanhngh.game@gmail.com';

const passwordSchema = z.object({
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

export function AdminAuthForm() {
  const navigate = useNavigate();
  const { signIn, user, roles } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [leaderPassword, setLeaderPassword] = useState('');
  const [deputyPassword, setDeputyPassword] = useState('');

  const isAdminOrLeader = roles.includes('admin') || roles.includes('leader');

  useEffect(() => {
    if (user && isAdminOrLeader) {
      navigate('/dashboard');
    }
  }, [user, isAdminOrLeader, navigate]);

  // Setup system accounts on first load
  useEffect(() => {
    const setupAccounts = async () => {
      setIsSettingUp(true);
      try {
        const { error } = await supabase.functions.invoke('manage-users', {
          body: { action: 'setup_system_accounts' }
        });
        if (error) {
          console.error('Setup error:', error);
        }
      } catch (err) {
        console.error('Setup failed:', err);
      } finally {
        setIsSettingUp(false);
      }
    };
    setupAccounts();
  }, []);

  const handleLeaderLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = passwordSchema.safeParse({ password: leaderPassword });
    if (!result.success) {
      setErrors({ leaderPassword: 'Vui lòng nhập mật khẩu' });
      return;
    }

    if (leaderPassword !== LEADER_PASSWORD) {
      toast({
        title: 'Mật khẩu không đúng',
        description: 'Mật khẩu Leader không chính xác.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(LEADER_EMAIL, LEADER_PASSWORD);
    setIsLoading(false);

    if (error) {
      toast({
        title: 'Đăng nhập thất bại',
        description: 'Không thể đăng nhập. Vui lòng thử lại sau.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Đăng nhập thành công',
      description: 'Chào mừng Leader!',
    });
    navigate('/dashboard');
  };

  const handleDeputyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = passwordSchema.safeParse({ password: deputyPassword });
    if (!result.success) {
      setErrors({ deputyPassword: 'Vui lòng nhập mật khẩu' });
      return;
    }

    if (deputyPassword !== DEPUTY_PASSWORD) {
      toast({
        title: 'Mật khẩu không đúng',
        description: 'Mật khẩu Nhóm phó không chính xác.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(DEPUTY_EMAIL, DEPUTY_PASSWORD);
    setIsLoading(false);

    if (error) {
      toast({
        title: 'Đăng nhập thất bại',
        description: 'Không thể đăng nhập. Vui lòng thử lại sau.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Đăng nhập thành công',
      description: 'Chào mừng Nhóm phó!',
    });
    navigate('/dashboard');
  };

  if (isSettingUp) {
    return (
      <div className="w-full max-w-md flex flex-col items-center gap-4">
        <UEHLogo width={100} />
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Đang khởi tạo hệ thống...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 flex flex-col items-center gap-2">
        <UEHLogo width={100} />
        <span className="font-heading font-semibold text-primary flex items-center gap-1">
          <Shield className="w-4 h-4" /> TaskFlow UEH - Quản trị
        </span>
      </div>
      <Card className="w-full shadow-card-lg border-border/50">
        <CardHeader className="text-center pb-2">
          <CardTitle className="font-heading text-2xl">Đăng nhập Quản trị</CardTitle>
          <CardDescription>
            Chọn vai trò và nhập mật khẩu để đăng nhập
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="leader" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="leader" className="font-medium flex items-center gap-1">
                <Crown className="w-4 h-4" /> Leader
              </TabsTrigger>
              <TabsTrigger value="deputy" className="font-medium flex items-center gap-1">
                <Users className="w-4 h-4" /> Nhóm phó
              </TabsTrigger>
            </TabsList>

            <TabsContent value="leader">
              <form onSubmit={handleLeaderLogin} className="space-y-4">
                <div className="p-3 bg-primary/10 rounded-lg text-sm text-center">
                  <Crown className="w-5 h-5 mx-auto mb-1 text-primary" />
                  <p className="font-medium text-primary">Leader - Quyền cao nhất</p>
                  <p className="text-muted-foreground text-xs">Quản lý toàn bộ hệ thống</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leader-password">Mật khẩu Leader</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="leader-password"
                      type="password"
                      placeholder="Nhập mật khẩu Leader"
                      className="pl-10"
                      value={leaderPassword}
                      onChange={(e) => setLeaderPassword(e.target.value)}
                      disabled={isLoading}
                      autoFocus
                    />
                  </div>
                  {errors.leaderPassword && <p className="text-sm text-destructive">{errors.leaderPassword}</p>}
                </div>
                <Button type="submit" className="w-full font-semibold" disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Crown className="w-4 h-4 mr-2" />}
                  Đăng nhập Leader
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="deputy">
              <form onSubmit={handleDeputyLogin} className="space-y-4">
                <div className="p-3 bg-secondary/50 rounded-lg text-sm text-center">
                  <Users className="w-5 h-5 mx-auto mb-1 text-secondary-foreground" />
                  <p className="font-medium">Nhóm phó</p>
                  <p className="text-muted-foreground text-xs">Quản lý công việc trong nhóm</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deputy-password">Mật khẩu Nhóm phó</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="deputy-password"
                      type="password"
                      placeholder="Nhập mật khẩu Nhóm phó"
                      className="pl-10"
                      value={deputyPassword}
                      onChange={(e) => setDeputyPassword(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.deputyPassword && <p className="text-sm text-destructive">{errors.deputyPassword}</p>}
                </div>
                <Button type="submit" className="w-full font-semibold" variant="secondary" disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Users className="w-4 h-4 mr-2" />}
                  Đăng nhập Nhóm phó
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
