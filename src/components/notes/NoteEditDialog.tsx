import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import NoteEditor from './NoteEditor';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Lock, Globe, Star, X, Plus, Link as LinkIcon, Trash2, Save } from 'lucide-react';
import type { Note, NoteVisibility } from '@/types/notes';
import type { Stage, Task } from '@/types/database';

interface NoteEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: Note | null;
  groupId: string;
  stages: Stage[];
  tasks: Task[];
  onSave: () => void;
}

export default function NoteEditDialog({
  open,
  onOpenChange,
  note,
  groupId,
  stages,
  tasks,
  onSave,
}: NoteEditDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<NoteVisibility>('private');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [stageId, setStageId] = useState<string>('');
  const [taskId, setTaskId] = useState<string>('');
  const [links, setLinks] = useState<string[]>([]);
  const [newLink, setNewLink] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (open) {
      if (note) {
        setTitle(note.title);
        setContent(note.content || '');
        setVisibility(note.visibility);
        setTags(note.tags || []);
        setStageId(note.stage_id || '');
        setTaskId(note.task_id || '');
        setLinks(note.links || []);
      } else {
        setTitle('');
        setContent('');
        setVisibility('private');
        setTags([]);
        setStageId('');
        setTaskId('');
        setLinks([]);
      }
      setHasChanges(false);
    }
  }, [open, note]);

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    setHasChanges(true);
  }, []);

  const addTag = () => {
    const tag = newTag.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setNewTag('');
      setHasChanges(true);
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
    setHasChanges(true);
  };

  const addLink = () => {
    const link = newLink.trim();
    if (link && !links.includes(link)) {
      setLinks([...links, link]);
      setNewLink('');
      setHasChanges(true);
    }
  };

  const removeLink = (linkToRemove: string) => {
    setLinks(links.filter(l => l !== linkToRemove));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: 'Lỗi', description: 'Vui lòng nhập tiêu đề ghi chú', variant: 'destructive' });
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
      };

      if (note) {
        await supabase.from('notes').update(noteData).eq('id', note.id);
        toast({ title: 'Thành công', description: 'Đã cập nhật ghi chú' });
      } else {
        await supabase.from('notes').insert({
          ...noteData,
          group_id: groupId,
          user_id: user!.id,
        });
        toast({ title: 'Thành công', description: 'Đã tạo ghi chú mới' });
      }

      onSave();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!note) return;

    setIsDeleting(true);
    try {
      await supabase.from('notes').delete().eq('id', note.id);
      toast({ title: 'Thành công', description: 'Đã xóa ghi chú' });
      onSave();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter tasks by selected stage
  const filteredTasks = stageId
    ? tasks.filter(t => t.stage_id === stageId)
    : tasks;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b bg-muted/30 shrink-0">
          <DialogTitle className="text-xl font-bold">
            {note ? 'Chỉnh sửa ghi chú' : 'Tạo ghi chú mới'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-6">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main editor area */}
            <div className="lg:col-span-2 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Tiêu đề</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={e => { setTitle(e.target.value); setHasChanges(true); }}
                  placeholder="Nhập tiêu đề ghi chú..."
                  className="text-lg font-medium h-12"
                />
              </div>

              <div className="space-y-2">
                <Label>Nội dung</Label>
                <NoteEditor
                  content={content}
                  onChange={handleContentChange}
                  placeholder="Bắt đầu ghi chú của bạn..."
                />
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-5">
              {/* Visibility */}
              <div className="p-4 rounded-xl border bg-card space-y-3">
                <Label className="text-sm font-semibold">Quyền riêng tư</Label>
                <Select
                  value={visibility}
                  onValueChange={(v: NoteVisibility) => { setVisibility(v); setHasChanges(true); }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4" />
                        <span>Riêng tư</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="public">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-blue-500" />
                        <span>Công khai trong Project</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="pinned">
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-yellow-500" />
                        <span>Công khai + Ghim</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {visibility === 'private' && 'Chỉ bạn có thể xem ghi chú này'}
                  {visibility === 'public' && 'Các thành viên trong project có thể xem'}
                  {visibility === 'pinned' && 'Hiển thị nổi bật trong danh sách ghi chú'}
                </p>
              </div>

              {/* Stage & Task */}
              <div className="p-4 rounded-xl border bg-card space-y-3">
                <Label className="text-sm font-semibold">Liên kết</Label>
                
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Giai đoạn</Label>
                  <Select value={stageId || '_none'} onValueChange={(v) => { setStageId(v === '_none' ? '' : v); setTaskId(''); setHasChanges(true); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn giai đoạn" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Không chọn</SelectItem>
                      {stages.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Task</Label>
                  <Select value={taskId || '_none'} onValueChange={(v) => { setTaskId(v === '_none' ? '' : v); setHasChanges(true); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn task" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Không chọn</SelectItem>
                      {filteredTasks.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Tags */}
              <div className="p-4 rounded-xl border bg-card space-y-3">
                <Label className="text-sm font-semibold">Tags</Label>
                
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={e => setNewTag(e.target.value)}
                    placeholder="Thêm tag..."
                    className="h-8 text-sm"
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  />
                  <Button size="sm" variant="outline" onClick={addTag} className="h-8 px-2">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="gap-1">
                        {tag}
                        <button onClick={() => removeTag(tag)} className="hover:text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* External Links */}
              <div className="p-4 rounded-xl border bg-card space-y-3">
                <Label className="text-sm font-semibold">Liên kết ngoài</Label>
                
                <div className="flex gap-2">
                  <Input
                    value={newLink}
                    onChange={e => setNewLink(e.target.value)}
                    placeholder="Thêm URL..."
                    className="h-8 text-sm"
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addLink())}
                  />
                  <Button size="sm" variant="outline" onClick={addLink} className="h-8 px-2">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {links.length > 0 && (
                  <div className="space-y-1">
                    {links.map((link, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs">
                        <LinkIcon className="w-3 h-3 shrink-0" />
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline truncate flex-1"
                        >
                          {link}
                        </a>
                        <button onClick={() => removeLink(link)} className="text-muted-foreground hover:text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/30 shrink-0">
          <div className="flex items-center justify-between w-full">
            <div>
              {note && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  Xóa
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Hủy
              </Button>
              <Button onClick={handleSave} disabled={isSaving || !title.trim()}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {note ? 'Cập nhật' : 'Tạo mới'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
