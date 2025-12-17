import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { CountdownTimer } from '@/components/CountdownTimer';
import { ExternalLink, FileText, Users, CheckCircle2 } from 'lucide-react';
import type { Task, TaskAssignment, Profile } from '@/types/database';

interface TaskCardProps {
  task: Task & { task_assignments?: (TaskAssignment & { profiles?: Profile })[] };
  groupId: string;
  showLink?: boolean;
}

export function TaskCard({ task, groupId, showLink = true }: TaskCardProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'TODO':
        return { label: 'Chờ làm', color: 'bg-muted text-muted-foreground', progress: 0 };
      case 'IN_PROGRESS':
        return { label: 'Đang làm', color: 'bg-warning/10 text-warning border-warning/30', progress: 50 };
      case 'DONE':
        return { label: 'Hoàn thành', color: 'bg-primary/10 text-primary border-primary/30', progress: 80 };
      case 'VERIFIED':
        return { label: 'Đã duyệt', color: 'bg-success/10 text-success border-success/30', progress: 100 };
      default:
        return { label: status, color: 'bg-muted', progress: 0 };
    }
  };

  const statusConfig = getStatusConfig(task.status);

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const content = (
    <Card className="group hover:shadow-card-lg transition-all duration-200 border-border/50 hover:border-primary/20">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                  {task.title}
                </h3>
              </div>
              {task.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {task.description}
                </p>
              )}
            </div>
            <Badge className={`${statusConfig.color} shrink-0 border`}>
              {statusConfig.label}
            </Badge>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <Progress value={statusConfig.progress} className="h-1.5" />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-3">
              {/* Deadline */}
              {task.deadline && (
                <CountdownTimer deadline={task.deadline} className="text-xs" />
              )}
              
              {/* Submission indicator */}
              {task.submission_link && (
                <div className="flex items-center gap-1 text-xs text-success">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Đã nộp</span>
                </div>
              )}
            </div>

            {/* Assignees */}
            <div className="flex items-center gap-1">
              <div className="flex -space-x-2">
                {task.task_assignments?.slice(0, 3).map((assignment) => (
                  <Avatar key={assignment.id} className="w-7 h-7 border-2 border-background">
                    <AvatarFallback className="text-[10px] bg-secondary text-secondary-foreground">
                      {assignment.profiles ? getInitials(assignment.profiles.full_name) : '?'}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              {(task.task_assignments?.length || 0) > 3 && (
                <span className="text-xs text-muted-foreground ml-1">
                  +{(task.task_assignments?.length || 0) - 3}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (showLink) {
    return (
      <Link to={`/groups/${groupId}/tasks/${task.id}`} className="block">
        {content}
      </Link>
    );
  }

  return content;
}