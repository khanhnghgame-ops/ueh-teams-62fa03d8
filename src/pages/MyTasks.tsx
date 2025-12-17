import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ListTodo, Calendar, ExternalLink } from 'lucide-react';
import type { Task, Group } from '@/types/database';

export default function MyTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<(Task & { groups?: Group })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => { if (user) fetchTasks(); }, [user]);

  const fetchTasks = async () => {
    const { data: assignments } = await supabase.from('task_assignments').select('task_id').eq('user_id', user!.id);
    if (assignments && assignments.length > 0) {
      const taskIds = assignments.map(a => a.task_id);
      const { data: tasksData } = await supabase.from('tasks').select('*').in('id', taskIds).order('deadline', { ascending: true });
      if (tasksData) {
        const groupIds = [...new Set(tasksData.map(t => t.group_id))];
        const { data: groupsData } = await supabase.from('groups').select('*').in('id', groupIds);
        const groupsMap = new Map(groupsData?.map(g => [g.id, g]) || []);
        setTasks(tasksData.map(t => ({ ...t, groups: groupsMap.get(t.group_id) })));
      }
    }
    setIsLoading(false);
  };

  const getStatusColor = (s: string) => {
    switch (s) { case 'TODO': return 'bg-muted text-muted-foreground'; case 'IN_PROGRESS': return 'bg-warning/10 text-warning'; case 'DONE': return 'bg-primary/10 text-primary'; case 'VERIFIED': return 'bg-success/10 text-success'; default: return 'bg-muted'; }
  };
  const getStatusLabel = (s: string) => { switch (s) { case 'TODO': return 'Chờ làm'; case 'IN_PROGRESS': return 'Đang làm'; case 'DONE': return 'Hoàn thành'; case 'VERIFIED': return 'Đã duyệt'; default: return s; } };

  const filteredTasks = tasks.filter(t => filter === 'all' ? true : t.status === filter);

  if (isLoading) return <DashboardLayout><div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Task của tôi</h1>
        <div className="flex flex-wrap gap-2">
          {['all', 'TODO', 'IN_PROGRESS', 'DONE', 'VERIFIED'].map(f => (
            <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)}>
              {f === 'all' ? 'Tất cả' : getStatusLabel(f)}
            </Button>
          ))}
        </div>
        {filteredTasks.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-16"><ListTodo className="w-16 h-16 text-muted-foreground/50 mb-4" /><p className="text-muted-foreground">Không có task</p></CardContent></Card>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map(task => (
              <Link key={task.id} to={`/groups/${task.group_id}/tasks/${task.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium truncate">{task.title}</h3>
                          <Badge className={getStatusColor(task.status)}>{getStatusLabel(task.status)}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{task.groups?.name}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                          {task.deadline && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(task.deadline).toLocaleDateString('vi-VN')}</span>}
                          {task.submission_link && <span className="flex items-center gap-1 text-primary"><ExternalLink className="w-3 h-3" />Đã nộp</span>}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}