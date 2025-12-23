import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Lock, Globe, Star, Calendar, Tag, Link as LinkIcon, User } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Note } from '@/types/notes';

interface NoteCardProps {
  note: Note;
  onClick: () => void;
  showAuthor?: boolean;
}

export default function NoteCard({ note, onClick, showAuthor = false }: NoteCardProps) {
  const getVisibilityIcon = () => {
    switch (note.visibility) {
      case 'private':
        return <Lock className="w-3.5 h-3.5 text-muted-foreground" />;
      case 'public':
        return <Globe className="w-3.5 h-3.5 text-blue-500" />;
      case 'pinned':
        return <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />;
    }
  };

  const getVisibilityLabel = () => {
    switch (note.visibility) {
      case 'private':
        return 'Riêng tư';
      case 'public':
        return 'Công khai';
      case 'pinned':
        return 'Ghim';
    }
  };

  // Strip HTML tags for preview
  const getTextPreview = (html: string | null) => {
    if (!html) return '';
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return text.length > 150 ? text.slice(0, 150) + '...' : text;
  };

  return (
    <Card
      className="group cursor-pointer hover:shadow-md transition-all hover:border-primary/50"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-base line-clamp-2 group-hover:text-primary transition-colors">
            {note.title}
          </h3>
          <div className="flex items-center gap-1 shrink-0">
            {getVisibilityIcon()}
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
            {getVisibilityLabel()}
          </Badge>
          
          {showAuthor && note.profiles && (
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {note.profiles.full_name}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Content preview */}
        {note.content && (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {getTextPreview(note.content)}
          </p>
        )}

        {/* Tags */}
        {note.tags && note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {note.tags.slice(0, 3).map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-[10px] px-1.5 py-0">
                <Tag className="w-2.5 h-2.5 mr-1" />
                {tag}
              </Badge>
            ))}
            {note.tags.length > 3 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                +{note.tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Links count */}
        {note.links && note.links.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <LinkIcon className="w-3 h-3" />
            <span>{note.links.length} liên kết</span>
          </div>
        )}

        {/* Related info */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1 border-t">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {format(new Date(note.updated_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
          </span>
          
          {note.stages && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
              {note.stages.name}
            </Badge>
          )}
          
          {note.tasks && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
              {note.tasks.title}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
