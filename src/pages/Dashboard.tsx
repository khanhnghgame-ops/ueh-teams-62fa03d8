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
  Calendar,
} from 'lucide-react';
import type { Task, Group } from '@/types/database';

interface ProjectWithDeadline extends Group {
  nearestDeadline: string | null;
  taskCount: number;
}

export default function Dashboard() {
  const { user, profile, mustChangePassword, refreshProfile } = useAuth();
  const [overdueTasks, setOverdueTasks] = useState<(Task & { groups?: Group })[]>([]);
  const [upcomingProjects, setUpcomingProjects] = useState<ProjectWithDeadline[]>([]);
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
      // Fetch groups where user is a member
      const { data: memberData } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user!.id);

      const groupIds = memberData?.map(m => m.group_id) || [];

      if (groupIds.length > 0) {
        // Fetch groups
        const { data: groupsData } = await supabase
          .from('groups')
          .select('*')
          .in('id', groupIds)
          .order('created_at', { ascending: false });

        if (groupsData) {
          setGroups(groupsData);
        }

        // Fetch all tasks from these groups
        const { data: tasksData } = await supabase
          .from('tasks')
          .select('*, groups(*)')
          .in('group_id', groupIds);

        if (tasksData) {
          const now = new Date();
          
          // Get overdue tasks
          const overdue = tasksData
            .filter(t => t.deadline && new Date(t.deadline) < now && t.status !== 'VERIFIED' && t.status !== 'DONE')
            .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
            .slice(0, 5) as (Task & { groups?: Group })[];
          setOverdueTasks(overdue);

          // Get projects with upcoming deadlines
          const projectDeadlines = new Map<string, { deadline: string; count: number }>();
          tasksData.forEach(task => {
            if (task.deadline && task.status !== 'VERIFIED') {
              const existing = projectDeadlines.get(task.group_id);
              if (!existing || new Date(task.deadline) < new Date(existing.deadline)) {
                projectDeadlines.set(task.group_id, {
                  deadline: task.deadline,
                  count: (existing?.count || 0) + 1
                });
              } else {
                projectDeadlines.set(task.group_id, {
                  ...existing,
                  count: existing.count + 1
                });
              }
            }
          });

          const upcoming = groupsData?.map(g => ({
            ...g,
            nearestDeadline: projectDeadlines.get(g.id)?.deadline || null,
            taskCount: projectDeadlines.get(g.id)?.count || 0
          }))
            .filter(p => p.nearestDeadline && new Date(p.nearestDeadline) >= now)
            .sort((a, b) => new Date(a.nearestDeadline!).getTime() - new Date(b.nearestDeadline!).getTime())
            .slice(0, 5) || [];

          setUpcomingProjects(upcoming);
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
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

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <FolderKanban className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{groups.length}</p>
                  <p className="text-xs text-muted-foreground">Projects</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10 text-destructive">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{overdueTasks.length}</p>
                  <p className="text-xs text-muted-foreground">Task quá hạn</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10 text-warning">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{upcomingProjects.length}</p>
                  <p className="text-xs text-muted-foreground">Sắp deadline</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10 text-success">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{groups.length}</p>
                  <p className="text-xs text-muted-foreground">Tham gia</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* My Projects */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Projects của tôi</CardTitle>
                <CardDescription>Các dự án bạn đang tham gia</CardDescription>
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
                  <p>Bạn chưa tham gia project nào</p>
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

          {/* Overdue Tasks */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-5 h-5" />
                Task quá hạn
              </CardTitle>
              <CardDescription>Các task cần hoàn thành gấp</CardDescription>
            </CardHeader>
            <CardContent>
              {overdueTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Không có task quá hạn!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {overdueTasks.map((task) => (
                    <Link
                      key={task.id}
                      to={`/groups/${task.group_id}`}
                      className="flex items-center gap-3 p-3 rounded-lg border border-destructive/20 hover:bg-destructive/5 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{task.title}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {task.groups?.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-destructive flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(task.deadline!)}
                        </span>
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

        {/* Projects with upcoming deadlines */}
        {upcomingProjects.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-warning" />
                Projects sắp deadline
              </CardTitle>
              <CardDescription>Các dự án có task sắp đến hạn</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcomingProjects.map((project) => (
                  <Link
                    key={project.id}
                    to={`/groups/${project.id}`}
                    className="p-4 rounded-lg border hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold truncate">{project.name}</h3>
                      <Badge variant="outline" className="text-warning border-warning">
                        {project.taskCount} task
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Deadline gần nhất: {formatDate(project.nearestDeadline!)}
                    </p>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
