import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  Lock, Globe, Star, Calendar, Tag, Link as LinkIcon, User,
  Edit, Copy, Download, Trash2, ExternalLink, Layers, FileText
} from 'lucide-react';
import type { Note } from '@/types/notes';

interface NoteViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: Note | null;
  onEdit: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onDelete: () => void;
  canEdit: boolean;
}

export default function NoteViewDialog({
  open,
  onOpenChange,
  note,
  onEdit,
  onDuplicate,
  onExport,
  onDelete,
  canEdit,
}: NoteViewDialogProps) {
  if (!note) return null;

  const getVisibilityInfo = () => {
    switch (note.visibility) {
      case 'private':
        return { icon: Lock, label: 'Riêng tư', color: 'text-muted-foreground' };
      case 'public':
        return { icon: Globe, label: 'Công khai', color: 'text-blue-500' };
      case 'pinned':
        return { icon: Star, label: 'Được ghim', color: 'text-yellow-500' };
    }
  };

  const visibility = getVisibilityInfo();
  const VisibilityIcon = visibility.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl font-bold line-clamp-2">
                {note.title}
              </DialogTitle>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                <span className={`flex items-center gap-1 ${visibility.color}`}>
                  <VisibilityIcon className="w-4 h-4" />
                  {visibility.label}
                </span>
                {note.profiles && (
                  <span className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {note.profiles.full_name}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {format(new Date(note.updated_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                </span>
              </div>
            </div>

            {canEdit && (
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={onExport}>
                  <Download className="w-4 h-4 mr-2" />
                  Xuất
                </Button>
                <Button variant="outline" size="sm" onClick={onDuplicate}>
                  <Copy className="w-4 h-4 mr-2" />
                  Sao chép
                </Button>
                <Button size="sm" onClick={onEdit}>
                  <Edit className="w-4 h-4 mr-2" />
                  Chỉnh sửa
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Main Content */}
          <ScrollArea className="flex-1 p-6">
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: note.content || '<p class="text-muted-foreground italic">Chưa có nội dung</p>' }}
            />
          </ScrollArea>

          {/* Sidebar */}
          <div className="w-64 border-l bg-muted/30 p-4 shrink-0 hidden md:block">
            <div className="space-y-5">
              {/* Related Stage/Task */}
              {(note.stages || note.tasks) && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Liên kết
                  </h4>
                  {note.stages && (
                    <div className="flex items-center gap-2 text-sm">
                      <Layers className="w-4 h-4 text-muted-foreground" />
                      <span>{note.stages.name}</span>
                    </div>
                  )}
                  {note.tasks && (
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="truncate">{note.tasks.title}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Tags */}
              {note.tags && note.tags.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Tags
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {note.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        <Tag className="w-3 h-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* External Links */}
              {note.links && note.links.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Liên kết ngoài
                  </h4>
                  <div className="space-y-2">
                    {note.links.map((link, index) => (
                      <a
                        key={index}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <LinkIcon className="w-3 h-3 shrink-0" />
                        <span className="truncate">{link}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Thời gian
                </h4>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Tạo lúc:</span>
                    <span>{format(new Date(note.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cập nhật:</span>
                    <span>{format(new Date(note.updated_at), 'dd/MM/yyyy HH:mm', { locale: vi })}</span>
                  </div>
                </div>
              </div>

              {/* Delete Button */}
              {canEdit && (
                <>
                  <Separator />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={onDelete}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Xóa ghi chú
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
