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
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { 
  Loader2, 
  Plus, 
  Trash2, 
  ExternalLink, 
  Lock, 
  AlertTriangle, 
  Send,
  Clock,
  User,
  FileText,
  History,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  Target,
  Users,
  Link as LinkIcon,
  MessageSquare,
  Info,
  ChevronDown
} from 'lucide-react';
import type { Task, TaskStatus } from '@/types/database';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface SubmissionLink {
  id?: string;
  title: string;
  url: string;
}

interface SubmissionHistoryEntry {
  id: string;
  user_id: string;
  user_name?: string;
  submission_link: string;
  note: string | null;
  submitted_at: string;
}

interface TaskSubmissionDialogProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  isAssignee: boolean;
  isLeaderInGroup: boolean;
}

export default function TaskSubmissionDialog({
  task,
  isOpen,
  onClose,
  onSave,
  isAssignee,
  isLeaderInGroup,
}: TaskSubmissionDialogProps) {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  const [status, setStatus] = useState<TaskStatus>('TODO');
  const [submissionLinks, setSubmissionLinks] = useState<SubmissionLink[]>([]);
  const [note, setNote] = useState('');
  const [submissionHistory, setSubmissionHistory] = useState<SubmissionHistoryEntry[]>([]);
  const [taskAssignees, setTaskAssignees] = useState<string[]>([]);

  // Check if task is overdue
  const isOverdue = task?.deadline ? new Date(task.deadline) < new Date() : false;
  
  // Permission logic
  const canSubmit = isLeaderInGroup || (isAssignee && !isOverdue);
  const isSubmittingOnBehalf = isLeaderInGroup && !isAssignee && isOverdue;

  useEffect(() => {
    if (task && isOpen) {
      setStatus(task.status);
      setNote('');
      
      // Parse submission links
      try {
        const links = task.submission_link ? JSON.parse(task.submission_link) : [];
        setSubmissionLinks(Array.isArray(links) ? links : [{ title: 'Bài nộp', url: task.submission_link }]);
      } catch {
        setSubmissionLinks(task.submission_link ? [{ title: 'Bài nộp', url: task.submission_link }] : []);
      }
      
      // Extract assignee names
      if (task.task_assignments) {
        const names = task.task_assignments.map((a: any) => a.profiles?.full_name || 'Unknown');
        setTaskAssignees(names);
      }
      
      fetchSubmissionHistory();
    }
  }, [task, isOpen]);

  const fetchSubmissionHistory = async () => {
    if (!task) return;
    setIsLoadingHistory(true);
    
    try {
      const { data: historyData, error } = await supabase
        .from('submission_history')
        .select('*')
        .eq('task_id', task.id)
        .order('submitted_at', { ascending: false });
      
      if (error) throw error;
      
      if (historyData && historyData.length > 0) {
        const userIds = [...new Set(historyData.map(h => h.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        
        const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);
        
        setSubmissionHistory(historyData.map(h => ({
          ...h,
          user_name: profileMap.get(h.user_id) || 'Unknown'
        })));
      } else {
        setSubmissionHistory([]);
      }
    } catch (error) {
      console.error('Error fetching submission history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

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

  const getStatusConfig = (status: TaskStatus) => {
    switch (status) {
      case 'TODO':
        return { label: 'Chờ làm', color: 'bg-muted text-muted-foreground', icon: AlertCircle };
      case 'IN_PROGRESS':
        return { label: 'Đang làm', color: 'bg-warning/10 text-warning border-warning/50', icon: Clock };
      case 'DONE':
        return { label: 'Hoàn thành', color: 'bg-primary/10 text-primary border-primary/50', icon: CheckCircle2 };
      case 'VERIFIED':
        return { label: 'Đã duyệt', color: 'bg-success/10 text-success border-success/50', icon: CheckCircle2 };
      default:
        return { label: status, color: 'bg-muted', icon: AlertCircle };
    }
  };

  const handleSubmit = async () => {
    if (!task || !canSubmit) return;
    
    const validLinks = submissionLinks.filter(l => l.url.trim());
    if (validLinks.length === 0) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng thêm ít nhất 1 liên kết nộp bài',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const submissionLinkJson = JSON.stringify(validLinks);
      const now = new Date();
      const isLateSubmission = task.deadline && now > new Date(task.deadline);

      const { error: taskError } = await supabase
        .from('tasks')
        .update({
          status,
          submission_link: submissionLinkJson,
        })
        .eq('id', task.id);

      if (taskError) throw taskError;

      const { error: historyError } = await supabase
        .from('submission_history')
        .insert({
          task_id: task.id,
          user_id: user!.id,
          submission_link: submissionLinkJson,
          note: note.trim() || (isSubmittingOnBehalf ? 'Leader nộp thay' : null),
        });

      if (historyError) throw historyError;

      const actionType = isLateSubmission ? 'LATE_SUBMISSION' : 'SUBMISSION';
      const lateHours = isLateSubmission 
        ? Math.round((now.getTime() - new Date(task.deadline!).getTime()) / (1000 * 60 * 60))
        : 0;

      await supabase.from('activity_logs').insert({
        user_id: user!.id,
        user_name: profile?.full_name || user?.email || 'Unknown',
        action: actionType,
        action_type: 'task',
        description: isSubmittingOnBehalf 
          ? `Leader nộp thay cho task "${task.title}"${isLateSubmission ? ` (trễ ${lateHours} giờ)` : ''}`
          : isLateSubmission 
            ? `Nộp bài trễ ${lateHours} giờ cho task "${task.title}"`
            : `Nộp bài đúng hạn cho task "${task.title}"`,
        group_id: task.group_id,
        metadata: { 
          task_id: task.id, 
          task_title: task.title, 
          deadline: task.deadline,
          is_late: isLateSubmission,
          late_hours: lateHours,
          submitted_by_leader: isSubmittingOnBehalf
        }
      });

      toast({
        title: 'Nộp bài thành công',
        description: isLateSubmission ? 'Bài nộp đã được ghi nhận (trễ hạn)' : 'Bài nộp đã được ghi nhận',
      });
      
      onSave();
      onClose();
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể nộp bài',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const statusConfig = task ? getStatusConfig(task.status) : getStatusConfig('TODO');
  const StatusIcon = statusConfig.icon;

  // Calculate time remaining or overdue
  const getTimeStatus = () => {
    if (!task?.deadline) return null;
    const now = new Date();
    const deadline = new Date(task.deadline);
    const diff = deadline.getTime() - now.getTime();
    
    if (diff < 0) {
      const hours = Math.abs(Math.round(diff / (1000 * 60 * 60)));
      if (hours < 24) return { text: `Quá hạn ${hours} giờ`, isOverdue: true };
      const days = Math.round(hours / 24);
      return { text: `Quá hạn ${days} ngày`, isOverdue: true };
    } else {
      const hours = Math.round(diff / (1000 * 60 * 60));
      if (hours < 24) return { text: `Còn ${hours} giờ`, isOverdue: false };
      const days = Math.round(hours / 24);
      return { text: `Còn ${days} ngày`, isOverdue: false };
    }
  };

  const timeStatus = getTimeStatus();

  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-[98vw] max-h-[95vh] p-0 overflow-hidden flex flex-col">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b bg-muted/30">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 flex-1 min-w-0">
              <div className="p-3 rounded-xl bg-primary/10 shrink-0">
                <Send className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-xl font-bold line-clamp-2">
                  {task?.title}
                </DialogTitle>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <Badge className={`${statusConfig.color} gap-1.5 border text-sm px-3 py-1`}>
                <StatusIcon className="w-4 h-4" />
                {statusConfig.label}
              </Badge>
              {timeStatus && (
                <Badge 
                  variant={timeStatus.isOverdue ? "destructive" : "secondary"}
                  className="gap-1 text-xs"
                >
                  <Clock className="w-3 h-3" />
                  {timeStatus.text}
                </Badge>
              )}
            </div>
          </div>
          
          {/* Alert badges */}
          {(isOverdue || isSubmittingOnBehalf) && (
            <div className="flex flex-wrap gap-2 mt-3">
              {isOverdue && !isLeaderInGroup && (
                <Badge variant="outline" className="gap-1.5 border-destructive text-destructive">
                  <Lock className="w-3.5 h-3.5" />
                  Đã quá deadline - Chỉ Leader được nộp thay
                </Badge>
              )}
              {isSubmittingOnBehalf && (
                <Badge variant="secondary" className="gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  Bạn đang nộp thay cho thành viên
                </Badge>
              )}
            </div>
          )}
        </DialogHeader>
        
        <ScrollArea className="flex-1">
          <div className="p-6">
            {/* Task Description Section - Expandable */}
            {task?.description && (
              <Card className="border-2 border-primary/20 mb-6">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Info className="w-4 h-4 text-primary" />
                      Mô tả công việc
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                      className="gap-1.5 text-xs"
                    >
                      {isDescriptionExpanded ? 'Thu gọn' : 'Xem đầy đủ'}
                      <ChevronDown className={`w-4 h-4 transition-transform ${isDescriptionExpanded ? 'rotate-180' : ''}`} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={`text-sm text-muted-foreground whitespace-pre-wrap ${
                    isDescriptionExpanded ? '' : 'line-clamp-3'
                  }`}>
                    {task.description}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid lg:grid-cols-3 gap-6">
              {/* Left Column - Task Info & Submission */}
              <div className="lg:col-span-2 space-y-6">
                {/* Task Info Cards */}
                <div className="grid sm:grid-cols-3 gap-4">
                  {/* Deadline Card */}
                  <Card className="border-2">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isOverdue ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                          <Calendar className={`w-5 h-5 ${isOverdue ? 'text-destructive' : 'text-primary'}`} />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground font-medium uppercase">Deadline</p>
                          {task?.deadline ? (
                            <p className={`text-sm font-semibold ${isOverdue ? 'text-destructive' : ''}`}>
                              {format(new Date(task.deadline), "dd/MM/yyyy", { locale: vi })}
                              <span className="block text-xs font-normal">
                                {format(new Date(task.deadline), "HH:mm", { locale: vi })}
                              </span>
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground">Không có</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Assignees Card */}
                  <Card className="border-2">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-accent/50">
                          <Users className="w-5 h-5 text-accent-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground font-medium uppercase">Người thực hiện</p>
                          {taskAssignees.length > 0 ? (
                            <p className="text-sm font-semibold truncate" title={taskAssignees.join(', ')}>
                              {taskAssignees.length > 2 
                                ? `${taskAssignees[0]} +${taskAssignees.length - 1}`
                                : taskAssignees.join(', ')}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground">Chưa giao</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Submissions Count */}
                  <Card className="border-2">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-success/10">
                          <History className="w-5 h-5 text-success" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground font-medium uppercase">Lần nộp</p>
                          <p className="text-sm font-semibold">
                            {submissionHistory.length} lần
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Status Select */}
                {canSubmit && (
                  <Card className="border-2 border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Target className="w-4 h-4 text-primary" />
                        Cập nhật trạng thái
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                        <SelectTrigger className="h-12">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TODO">
                            <span className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground" />
                              Chờ làm
                            </span>
                          </SelectItem>
                          <SelectItem value="IN_PROGRESS">
                            <span className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full bg-warning" />
                              Đang làm
                            </span>
                          </SelectItem>
                          <SelectItem value="DONE">
                            <span className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                              Hoàn thành
                            </span>
                          </SelectItem>
                          {isLeaderInGroup && (
                            <SelectItem value="VERIFIED">
                              <span className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-success" />
                                Đã duyệt
                              </span>
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </CardContent>
                  </Card>
                )}

                {/* Submission Links */}
                <Card className="border-2">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <LinkIcon className="w-4 h-4 text-primary" />
                        Liên kết nộp bài
                      </CardTitle>
                      {canSubmit && (
                        <Button type="button" variant="outline" size="sm" onClick={addSubmissionLink} className="gap-1.5">
                          <Plus className="w-4 h-4" />
                          Thêm link
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {submissionLinks.length === 0 ? (
                      <div className="text-center py-8 border-2 border-dashed rounded-xl bg-muted/30">
                        <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground font-medium">Chưa có liên kết nộp bài</p>
                        {canSubmit && (
                          <Button variant="link" size="sm" onClick={addSubmissionLink} className="mt-2">
                            Thêm liên kết đầu tiên
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {submissionLinks.map((link, index) => (
                          <div key={index} className="flex items-start gap-3 p-4 rounded-xl border-2 bg-muted/30">
                            <div className="p-2 rounded-lg bg-background border">
                              <LinkIcon className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs text-muted-foreground mb-1 block">Tiêu đề</Label>
                                <Input
                                  placeholder="VD: File Word, Slide..."
                                  value={link.title}
                                  onChange={(e) => updateSubmissionLink(index, 'title', e.target.value)}
                                  disabled={!canSubmit}
                                  className="h-10"
                                />
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground mb-1 block">URL</Label>
                                <Input
                                  placeholder="https://drive.google.com/..."
                                  value={link.url}
                                  onChange={(e) => updateSubmissionLink(index, 'url', e.target.value)}
                                  disabled={!canSubmit}
                                  className="h-10"
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {link.url && (
                                <a href={link.url} target="_blank" rel="noopener noreferrer">
                                  <Button type="button" variant="ghost" size="icon" className="h-10 w-10">
                                    <ExternalLink className="w-4 h-4" />
                                  </Button>
                                </a>
                              )}
                              {canSubmit && (
                                <Button 
                                  type="button" 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => removeSubmissionLink(index)}
                                  className="h-10 w-10 text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Note */}
                {canSubmit && (
                  <Card className="border-2">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-primary" />
                        Ghi chú
                        <Badge variant="secondary" className="text-[10px] font-normal">Tùy chọn</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        placeholder="Thêm ghi chú cho lần nộp bài này..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={3}
                        className="resize-none"
                      />
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Right Column - History */}
              <div className="lg:col-span-1">
                <Card className="border-2 h-full">
                  <CardHeader className="pb-3 border-b">
                    <CardTitle className="text-base flex items-center gap-2">
                      <History className="w-4 h-4 text-primary" />
                      Lịch sử nộp bài
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[400px]">
                      <div className="p-4">
                        {isLoadingHistory ? (
                          <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                          </div>
                        ) : submissionHistory.length === 0 ? (
                          <div className="text-center py-12">
                            <History className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                            <p className="text-sm text-muted-foreground">Chưa có lịch sử nộp bài</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {submissionHistory.map((entry, index) => {
                              const isLate = task?.deadline && new Date(entry.submitted_at) > new Date(task.deadline);
                              
                              return (
                                <div 
                                  key={entry.id} 
                                  className={`p-4 rounded-xl border-2 ${
                                    index === 0 
                                      ? 'border-primary/30 bg-primary/5' 
                                      : 'bg-muted/30'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                        <User className="w-4 h-4 text-primary" />
                                      </div>
                                      <div>
                                        <span className="text-sm font-semibold block">{entry.user_name}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {format(new Date(entry.submitted_at), "dd/MM/yyyy HH:mm", { locale: vi })}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex gap-1">
                                      {isLate && (
                                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                          Trễ
                                        </Badge>
                                      )}
                                      {index === 0 && (
                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                          Mới nhất
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  {entry.note && (
                                    <p className="text-xs text-muted-foreground bg-background/50 p-2 rounded-lg mt-2">
                                      "{entry.note}"
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t bg-muted/30 gap-2">
          <Button variant="outline" onClick={onClose} className="min-w-24">
            Đóng
          </Button>
          {canSubmit && (
            <Button onClick={handleSubmit} disabled={isLoading} className="min-w-36 gap-2">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang nộp...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {isSubmittingOnBehalf ? 'Nộp thay' : 'Nộp bài'}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
