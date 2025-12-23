import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import NoteEditor from './NoteEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Plus, Save, Lock, Globe, Star, Tag, X, Loader2, History, Clock, Check,
  ChevronDown, StickyNote, Edit3, Eye, ArrowLeft, Layers, FileText, User,
  Search, BookOpen, Trash2
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import type { Note, NoteVisibility } from '@/types/notes';
import type { Stage, GroupMember, Profile } from '@/types/database';

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

interface ProjectNotesTabProps {
  groupId: string;
  stages: Stage[];
  members: GroupMember[];
}

export default function ProjectNotesTab({ groupId, stages, members }: ProjectNotesTabProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Notes list state
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'my' | 'public' | 'pinned'>('all');

  // Current note state
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Note editing state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<NoteVisibility>('private');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [stageId, setStageId] = useState<string>('');
  const [history, setHistory] = useState<NoteHistory[]>([]);

  // Status
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchNotes();
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [groupId]);

  const fetchNotes = async () => {
    setIsLoadingNotes(true);
    try {
      const { data: notesData, error } = await supabase
        .from('notes')
        .select('*')
        .eq('group_id', groupId)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      if (notesData) {
        const userIds = [...new Set(notesData.map(n => n.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds);
        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

        const enrichedNotes: Note[] = notesData.map(note => ({
          ...note,
          visibility: note.visibility as NoteVisibility,
          tags: note.tags || [],
          links: note.links || [],
          profiles: profilesMap.get(note.user_id),
        }));

        setNotes(enrichedNotes);
      }
    } catch (error: any) {
      toast({ title: 'Lỗi', description: 'Không thể tải ghi chú', variant: 'destructive' });
    } finally {
      setIsLoadingNotes(false);
    }
  };

  // Filter notes
  const filteredNotes = useMemo(() => {
    let result = [...notes];

    if (filterTab === 'my') result = result.filter(n => n.user_id === user?.id);
    else if (filterTab === 'public') result = result.filter(n => n.visibility !== 'private');
    else if (filterTab === 'pinned') result = result.filter(n => n.visibility === 'pinned');

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(n =>
        n.title.toLowerCase().includes(query) ||
        n.tags?.some(t => t.toLowerCase().includes(query))
      );
    }

    return result;
  }, [notes, filterTab, searchQuery, user?.id]);

  // Stats
  const stats = useMemo(() => ({
    total: notes.length,
    my: notes.filter(n => n.user_id === user?.id).length,
    public: notes.filter(n => n.visibility !== 'private').length,
    pinned: notes.filter(n => n.visibility === 'pinned').length,
  }), [notes, user?.id]);

  const openNote = async (note: Note) => {
    // Check if user can view this note
    if (note.visibility === 'private' && note.user_id !== user?.id) {
      toast({ title: 'Không có quyền', description: 'Ghi chú này là riêng tư', variant: 'destructive' });
      return;
    }

    setSelectedNote(note);
    setTitle(note.title);
    setContent(note.auto_save_content || note.content || '');
    setVisibility(note.visibility);
    setTags(note.tags || []);
    setStageId(note.stage_id || '');
    setLastSaved(new Date(note.updated_at));
    setIsEditing(false);
    setIsCreating(false);
    setHasUnsavedChanges(false);

    // Fetch history
    const { data: historyData } = await supabase
      .from('note_history')
      .select('*')
      .eq('note_id', note.id)
      .order('saved_at', { ascending: false })
      .limit(20);
    if (historyData) setHistory(historyData as NoteHistory[]);
  };

  const createNewNote = () => {
    setSelectedNote(null);
    setTitle('');
    setContent('');
    setVisibility('private');
    setTags([]);
    setStageId('');
    setHistory([]);
    setIsEditing(true);
    setIsCreating(true);
    setHasUnsavedChanges(false);
    setLastSaved(null);
  };

  const closeNote = () => {
    if (hasUnsavedChanges) {
      if (!window.confirm('Bạn có thay đổi chưa lưu. Bạn có chắc muốn đóng?')) {
        return;
      }
    }
    setSelectedNote(null);
    setIsEditing(false);
    setIsCreating(false);
    setHasUnsavedChanges(false);
  };

  // Auto-save functionality
  const autoSave = useCallback(async () => {
    if (!hasUnsavedChanges || isCreating || !selectedNote) return;

    setIsAutoSaving(true);
    try {
      await supabase
        .from('notes')
        .update({
          auto_save_content: content,
          last_auto_save: new Date().toISOString(),
        })
        .eq('id', selectedNote.id);
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      setIsAutoSaving(false);
    }
  }, [content, hasUnsavedChanges, isCreating, selectedNote]);

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    setHasUnsavedChanges(true);

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSave();
    }, 3000);
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
        auto_save_content: null,
        last_auto_save: null,
      };

      if (isCreating) {
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
        await fetchNotes();
        
        // Open the new note in view mode
        if (newNote) {
          const enrichedNote: Note = {
            ...newNote,
            visibility: newNote.visibility as NoteVisibility,
            tags: newNote.tags || [],
            links: newNote.links || [],
          };
          setSelectedNote(enrichedNote);
          setIsCreating(false);
          setIsEditing(false);
        }
      } else if (selectedNote) {
        // Save history before updating
        await supabase.from('note_history').insert({
          note_id: selectedNote.id,
          user_id: user!.id,
          title,
          content,
          visibility,
          tags,
          change_summary: 'Lưu thủ công',
        });

        const { error } = await supabase.from('notes').update(noteData).eq('id', selectedNote.id);
        if (error) throw error;

        toast({ title: 'Thành công', description: 'Đã lưu ghi chú' });
        setLastSaved(new Date());
        await fetchNotes();

        // Refresh history
        const { data: historyData } = await supabase
          .from('note_history')
          .select('*')
          .eq('note_id', selectedNote.id)
          .order('saved_at', { ascending: false })
          .limit(20);
        if (historyData) setHistory(historyData as NoteHistory[]);
      }

      setHasUnsavedChanges(false);
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedNote || !window.confirm('Bạn có chắc muốn xóa ghi chú này?')) return;

    setIsDeleting(true);
    try {
      await supabase.from('note_history').delete().eq('note_id', selectedNote.id);
      await supabase.from('notes').delete().eq('id', selectedNote.id);
      toast({ title: 'Thành công', description: 'Đã xóa ghi chú' });
      closeNote();
      await fetchNotes();
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestoreVersion = (historyItem: NoteHistory) => {
    setTitle(historyItem.title);
    setContent(historyItem.content || '');
    setVisibility(historyItem.visibility as NoteVisibility);
    setTags(historyItem.tags || []);
    setHasUnsavedChanges(true);
    setIsHistoryOpen(false);
    setIsEditing(true);
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

  const isOwner = selectedNote ? selectedNote.user_id === user?.id : true;

  const getVisibilityIcon = (v: NoteVisibility) => {
    switch (v) {
      case 'private': return <Lock className="w-3.5 h-3.5" />;
      case 'public': return <Globe className="w-3.5 h-3.5 text-blue-500" />;
      case 'pinned': return <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />;
    }
  };

  // Strip HTML tags for preview
  const getTextPreview = (html: string | null) => {
    if (!html) return '';
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return text.length > 80 ? text.slice(0, 80) + '...' : text;
  };

  if (isLoadingNotes) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Note detail view (view or edit mode)
  if (selectedNote || isCreating) {
    return (
      <div className="flex flex-col -mx-4 -mt-2 sm:-mx-6 lg:-mx-8">
        {/* Toolbar - Green bar */}
        <div className="bg-primary px-4 sm:px-6 py-3 flex items-center gap-3 flex-wrap">
          {/* Back button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={closeNote}
            className="gap-2 bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Danh sách</span>
          </Button>

          <div className="w-px h-6 bg-primary-foreground/20" />

          {/* Visibility Toggle */}
          {isEditing && isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="gap-2 bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-0">
                  {visibility === 'private' && <Lock className="w-4 h-4" />}
                  {visibility === 'public' && <Globe className="w-4 h-4" />}
                  {visibility === 'pinned' && <Star className="w-4 h-4 fill-current" />}
                  <span className="hidden sm:inline">
                    {visibility === 'private' && 'Riêng tư'}
                    {visibility === 'public' && 'Công khai'}
                    {visibility === 'pinned' && 'Ghim'}
                  </span>
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => { setVisibility('private'); setHasUnsavedChanges(true); }}>
                  <Lock className="w-4 h-4 mr-2" />Riêng tư
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setVisibility('public'); setHasUnsavedChanges(true); }}>
                  <Globe className="w-4 h-4 mr-2 text-blue-500" />Công khai
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setVisibility('pinned'); setHasUnsavedChanges(true); }}>
                  <Star className="w-4 h-4 mr-2 text-yellow-500" />Ghim
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {!isEditing && selectedNote && (
            <Badge variant="secondary" className="gap-1 bg-primary-foreground/10 text-primary-foreground border-0">
              {getVisibilityIcon(visibility)}
              {visibility === 'private' && 'Riêng tư'}
              {visibility === 'public' && 'Công khai'}
              {visibility === 'pinned' && 'Ghim'}
            </Badge>
          )}

          {/* Stage selector (edit mode) */}
          {isEditing && (
            <Select value={stageId || '_none'} onValueChange={(v) => { setStageId(v === '_none' ? '' : v); setHasUnsavedChanges(true); }}>
              <SelectTrigger className="w-auto h-8 bg-primary-foreground/10 text-primary-foreground border-0 text-sm">
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
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Status */}
          <div className="flex items-center gap-2 text-sm text-primary-foreground/80">
            {isAutoSaving && (
              <span className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="hidden sm:inline">Đang lưu...</span>
              </span>
            )}
            {!isAutoSaving && hasUnsavedChanges && (
              <span className="flex items-center gap-1 text-yellow-300">
                <Clock className="w-3 h-3" />
                <span className="hidden sm:inline">Chưa lưu</span>
              </span>
            )}
            {!isAutoSaving && !hasUnsavedChanges && lastSaved && !isCreating && (
              <span className="flex items-center gap-1 text-green-300">
                <Check className="w-3 h-3" />
                <span className="hidden sm:inline">Đã lưu</span>
              </span>
            )}
          </div>

          {/* History button */}
          {!isCreating && selectedNote && (
            <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" size="sm" className="bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-0">
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

          {/* Edit/View toggle */}
          {!isCreating && selectedNote && isOwner && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
              className="gap-2 bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-0"
            >
              {isEditing ? <Eye className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
              <span className="hidden sm:inline">{isEditing ? 'Xem' : 'Sửa'}</span>
            </Button>
          )}

          {/* Delete button */}
          {!isCreating && selectedNote && isOwner && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive/20 hover:bg-destructive/30 text-primary-foreground border-0"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </Button>
          )}

          {/* Save button */}
          {isEditing && isOwner && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !title.trim()}
              className="gap-2 bg-primary-foreground text-primary hover:bg-primary-foreground/90"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span className="hidden sm:inline">Lưu</span>
            </Button>
          )}
        </div>

        {/* Note content area - 100% white space */}
        <div className="flex-1 bg-background p-4 sm:p-6 lg:p-8">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Title */}
            {isEditing ? (
              <Input
                value={title}
                onChange={e => { setTitle(e.target.value); setHasUnsavedChanges(true); }}
                placeholder="Tiêu đề ghi chú..."
                className="text-2xl font-bold h-14 border-none shadow-none focus-visible:ring-0 px-0 placeholder:text-muted-foreground/50"
              />
            ) : (
              <h1 className="text-2xl font-bold">{title}</h1>
            )}

            {/* Metadata */}
            {!isCreating && selectedNote && (
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {selectedNote.profiles && (
                  <span className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {selectedNote.profiles.full_name}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {format(new Date(selectedNote.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                </span>
                {stageId && stages.find(s => s.id === stageId) && (
                  <Badge variant="outline" className="gap-1">
                    <Layers className="w-3 h-3" />
                    {stages.find(s => s.id === stageId)?.name}
                  </Badge>
                )}
              </div>
            )}

            {/* Tags */}
            {(isEditing || tags.length > 0) && (
              <div className="flex flex-wrap items-center gap-2">
                {tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="gap-1">
                    <Tag className="w-3 h-3" />
                    {tag}
                    {isEditing && (
                      <button 
                        onClick={() => { setTags(tags.filter((_, i) => i !== index)); setHasUnsavedChanges(true); }} 
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </Badge>
                ))}
                {isEditing && (
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
                )}
              </div>
            )}

            {/* Content */}
            {isEditing ? (
              <div className="min-h-[500px]">
                <NoteEditor
                  content={content}
                  onChange={handleContentChange}
                  placeholder="Bắt đầu viết ghi chú của bạn..."
                />
              </div>
            ) : (
              <div 
                className="prose prose-sm max-w-none min-h-[300px]"
                dangerouslySetInnerHTML={{ __html: content || '<p class="text-muted-foreground">Chưa có nội dung</p>' }}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // Notes list view
  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <StickyNote className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Ghi chú dự án</h2>
            <p className="text-sm text-muted-foreground">
              {stats.total} ghi chú • {stats.my} của tôi • {stats.public} công khai
            </p>
          </div>
        </div>

        <Button onClick={createNewNote} size="lg" className="gap-2">
          <Plus className="w-5 h-5" />
          Tạo ghi chú
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
          <Button
            variant={filterTab === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilterTab('all')}
            className="gap-1"
          >
            <BookOpen className="w-4 h-4" />
            Tất cả
          </Button>
          <Button
            variant={filterTab === 'my' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilterTab('my')}
            className="gap-1"
          >
            <Lock className="w-4 h-4" />
            Của tôi
          </Button>
          <Button
            variant={filterTab === 'public' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilterTab('public')}
            className="gap-1"
          >
            <Globe className="w-4 h-4" />
            Công khai
          </Button>
          <Button
            variant={filterTab === 'pinned' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilterTab('pinned')}
            className="gap-1"
          >
            <Star className="w-4 h-4" />
            Ghim
          </Button>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm ghi chú..."
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Notes Grid */}
      {filteredNotes.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredNotes.map(note => (
            <div
              key={note.id}
              onClick={() => openNote(note)}
              className="group cursor-pointer p-4 border rounded-xl bg-card hover:shadow-md hover:border-primary/50 transition-all"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors flex-1">
                  {note.title}
                </h3>
                {getVisibilityIcon(note.visibility)}
              </div>

              {/* Preview */}
              {note.content && (
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                  {getTextPreview(note.content)}
                </p>
              )}

              {/* Tags */}
              {note.tags && note.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {note.tags.slice(0, 2).map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                      {tag}
                    </Badge>
                  ))}
                  {note.tags.length > 2 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                      +{note.tags.length - 2}
                    </Badge>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-2 border-t mt-auto">
                {note.user_id !== user?.id && note.profiles && (
                  <span className="flex items-center gap-1">
                    <User className="w-2.5 h-2.5" />
                    {note.profiles.full_name.split(' ').slice(-2).join(' ')}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {format(new Date(note.updated_at), 'dd/MM', { locale: vi })}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <StickyNote className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Chưa có ghi chú nào</h3>
          <p className="text-muted-foreground mb-4">Tạo ghi chú để lưu lại kiến thức và ý tưởng</p>
          <Button onClick={createNewNote}>
            <Plus className="w-4 h-4 mr-2" />
            Tạo ghi chú đầu tiên
          </Button>
        </div>
      )}
    </div>
  );
}
