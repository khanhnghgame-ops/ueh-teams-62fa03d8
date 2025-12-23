import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import NoteCard from './NoteCard';
import NoteEditDialog from './NoteEditDialog';
import { Plus, Search, FileText, Lock, Globe, Star, Loader2, StickyNote } from 'lucide-react';
import type { Note, NoteVisibility } from '@/types/notes';
import type { Stage, Task, Profile, GroupMember } from '@/types/database';

interface NotesPageProps {
  groupId: string;
  stages: Stage[];
  tasks: Task[];
  members: GroupMember[];
}

type FilterType = 'all' | 'my' | 'public';

export default function NotesPage({ groupId, stages, tasks, members }: NotesPageProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterMember, setFilterMember] = useState<string>('');
  const [filterStage, setFilterStage] = useState<string>('');
  const [filterTask, setFilterTask] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  useEffect(() => {
    fetchNotes();
  }, [groupId]);

  const fetchNotes = async () => {
    setIsLoading(true);
    try {
      // Fetch notes - RLS will handle visibility
      const { data: notesData, error } = await supabase
        .from('notes')
        .select('*')
        .eq('group_id', groupId)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      if (notesData) {
        // Fetch related data
        const userIds = [...new Set(notesData.map(n => n.user_id))];
        const stageIds = [...new Set(notesData.filter(n => n.stage_id).map(n => n.stage_id))];
        const taskIds = [...new Set(notesData.filter(n => n.task_id).map(n => n.task_id))];

        const [profilesRes, stagesRes, tasksRes] = await Promise.all([
          supabase.from('profiles').select('*').in('id', userIds),
          stageIds.length ? supabase.from('stages').select('*').in('id', stageIds) : { data: [] },
          taskIds.length ? supabase.from('tasks').select('*').in('id', taskIds) : { data: [] },
        ]);

        const profilesMap = new Map(profilesRes.data?.map(p => [p.id, p]) || []);
        const stagesMap = new Map((stagesRes.data || []).map(s => [s.id, s]));
        const tasksMap = new Map((tasksRes.data || []).map(t => [t.id, t]));

        const enrichedNotes: Note[] = notesData.map(note => ({
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
      toast({ title: 'Lỗi', description: 'Không thể tải ghi chú', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenNote = (note: Note) => {
    setSelectedNote(note);
    setIsDialogOpen(true);
  };

  const handleCreateNote = () => {
    setSelectedNote(null);
    setIsDialogOpen(true);
  };

  // Filter notes
  const filteredNotes = notes.filter(note => {
    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = note.title.toLowerCase().includes(query);
      const matchesContent = note.content?.toLowerCase().includes(query);
      const matchesTags = note.tags?.some(t => t.toLowerCase().includes(query));
      if (!matchesTitle && !matchesContent && !matchesTags) return false;
    }

    // Filter type
    if (filterType === 'my' && note.user_id !== user?.id) return false;
    if (filterType === 'public' && note.visibility === 'private') return false;

    // Filter by member
    if (filterMember && note.user_id !== filterMember) return false;

    // Filter by stage
    if (filterStage && note.stage_id !== filterStage) return false;

    // Filter by task
    if (filterTask && note.task_id !== filterTask) return false;

    return true;
  });

  // Separate pinned notes
  const pinnedNotes = filteredNotes.filter(n => n.visibility === 'pinned');
  const regularNotes = filteredNotes.filter(n => n.visibility !== 'pinned');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <StickyNote className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Ghi chú</h2>
            <p className="text-sm text-muted-foreground">{notes.length} ghi chú</p>
          </div>
        </div>

        <Button onClick={handleCreateNote}>
          <Plus className="w-4 h-4 mr-2" />
          Tạo ghi chú
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm ghi chú..."
                  className="pl-9"
                />
              </div>
            </div>

            <Select value={filterType} onValueChange={(v: FilterType) => setFilterType(v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Tất cả
                  </div>
                </SelectItem>
                <SelectItem value="my">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Của tôi
                  </div>
                </SelectItem>
                <SelectItem value="public">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Công khai
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterMember || '_all'} onValueChange={(v) => setFilterMember(v === '_all' ? '' : v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Thành viên" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Tất cả thành viên</SelectItem>
                {members.map(m => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.profiles?.full_name || 'Unknown'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStage || '_all'} onValueChange={(v) => setFilterStage(v === '_all' ? '' : v)}>
              <SelectTrigger className="w-[150px]">
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

      {/* Pinned Notes */}
      {pinnedNotes.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            Ghi chú được ghim
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {pinnedNotes.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                onClick={() => handleOpenNote(note)}
                showAuthor={note.user_id !== user?.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Regular Notes */}
      {regularNotes.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {regularNotes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              onClick={() => handleOpenNote(note)}
              showAuthor={note.user_id !== user?.id}
            />
          ))}
        </div>
      ) : (
        notes.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <StickyNote className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Chưa có ghi chú nào</h3>
            <p className="text-muted-foreground mb-4">
              Bắt đầu tạo ghi chú để lưu lại kiến thức và ý tưởng
            </p>
            <Button onClick={handleCreateNote}>
              <Plus className="w-4 h-4 mr-2" />
              Tạo ghi chú đầu tiên
            </Button>
          </div>
        )
      )}

      {filteredNotes.length === 0 && notes.length > 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Không tìm thấy ghi chú phù hợp</p>
        </div>
      )}

      {/* Edit Dialog */}
      <NoteEditDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        note={selectedNote}
        groupId={groupId}
        stages={stages}
        tasks={tasks}
        onSave={fetchNotes}
      />
    </div>
  );
}
