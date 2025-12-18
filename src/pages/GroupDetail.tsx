import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Users,
  ListTodo,
  Loader2,
  ArrowLeft,
  UserPlus,
  ExternalLink,
  Calendar,
  Layers,
  FolderOpen,
  ChevronRight,
} from 'lucide-react';
import type { Group, GroupMember, Task, TaskAssignment, Profile, TaskStatus, Stage } from '@/types/database';

export default function GroupDetail() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLeaderInGroup, setIsLeaderInGroup] = useState(false);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);

  // Stage dialog state
  const [isStageDialogOpen, setIsStageDialogOpen] = useState(false);
  const [isCreatingStage, setIsCreatingStage] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [newStageDescription, setNewStageDescription] = useState('');

  // Task dialog state
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskDeadline, setNewTaskDeadline] = useState('');
  const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);
  const [newTaskStageId, setNewTaskStageId] = useState<string>('');

  // Member dialog state
  const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'member' | 'leader'>('member');

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (groupId) {
      fetchGroupData();
    }
  }, [groupId]);

  const fetchGroupData = async () => {
    try {
      // Fetch group
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (groupError) throw groupError;
      setGroup(groupData);

      // Fetch stages
      const { data: stagesData } = await supabase
        .from('stages')
        .select('*')
        .eq('group_id', groupId)
        .order('order_index', { ascending: true });

      if (stagesData) {
        setStages(stagesData);
      }

      // Fetch members
      const { data: membersData } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupId);

      if (membersData) {
        const userIds = membersData.map(m => m.user_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds);
        
        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        const membersWithProfiles = membersData.map(m => ({
          ...m,
          profiles: profilesMap.get(m.user_id),
        })) as GroupMember[];
        
        setMembers(membersWithProfiles);
        const myMembership = membersData.find((m) => m.user_id === user?.id);
        setIsLeaderInGroup(
          myMembership?.role === 'leader' || myMembership?.role === 'admin' || isAdmin
        );
      }

      // Fetch tasks
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

      if (tasksData) {
        const taskIds = tasksData.map(t => t.id);
        const { data: assignmentsData } = await supabase
          .from('task_assignments')
          .select('*')
          .in('task_id', taskIds);
        
        const assigneeIds = [...new Set(assignmentsData?.map(a => a.user_id) || [])];
        const { data: assigneeProfiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', assigneeIds);
        
        const profilesMap = new Map(assigneeProfiles?.map(p => [p.id, p]) || []);
        
        const tasksWithAssignments = tasksData.map(task => ({
          ...task,
          task_assignments: assignmentsData
            ?.filter(a => a.task_id === task.id)
            .map(a => ({ ...a, profiles: profilesMap.get(a.user_id) })) || [],
        })) as Task[];
        
        setTasks(tasksWithAssignments);
      }

      // Fetch all approved profiles for adding members
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_approved', true);

      if (profilesData) {
        setAllProfiles(profilesData);
      }
    } catch (error: any) {
      console.error('Error fetching group:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải thông tin nhóm',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateStage = async () => {
    if (!newStageName.trim()) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng nhập tên giai đoạn',
        variant: 'destructive',
      });
      return;
    }

    setIsCreatingStage(true);

    try {
      const { error } = await supabase.from('stages').insert({
        group_id: groupId,
        name: newStageName.trim(),
        description: newStageDescription.trim() || null,
        order_index: stages.length,
      });

      if (error) throw error;

      toast({
        title: 'Thành công',
        description: 'Đã tạo giai đoạn mới',
      });

      setIsStageDialogOpen(false);
      setNewStageName('');
      setNewStageDescription('');
      fetchGroupData();
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể tạo giai đoạn',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingStage(false);
    }
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng nhập tên task',
        variant: 'destructive',
      });
      return;
    }

    setIsCreatingTask(true);

    try {
      const { data: newTask, error: taskError } = await supabase
        .from('tasks')
        .insert({
          group_id: groupId,
          title: newTaskTitle.trim(),
          description: newTaskDescription.trim() || null,
          deadline: newTaskDeadline || null,
          stage_id: newTaskStageId || null,
          created_by: user!.id,
        })
        .select()
        .single();

      if (taskError) throw taskError;

      if (newTaskAssignees.length > 0) {
        const assignments = newTaskAssignees.map((userId) => ({
          task_id: newTask.id,
          user_id: userId,
        }));

        const { error: assignError } = await supabase
          .from('task_assignments')
          .insert(assignments);

        if (assignError) throw assignError;
      }

      toast({
        title: 'Thành công',
        description: 'Đã tạo task mới',
      });

      setIsTaskDialogOpen(false);
      setNewTaskTitle('');
      setNewTaskDescription('');
      setNewTaskDeadline('');
      setNewTaskAssignees([]);
      setNewTaskStageId('');
      fetchGroupData();
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể tạo task',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng chọn thành viên',
        variant: 'destructive',
      });
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
        if (error.code === '23505') {
          throw new Error('Thành viên này đã có trong nhóm');
        }
        throw error;
      }

      toast({
        title: 'Thành công',
        description: 'Đã thêm thành viên vào nhóm',
      });

      setIsMemberDialogOpen(false);
      setSelectedUserId('');
      setSelectedRole('member');
      fetchGroupData();
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể thêm thành viên',
        variant: 'destructive',
      });
    } finally {
      setIsAddingMember(false);
    }
  };

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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const filteredTasks = tasks.filter((task) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'my') {
      return task.task_assignments?.some((a) => a.user_id === user?.id);
    }
    return task.status === statusFilter;
  });

  const getTasksByStage = (stageId: string | null) => {
    return filteredTasks.filter((task) => task.stage_id === stageId);
  };

  const unstagedTasks = getTasksByStage(null);

  const availableProfiles = allProfiles.filter(
    (p) => !members.some((m) => m.user_id === p.id)
  );

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!group) {
    return (
      <DashboardLayout>
        <div className="text-center py-16">
          <h1 className="text-2xl font-bold mb-2">Không tìm thấy nhóm</h1>
          <Link to="/groups">
            <Button>Quay lại danh sách nhóm</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const TaskCard = ({ task }: { task: Task }) => (
    <Link key={task.id} to={`/groups/${groupId}/tasks/${task.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium truncate">{task.title}</h3>
                <Badge className={getStatusColor(task.status)}>
                  {getStatusLabel(task.status)}
                </Badge>
              </div>
              {task.description && (
                <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                  {task.description}
                </p>
              )}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {task.deadline && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(task.deadline).toLocaleDateString('vi-VN')}
                  </span>
                )}
                {task.submission_link && (
                  <span className="flex items-center gap-1 text-primary">
                    <ExternalLink className="w-3 h-3" />
                    Đã nộp bài
                  </span>
                )}
              </div>
            </div>
            <div className="flex -space-x-2">
              {task.task_assignments?.slice(0, 3).map((assignment) => (
                <Avatar key={assignment.id} className="w-8 h-8 border-2 border-background">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {assignment.profiles
                      ? getInitials(assignment.profiles.full_name)
                      : '?'}
                  </AvatarFallback>
                </Avatar>
              ))}
              {(task.task_assignments?.length || 0) > 3 && (
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs border-2 border-background">
                  +{(task.task_assignments?.length || 0) - 3}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <Link
              to="/groups"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Quay lại
            </Link>
            <h1 className="text-3xl font-bold">{group.name}</h1>
            {group.description && (
              <p className="text-muted-foreground mt-1">{group.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            {isLeaderInGroup && (
              <>
                <Dialog open={isMemberDialogOpen} onOpenChange={setIsMemberDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Thêm thành viên
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Thêm thành viên</DialogTitle>
                      <DialogDescription>
                        Chọn thành viên để thêm vào nhóm
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Chọn thành viên</Label>
                        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Chọn thành viên..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableProfiles.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.full_name} ({p.student_id})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Vai trò</Label>
                        <Select
                          value={selectedRole}
                          onValueChange={(v) => setSelectedRole(v as 'member' | 'leader')}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="leader">Leader</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsMemberDialogOpen(false)}>
                        Hủy
                      </Button>
                      <Button onClick={handleAddMember} disabled={isAddingMember}>
                        {isAddingMember ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Thêm'
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={isStageDialogOpen} onOpenChange={setIsStageDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Layers className="w-4 h-4 mr-2" />
                      Tạo giai đoạn
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Tạo giai đoạn mới</DialogTitle>
                      <DialogDescription>
                        Tạo giai đoạn để phân loại các task trong dự án
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="stage-name">Tên giai đoạn</Label>
                        <Input
                          id="stage-name"
                          placeholder="VD: Giai đoạn 1 - Nghiên cứu"
                          value={newStageName}
                          onChange={(e) => setNewStageName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="stage-description">Mô tả (tùy chọn)</Label>
                        <Textarea
                          id="stage-description"
                          placeholder="Mô tả chi tiết giai đoạn..."
                          value={newStageDescription}
                          onChange={(e) => setNewStageDescription(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsStageDialogOpen(false)}>
                        Hủy
                      </Button>
                      <Button onClick={handleCreateStage} disabled={isCreatingStage}>
                        {isCreatingStage ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Tạo giai đoạn'
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog 
                  open={isTaskDialogOpen} 
                  onOpenChange={(open) => {
                    setIsTaskDialogOpen(open);
                    if (open && stages.length > 0) {
                      // Auto-select giai đoạn đầu tiên khi mở dialog
                      setNewTaskStageId(stages[0].id);
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Tạo task
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Tạo task mới</DialogTitle>
                      <DialogDescription>
                        Tạo task và giao cho thành viên trong nhóm
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="task-title">Tên task</Label>
                        <Input
                          id="task-title"
                          placeholder="VD: Viết báo cáo chương 1"
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="task-description">Mô tả (tùy chọn)</Label>
                        <Textarea
                          id="task-description"
                          placeholder="Mô tả chi tiết task..."
                          value={newTaskDescription}
                          onChange={(e) => setNewTaskDescription(e.target.value)}
                        />
                      </div>
                      {stages.length > 0 && (
                        <div className="space-y-2">
                          <Label>Giai đoạn</Label>
                          <Select value={newTaskStageId} onValueChange={setNewTaskStageId}>
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
                          <p className="text-xs text-muted-foreground">
                            Task sẽ được gán vào giai đoạn này. Bạn có thể chỉnh sửa sau.
                          </p>
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="task-deadline">Deadline (tùy chọn)</Label>
                        <Input
                          id="task-deadline"
                          type="datetime-local"
                          value={newTaskDeadline}
                          onChange={(e) => setNewTaskDeadline(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Giao cho</Label>
                        <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                          {members.map((member) => (
                            <div key={member.id} className="flex items-center gap-2">
                              <Checkbox
                                id={`assignee-${member.user_id}`}
                                checked={newTaskAssignees.includes(member.user_id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setNewTaskAssignees([...newTaskAssignees, member.user_id]);
                                  } else {
                                    setNewTaskAssignees(
                                      newTaskAssignees.filter((id) => id !== member.user_id)
                                    );
                                  }
                                }}
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
                      <Button variant="outline" onClick={() => setIsTaskDialogOpen(false)}>
                        Hủy
                      </Button>
                      <Button onClick={handleCreateTask} disabled={isCreatingTask}>
                        {isCreatingTask ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Tạo task'
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="tasks">
          <TabsList>
            <TabsTrigger value="tasks" className="gap-2">
              <ListTodo className="w-4 h-4" />
              Tasks ({tasks.length})
            </TabsTrigger>
            <TabsTrigger value="stages" className="gap-2">
              <Layers className="w-4 h-4" />
              Giai đoạn ({stages.length})
            </TabsTrigger>
            <TabsTrigger value="members" className="gap-2">
              <Users className="w-4 h-4" />
              Thành viên ({members.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="mt-6">
            {/* Filters */}
            <div className="flex flex-wrap gap-2 mb-4">
              {['all', 'my', 'TODO', 'IN_PROGRESS', 'DONE', 'VERIFIED'].map((filter) => (
                <Button
                  key={filter}
                  variant={statusFilter === filter ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(filter)}
                >
                  {filter === 'all' && 'Tất cả'}
                  {filter === 'my' && 'Task của tôi'}
                  {filter === 'TODO' && 'Chờ làm'}
                  {filter === 'IN_PROGRESS' && 'Đang làm'}
                  {filter === 'DONE' && 'Hoàn thành'}
                  {filter === 'VERIFIED' && 'Đã duyệt'}
                </Button>
              ))}
            </div>

            {/* Tasks List */}
            {filteredTasks.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <ListTodo className="w-16 h-16 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Không có task nào</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredTasks.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="stages" className="mt-6">
            {stages.length === 0 && unstagedTasks.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Layers className="w-16 h-16 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground mb-4">Chưa có giai đoạn nào</p>
                  {isLeaderInGroup && (
                    <Button onClick={() => setIsStageDialogOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Tạo giai đoạn đầu tiên
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Staged tasks */}
                <Accordion type="multiple" className="space-y-4" defaultValue={stages.map(s => s.id)}>
                  {stages.map((stage) => {
                    const stageTasks = getTasksByStage(stage.id);
                    const completedCount = stageTasks.filter(t => t.status === 'DONE' || t.status === 'VERIFIED').length;
                    
                    return (
                      <AccordionItem 
                        key={stage.id} 
                        value={stage.id}
                        className="border rounded-lg bg-card"
                      >
                        <AccordionTrigger className="px-4 py-3 hover:no-underline">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <FolderOpen className="w-5 h-5 text-primary" />
                            </div>
                            <div className="text-left flex-1">
                              <h3 className="font-semibold">{stage.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                {stageTasks.length} task • {completedCount} hoàn thành
                              </p>
                            </div>
                            {stageTasks.length > 0 && (
                              <div className="w-24 h-2 bg-muted rounded-full overflow-hidden mr-4">
                                <div 
                                  className="h-full bg-primary rounded-full transition-all"
                                  style={{ width: `${(completedCount / stageTasks.length) * 100}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4">
                          {stage.description && (
                            <p className="text-sm text-muted-foreground mb-4">{stage.description}</p>
                          )}
                          {stageTasks.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center">
                              Chưa có task nào trong giai đoạn này
                            </p>
                          ) : (
                            <div className="space-y-3">
                              {stageTasks.map((task) => (
                                <TaskCard key={task.id} task={task} />
                              ))}
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>

                {/* Unstaged tasks */}
                {unstagedTasks.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <ListTodo className="w-5 h-5" />
                        Task chưa phân giai đoạn
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {unstagedTasks.map((task) => (
                        <TaskCard key={task.id} task={task} />
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="members" className="mt-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {members.map((member) => (
                <Card key={member.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-12 h-12">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {member.profiles ? getInitials(member.profiles.full_name) : '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{member.profiles?.full_name}</p>
                          {getRoleBadge(member.role)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {member.profiles?.student_id}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
