import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  CheckCircle2,
  Clock,
  ListTodo,
  TrendingUp,
  Users,
  AlertCircle,
} from 'lucide-react';
import type { Task, GroupMember, Stage } from '@/types/database';

interface GroupDashboardProps {
  tasks: Task[];
  members: GroupMember[];
  stages: Stage[];
}

export default function GroupDashboard({ tasks, members, stages }: GroupDashboardProps) {
  // Task statistics
  const totalTasks = tasks.length;
  const todoTasks = tasks.filter(t => t.status === 'TODO').length;
  const inProgressTasks = tasks.filter(t => t.status === 'IN_PROGRESS').length;
  const doneTasks = tasks.filter(t => t.status === 'DONE').length;
  const verifiedTasks = tasks.filter(t => t.status === 'VERIFIED').length;
  const completedTasks = doneTasks + verifiedTasks;
  
  // Progress calculation
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Get tasks with upcoming deadlines (within 3 days)
  const upcomingDeadlines = tasks.filter(t => {
    if (!t.deadline || t.status === 'DONE' || t.status === 'VERIFIED') return false;
    const deadline = new Date(t.deadline);
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    return deadline <= threeDaysFromNow && deadline >= now;
  });

  // Get overdue tasks
  const overdueTasks = tasks.filter(t => {
    if (!t.deadline || t.status === 'DONE' || t.status === 'VERIFIED') return false;
    return new Date(t.deadline) < new Date();
  });

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
        return <Badge className="bg-warning/10 text-warning text-xs">Leader</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">Member</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <ListTodo className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalTasks}</p>
                <p className="text-xs text-muted-foreground">Tổng task</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Clock className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{todoTasks}</p>
                <p className="text-xs text-muted-foreground">Chưa làm</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{inProgressTasks}</p>
                <p className="text-xs text-muted-foreground">Đang làm</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedTasks}</p>
                <p className="text-xs text-muted-foreground">Hoàn thành</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress and Alerts Row */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Overall Progress */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tiến độ tổng thể</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-primary">{progressPercent}%</span>
                <span className="text-sm text-muted-foreground">
                  {completedTasks}/{totalTasks} task
                </span>
              </div>
              <Progress value={progressPercent} className="h-3" />
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-muted" />
                  Chưa làm: {todoTasks}
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-warning" />
                  Đang làm: {inProgressTasks}
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  Hoàn thành: {completedTasks}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Cảnh báo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overdueTasks.length === 0 && upcomingDeadlines.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Không có task nào sắp đến hạn hoặc quá hạn
              </p>
            ) : (
              <div className="space-y-2">
                {overdueTasks.length > 0 && (
                  <div className="p-2 rounded-lg bg-destructive/10 text-destructive text-sm">
                    <span className="font-semibold">{overdueTasks.length}</span> task đã quá hạn
                  </div>
                )}
                {upcomingDeadlines.length > 0 && (
                  <div className="p-2 rounded-lg bg-warning/10 text-warning text-sm">
                    <span className="font-semibold">{upcomingDeadlines.length}</span> task sắp đến hạn (trong 3 ngày)
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stages Progress */}
      {stages.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tiến độ theo giai đoạn</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stages.map((stage) => {
                const stageTasks = tasks.filter(t => t.stage_id === stage.id);
                const stageCompleted = stageTasks.filter(t => t.status === 'DONE' || t.status === 'VERIFIED').length;
                const stageProgress = stageTasks.length > 0 ? Math.round((stageCompleted / stageTasks.length) * 100) : 0;
                
                return (
                  <div key={stage.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{stage.name}</span>
                      <span className="text-muted-foreground">{stageCompleted}/{stageTasks.length}</span>
                    </div>
                    <Progress value={stageProgress} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Members List */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            Thành viên ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {members.map((member) => (
              <div key={member.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {member.profiles ? getInitials(member.profiles.full_name) : '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{member.profiles?.full_name}</p>
                  <div className="flex items-center gap-1">
                    {getRoleBadge(member.role)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
