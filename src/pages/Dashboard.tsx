import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import ChangePasswordDialog from '@/components/ChangePasswordDialog';
import {
  ListTodo,
  Clock,
  CheckCircle,
  AlertCircle,
  FolderKanban,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import type { Task, Group } from '@/types/database';

interface TaskStats {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
  verified: number;
  overdue: number;
}

export default function Dashboard() {
  const { user, profile, isApproved, mustChangePassword, refreshProfile } = useAuth();
  const [stats, setStats] = useState<TaskStats>({
    total: 0,
    todo: 0,
    inProgress: 0,
    done: 0,
    verified: 0,
    overdue: 0,
  });
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      // Fetch groups
      const { data: groupsData } = await supabase
        .from('groups')
        .select('*')
        .order('created_at', { ascending: false });

      if (groupsData) {
        setGroups(groupsData);
      }

      // Fetch my assigned tasks
      const { data: assignmentsData } = await supabase
        .from('task_assignments')
        .select('task_id')
        .eq('user_id', user!.id);

      if (assignmentsData && assignmentsData.length > 0) {
        const taskIds = assignmentsData.map((a) => a.task_id);
        
        const { data: tasksData } = await supabase
          .from('tasks')
          .select('*, groups(*)')
          .in('id', taskIds)
          .order('deadline', { ascending: true });

        if (tasksData) {
          setMyTasks(tasksData as Task[]);
          
          const now = new Date();
          const newStats: TaskStats = {
            total: tasksData.length,
            todo: tasksData.filter((t) => t.status === 'TODO').length,
            inProgress: tasksData.filter((t) => t.status === 'IN_PROGRESS').length,
            done: tasksData.filter((t) => t.status === 'DONE').length,
            verified: tasksData.filter((t) => t.status === 'VERIFIED').length,
            overdue: tasksData.filter(
              (t) => t.deadline && new Date(t.deadline) < now && t.status !== 'VERIFIED'
            ).length,
          };
          setStats(newStats);
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ĐÃ BỎ MÀN HÌNH "TÀI KHOẢN CHỜ DUYỆT" – tất cả user đăng nhập đều vào dashboard

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'TODO':
        return 'bg-muted text-muted-foreground';
      case 'IN_PROGRESS':
        return 'bg-warning/10 text-warning';
      case 'DONE':
        return 'bg-primary/10 text-primary';
      case 'VERIFIED':
        return 'bg-success/10 text-success';
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

  return (
    <DashboardLayout>
      {/* Password change dialog for first login */}
      {user && mustChangePassword && (
        <ChangePasswordDialog 
          open={mustChangePassword} 
          userId={user.id} 
          onPasswordChanged={refreshProfile} 
        />
      )}
      
      <div className="space-y-6">
        {/* Welcome */}
        <div>
          <h1 className="text-3xl font-bold">
            Chào mừng, {profile?.full_name}!
          </h1>
          <p className="text-muted-foreground mt-1">
            MSSV: {profile?.student_id}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <StatCard
            title="Tổng task"
            value={stats.total}
            icon={<ListTodo className="w-5 h-5" />}
            color="primary"
          />
          <StatCard
            title="Chờ làm"
            value={stats.todo}
            icon={<Clock className="w-5 h-5" />}
            color="muted"
          />
          <StatCard
            title="Đang làm"
            value={stats.inProgress}
            icon={<Clock className="w-5 h-5" />}
            color="warning"
          />
          <StatCard
            title="Hoàn thành"
            value={stats.done}
            icon={<CheckCircle className="w-5 h-5" />}
            color="primary"
          />
          <StatCard
            title="Đã duyệt"
            value={stats.verified}
            icon={<CheckCircle className="w-5 h-5" />}
            color="success"
          />
          <StatCard
            title="Quá hạn"
            value={stats.overdue}
            icon={<AlertCircle className="w-5 h-5" />}
            color="destructive"
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* My Groups */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Nhóm của tôi</CardTitle>
                <CardDescription>Các nhóm bạn đang tham gia</CardDescription>
              </div>
              <Link to="/groups">
                <Button variant="ghost" size="sm">
                  Xem tất cả
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {groups.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FolderKanban className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Bạn chưa tham gia nhóm nào</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {groups.slice(0, 5).map((group) => (
                    <Link
                      key={group.id}
                      to={`/groups/${group.id}`}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <FolderKanban className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{group.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {group.description || 'Không có mô tả'}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* My Tasks */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Task của tôi</CardTitle>
                <CardDescription>Các task được giao cho bạn</CardDescription>
              </div>
              <Link to="/tasks">
                <Button variant="ghost" size="sm">
                  Xem tất cả
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {myTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ListTodo className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Bạn chưa có task nào</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myTasks.slice(0, 5).map((task) => (
                    <Link
                      key={task.id}
                      to={`/groups/${task.group_id}/tasks/${task.id}`}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{task.title}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {task.groups?.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {task.deadline && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(task.deadline).toLocaleDateString('vi-VN')}
                          </span>
                        )}
                        <Badge className={getStatusColor(task.status)}>
                          {getStatusLabel(task.status)}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: 'primary' | 'muted' | 'warning' | 'success' | 'destructive';
}) {
  const colorClasses = {
    primary: 'bg-primary/10 text-primary',
    muted: 'bg-muted text-muted-foreground',
    warning: 'bg-warning/10 text-warning',
    success: 'bg-success/10 text-success',
    destructive: 'bg-destructive/10 text-destructive',
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${colorClasses[color]}`}>{icon}</div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{title}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}