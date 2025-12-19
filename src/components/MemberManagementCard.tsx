import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { Users, MoreVertical, Trash2, Crown, Shield, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { GroupMember } from '@/types/database';

interface MemberManagementCardProps {
  members: GroupMember[];
  isLeaderInGroup: boolean;
  groupId: string;
  currentUserId: string;
  groupCreatorId: string;
  onRefresh: () => void;
}

export default function MemberManagementCard({
  members,
  isLeaderInGroup,
  groupId,
  currentUserId,
  groupCreatorId,
  onRefresh,
}: MemberManagementCardProps) {
  const { toast } = useToast();
  const [memberToDelete, setMemberToDelete] = useState<GroupMember | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);

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
        return <Badge className="bg-warning/10 text-warning text-xs">Leader/Phó nhóm</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">Thành viên</Badge>;
    }
  };

  const isGroupCreator = (memberId: string) => {
    return memberId === groupCreatorId;
  };

  const canDeleteMember = (member: GroupMember) => {
    // Cannot delete yourself
    if (member.user_id === currentUserId) return false;
    // Cannot delete the group creator
    if (isGroupCreator(member.user_id)) return false;
    // Only leaders can delete members
    return isLeaderInGroup;
  };

  const canChangeRole = (member: GroupMember) => {
    // Cannot change your own role
    if (member.user_id === currentUserId) return false;
    // Cannot change the group creator's role
    if (isGroupCreator(member.user_id)) return false;
    // Only leaders can change roles
    return isLeaderInGroup;
  };

  const handleDeleteMember = async () => {
    if (!memberToDelete) return;
    setIsDeleting(true);

    try {
      // First, remove task assignments for this member in this group
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('id')
        .eq('group_id', groupId);

      if (tasksData && tasksData.length > 0) {
        const taskIds = tasksData.map(t => t.id);
        await supabase
          .from('task_assignments')
          .delete()
          .eq('user_id', memberToDelete.user_id)
          .in('task_id', taskIds);
      }

      // Remove the member from the group
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('id', memberToDelete.id);

      if (error) throw error;

      toast({
        title: 'Đã xóa thành viên',
        description: `${memberToDelete.profiles?.full_name} đã bị xóa khỏi project`,
      });
      setMemberToDelete(null);
      onRefresh();
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể xóa thành viên',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRoleChange = async (member: GroupMember, newRole: 'member' | 'leader') => {
    setUpdatingMemberId(member.id);

    try {
      const { error } = await supabase
        .from('group_members')
        .update({ role: newRole as 'admin' | 'leader' | 'member' })
        .eq('id', member.id);

      if (error) throw error;

      toast({
        title: 'Đã cập nhật vai trò',
        description: `${member.profiles?.full_name} đã được đặt làm ${newRole === 'leader' ? 'Phó nhóm' : 'Thành viên'}`,
      });
      onRefresh();
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể cập nhật vai trò',
        variant: 'destructive',
      });
    } finally {
      setUpdatingMemberId(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            Thành viên ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {members.map((member) => (
              <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {member.profiles ? getInitials(member.profiles.full_name) : '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{member.profiles?.full_name}</p>
                    {isGroupCreator(member.user_id) && (
                      <span title="Người tạo project"><Crown className="w-4 h-4 text-warning" /></span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{member.profiles?.student_id}</p>
                </div>
                
                <div className="flex items-center gap-2">
                  {isLeaderInGroup && canChangeRole(member) ? (
                    <Select
                      value={member.role}
                      onValueChange={(value: 'member' | 'leader') => handleRoleChange(member, value)}
                      disabled={updatingMemberId === member.id}
                    >
                      <SelectTrigger className="w-32 h-8">
                        {updatingMemberId === member.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <SelectValue />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Thành viên</SelectItem>
                        <SelectItem value="leader">Phó nhóm</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    getRoleBadge(member.role)
                  )}
                  
                  {canDeleteMember(member) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => setMemberToDelete(member)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Xóa khỏi project
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Delete Member Confirmation */}
      <AlertDialog open={!!memberToDelete} onOpenChange={() => setMemberToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa thành viên</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa <span className="font-semibold">{memberToDelete?.profiles?.full_name}</span> khỏi project?
              <br /><br />
              <span className="text-warning">
                Lưu ý: Các task đã giao cho thành viên này sẽ trở thành "Chưa phân công".
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Xóa thành viên'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
