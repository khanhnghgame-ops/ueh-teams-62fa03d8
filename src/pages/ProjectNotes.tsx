import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import DashboardLayout from '@/components/layout/DashboardLayout';
import NoteCard from '@/components/notes/NoteCard';
import NoteEditDialog from '@/components/notes/NoteEditDialog';
import NoteViewDialog from '@/components/notes/NoteViewDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Plus, Search, FileText, Lock, Globe, Star, Loader2, StickyNote,
  ArrowLeft, Grid3X3, List, SortAsc, SortDesc, Calendar, Clock, Tag,
  Filter, MoreVertical, Copy, Download, Trash2, Eye, Edit, BookOpen,
  Layers, User, ChevronDown
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import type { Note, NoteVisibility } from '@/types/notes';
import type { Stage, Task, Profile, GroupMember, Group } from '@/types/database';

type FilterType = 'all' | 'my' | 'public';
type SortType = 'updated' | 'created' | 'title';
type ViewMode = 'grid' | 'list';

export default function ProjectNotes() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();

  const [group, setGroup] = useState<Group | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterMember, setFilterMember] = useState<string>('');
  const [filterStage, setFilterStage] = useState<string>('');
  const [filterTask, setFilterTask] = useState<string>('');
  const [filterTag, setFilterTag] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortType>('updated');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [activeTab, setActiveTab] = useState('all');

  // Dialogs
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  useEffect(() => {
    if (groupId) fetchData();
  }, [groupId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [groupRes, stagesRes, tasksRes, membersRes, notesRes] = await Promise.all([
        supabase.from('groups').select('*').eq('id', groupId).single(),
        supabase.from('stages').select('*').eq('group_id', groupId).order('order_index'),
        supabase.from('tasks').select('*').eq('group_id', groupId).order('created_at', { ascending: false }),
        supabase.from('group_members').select('*').eq('group_id', groupId),
        supabase.from('notes').select('*').eq('group_id', groupId).order('updated_at', { ascending: false }),
      ]);

      if (groupRes.data) setGroup(groupRes.data);
      if (stagesRes.data) setStages(stagesRes.data);
      if (tasksRes.data) setTasks(tasksRes.data);

      // Fetch member profiles
      if (membersRes.data) {
        const userIds = membersRes.data.map(m => m.user_id);
        const { data: profilesData } = await supabase.from('profiles').select('*').in('id', userIds);
        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        setMembers(membersRes.data.map(m => ({ ...m, profiles: profilesMap.get(m.user_id) })) as GroupMember[]);
      }

      // Enrich notes
      if (notesRes.data) {
        const userIds = [...new Set(notesRes.data.map(n => n.user_id))];
        const stageIds = [...new Set(notesRes.data.filter(n => n.stage_id).map(n => n.stage_id))];
        const taskIds = [...new Set(notesRes.data.filter(n => n.task_id).map(n => n.task_id))];

        const [profilesRes, stagesDataRes, tasksDataRes] = await Promise.all([
          supabase.from('profiles').select('*').in('id', userIds),
          stageIds.length ? supabase.from('stages').select('*').in('id', stageIds) : { data: [] },
          taskIds.length ? supabase.from('tasks').select('*').in('id', taskIds) : { data: [] },
        ]);

        const profilesMap = new Map(profilesRes.data?.map(p => [p.id, p]) || []);
        const stagesMap = new Map((stagesDataRes.data || []).map(s => [s.id, s]));
        const tasksMap = new Map((tasksDataRes.data || []).map(t => [t.id, t]));

        const enrichedNotes: Note[] = notesRes.data.map(note => ({
          ...note,
          visibility: note.visibility as NoteVisibility,
          tags: note.tags || [],
          links: note.links || [],
          profiles: profilesMap.get(note.user_id),
          stages: note.stage_id ? stagesMap.get(note.stage_id) : undefined,
          tasks: note.task_id ? tasksMap.get(note.task_id) : undefined,
        }));

        setNotes(enrichedNotes);
      }
    } catch (error: any) {
      toast({ title: 'Lỗi', description: 'Không thể tải dữ liệu', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // Get all unique tags
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    notes.forEach(n => n.tags?.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [notes]);

  // Filter and sort notes
  const filteredNotes = useMemo(() => {
    let result = [...notes];

    // Tab filter
    if (activeTab === 'my') result = result.filter(n => n.user_id === user?.id);
    else if (activeTab === 'public') result = result.filter(n => n.visibility !== 'private');
    else if (activeTab === 'pinned') result = result.filter(n => n.visibility === 'pinned');

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(n =>
        n.title.toLowerCase().includes(query) ||
        n.content?.toLowerCase().includes(query) ||
        n.tags?.some(t => t.toLowerCase().includes(query))
      );
    }

    // Filters
    if (filterMember) result = result.filter(n => n.user_id === filterMember);
    if (filterStage) result = result.filter(n => n.stage_id === filterStage);
    if (filterTask) result = result.filter(n => n.task_id === filterTask);
    if (filterTag) result = result.filter(n => n.tags?.includes(filterTag));

    // Sort
    result.sort((a, b) => {
      let compare = 0;
      if (sortBy === 'updated') compare = new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      else if (sortBy === 'created') compare = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      else if (sortBy === 'title') compare = a.title.localeCompare(b.title);
      return sortOrder === 'desc' ? compare : -compare;
    });

    return result;
  }, [notes, activeTab, searchQuery, filterMember, filterStage, filterTask, filterTag, sortBy, sortOrder, user?.id]);

  // Stats
  const stats = useMemo(() => ({
    total: notes.length,
    my: notes.filter(n => n.user_id === user?.id).length,
    public: notes.filter(n => n.visibility !== 'private').length,
    pinned: notes.filter(n => n.visibility === 'pinned').length,
  }), [notes, user?.id]);

  const handleViewNote = (note: Note) => {
    setSelectedNote(note);
    setIsViewDialogOpen(true);
  };

  const handleEditNote = (note: Note | null) => {
    setSelectedNote(note);
    setIsEditDialogOpen(true);
    setIsViewDialogOpen(false);
  };

  const handleDuplicateNote = async (note: Note) => {
    try {
      await supabase.from('notes').insert({
        group_id: groupId,
        user_id: user!.id,
        title: `${note.title} (bản sao)`,
        content: note.content,
        visibility: 'private',
        tags: note.tags,
        stage_id: note.stage_id,
        task_id: note.task_id,
        links: note.links,
      });
      toast({ title: 'Thành công', description: 'Đã tạo bản sao ghi chú' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteNote = async (note: Note) => {
    if (!confirm('Bạn có chắc muốn xóa ghi chú này?')) return;
    try {
      await supabase.from('notes').delete().eq('id', note.id);
      toast({ title: 'Thành công', description: 'Đã xóa ghi chú' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    }
  };

  const handleExportNote = (note: Note) => {
    const content = `# ${note.title}\n\n${note.content?.replace(/<[^>]*>/g, '') || ''}\n\n---\nTags: ${note.tags?.join(', ') || 'Không có'}\nNgày tạo: ${format(new Date(note.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.title}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Thành công', description: 'Đã xuất ghi chú' });
  };

  const clearFilters = () => {
    setFilterMember('');
    setFilterStage('');
    setFilterTask('');
    setFilterTag('');
    setSearchQuery('');
  };

  const hasActiveFilters = filterMember || filterStage || filterTask || filterTag || searchQuery;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <Link to={`/groups/${groupId}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Quay lại {group?.name}
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <StickyNote className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Ghi chú dự án</h1>
                <p className="text-sm text-muted-foreground">{group?.name}</p>
              </div>
            </div>
          </div>

          <Button onClick={() => handleEditNote(null)} size="lg">
            <Plus className="w-5 h-5 mr-2" />
            Tạo ghi chú mới
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setActiveTab('all')}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <FileText className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Tổng ghi chú</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setActiveTab('my')}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Lock className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.my}</p>
                <p className="text-xs text-muted-foreground">Của tôi</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setActiveTab('public')}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Globe className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.public}</p>
                <p className="text-xs text-muted-foreground">Công khai</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setActiveTab('pinned')}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Star className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pinned}</p>
                <p className="text-xs text-muted-foreground">Được ghim</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs & Filters */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <TabsList>
              <TabsTrigger value="all" className="gap-2">
                <BookOpen className="w-4 h-4" />
                Tất cả
              </TabsTrigger>
              <TabsTrigger value="my" className="gap-2">
                <Lock className="w-4 h-4" />
                Của tôi
              </TabsTrigger>
              <TabsTrigger value="public" className="gap-2">
                <Globe className="w-4 h-4" />
                Công khai
              </TabsTrigger>
              <TabsTrigger value="pinned" className="gap-2">
                <Star className="w-4 h-4" />
                Được ghim
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Search & Filters Bar */}
          <Card className="mt-4">
            <CardContent className="py-4">
              <div className="flex flex-wrap gap-3">
                {/* Search */}
                <div className="flex-1 min-w-[250px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Tìm kiếm theo tiêu đề, nội dung, tag..."
                      className="pl-9"
                    />
                  </div>
                </div>

                {/* Member Filter */}
                <Select value={filterMember || '_all'} onValueChange={(v) => setFilterMember(v === '_all' ? '' : v)}>
                  <SelectTrigger className="w-[160px]">
                    <User className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Thành viên" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Tất cả</SelectItem>
                    {members.map(m => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.profiles?.full_name || 'Unknown'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Stage Filter */}
                <Select value={filterStage || '_all'} onValueChange={(v) => setFilterStage(v === '_all' ? '' : v)}>
                  <SelectTrigger className="w-[140px]">
                    <Layers className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Giai đoạn" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Tất cả</SelectItem>
                    {stages.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Tag Filter */}
                {allTags.length > 0 && (
                  <Select value={filterTag || '_all'} onValueChange={(v) => setFilterTag(v === '_all' ? '' : v)}>
                    <SelectTrigger className="w-[130px]">
                      <Tag className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Tag" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">Tất cả</SelectItem>
                      {allTags.map(tag => (
                        <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Sort */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      {sortOrder === 'desc' ? <SortDesc className="w-4 h-4" /> : <SortAsc className="w-4 h-4" />}
                      {sortBy === 'updated' && 'Cập nhật'}
                      {sortBy === 'created' && 'Ngày tạo'}
                      {sortBy === 'title' && 'Tiêu đề'}
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setSortBy('updated')}>
                      <Clock className="w-4 h-4 mr-2" />
                      Cập nhật gần nhất
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('created')}>
                      <Calendar className="w-4 h-4 mr-2" />
                      Ngày tạo
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('title')}>
                      <FileText className="w-4 h-4 mr-2" />
                      Tiêu đề
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}>
                      {sortOrder === 'desc' ? <SortAsc className="w-4 h-4 mr-2" /> : <SortDesc className="w-4 h-4 mr-2" />}
                      {sortOrder === 'desc' ? 'Tăng dần' : 'Giảm dần'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Clear Filters */}
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Xóa bộ lọc
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Notes Content */}
          <TabsContent value={activeTab} className="mt-6">
            {filteredNotes.length > 0 ? (
              viewMode === 'grid' ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredNotes.map(note => (
                    <div key={note.id} className="group relative">
                      <NoteCard
                        note={note}
                        onClick={() => handleViewNote(note)}
                        showAuthor={note.user_id !== user?.id}
                      />
                      {note.user_id === user?.id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 bg-background/80 backdrop-blur"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewNote(note)}>
                              <Eye className="w-4 h-4 mr-2" />
                              Xem
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditNote(note)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Chỉnh sửa
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicateNote(note)}>
                              <Copy className="w-4 h-4 mr-2" />
                              Tạo bản sao
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExportNote(note)}>
                              <Download className="w-4 h-4 mr-2" />
                              Xuất file
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDeleteNote(note)} className="text-destructive">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Xóa
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredNotes.map(note => (
                    <Card
                      key={note.id}
                      className="group cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => handleViewNote(note)}
                    >
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-muted">
                          {note.visibility === 'pinned' ? (
                            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                          ) : note.visibility === 'public' ? (
                            <Globe className="w-5 h-5 text-blue-500" />
                          ) : (
                            <Lock className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate">{note.title}</h3>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            {note.profiles && note.user_id !== user?.id && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {note.profiles.full_name}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {format(new Date(note.updated_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                            </span>
                            {note.stages && (
                              <Badge variant="outline" className="text-[10px]">{note.stages.name}</Badge>
                            )}
                          </div>
                        </div>
                        {note.tags && note.tags.length > 0 && (
                          <div className="hidden md:flex gap-1">
                            {note.tags.slice(0, 3).map((tag, i) => (
                              <Badge key={i} variant="secondary" className="text-[10px]">{tag}</Badge>
                            ))}
                          </div>
                        )}
                        {note.user_id === user?.id && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditNote(note); }}>
                                <Edit className="w-4 h-4 mr-2" />
                                Chỉnh sửa
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicateNote(note); }}>
                                <Copy className="w-4 h-4 mr-2" />
                                Tạo bản sao
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleExportNote(note); }}>
                                <Download className="w-4 h-4 mr-2" />
                                Xuất file
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteNote(note); }} className="text-destructive">
                                <Trash2 className="w-4 h-4 mr-2" />
                                Xóa
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )
            ) : (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <StickyNote className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  {hasActiveFilters ? 'Không tìm thấy ghi chú' : 'Chưa có ghi chú nào'}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {hasActiveFilters
                    ? 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm'
                    : 'Bắt đầu tạo ghi chú để lưu lại kiến thức và ý tưởng'}
                </p>
                {hasActiveFilters ? (
                  <Button variant="outline" onClick={clearFilters}>Xóa bộ lọc</Button>
                ) : (
                  <Button onClick={() => handleEditNote(null)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Tạo ghi chú đầu tiên
                  </Button>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* View Dialog */}
      <NoteViewDialog
        open={isViewDialogOpen}
        onOpenChange={setIsViewDialogOpen}
        note={selectedNote}
        onEdit={() => handleEditNote(selectedNote)}
        onDuplicate={() => selectedNote && handleDuplicateNote(selectedNote)}
        onExport={() => selectedNote && handleExportNote(selectedNote)}
        onDelete={() => selectedNote && handleDeleteNote(selectedNote)}
        canEdit={selectedNote?.user_id === user?.id}
      />

      {/* Edit Dialog */}
      <NoteEditDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        note={selectedNote}
        groupId={groupId!}
        stages={stages}
        tasks={tasks}
        onSave={fetchData}
      />
    </DashboardLayout>
  );
}
