import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { 
  Activity, 
  Trash2, 
  Filter, 
  Search, 
  Calendar,
  User,
  FileText,
  Users,
  CheckSquare,
  Star,
  LogIn,
  RefreshCw
} from 'lucide-react';

interface ActivityLog {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  action_type: string;
  description: string | null;
  metadata: any;
  group_id: string | null;
  created_at: string;
}

const actionTypeOptions = [
  { value: 'all', label: 'Tất cả', icon: Activity },
  { value: 'task', label: 'Task', icon: CheckSquare },
  { value: 'group', label: 'Nhóm', icon: Users },
  { value: 'member', label: 'Thành viên', icon: User },
  { value: 'score', label: 'Điểm', icon: Star },
  { value: 'auth', label: 'Đăng nhập', icon: LogIn },
];

const getActionTypeColor = (type: string) => {
  const colors: Record<string, string> = {
    task: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    group: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    member: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    score: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    auth: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
  };
  return colors[type] || 'bg-muted text-muted-foreground';
};

const getActionTypeIcon = (type: string) => {
  const icons: Record<string, React.ComponentType<any>> = {
    task: CheckSquare,
    group: Users,
    member: User,
    score: Star,
    auth: LogIn,
  };
  return icons[type] || FileText;
};

export default function AdminActivity() {
  const { isAdmin, isLeader, profile } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionTypeFilter, setActionTypeFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (actionTypeFilter !== 'all') {
        query = query.eq('action_type', actionTypeFilter);
      }

      if (startDate) {
        query = query.gte('created_at', `${startDate}T00:00:00`);
      }

      if (endDate) {
        query = query.lte('created_at', `${endDate}T23:59:59`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
      toast.error('Không thể tải nhật ký hoạt động');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionTypeFilter, startDate, endDate]);

  const filteredLogs = logs.filter(log => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.user_name.toLowerCase().includes(query) ||
      log.action.toLowerCase().includes(query) ||
      (log.description && log.description.toLowerCase().includes(query))
    );
  });

  const handleDeleteByDateRange = async () => {
    if (!startDate || !endDate) {
      toast.error('Vui lòng chọn khoảng thời gian để xóa');
      return;
    }

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('activity_logs')
        .delete()
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`);

      if (error) throw error;

      toast.success('Đã xóa nhật ký trong khoảng thời gian đã chọn');
      fetchLogs();
    } catch (error) {
      console.error('Error deleting logs:', error);
      toast.error('Không thể xóa nhật ký');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteSingleLog = async (logId: string) => {
    try {
      const { error } = await supabase
        .from('activity_logs')
        .delete()
        .eq('id', logId);

      if (error) throw error;

      setLogs(logs.filter(log => log.id !== logId));
      toast.success('Đã xóa nhật ký');
    } catch (error) {
      console.error('Error deleting log:', error);
      toast.error('Không thể xóa nhật ký');
    }
  };

  // Log current user activity for demo
  const logActivity = async (action: string, actionType: string, description: string) => {
    if (!profile) return;
    
    try {
      await supabase.from('activity_logs').insert({
        user_id: profile.id,
        user_name: profile.full_name,
        action,
        action_type: actionType,
        description,
      });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };

  if (!isAdmin && !isLeader) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Bạn không có quyền truy cập trang này</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="w-6 h-6" />
              Nhật ký hoạt động
            </h1>
            <p className="text-muted-foreground mt-1">
              Theo dõi tất cả hoạt động trong hệ thống
            </p>
          </div>
          <Button onClick={fetchLogs} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Làm mới
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Bộ lọc
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Search */}
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm kiếm theo tên, hành động..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Action Type Filter */}
              <Select value={actionTypeFilter} onValueChange={setActionTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Loại hoạt động" />
                </SelectTrigger>
                <SelectContent>
                  {actionTypeOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <option.icon className="w-4 h-4" />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Date Range */}
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="pl-9"
                  placeholder="Từ ngày"
                />
              </div>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="pl-9"
                  placeholder="Đến ngày"
                />
              </div>
            </div>

            {/* Delete by date range */}
            {(isAdmin || isLeader) && startDate && endDate && (
              <div className="mt-4 pt-4 border-t flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Xóa nhật ký từ <strong>{format(new Date(startDate), 'dd/MM/yyyy')}</strong> đến <strong>{format(new Date(endDate), 'dd/MM/yyyy')}</strong>
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={isDeleting}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Xóa theo ngày
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Xác nhận xóa nhật ký?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Bạn có chắc chắn muốn xóa tất cả nhật ký từ {format(new Date(startDate), 'dd/MM/yyyy')} đến {format(new Date(endDate), 'dd/MM/yyyy')}? 
                        Hành động này không thể hoàn tác.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Hủy</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteByDateRange} className="bg-destructive hover:bg-destructive/90">
                        Xóa
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Danh sách hoạt động</CardTitle>
            <CardDescription>
              Hiển thị {filteredLogs.length} / {logs.length} bản ghi
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Không có nhật ký hoạt động nào</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Thời gian</TableHead>
                      <TableHead className="w-[150px]">Người dùng</TableHead>
                      <TableHead className="w-[100px]">Loại</TableHead>
                      <TableHead>Hành động</TableHead>
                      <TableHead>Mô tả</TableHead>
                      <TableHead className="w-[80px]">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => {
                      const IconComponent = getActionTypeIcon(log.action_type);
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-sm">
                            {format(new Date(log.created_at), 'HH:mm:ss dd/MM/yyyy', { locale: vi })}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium">{log.user_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getActionTypeColor(log.action_type)}>
                              <IconComponent className="w-3 h-3 mr-1" />
                              {log.action_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{log.action}</TableCell>
                          <TableCell className="text-muted-foreground max-w-[300px] truncate">
                            {log.description || '-'}
                          </TableCell>
                          <TableCell>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Xóa nhật ký này?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Bạn có chắc chắn muốn xóa nhật ký này không?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Hủy</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleDeleteSingleLog(log.id)}
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    Xóa
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
