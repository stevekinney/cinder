import type { IconProps } from 'lucide-svelte';
import type { ComponentType, SvelteComponent } from 'svelte';

export {
  ArrowUp,
  Bold,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Code,
  Copy,
  FileCode,
  FileText,
  FolderGit2,
  GitBranch,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link,
  List,
  ListOrdered,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Pilcrow,
  Plus,
  Quote,
  Redo2,
  RefreshCw,
  RotateCcw,
  Search,
  Square,
  Strikethrough,
  Trash2,
  Undo2,
  Unlink,
  X,
} from 'lucide-svelte';

export type { IconProps } from 'lucide-svelte';

export type IconComponent = ComponentType<SvelteComponent<IconProps>>;
