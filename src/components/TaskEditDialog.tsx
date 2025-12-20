import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Plus, Trash2, ExternalLink, Lock, AlertTriangle } from 'lucide-react';
import type { Task, Stage, GroupMember, TaskStatus } from '@/types/database';

interface SubmissionLink {
  id?: string;
  title: string;
  url: string;
}

interface TaskEditDialogProps {
  task: Task | null;
  stages: Stage[];
  members: GroupMember[];
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  canEdit: boolean;
}

export default function TaskEditDialog({
  task,
  stages,
  members,
  isOpen,
  onClose,
  onSave,
  canEdit: canEditProp,
}: TaskEditDialogProps) {
  const { toast } = useToast();
  const { user, isLeader, isAdmin } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [stageId, setStageId] = useState<string>('');
  const [status, setStatus] = useState<TaskStatus>('TODO');
  const [submissionLinks, setSubmissionLinks] = useState<SubmissionLink[]>([]);
  const [assignees, setAssignees] = useState<string[]>([]);

  // Check if task is overdue
  const isOverdue = task?.deadline ? new Date(task.deadline) < new Date() : false;
  
  // Member can edit only if not overdue OR is leader/admin
  const isLeaderOrAdmin = isLeader || isAdmin;
  const canEdit = canEditProp && (isLeaderOrAdmin || !isOverdue);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setDeadline(task.deadline ? task.deadline.slice(0, 16) : '');
      setStageId(task.stage_id || '');
      setStatus(task.status);
      
      // Parse submission links - support multiple links stored as JSON
      try {
        const links = task.submission_link ? JSON.parse(task.submission_link) : [];
        setSubmissionLinks(Array.isArray(links) ? links : [{ title: 'Bài nộp', url: task.submission_link }]);
      } catch {
        setSubmissionLinks(task.submission_link ? [{ title: 'Bài nộp', url: task.submission_link }] : []);
      }
      
      setAssignees(task.task_assignments?.map(a => a.user_id) || []);
    }
  }, [task]);

  const addSubmissionLink = () => {
    setSubmissionLinks([...submissionLinks, { title: '', url: '' }]);
  };

  const removeSubmissionLink = (index: number) => {
    setSubmissionLinks(submissionLinks.filter((_, i) => i !== index));
  };

  const updateSubmissionLink = (index: number, field: 'title' | 'url', value: string) => {
    const updated = [...submissionLinks];
    updated[index][field] = value;
    setSubmissionLinks(updated);
  };

  const handleSave = async () => {
    if (!task || !canEdit) return;
    if (!title.trim()) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng nhập tên task',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Filter out empty submission links and store as JSON
      const validLinks = submissionLinks.filter(l => l.url.trim());
      const submissionLinkJson = validLinks.length > 0 ? JSON.stringify(validLinks) : null;

      // Update task
      const { error: taskError } = await supabase
        .from('tasks')
        .update({
          title: title.trim(),
          description: description.trim() || null,
          deadline: deadline || null,
          stage_id: stageId || null,
          status,
          submission_link: submissionLinkJson,
        })
        .eq('id', task.id);

      if (taskError) throw taskError;

      // Log submission time if member is submitting
      if (!isLeaderOrAdmin && validLinks.length > 0) {
        const now = new Date();
        const isLateSubmission = task.deadline && now > new Date(task.deadline);
        
        await supabase.from('activity_logs').insert({
          user_id: user!.id,
          user_name: user?.email || 'Unknown',
          action: isLateSubmission ? 'LATE_SUBMISSION' : 'SUBMISSION',
          action_type: 'task',
          description: isLateSubmission 
            ? `Nộp bài trễ ${Math.round((now.getTime() - new Date(task.deadline!).getTime()) / (1000 * 60 * 60))} giờ`
            : 'Đã nộp bài đúng hạn',
          group_id: task.group_id,
          metadata: { task_id: task.id, task_title: task.title, deadline: task.deadline }
        });
      }

      // Update assignments (only leader can change)
      if (isLeaderOrAdmin) {
        await supabase.from('task_assignments').delete().eq('task_id', task.id);

        if (assignees.length > 0) {
          const assignments = assignees.map((userId) => ({
            task_id: task.id,
            user_id: userId,
          }));
          await supabase.from('task_assignments').insert(assignments);
        }
      }

      toast({
        title: 'Đã lưu',
        description: 'Task đã được cập nhật',
      });
      
      onSave();
      onClose();
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể cập nhật task',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold">
              {canEdit ? 'Chỉnh sửa task' : 'Chi tiết task'}
            </DialogTitle>
            {isOverdue && !isLeaderOrAdmin && (
              <Badge variant="destructive" className="gap-1">
                <Lock className="w-3 h-3" />
                Đã quá hạn - Chỉ xem
              </Badge>
            )}
          </div>
          {!canEditProp && (
            <p className="text-sm text-muted-foreground">
              Chỉ Leader/Phó nhóm được chỉnh sửa
            </p>
          )}
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Task Title */}
          <div className="space-y-2">
            <Label htmlFor="task-title" className="text-sm font-medium">
              Tên task <span className="text-destructive">*</span>
            </Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!canEdit}
              placeholder="Nhập tên task..."
              className="h-11"
            />
          </div>
          
          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="task-description" className="text-sm font-medium">Mô tả</Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canEdit}
              placeholder="Mô tả chi tiết task..."
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Stage & Status Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Giai đoạn</Label>
              <Select value={stageId} onValueChange={setStageId} disabled={!canEdit || !isLeaderOrAdmin}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Chọn giai đoạn..." />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Trạng thái</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)} disabled={!canEdit}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODO">
                    <span className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                      Chờ làm
                    </span>
                  </SelectItem>
                  <SelectItem value="IN_PROGRESS">
                    <span className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-warning" />
                      Đang làm
                    </span>
                  </SelectItem>
                  <SelectItem value="DONE">
                    <span className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      Hoàn thành
                    </span>
                  </SelectItem>
                  <SelectItem value="VERIFIED">
                    <span className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-success" />
                      Đã duyệt
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Deadline */}
          <div className="space-y-2">
            <Label htmlFor="task-deadline" className="text-sm font-medium">Deadline</Label>
            <Input
              id="task-deadline"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              disabled={!canEdit || !isLeaderOrAdmin}
              className="h-11"
            />
            {isOverdue && task?.deadline && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>Task đã quá hạn từ {new Date(task.deadline).toLocaleDateString('vi-VN')}</span>
              </div>
            )}
          </div>

          {/* Submission Links - Multiple */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Liên kết nộp bài</Label>
              {canEdit && (
                <Button type="button" variant="outline" size="sm" onClick={addSubmissionLink} className="gap-1 h-8">
                  <Plus className="w-3 h-3" />
                  Thêm link
                </Button>
              )}
            </div>
            
            {submissionLinks.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Chưa có liên kết nộp bài</p>
            ) : (
              <div className="space-y-3">
                {submissionLinks.map((link, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <Input
                        placeholder="Tiêu đề (VD: File Word)"
                        value={link.title}
                        onChange={(e) => updateSubmissionLink(index, 'title', e.target.value)}
                        disabled={!canEdit}
                        className="h-9"
                      />
                      <Input
                        placeholder="https://..."
                        value={link.url}
                        onChange={(e) => updateSubmissionLink(index, 'url', e.target.value)}
                        disabled={!canEdit}
                        className="h-9"
                      />
                    </div>
                    {link.url && (
                      <a href={link.url} target="_blank" rel="noopener noreferrer">
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </a>
                    )}
                    {canEdit && (
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => removeSubmissionLink(index)}
                        className="h-9 w-9 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assignees - Only Leader can edit */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Người phụ trách</Label>
            <div className="border rounded-lg p-4 max-h-48 overflow-y-auto bg-muted/20">
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa có thành viên nào</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50">
                      <Checkbox
                        id={`assignee-${member.user_id}`}
                        checked={assignees.includes(member.user_id)}
                        onCheckedChange={(checked) => {
                          if (!canEdit || !isLeaderOrAdmin) return;
                          if (checked) {
                            setAssignees([...assignees, member.user_id]);
                          } else {
                            setAssignees(assignees.filter((id) => id !== member.user_id));
                          }
                        }}
                        disabled={!canEdit || !isLeaderOrAdmin}
                      />
                      <label
                        htmlFor={`assignee-${member.user_id}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        <span className="font-medium">{member.profiles?.full_name}</span>
                        <span className="text-muted-foreground ml-1">({member.profiles?.student_id})</span>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-4 border-t gap-2">
          <Button variant="outline" onClick={onClose}>
            {canEdit ? 'Hủy' : 'Đóng'}
          </Button>
          {canEdit && (
            <Button onClick={handleSave} disabled={isLoading} className="min-w-24">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                'Lưu thay đổi'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
