import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Key, ShieldAlert } from 'lucide-react';

interface ChangePasswordDialogProps {
  open: boolean;
  userId: string;
  onPasswordChanged: () => void;
}

export default function ChangePasswordDialog({ open, userId, onPasswordChanged }: ChangePasswordDialogProps) {
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast({
        title: 'Mật khẩu quá ngắn',
        description: 'Mật khẩu mới phải có ít nhất 6 ký tự',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Mật khẩu không khớp',
        description: 'Vui lòng nhập lại mật khẩu xác nhận',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword === '123456') {
      toast({
        title: 'Mật khẩu không hợp lệ',
        description: 'Vui lòng chọn mật khẩu khác với mật khẩu mặc định',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    const { data, error } = await supabase.functions.invoke('manage-users', {
      body: {
        action: 'update_password',
        user_id: userId,
        password: newPassword,
      }
    });

    setIsLoading(false);

    if (error || data?.error) {
      toast({
        title: 'Đổi mật khẩu thất bại',
        description: data?.error || error?.message || 'Có lỗi xảy ra',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Đổi mật khẩu thành công',
      description: 'Bạn có thể tiếp tục sử dụng hệ thống',
    });

    onPasswordChanged();
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            Yêu cầu đổi mật khẩu
          </DialogTitle>
          <DialogDescription>
            Đây là lần đăng nhập đầu tiên của bạn. Vui lòng đổi mật khẩu mặc định để bảo mật tài khoản.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">Mật khẩu mới</Label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="newPassword"
                type="password"
                placeholder="Tối thiểu 6 ký tự"
                className="pl-10"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Xác nhận mật khẩu</Label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Nhập lại mật khẩu mới"
                className="pl-10"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Đổi mật khẩu
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}