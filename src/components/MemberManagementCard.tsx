import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, MoreVertical, Trash2, Crown, Edit, Loader2, UserPlus, Mail, User, Hash } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { GroupMember, Profile } from '@/types/database';

interface MemberManagementCardProps {
  members: GroupMember[];
  availableProfiles: Profile[];
  isLeaderInGroup: boolean;
  groupId: string;
  currentUserId: string;
  groupCreatorId: string;
  onRefresh: () => void;
}

export default function MemberManagementCard({
  members,
  availableProfiles,
  isLeaderInGroup,
  groupId,
  currentUserId,
  groupCreatorId,
  onRefresh,
}: MemberManagementCardProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [memberToDelete, setMemberToDelete] = useState<GroupMember | null>(null);
  const [memberToEdit, setMemberToEdit] = useState<GroupMember | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Add member dialog - New member registration
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [addMode, setAddMode] = useState<'existing' | 'new'>('existing');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'member' | 'leader'>('member');
  
  // New member fields
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberStudentId, setNewMemberStudentId] = useState('');
  const [newMemberPassword, setNewMemberPassword] = useState('');
  
  // Edit member dialog
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<'member' | 'leader'>('member');
  const [isEditing, setIsEditing] = useState(false);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-destructive/10 text-destructive text-xs">Admin</Badge>;
      case 'leader':
        return <Badge className="bg-warning/10 text-warning text-xs">Phó nhóm</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">Thành viên</Badge>;
    }
  };

  const isGroupCreator = (memberId: string) => memberId === groupCreatorId;

  const canDeleteMember = (member: GroupMember) => {
    if (member.user_id === currentUserId) return false;
    if (isGroupCreator(member.user_id)) return false;
    return isLeaderInGroup;
  };

  const canEditMember = (member: GroupMember) => {
    if (isGroupCreator(member.user_id)) return false;
    return isLeaderInGroup;
  };

  const resetAddForm = () => {
    setSelectedUserId('');
    setSelectedRole('member');
    setNewMemberEmail('');
    setNewMemberName('');
    setNewMemberStudentId('');
    setNewMemberPassword('');
    setAddMode('existing');
  };

  const handleAddExistingMember = async () => {
    if (!selectedUserId) {
      toast({ title: 'Lỗi', description: 'Vui lòng chọn thành viên', variant: 'destructive' });
      return;
    }
    setIsAddingMember(true);

    try {
      const { error } = await supabase.from('group_members').insert({
        group_id: groupId,
        user_id: selectedUserId,
        role: selectedRole,
      });

      if (error) {
        if (error.code === '23505') throw new Error('Thành viên này đã có trong project');
        throw error;
      }

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user!.id,
        user_name: user?.email || 'Unknown',
        action: 'ADD_MEMBER',
        action_type: 'member',
        description: `Thêm thành viên mới vào project`,
        group_id: groupId,
      });

      toast({ title: 'Thành công', description: 'Đã thêm thành viên vào project' });
      setIsAddDialogOpen(false);
      resetAddForm();
      onRefresh();
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleAddNewMember = async () => {
    // Validate inputs
    if (!newMemberEmail.trim() || !newMemberName.trim() || !newMemberStudentId.trim() || !newMemberPassword.trim()) {
      toast({ title: 'Lỗi', description: 'Vui lòng điền đầy đủ thông tin', variant: 'destructive' });
      return;
    }

    if (newMemberPassword.length < 6) {
      toast({ title: 'Lỗi', description: 'Mật khẩu phải có ít nhất 6 ký tự', variant: 'destructive' });
      return;
    }

    setIsAddingMember(true);

    try {
      // Call edge function to create user
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'create',
          email: newMemberEmail.trim(),
          password: newMemberPassword,
          full_name: newMemberName.trim(),
          student_id: newMemberStudentId.trim(),
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const newUserId = data?.user?.id;
      if (!newUserId) throw new Error('Không thể tạo tài khoản');

      // Add to group
      await supabase.from('group_members').insert({
        group_id: groupId,
        user_id: newUserId,
        role: selectedRole,
      });

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user!.id,
        user_name: user?.email || 'Unknown',
        action: 'CREATE_AND_ADD_MEMBER',
        action_type: 'member',
        description: `Tạo tài khoản và thêm ${newMemberName.trim()} vào project`,
        group_id: groupId,
      });

      toast({ 
        title: 'Thành công', 
        description: `Đã tạo tài khoản cho ${newMemberName.trim()} và thêm vào project. Thành viên có thể đăng nhập với email và mật khẩu đã cung cấp.` 
      });
      setIsAddDialogOpen(false);
      resetAddForm();
      onRefresh();
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleEditMember = async () => {
    if (!memberToEdit) return;
    setIsEditing(true);

    try {
      const { error: roleError } = await supabase
        .from('group_members')
        .update({ role: editRole as 'admin' | 'leader' | 'member' })
        .eq('id', memberToEdit.id);

      if (roleError) throw roleError;

      if (editName.trim() && editName !== memberToEdit.profiles?.full_name) {
        await supabase.from('profiles').update({ full_name: editName.trim() }).eq('id', memberToEdit.user_id);
      }

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user!.id,
        user_name: user?.email || 'Unknown',
        action: 'UPDATE_MEMBER',
        action_type: 'member',
        description: `Cập nhật thông tin thành viên ${memberToEdit.profiles?.full_name}`,
        group_id: groupId,
      });

      toast({ title: 'Thành công', description: 'Đã cập nhật thông tin thành viên' });
      setMemberToEdit(null);
      onRefresh();
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!memberToDelete) return;
    setIsDeleting(true);

    try {
      const { data: tasksData } = await supabase.from('tasks').select('id').eq('group_id', groupId);
      if (tasksData && tasksData.length > 0) {
        await supabase.from('task_assignments').delete()
          .eq('user_id', memberToDelete.user_id)
          .in('task_id', tasksData.map(t => t.id));
      }

      const { error } = await supabase.from('group_members').delete().eq('id', memberToDelete.id);
      if (error) throw error;

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user!.id,
        user_name: user?.email || 'Unknown',
        action: 'REMOVE_MEMBER',
        action_type: 'member',
        description: `Xóa ${memberToDelete.profiles?.full_name} khỏi project`,
        group_id: groupId,
      });

      toast({ title: 'Đã xóa thành viên', description: `${memberToDelete.profiles?.full_name} đã bị xóa khỏi project` });
      setMemberToDelete(null);
      onRefresh();
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const openEditDialog = (member: GroupMember) => {
    setMemberToEdit(member);
    setEditName(member.profiles?.full_name || '');
    setEditRole(member.role === 'leader' ? 'leader' : 'member');
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Thành viên ({members.length})
            </CardTitle>
            {isLeaderInGroup && (
              <Button onClick={() => setIsAddDialogOpen(true)} size="sm" className="gap-2">
                <UserPlus className="w-4 h-4" />
                Thêm thành viên
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {members.map((member) => (
              <div key={member.id} className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                <Avatar className="w-12 h-12 border-2 border-background">
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {member.profiles ? getInitials(member.profiles.full_name) : '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate">{member.profiles?.full_name}</p>
                    {isGroupCreator(member.user_id) && (
                      <span title="Trưởng nhóm"><Crown className="w-4 h-4 text-warning" /></span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{member.profiles?.student_id}</span>
                    <span>•</span>
                    <span className="truncate">{member.profiles?.email}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {getRoleBadge(member.role)}
                  
                  {(canEditMember(member) || canDeleteMember(member)) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canEditMember(member) && (
                          <DropdownMenuItem onClick={() => openEditDialog(member)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Chỉnh sửa
                          </DropdownMenuItem>
                        )}
                        {canDeleteMember(member) && (
                          <DropdownMenuItem onClick={() => setMemberToDelete(member)} className="text-destructive">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Xóa khỏi project
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Add Member Dialog - Enhanced */}
      <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) resetAddForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Thêm thành viên mới</DialogTitle>
            <DialogDescription>
              Thêm thành viên có sẵn hoặc tạo tài khoản mới cho thành viên
            </DialogDescription>
          </DialogHeader>
          
          {/* Mode Selection */}
          <div className="flex gap-2 p-1 bg-muted rounded-lg">
            <Button 
              variant={addMode === 'existing' ? 'default' : 'ghost'} 
              size="sm" 
              className="flex-1"
              onClick={() => setAddMode('existing')}
            >
              Chọn từ danh sách
            </Button>
            <Button 
              variant={addMode === 'new' ? 'default' : 'ghost'} 
              size="sm" 
              className="flex-1"
              onClick={() => setAddMode('new')}
            >
              Tạo tài khoản mới
            </Button>
          </div>

          <div className="space-y-5 py-2">
            {addMode === 'existing' ? (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Chọn thành viên <span className="text-destructive">*</span></Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Tìm kiếm thành viên..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProfiles.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground text-sm">
                          Không có thành viên khả dụng. Vui lòng tạo tài khoản mới.
                        </div>
                      ) : (
                        availableProfiles.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{p.full_name}</span>
                              <span className="text-xs text-muted-foreground">{p.student_id} - {p.email}</span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Họ và tên <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="h-11"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Hash className="w-4 h-4" />
                    MSSV <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={newMemberStudentId}
                    onChange={(e) => setNewMemberStudentId(e.target.value)}
                    placeholder="31211234567"
                    className="h-11"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="email"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="h-11"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Mật khẩu <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="password"
                    value={newMemberPassword}
                    onChange={(e) => setNewMemberPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">
                    Thành viên sẽ sử dụng email và mật khẩu này để đăng nhập
                  </p>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-medium">Vai trò trong project</Label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as 'member' | 'leader')}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Thành viên</SelectItem>
                  <SelectItem value="leader">Phó nhóm (có quyền quản lý)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); resetAddForm(); }}>Hủy</Button>
            <Button 
              onClick={addMode === 'existing' ? handleAddExistingMember : handleAddNewMember} 
              disabled={isAddingMember || (addMode === 'existing' && !selectedUserId)}
              className="min-w-28"
            >
              {isAddingMember ? <Loader2 className="w-4 h-4 animate-spin" /> : addMode === 'existing' ? 'Thêm thành viên' : 'Tạo & Thêm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Member Dialog */}
      <Dialog open={!!memberToEdit} onOpenChange={() => setMemberToEdit(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Chỉnh sửa thành viên</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Họ và tên</Label>
              <Input 
                value={editName} 
                onChange={(e) => setEditName(e.target.value)} 
                placeholder="Nhập họ tên..."
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Vai trò</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as 'member' | 'leader')}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Thành viên</SelectItem>
                  <SelectItem value="leader">Phó nhóm</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
              <p><strong>MSSV:</strong> {memberToEdit?.profiles?.student_id}</p>
              <p><strong>Email:</strong> {memberToEdit?.profiles?.email}</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setMemberToEdit(null)}>Hủy</Button>
            <Button onClick={handleEditMember} disabled={isEditing} className="min-w-24">
              {isEditing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Lưu thay đổi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!memberToDelete} onOpenChange={() => setMemberToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa thành viên</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa <strong>{memberToDelete?.profiles?.full_name}</strong> khỏi project?
              <br /><br />
              <span className="text-warning">Các task đã giao cho thành viên này sẽ trở thành "Chưa phân công".</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Xóa thành viên'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
