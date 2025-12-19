import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, UserPlus, Users, Trash2, Key, Mail, Hash, User, Pencil } from 'lucide-react';
import type { Profile } from '@/types/database';

export default function MemberManagement() {
  const navigate = useNavigate();
  const { user, isAdmin, isLeader, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [members, setMembers] = useState<Profile[]>([]);
  const [memberRoles, setMemberRoles] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Profile | null>(null);
  
  // Form state
  const [newEmail, setNewEmail] = useState('');
  const [newStudentId, setNewStudentId] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [updatePassword, setUpdatePassword] = useState('');
  
  // Edit form state
  const [editFullName, setEditFullName] = useState('');
  const [editStudentId, setEditStudentId] = useState('');
  const [editEmail, setEditEmail] = useState('');

  // Check if a member is a leader (has 'admin' or 'leader' role)
  const isMemberLeader = (memberId: string): boolean => {
    const roles = memberRoles[memberId] || [];
    return roles.includes('admin') || roles.includes('leader');
  };

  // Check if current user can manage (edit/delete/change password) the member
  // Deputies (leader role but not admin) cannot manage Leaders (admin role)
  const canManageMember = (memberId: string): boolean => {
    if (isAdmin) return true; // Admin can manage everyone
    if (!isLeader) return false; // Non-leaders cannot manage anyone
    
    // Deputies (leaders who are not admins) cannot manage other leaders/admins
    const targetRoles = memberRoles[memberId] || [];
    const isTargetAdmin = targetRoles.includes('admin');
    
    return !isTargetAdmin; // Deputies can only manage non-admin members
  };

  useEffect(() => {
    if (!authLoading && !isAdmin && !isLeader) {
      navigate('/dashboard');
      return;
    }
    fetchMembers();
  }, [authLoading, isAdmin, isLeader, navigate]);

  const fetchMembers = async () => {
    setIsLoading(true);
    
    // Fetch profiles
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (profilesError) {
      toast({
        title: 'Lỗi',
        description: 'Không thể tải danh sách thành viên',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }
    
    setMembers(profilesData || []);
    
    // Fetch user roles if admin
    if (isAdmin) {
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role');
      
      if (rolesData) {
        const rolesMap: Record<string, string[]> = {};
        rolesData.forEach((r) => {
          if (!rolesMap[r.user_id]) {
            rolesMap[r.user_id] = [];
          }
          rolesMap[r.user_id].push(r.role);
        });
        setMemberRoles(rolesMap);
      }
    } else if (isLeader) {
      // Deputies need to know who the admins are to prevent editing them
      // Use RPC or check profiles for admin indicators
      const profileIds = (profilesData || []).map(p => p.id);
      const rolesMap: Record<string, string[]> = {};
      
      // For each profile, check if they have admin role
      for (const profile of (profilesData || [])) {
        const { data: hasAdminRole } = await supabase.rpc('is_admin', { _user_id: profile.id });
        if (hasAdminRole) {
          rolesMap[profile.id] = ['admin'];
        }
      }
      setMemberRoles(rolesMap);
    }
    
    setIsLoading(false);
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newEmail || !newStudentId || !newFullName) {
      toast({
        title: 'Thiếu thông tin',
        description: 'Vui lòng điền đầy đủ thông tin',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    
    const { data, error } = await supabase.functions.invoke('manage-users', {
      body: {
        action: 'create_member',
        email: newEmail,
        student_id: newStudentId,
        full_name: newFullName,
      }
    });

    setIsCreating(false);

    if (error || data?.error) {
      toast({
        title: 'Tạo thành viên thất bại',
        description: data?.error || error?.message || 'Có lỗi xảy ra',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Tạo thành viên thành công',
      description: `Đã tạo tài khoản cho ${newFullName}. Mật khẩu mặc định: 123456`,
    });

    // Reset form
    setNewEmail('');
    setNewStudentId('');
    setNewFullName('');
    setIsDialogOpen(false);
    fetchMembers();
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedMember || !updatePassword) {
      return;
    }

    if (updatePassword.length < 6) {
      toast({
        title: 'Mật khẩu quá ngắn',
        description: 'Mật khẩu phải có ít nhất 6 ký tự',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    
    const { data, error } = await supabase.functions.invoke('manage-users', {
      body: {
        action: 'update_password',
        user_id: selectedMember.id,
        password: updatePassword,
        requester_id: user?.id,
      }
    });

    setIsCreating(false);

    if (error || data?.error) {
      toast({
        title: 'Cập nhật mật khẩu thất bại',
        description: data?.error || error?.message || 'Có lỗi xảy ra',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Cập nhật thành công',
      description: `Đã đổi mật khẩu cho ${selectedMember.full_name}`,
    });

    setUpdatePassword('');
    setSelectedMember(null);
    setIsPasswordDialogOpen(false);
  };

  const handleEditMember = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedMember) return;

    if (!editFullName.trim() || !editStudentId.trim()) {
      toast({
        title: 'Thiếu thông tin',
        description: 'Vui lòng điền đầy đủ thông tin',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);

    // Update profile in database
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: editFullName.trim(),
        student_id: editStudentId.trim(),
      })
      .eq('id', selectedMember.id);

    // Update email in auth if changed
    if (editEmail.trim() !== selectedMember.email) {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'update_email',
          user_id: selectedMember.id,
          email: editEmail.trim(),
        }
      });

      if (error || data?.error) {
        setIsCreating(false);
        toast({
          title: 'Cập nhật email thất bại',
          description: data?.error || error?.message || 'Có lỗi xảy ra',
          variant: 'destructive',
        });
        return;
      }
    }

    setIsCreating(false);

    if (profileError) {
      toast({
        title: 'Cập nhật thất bại',
        description: profileError.message || 'Có lỗi xảy ra',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Cập nhật thành công',
      description: `Đã cập nhật thông tin cho ${editFullName}`,
    });

    setSelectedMember(null);
    setIsEditDialogOpen(false);
    fetchMembers();
  };

  const handleDeleteMember = async () => {
    if (!selectedMember) return;

    setIsCreating(true);

    const { data, error } = await supabase.functions.invoke('manage-users', {
      body: {
        action: 'delete_user',
        user_id: selectedMember.id,
        requester_id: user?.id,
      }
    });

    setIsCreating(false);

    if (error || data?.error) {
      toast({
        title: 'Xóa thành viên thất bại',
        description: data?.error || error?.message || 'Có lỗi xảy ra',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Xóa thành công',
      description: `Đã xóa thành viên ${selectedMember.full_name}`,
    });

    setSelectedMember(null);
    setIsDeleteDialogOpen(false);
    fetchMembers();
  };

  const openEditDialog = (member: Profile) => {
    setSelectedMember(member);
    setEditFullName(member.full_name);
    setEditStudentId(member.student_id);
    setEditEmail(member.email);
    setIsEditDialogOpen(true);
  };

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-heading font-bold">Quản lý thành viên</h1>
            <p className="text-muted-foreground">Thêm, chỉnh sửa, xóa và phân quyền thành viên trong hệ thống</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="font-semibold">
                <UserPlus className="w-4 h-4 mr-2" />
                Thêm thành viên
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Thêm thành viên mới</DialogTitle>
                <DialogDescription>
                  Tạo tài khoản cho thành viên mới. Mật khẩu mặc định là "123456", thành viên sẽ được yêu cầu đổi mật khẩu khi đăng nhập lần đầu.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateMember} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Họ và tên</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      placeholder="Nguyễn Văn A"
                      className="pl-10"
                      value={newFullName}
                      onChange={(e) => setNewFullName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="studentId">Mã số sinh viên</Label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="studentId"
                      placeholder="31241234567"
                      className="pl-10"
                      value={newStudentId}
                      onChange={(e) => setNewStudentId(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email UEH</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="email@ueh.edu.vn"
                      className="pl-10"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <Key className="w-4 h-4 inline mr-1" />
                    Mật khẩu mặc định: <span className="font-mono font-bold">123456</span>
                  </p>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Hủy
                  </Button>
                  <Button type="submit" disabled={isCreating}>
                    {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
                    Tạo thành viên
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Danh sách thành viên ({members.length})
            </CardTitle>
            <CardDescription>
              Tất cả thành viên trong hệ thống
            </CardDescription>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Chưa có thành viên nào</p>
                <p className="text-sm">Bấm "Thêm thành viên" để bắt đầu</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Họ tên</TableHead>
                    <TableHead>MSSV</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Ngày tạo</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => {
                    const canManage = canManageMember(member.id);
                    const isLeaderMember = isMemberLeader(member.id);
                    
                    return (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          {member.full_name || '—'}
                          {isLeaderMember && (
                            <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                              Leader
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{member.student_id}</TableCell>
                        <TableCell>{member.email}</TableCell>
                        <TableCell>
                          {new Date(member.created_at).toLocaleDateString('vi-VN')}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          {canManage ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(member)}
                              >
                                <Pencil className="w-4 h-4 mr-1" />
                                Sửa
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedMember(member);
                                  setIsPasswordDialogOpen(true);
                                }}
                              >
                                <Key className="w-4 h-4 mr-1" />
                                Đổi MK
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => {
                                  setSelectedMember(member);
                                  setIsDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                Xóa
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">Không có quyền</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Password Update Dialog */}
        <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Đổi mật khẩu</DialogTitle>
              <DialogDescription>
                Đổi mật khẩu cho {selectedMember?.full_name}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="updatePassword">Mật khẩu mới</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="updatePassword"
                    type="password"
                    placeholder="Tối thiểu 6 ký tự"
                    className="pl-10"
                    value={updatePassword}
                    onChange={(e) => setUpdatePassword(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>
                  Hủy
                </Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Cập nhật
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Member Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Chỉnh sửa thành viên</DialogTitle>
              <DialogDescription>
                Cập nhật thông tin cho {selectedMember?.full_name}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditMember} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="editFullName">Họ và tên</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="editFullName"
                    placeholder="Nguyễn Văn A"
                    className="pl-10"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editStudentId">Mã số sinh viên</Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="editStudentId"
                    placeholder="31241234567"
                    className="pl-10"
                    value={editStudentId}
                    onChange={(e) => setEditStudentId(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editEmail">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="editEmail"
                    type="email"
                    placeholder="email@ueh.edu.vn"
                    className="pl-10"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Hủy
                </Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Pencil className="w-4 h-4 mr-2" />}
                  Cập nhật
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xác nhận xóa thành viên</AlertDialogTitle>
              <AlertDialogDescription>
                Bạn có chắc chắn muốn xóa thành viên <strong>{selectedMember?.full_name}</strong>?
                <br />
                Hành động này không thể hoàn tác và sẽ xóa toàn bộ dữ liệu liên quan đến thành viên này.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteMember}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={isCreating}
              >
                {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Xóa thành viên
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
