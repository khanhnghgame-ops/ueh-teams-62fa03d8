import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  Users,
  LayoutDashboard,
  FolderKanban,
  ListTodo,
  UserCog,
  LogOut,
  ChevronDown,
  Shield,
  Key,
} from 'lucide-react';
import uehLogo from '@/assets/ueh-logo-new.png';
import UserChangePasswordDialog from '@/components/UserChangePasswordDialog';

interface DashboardLayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Nhóm của tôi', href: '/groups', icon: FolderKanban },
  { name: 'Task của tôi', href: '/tasks', icon: ListTodo },
];

const adminNavigation = [
  { name: 'Quản lý thành viên', href: '/admin/members', icon: Users },
  { name: 'Quản lý task', href: '/admin/tasks', icon: ListTodo },
  { name: 'Điểm & giai đoạn', href: '/admin/scores', icon: LayoutDashboard },
  { name: 'Quản lý nhóm', href: '/admin/groups', icon: FolderKanban },
  { name: 'Tài khoản (Admin)', href: '/admin/accounts', icon: UserCog },
  { name: 'Nhật ký', href: '/admin/activity', icon: Shield },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, isAdmin, isLeader, signOut, refreshProfile } = useAuth();
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [studentId, setStudentId] = useState(profile?.student_id || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    setIsSavingProfile(true);

    try {
      const updateData: any = {
        full_name: fullName.trim(),
        student_id: studentId.trim(),
      };

      if (!isAdmin) {
        updateData.is_approved = false;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', profile.id);

      if (error) throw error;

      await refreshProfile();
      setIsProfileDialogOpen(false);
    } catch (error) {
      console.error('Error updating profile', error);
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full overflow-hidden">
        <Sidebar className="border-r flex-shrink-0">
          <SidebarHeader className="p-4">
            <Link to="/dashboard" className="flex items-center gap-3">
              <img src={uehLogo} alt="UEH Logo" className="h-10 w-auto drop-shadow-md" />
              <span className="font-bold text-lg text-sidebar-foreground">TaskFlow</span>
            </Link>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Menu chính</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigation.map((item) => (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton
                        asChild
                        isActive={location.pathname === item.href}
                      >
                        <Link to={item.href}>
                          <item.icon className="w-5 h-5" />
                          <span>{item.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {(isAdmin || isLeader) && (
              <SidebarGroup>
                <SidebarGroupLabel className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Quản trị Leader / Admin
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {adminNavigation.map((item) => (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton
                          asChild
                          isActive={location.pathname === item.href}
                        >
                          <Link to={item.href}>
                            <item.icon className="w-5 h-5" />
                            <span>{item.name}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>

          <SidebarFooter className="p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 h-auto py-3 px-2"
                >
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-sm">
                      {profile ? getInitials(profile.full_name) : '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium truncate text-sidebar-foreground max-w-[140px]">
                      {profile?.full_name || 'Đang tải...'}
                    </p>
                    <p className="text-xs text-sidebar-foreground/70 truncate max-w-[140px]">
                      {profile?.student_id}
                    </p>
                  </div>
                  <ChevronDown className="w-4 h-4 flex-shrink-0 text-sidebar-foreground/70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Tài khoản của tôi</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="flex flex-col items-start">
                  <span className="font-medium truncate max-w-full">{profile?.full_name}</span>
                  <span className="text-xs text-muted-foreground truncate max-w-full">{profile?.email}</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <span className="text-xs">
                    Vai trò: {isAdmin ? 'Admin' : isLeader ? 'Leader' : 'Member'}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsChangePasswordOpen(true)}>
                  <Key className="w-4 h-4 mr-2" />
                  Đổi mật khẩu
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Đăng xuất
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="flex-1">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 bg-card">
            <SidebarTrigger className="-ml-1" />
          </header>
          <main className="flex-1 p-6 bg-background">
            {children}
          </main>
        </SidebarInset>
      </div>

      {/* Change Password Dialog */}
      <UserChangePasswordDialog 
        open={isChangePasswordOpen} 
        onOpenChange={setIsChangePasswordOpen} 
      />
    </SidebarProvider>
  );
}
