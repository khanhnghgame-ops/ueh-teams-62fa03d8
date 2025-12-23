import type { Profile, Task, Stage } from './database';

export type NoteVisibility = 'private' | 'public' | 'pinned';

export interface Note {
  id: string;
  group_id: string;
  user_id: string;
  title: string;
  content: string | null;
  visibility: NoteVisibility;
  tags: string[];
  task_id: string | null;
  stage_id: string | null;
  links: string[];
  auto_save_content: string | null;
  last_auto_save: string | null;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
  tasks?: Task;
  stages?: Stage;
}
