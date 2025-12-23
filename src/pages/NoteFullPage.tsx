import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import NoteEditor from '@/components/notes/NoteEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, Save, Lock, Globe, Star, Tag, X, Plus, Link as LinkIcon,
  Loader2, History, Clock, Check, MoreVertical, Trash2, Copy, ExternalLink,
  Layers, FileText, ChevronDown, Eye, EyeOff, StickyNote
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import type { Note, NoteVisibility } from '@/types/notes';
import type { Stage, Task, Group } from '@/types/database';

interface NoteHistory {
  id: string;
  note_id: string;
  title: string;
  content: string | null;
  visibility: string;
  tags: string[];
  saved_at: string;
  change_summary: string | null;
}

export default function NoteFullPage() {
  const { groupId, noteId } = useParams<{ groupId: string; noteId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [group, setGroup] = useState<Group | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [history, setHistory] = useState<NoteHistory[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Note data
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<NoteVisibility>('private');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [stageId, setStageId] = useState<string>('');
  const [taskId, setTaskId] = useState<string>('');
  const [links, setLinks] = useState<string[]>([]);
  const [newLink, setNewLink] = useState('');
  const [createdAt, setCreatedAt] = useState<string>('');
  const [isOwner, setIsOwner] = useState(false);

  const isNewNote = noteId === 'new';

  useEffect(() => {
    fetchData();
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [groupId, noteId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch group info
      const { data: groupData } = await supabase.from('groups').select('*').eq('id', groupId).single();
      if (groupData) setGroup(groupData);

      // Fetch stages and tasks
      const [stagesRes, tasksRes] = await Promise.all([
        supabase.from('stages').select('*').eq('group_id', groupId).order('order_index'),
        supabase.from('tasks').select('*').eq('group_id', groupId).order('created_at', { ascending: false }),
      ]);
      if (stagesRes.data) setStages(stagesRes.data);
      if (tasksRes.data) setTasks(tasksRes.data);

      // Fetch note if not new
      if (!isNewNote) {
        const { data: noteData, error } = await supabase
          .from('notes')
          .select('*')
          .eq('id', noteId)
          .single();

        if (error || !noteData) {
          toast({ title: 'Lỗi', description: 'Không tìm thấy ghi chú', variant: 'destructive' });
          navigate(`/groups/${groupId}/notes`);
          return;
        }

        setTitle(noteData.title);
        setContent(noteData.auto_save_content || noteData.content || '');
        setVisibility(noteData.visibility as NoteVisibility);
        setTags(noteData.tags || []);
        setStageId(noteData.stage_id || '');
        setTaskId(noteData.task_id || '');
        setLinks(noteData.links || []);
        setCreatedAt(noteData.created_at);
        setIsOwner(noteData.user_id === user?.id);
        setLastSaved(new Date(noteData.updated_at));

        // Fetch history
        const { data: historyData } = await supabase
          .from('note_history')
          .select('*')
          .eq('note_id', noteId)
          .order('saved_at', { ascending: false })
          .limit(20);
        if (historyData) setHistory(historyData as NoteHistory[]);
      } else {
        setIsOwner(true);
      }
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-save functionality
  const autoSave = useCallback(async () => {
    if (!hasUnsavedChanges || isNewNote || !isOwner) return;

    setIsAutoSaving(true);
    try {
      await supabase
        .from('notes')
        .update({
          auto_save_content: content,
          last_auto_save: new Date().toISOString(),
        })
        .eq('id', noteId);
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      setIsAutoSaving(false);
    }
  }, [content, hasUnsavedChanges, isNewNote, noteId, isOwner]);

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    setHasUnsavedChanges(true);

    // Debounced auto-save
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSave();
    }, 3000); // Auto-save after 3 seconds of inactivity
  }, [autoSave]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: 'Lỗi', description: 'Vui lòng nhập tiêu đề', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const noteData = {
        title: title.trim(),
        content,
        visibility,
        tags,
        stage_id: stageId || null,
        task_id: taskId || null,
        links,
        auto_save_content: null, // Clear auto-save on manual save
        last_auto_save: null,
      };

      if (isNewNote) {
        const { data: newNote, error } = await supabase
          .from('notes')
          .insert({
            ...noteData,
            group_id: groupId,
            user_id: user!.id,
          })
          .select()
          .single();

        if (error) throw error;

        toast({ title: 'Thành công', description: 'Đã tạo ghi chú mới' });
        // Navigate to the new note's page
        navigate(`/groups/${groupId}/notes/${newNote.id}`, { replace: true });
      } else {
        // Save history before updating
        await supabase.from('note_history').insert({
          note_id: noteId,
          user_id: user!.id,
          title,
          content,
          visibility,
          tags,
          change_summary: 'Lưu thủ công',
        });

        await supabase.from('notes').update(noteData).eq('id', noteId);

        toast({ title: 'Thành công', description: 'Đã lưu ghi chú' });
        setLastSaved(new Date());
        fetchData(); // Refresh history
      }

      setHasUnsavedChanges(false);
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestoreVersion = async (historyItem: NoteHistory) => {
    setTitle(historyItem.title);
    setContent(historyItem.content || '');
    setVisibility(historyItem.visibility as NoteVisibility);
    setTags(historyItem.tags || []);
    setHasUnsavedChanges(true);
    setIsHistoryOpen(false);
    toast({ title: 'Đã khôi phục', description: 'Nhấn Lưu để áp dụng thay đổi' });
  };

  const addTag = () => {
    const tag = newTag.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setNewTag('');
      setHasUnsavedChanges(true);
    }
  };

  const addLink = () => {
    const link = newLink.trim();
    if (link && !links.includes(link)) {
      setLinks([...links, link]);
      setNewLink('');
      setHasUnsavedChanges(true);
    }
  };

  const filteredTasks = stageId ? tasks.filter(t => t.stage_id === stageId) : tasks;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isOwner && !isNewNote) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <Lock className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Ghi chú riêng tư</h1>
        <p className="text-muted-foreground mb-6">Bạn không có quyền xem ghi chú này</p>
        <Link to={`/groups/${groupId}/notes`}>
          <Button><ArrowLeft className="w-4 h-4 mr-2" />Quay lại</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          {/* Left */}
          <div className="flex items-center gap-3">
            <Link to={`/groups/${groupId}/notes`} className="p-2 hover:bg-muted rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <StickyNote className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground hidden sm:inline">{group?.name}</span>
            </div>
          </div>

          {/* Center - Status */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {isAutoSaving && (
              <span className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Đang lưu...
              </span>
            )}
            {!isAutoSaving && hasUnsavedChanges && (
              <span className="flex items-center gap-1 text-orange-500">
                <Clock className="w-3 h-3" />
                Chưa lưu
              </span>
            )}
            {!isAutoSaving && !hasUnsavedChanges && lastSaved && (
              <span className="flex items-center gap-1 text-green-500">
                <Check className="w-3 h-3" />
                Đã lưu {formatDistanceToNow(lastSaved, { addSuffix: true, locale: vi })}
              </span>
            )}
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            {/* Visibility Toggle */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  {visibility === 'private' && <Lock className="w-4 h-4" />}
                  {visibility === 'public' && <Globe className="w-4 h-4 text-blue-500" />}
                  {visibility === 'pinned' && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                  <span className="hidden sm:inline">
                    {visibility === 'private' && 'Riêng tư'}
                    {visibility === 'public' && 'Công khai'}
                    {visibility === 'pinned' && 'Ghim'}
                  </span>
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { setVisibility('private'); setHasUnsavedChanges(true); }}>
                  <Lock className="w-4 h-4 mr-2" />
                  Riêng tư - Chỉ mình tôi
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setVisibility('public'); setHasUnsavedChanges(true); }}>
                  <Globe className="w-4 h-4 mr-2 text-blue-500" />
                  Công khai - Thành viên nhóm
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setVisibility('pinned'); setHasUnsavedChanges(true); }}>
                  <Star className="w-4 h-4 mr-2 text-yellow-500" />
                  Ghim - Hiển thị nổi bật
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* History */}
            {!isNewNote && (
              <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <History className="w-4 h-4" />
                    <span className="hidden sm:inline ml-2">Lịch sử</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Lịch sử chỉnh sửa</DialogTitle>
                  </DialogHeader>
                  <ScrollArea className="max-h-[400px]">
                    {history.length > 0 ? (
                      <div className="space-y-2">
                        {history.map((item) => (
                          <div
                            key={item.id}
                            className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() => handleRestoreVersion(item)}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm truncate">{item.title}</span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(item.saved_at), 'dd/MM HH:mm', { locale: vi })}
                              </span>
                            </div>
                            {item.change_summary && (
                              <p className="text-xs text-muted-foreground">{item.change_summary}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">Chưa có lịch sử</p>
                    )}
                  </ScrollArea>
                </DialogContent>
              </Dialog>
            )}

            {/* Save Button */}
            <Button onClick={handleSave} disabled={isSaving || !title.trim()}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span className="ml-2 hidden sm:inline">Lưu</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Title */}
          <Input
            value={title}
            onChange={e => { setTitle(e.target.value); setHasUnsavedChanges(true); }}
            placeholder="Tiêu đề ghi chú..."
            className="text-2xl font-bold h-14 border-none shadow-none focus-visible:ring-0 px-0 placeholder:text-muted-foreground/50"
          />

          {/* Metadata Bar */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {createdAt && (
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {format(new Date(createdAt), 'dd/MM/yyyy HH:mm', { locale: vi })}
              </span>
            )}

            {/* Stage */}
            <Select value={stageId || '_none'} onValueChange={(v) => { setStageId(v === '_none' ? '' : v); setTaskId(''); setHasUnsavedChanges(true); }}>
              <SelectTrigger className="w-auto h-8 text-xs border-dashed">
                <Layers className="w-3 h-3 mr-1" />
                <SelectValue placeholder="Giai đoạn" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Không chọn</SelectItem>
                {stages.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Task */}
            <Select value={taskId || '_none'} onValueChange={(v) => { setTaskId(v === '_none' ? '' : v); setHasUnsavedChanges(true); }}>
              <SelectTrigger className="w-auto h-8 text-xs border-dashed">
                <FileText className="w-3 h-3 mr-1" />
                <SelectValue placeholder="Task" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Không chọn</SelectItem>
                {filteredTasks.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap items-center gap-2">
            {tags.map((tag, index) => (
              <Badge key={index} variant="secondary" className="gap-1">
                <Tag className="w-3 h-3" />
                {tag}
                <button onClick={() => { setTags(tags.filter((_, i) => i !== index)); setHasUnsavedChanges(true); }} className="ml-1 hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            <div className="flex gap-1">
              <Input
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                placeholder="Thêm tag..."
                className="h-7 w-24 text-xs"
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
              />
              <Button size="sm" variant="ghost" onClick={addTag} className="h-7 px-2">
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* Editor */}
          <div className="min-h-[500px]">
            <NoteEditor
              content={content}
              onChange={handleContentChange}
              placeholder="Bắt đầu viết ghi chú của bạn..."
            />
          </div>

          {/* Links */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <LinkIcon className="w-4 h-4" />
              Liên kết tài liệu
            </h4>
            <div className="flex gap-2">
              <Input
                value={newLink}
                onChange={e => setNewLink(e.target.value)}
                placeholder="Thêm URL (Google Docs, Drive...)"
                className="flex-1"
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addLink())}
              />
              <Button variant="outline" onClick={addLink}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {links.length > 0 && (
              <div className="space-y-2">
                {links.map((link, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                    <LinkIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <a href={link} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate flex-1">
                      {link}
                    </a>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" asChild>
                      <a href={link} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setLinks(links.filter((_, i) => i !== index)); setHasUnsavedChanges(true); }}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
