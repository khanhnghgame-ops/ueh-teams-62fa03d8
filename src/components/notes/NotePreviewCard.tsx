import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Lock, Globe, Star, Calendar, Tag, Link as LinkIcon, User, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Note } from '@/types/notes';

interface NotePreviewCardProps {
  note: Note;
  onOpen: () => void;
  showAuthor?: boolean;
}

export default function NotePreviewCard({ note, onOpen, showAuthor = false }: NotePreviewCardProps) {
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

  // Strip HTML tags for preview - max 100 chars
  const getTextPreview = (html: string | null) => {
    if (!html) return '';
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return text.length > 100 ? text.slice(0, 100) + '...' : text;
  };

  return (
    <Card
      className="group cursor-pointer hover:shadow-md transition-all hover:border-primary/50 h-full"
      onClick={onOpen}
    >
      <CardContent className="p-4 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors flex-1">
            {note.title}
          </h3>
          {getVisibilityIcon()}
        </div>

        {/* Preview - max 2 lines */}
        {note.content && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3 flex-1">
            {getTextPreview(note.content)}
          </p>
        )}

        {/* Tags - max 2 */}
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
          {showAuthor && note.profiles && (
            <span className="flex items-center gap-1">
              <User className="w-2.5 h-2.5" />
              {note.profiles.full_name.split(' ').slice(-2).join(' ')}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="w-2.5 h-2.5" />
            {format(new Date(note.updated_at), 'dd/MM', { locale: vi })}
          </span>
          {note.links && note.links.length > 0 && (
            <span className="flex items-center gap-1">
              <LinkIcon className="w-2.5 h-2.5" />
              {note.links.length}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
