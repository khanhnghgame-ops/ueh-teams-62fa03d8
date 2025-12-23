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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import {
  Plus, Save, Lock, Globe, Star, Tag, X, Loader2, History, Clock, Check,
  ChevronDown, StickyNote, Edit3, Eye, Layers, User,
  Search, BookOpen, Trash2, FileText, MoreHorizontal
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import type { Note, NoteVisibility } from '@/types/notes';
import type { Stage, GroupMember } from '@/types/database';

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
  const [isFullEditMode, setIsFullEditMode] = useState(false);
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
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

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

  const viewNote = async (note: Note) => {
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
    setIsFullEditMode(false);
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
    setIsFullEditMode(true);
    setIsCreating(true);
    setHasUnsavedChanges(false);
    setLastSaved(null);
  };

  const openEditMode = () => {
    setIsFullEditMode(true);
  };

  const closeEditMode = () => {
    if (hasUnsavedChanges) {
      if (!window.confirm('Bạn có thay đổi chưa lưu. Bạn có chắc muốn đóng?')) {
        return;
      }
    }
    if (isCreating) {
      setSelectedNote(null);
      setIsCreating(false);
    }
    setIsFullEditMode(false);
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
          setIsFullEditMode(false);
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

  const handleDeleteNote = async (noteId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeletingNoteId(noteId);
    try {
      await supabase.from('note_history').delete().eq('note_id', noteId);
      await supabase.from('notes').delete().eq('id', noteId);
      toast({ title: 'Thành công', description: 'Đã xóa ghi chú' });
      if (selectedNote?.id === noteId) {
        setSelectedNote(null);
      }
      await fetchNotes();
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setDeletingNoteId(null);
    }
  };

  const handleRestoreVersion = (historyItem: NoteHistory) => {
    setTitle(historyItem.title);
    setContent(historyItem.content || '');
    setVisibility(historyItem.visibility as NoteVisibility);
    setTags(historyItem.tags || []);
    setHasUnsavedChanges(true);
    setIsHistoryOpen(false);
    setIsFullEditMode(true);
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
  const getTextPreview = (html: string | null, maxLength = 100) => {
    if (!html) return '';
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
  };

  if (isLoadingNotes) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Full-screen edit mode (like Word)
  if (isFullEditMode) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        {/* Word-like Toolbar */}
        <div className="border-b bg-muted/30 flex flex-col">
          {/* Top row - Actions */}
          <div className="flex items-center gap-2 px-4 py-2 border-b">
            <Button
              variant="ghost"
              size="sm"
              onClick={closeEditMode}
              className="gap-2"
            >
              <X className="w-4 h-4" />
              Đóng
            </Button>

            <div className="w-px h-6 bg-border" />

            {/* Visibility Toggle */}
            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    {visibility === 'private' && <Lock className="w-4 h-4" />}
                    {visibility === 'public' && <Globe className="w-4 h-4 text-blue-500" />}
                    {visibility === 'pinned' && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                    <span>
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

            {/* Stage selector */}
            <Select value={stageId || '_none'} onValueChange={(v) => { setStageId(v === '_none' ? '' : v); setHasUnsavedChanges(true); }}>
              <SelectTrigger className="w-auto h-8 text-sm">
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

            <div className="flex-1" />

            {/* Status */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {isAutoSaving && (
                <span className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Đang lưu...
                </span>
              )}
              {!isAutoSaving && hasUnsavedChanges && (
                <span className="flex items-center gap-1 text-yellow-600">
                  <Clock className="w-3 h-3" />
                  Chưa lưu
                </span>
              )}
              {!isAutoSaving && !hasUnsavedChanges && lastSaved && !isCreating && (
                <span className="flex items-center gap-1 text-green-600">
                  <Check className="w-3 h-3" />
                  Đã lưu
                </span>
              )}
            </div>

            {/* History button */}
            {!isCreating && selectedNote && (
              <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <History className="w-4 h-4" />
                    Lịch sử
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

            {/* Save button */}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !title.trim()}
              className="gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Lưu
            </Button>
          </div>
        </div>

        {/* Editor content - 100% for writing */}
        <div className="flex-1 overflow-auto bg-background">
          <div className="max-w-4xl mx-auto py-8 px-6">
            {/* Title */}
            <Input
              value={title}
              onChange={e => { setTitle(e.target.value); setHasUnsavedChanges(true); }}
              placeholder="Tiêu đề ghi chú..."
              className="text-3xl font-bold h-16 border-none shadow-none focus-visible:ring-0 px-0 placeholder:text-muted-foreground/40 mb-4"
            />

            {/* Tags */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
              {tags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="gap-1">
                  <Tag className="w-3 h-3" />
                  {tag}
                  <button 
                    onClick={() => { setTags(tags.filter((_, i) => i !== index)); setHasUnsavedChanges(true); }} 
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              <div className="flex gap-1">
                <Input
                  value={newTag}
                  onChange={e => setNewTag(e.target.value)}
                  placeholder="Thêm tag..."
                  className="h-7 w-28 text-xs"
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                />
                <Button size="sm" variant="ghost" onClick={addTag} className="h-7 px-2">
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* Editor */}
            <NoteEditor
              content={content}
              onChange={handleContentChange}
              placeholder="Bắt đầu viết ghi chú của bạn..."
            />
          </div>
        </div>
      </div>
    );
  }

  // Main view with list and preview
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

      {/* Main content - Split view */}
      <div className="flex gap-6">
        {/* Notes list - horizontal layout */}
        <div className={`${selectedNote ? 'w-1/3' : 'w-full'} space-y-2 transition-all`}>
          {filteredNotes.length > 0 ? (
            filteredNotes.map(note => (
              <div
                key={note.id}
                onClick={() => viewNote(note)}
                className={`group flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all hover:shadow-sm ${
                  selectedNote?.id === note.id ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                }`}
              >
                {/* Icon */}
                <div className="flex-shrink-0">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm truncate">{note.title}</h3>
                    {getVisibilityIcon(note.visibility)}
                  </div>
                  {note.content && (
                    <p className="text-xs text-muted-foreground truncate">
                      {getTextPreview(note.content, 60)}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                    {note.user_id !== user?.id && note.profiles && (
                      <span>{note.profiles.full_name.split(' ').slice(-2).join(' ')}</span>
                    )}
                    <span>{format(new Date(note.updated_at), 'dd/MM/yyyy', { locale: vi })}</span>
                  </div>
                </div>

                {/* Actions */}
                {note.user_id === user?.id && (
                  <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                        >
                          {deletingNoteId === note.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Xóa ghi chú?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Hành động này không thể hoàn tác. Ghi chú "{note.title}" sẽ bị xóa vĩnh viễn.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Hủy</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteNote(note.id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Xóa
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            ))
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

        {/* Note preview/view */}
        {selectedNote && (
          <div className="flex-1 border rounded-lg bg-card overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 p-4 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                {getVisibilityIcon(selectedNote.visibility)}
                <span className="text-sm text-muted-foreground">
                  {visibility === 'private' && 'Riêng tư'}
                  {visibility === 'public' && 'Công khai'}
                  {visibility === 'pinned' && 'Ghim'}
                </span>
                {stageId && stages.find(s => s.id === stageId) && (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Layers className="w-3 h-3" />
                    {stages.find(s => s.id === stageId)?.name}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isOwner && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openEditMode}
                      className="gap-2"
                    >
                      <Edit3 className="w-4 h-4" />
                      Chỉnh sửa
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Xóa ghi chú?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Hành động này không thể hoàn tác. Ghi chú này sẽ bị xóa vĩnh viễn.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Hủy</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteNote(selectedNote.id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Xóa
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedNote(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <ScrollArea className="h-[500px]">
              <div className="p-6">
                <h1 className="text-2xl font-bold mb-4">{title}</h1>

                {/* Metadata */}
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-4">
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
                </div>

                {/* Tags */}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="gap-1">
                        <Tag className="w-3 h-3" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Content */}
                <div 
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: content || '<p class="text-muted-foreground">Chưa có nội dung</p>' }}
                />
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
