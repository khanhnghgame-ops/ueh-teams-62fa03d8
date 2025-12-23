import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import DashboardLayout from '@/components/layout/DashboardLayout';
import NotePreviewCard from '@/components/notes/NotePreviewCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus, Search, FileText, Lock, Globe, Star, Loader2, StickyNote,
  ArrowLeft, BookOpen, User, Layers, Tag
} from 'lucide-react';
import type { Note, NoteVisibility } from '@/types/notes';
import type { Stage, Task, GroupMember, Group } from '@/types/database';

export default function ProjectNotesPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [group, setGroup] = useState<Group | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMember, setFilterMember] = useState<string>('');
  const [filterStage, setFilterStage] = useState<string>('');
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (groupId) fetchData();
  }, [groupId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [groupRes, stagesRes, membersRes, notesRes] = await Promise.all([
        supabase.from('groups').select('*').eq('id', groupId).single(),
        supabase.from('stages').select('*').eq('group_id', groupId).order('order_index'),
        supabase.from('group_members').select('*').eq('group_id', groupId),
        supabase.from('notes').select('*').eq('group_id', groupId).order('updated_at', { ascending: false }),
      ]);

      if (groupRes.data) setGroup(groupRes.data);
      if (stagesRes.data) setStages(stagesRes.data);

      // Fetch member profiles
      if (membersRes.data) {
        const userIds = membersRes.data.map(m => m.user_id);
        const { data: profilesData } = await supabase.from('profiles').select('*').in('id', userIds);
        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        setMembers(membersRes.data.map(m => ({ ...m, profiles: profilesMap.get(m.user_id) })) as GroupMember[]);
      }

      // Enrich notes with profiles
      if (notesRes.data) {
        const userIds = [...new Set(notesRes.data.map(n => n.user_id))];
        const { data: profilesData } = await supabase.from('profiles').select('*').in('id', userIds);
        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

        const enrichedNotes: Note[] = notesRes.data.map(note => ({
          ...note,
          visibility: note.visibility as NoteVisibility,
          tags: note.tags || [],
          links: note.links || [],
          profiles: profilesMap.get(note.user_id),
        }));

        setNotes(enrichedNotes);
      }
    } catch (error: any) {
      toast({ title: 'Lỗi', description: 'Không thể tải dữ liệu', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // Filter notes
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
        n.tags?.some(t => t.toLowerCase().includes(query))
      );
    }

    // Filters
    if (filterMember) result = result.filter(n => n.user_id === filterMember);
    if (filterStage) result = result.filter(n => n.stage_id === filterStage);

    return result;
  }, [notes, activeTab, searchQuery, filterMember, filterStage, user?.id]);

  // Stats
  const stats = useMemo(() => ({
    total: notes.length,
    my: notes.filter(n => n.user_id === user?.id).length,
    public: notes.filter(n => n.visibility !== 'private').length,
    pinned: notes.filter(n => n.visibility === 'pinned').length,
  }), [notes, user?.id]);

  const handleOpenNote = (note: Note) => {
    // Open in new tab
    window.open(`/groups/${groupId}/notes/${note.id}`, '_blank');
  };

  const handleCreateNote = () => {
    // Open new note in new tab
    window.open(`/groups/${groupId}/notes/new`, '_blank');
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
                <p className="text-sm text-muted-foreground">Ghi chú cá nhân - mở tab mới để chỉnh sửa</p>
              </div>
            </div>
          </div>

          <Button onClick={handleCreateNote} size="lg">
            <Plus className="w-5 h-5 mr-2" />
            Tạo ghi chú mới
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:border-primary/50" onClick={() => setActiveTab('all')}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <FileText className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Tổng</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/50" onClick={() => setActiveTab('my')}>
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
          <Card className="cursor-pointer hover:border-primary/50" onClick={() => setActiveTab('public')}>
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
          <Card className="cursor-pointer hover:border-primary/50" onClick={() => setActiveTab('pinned')}>
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
              Ghim
            </TabsTrigger>
          </TabsList>

          {/* Search & Filters */}
          <Card className="mt-4">
            <CardContent className="py-3">
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Tìm kiếm..."
                      className="pl-9 h-9"
                    />
                  </div>
                </div>

                <Select value={filterMember || '_all'} onValueChange={(v) => setFilterMember(v === '_all' ? '' : v)}>
                  <SelectTrigger className="w-[150px] h-9">
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

                <Select value={filterStage || '_all'} onValueChange={(v) => setFilterStage(v === '_all' ? '' : v)}>
                  <SelectTrigger className="w-[140px] h-9">
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
              </div>
            </CardContent>
          </Card>

          {/* Notes Grid */}
          <TabsContent value={activeTab} className="mt-6">
            {filteredNotes.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredNotes.map(note => (
                  <NotePreviewCard
                    key={note.id}
                    note={note}
                    onOpen={() => handleOpenNote(note)}
                    showAuthor={note.user_id !== user?.id}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <StickyNote className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Chưa có ghi chú nào</h3>
                <p className="text-muted-foreground mb-4">Tạo ghi chú để lưu lại kiến thức và ý tưởng</p>
                <Button onClick={handleCreateNote}>
                  <Plus className="w-4 h-4 mr-2" />
                  Tạo ghi chú đầu tiên
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
