import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
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
import {
  Plus,
  MoreVertical,
  Calendar,
  ExternalLink,
  Trash2,
  Edit,
  Loader2,
  Users,
  Layers,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { Task, Stage, GroupMember } from '@/types/database';

interface TaskListViewProps {
  stages: Stage[];
  tasks: Task[];
  members: GroupMember[];
  isLeaderInGroup: boolean;
  groupId: string;
  onRefresh: () => void;
  onEditTask: (task: Task) => void;
  onCreateTask: (stageId: string) => void;
  onEditStage: (stage: Stage) => void;
  onDeleteStage: (stage: Stage) => void;
}

export default function TaskListView({
  stages,
  tasks,
  members,
  isLeaderInGroup,
  groupId,
  onRefresh,
  onEditTask,
  onCreateTask,
  onEditStage,
  onDeleteStage,
}: TaskListViewProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set(stages.map(s => s.id)));
  const [filterStage, setFilterStage] = useState<string>('all');

  const getTasksByStage = (stageId: string | null) => {
    return tasks.filter((task) => task.stage_id === stageId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'TODO':
        return 'bg-muted text-muted-foreground';
      case 'IN_PROGRESS':
        return 'bg-warning/10 text-warning border-warning/30';
      case 'DONE':
        return 'bg-primary/10 text-primary border-primary/30';
      case 'VERIFIED':
        return 'bg-success/10 text-success border-success/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'TODO':
        return 'Chờ làm';
      case 'IN_PROGRESS':
        return 'Đang làm';
      case 'DONE':
        return 'Hoàn thành';
      case 'VERIFIED':
        return 'Đã duyệt';
      default:
        return status;
    }
  };

  const getProgressPercent = (status: string) => {
    switch (status) {
      case 'TODO':
        return 0;
      case 'IN_PROGRESS':
        return 50;
      case 'DONE':
        return 100;
      case 'VERIFIED':
        return 100;
      default:
        return 0;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const isOverdue = (deadline: string | null) => {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
  };

  const toggleStage = (stageId: string) => {
    const newExpanded = new Set(expandedStages);
    if (newExpanded.has(stageId)) {
      newExpanded.delete(stageId);
    } else {
      newExpanded.add(stageId);
    }
    setExpandedStages(newExpanded);
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;
    setIsDeleting(true);

    try {
      await supabase.from('task_assignments').delete().eq('task_id', taskToDelete.id);
      await supabase.from('task_scores').delete().eq('task_id', taskToDelete.id);
      await supabase.from('submission_history').delete().eq('task_id', taskToDelete.id);
      const { error } = await supabase.from('tasks').delete().eq('id', taskToDelete.id);

      if (error) throw error;

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user!.id,
        user_name: user?.email || 'Unknown',
        action: 'DELETE_TASK',
        action_type: 'task',
        description: `Xóa task "${taskToDelete.title}"`,
        group_id: groupId,
        metadata: { task_id: taskToDelete.id, task_title: taskToDelete.title }
      });

      toast({
        title: 'Đã xóa task',
        description: `Task "${taskToDelete.title}" đã được xóa`,
      });
      setTaskToDelete(null);
      onRefresh();
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể xóa task',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const TaskRow = ({ task, stageName }: { task: Task; stageName: string }) => {
    const progress = getProgressPercent(task.status);
    const overdueStatus = isOverdue(task.deadline) && task.status !== 'DONE' && task.status !== 'VERIFIED';

    return (
      <div className="group flex items-center gap-4 p-4 bg-card border rounded-xl hover:shadow-md transition-all">
        {/* Task Title - Click to Edit */}
        <div 
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => onEditTask(task)}
        >
          <h4 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
            {task.title}
          </h4>
          {task.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{task.description}</p>
          )}
        </div>

        {/* Stage */}
        <div className="w-28 flex-shrink-0 hidden md:block">
          <Badge variant="outline" className="text-xs truncate max-w-full">
            {stageName}
          </Badge>
        </div>

        {/* Assignees */}
        <div className="w-32 flex-shrink-0 hidden lg:flex items-center gap-1">
          {task.task_assignments && task.task_assignments.length > 0 ? (
            <>
              <div className="flex -space-x-2">
                {task.task_assignments.slice(0, 2).map((assignment) => (
                  <Avatar key={assignment.id} className="w-6 h-6 border-2 border-background">
                    <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                      {assignment.profiles ? getInitials(assignment.profiles.full_name) : '?'}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <span className="text-xs text-muted-foreground truncate">
                {task.task_assignments[0]?.profiles?.full_name?.split(' ').pop()}
                {task.task_assignments.length > 1 && ` +${task.task_assignments.length - 1}`}
              </span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground italic">Chưa giao</span>
          )}
        </div>

        {/* Deadline */}
        <div className="w-24 flex-shrink-0 hidden sm:block">
          {task.deadline ? (
            <div className={`flex items-center gap-1 text-xs ${overdueStatus ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
              <Calendar className="w-3 h-3" />
              <span>{formatDate(task.deadline)}</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground italic">Không có</span>
          )}
        </div>

        {/* Status */}
        <div className="w-24 flex-shrink-0">
          <Badge className={`${getStatusColor(task.status)} text-xs`}>
            {getStatusLabel(task.status)}
          </Badge>
        </div>

        {/* Progress */}
        <div className="w-20 flex-shrink-0 hidden xl:block">
          <div className="flex items-center gap-2">
            <Progress value={progress} className="h-1.5 flex-1" />
            <span className="text-xs text-muted-foreground w-8">{progress}%</span>
          </div>
        </div>

        {/* Submission Link Button */}
        {task.submission_link && (
          <a
            href={task.submission_link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex-shrink-0"
          >
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
              <ExternalLink className="w-3 h-3" />
              <span className="hidden sm:inline">Xem bài</span>
            </Button>
          </a>
        )}

        {/* Actions */}
        {isLeaderInGroup && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEditTask(task)}>
                <Edit className="w-4 h-4 mr-2" />
                Chỉnh sửa
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTaskToDelete(task)} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Xóa task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  };

  const filteredStages = filterStage === 'all' 
    ? stages 
    : stages.filter(s => s.id === filterStage);

  const unstagedTasks = getTasksByStage(null);

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Layers className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Task & Giai đoạn</h2>
        </div>
        <div className="flex items-center gap-3">
          <Select value={filterStage} onValueChange={setFilterStage}>
            <SelectTrigger className="w-44 h-9">
              <SelectValue placeholder="Lọc giai đoạn" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả giai đoạn</SelectItem>
              {stages.map(stage => (
                <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stage Sections */}
      <div className="space-y-6">
        {filteredStages.map((stage) => {
          const stageTasks = getTasksByStage(stage.id);
          const completedCount = stageTasks.filter(t => t.status === 'DONE' || t.status === 'VERIFIED').length;
          const isExpanded = expandedStages.has(stage.id);

          return (
            <Card key={stage.id} className="overflow-hidden">
              <CardHeader className="py-3 px-4 bg-muted/30 border-b">
                <div className="flex items-center justify-between">
                  <div 
                    className="flex items-center gap-3 cursor-pointer flex-1"
                    onClick={() => toggleStage(stage.id)}
                  >
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </Button>
                    <div>
                      <CardTitle className="text-base font-semibold">{stage.name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {stageTasks.length} task • {completedCount} hoàn thành
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={stageTasks.length > 0 ? (completedCount / stageTasks.length) * 100 : 0} className="w-24 h-2" />
                    {isLeaderInGroup && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEditStage(stage)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Đổi tên
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onDeleteStage(stage)} className="text-destructive">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Xóa giai đoạn
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              {isExpanded && (
                <CardContent className="p-4 space-y-3">
                  {stageTasks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Chưa có task nào trong giai đoạn này
                    </div>
                  ) : (
                    stageTasks.map((task) => (
                      <TaskRow key={task.id} task={task} stageName={stage.name} />
                    ))
                  )}
                  
                  {isLeaderInGroup && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-muted-foreground hover:text-foreground border-dashed border mt-2"
                      onClick={() => onCreateTask(stage.id)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Thêm task mới
                    </Button>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}

        {/* Unstaged Tasks */}
        {filterStage === 'all' && unstagedTasks.length > 0 && (
          <Card className="overflow-hidden border-dashed">
            <CardHeader className="py-3 px-4 bg-muted/20 border-b">
              <CardTitle className="text-base font-medium text-muted-foreground">
                Chưa phân giai đoạn ({unstagedTasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {unstagedTasks.map((task) => (
                <TaskRow key={task.id} task={task} stageName="Chưa phân" />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {stages.length === 0 && unstagedTasks.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="mb-2">Chưa có giai đoạn nào</p>
            <p className="text-sm">Tạo giai đoạn đầu tiên để bắt đầu quản lý task</p>
          </div>
        )}
      </div>

      {/* Delete Task Confirmation */}
      <AlertDialog open={!!taskToDelete} onOpenChange={() => setTaskToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa task</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa task <span className="font-semibold">"{taskToDelete?.title}"</span>?
              <br />
              Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTask}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Xóa task'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
