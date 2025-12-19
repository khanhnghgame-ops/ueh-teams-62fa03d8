import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { Task, Stage, GroupMember, TaskStatus } from '@/types/database';

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
  canEdit,
}: TaskEditDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [stageId, setStageId] = useState<string>('');
  const [status, setStatus] = useState<TaskStatus>('TODO');
  const [submissionLink, setSubmissionLink] = useState('');
  const [assignees, setAssignees] = useState<string[]>([]);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setDeadline(task.deadline ? task.deadline.slice(0, 16) : '');
      setStageId(task.stage_id || '');
      setStatus(task.status);
      setSubmissionLink(task.submission_link || '');
      setAssignees(task.task_assignments?.map(a => a.user_id) || []);
    }
  }, [task]);

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
      // Update task
      const { error: taskError } = await supabase
        .from('tasks')
        .update({
          title: title.trim(),
          description: description.trim() || null,
          deadline: deadline || null,
          stage_id: stageId || null,
          status,
          submission_link: submissionLink.trim() || null,
        })
        .eq('id', task.id);

      if (taskError) throw taskError;

      // Update assignments
      // First, delete existing assignments
      await supabase
        .from('task_assignments')
        .delete()
        .eq('task_id', task.id);

      // Then, add new assignments
      if (assignees.length > 0) {
        const assignments = assignees.map((userId) => ({
          task_id: task.id,
          user_id: userId,
        }));

        const { error: assignError } = await supabase
          .from('task_assignments')
          .insert(assignments);

        if (assignError) throw assignError;
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{canEdit ? 'Chỉnh sửa task' : 'Chi tiết task'}</DialogTitle>
          <DialogDescription>
            {canEdit ? 'Cập nhật thông tin task' : 'Xem chi tiết task (chỉ Leader/Phó nhóm được chỉnh sửa)'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Tên task *</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!canEdit}
              placeholder="Nhập tên task..."
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="task-description">Mô tả</Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canEdit}
              placeholder="Mô tả chi tiết task..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Giai đoạn</Label>
              <Select value={stageId} onValueChange={setStageId} disabled={!canEdit}>
                <SelectTrigger>
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
              <Label>Trạng thái</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)} disabled={!canEdit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODO">Chờ làm</SelectItem>
                  <SelectItem value="IN_PROGRESS">Đang làm</SelectItem>
                  <SelectItem value="DONE">Hoàn thành</SelectItem>
                  <SelectItem value="VERIFIED">Đã duyệt</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-deadline">Deadline</Label>
            <Input
              id="task-deadline"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              disabled={!canEdit}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-submission">Liên kết nộp bài</Label>
            <Input
              id="task-submission"
              type="url"
              value={submissionLink}
              onChange={(e) => setSubmissionLink(e.target.value)}
              disabled={!canEdit}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label>Người phụ trách</Label>
            <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
              {members.map((member) => (
                <div key={member.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`assignee-${member.user_id}`}
                    checked={assignees.includes(member.user_id)}
                    onCheckedChange={(checked) => {
                      if (!canEdit) return;
                      if (checked) {
                        setAssignees([...assignees, member.user_id]);
                      } else {
                        setAssignees(assignees.filter((id) => id !== member.user_id));
                      }
                    }}
                    disabled={!canEdit}
                  />
                  <label
                    htmlFor={`assignee-${member.user_id}`}
                    className="text-sm cursor-pointer"
                  >
                    {member.profiles?.full_name} ({member.profiles?.student_id})
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {canEdit ? 'Hủy' : 'Đóng'}
          </Button>
          {canEdit && (
            <Button onClick={handleSave} disabled={isLoading}>
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
