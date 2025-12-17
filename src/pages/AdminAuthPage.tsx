import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { AdminAuthForm } from '@/components/AdminAuthForm';

export default function AdminAuthPage() {
  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      {/* Header */}
      <header className="bg-card border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Trang chủ
            </Button>
          </Link>
          <span className="hidden sm:inline font-heading text-sm text-muted-foreground">
            TaskFlow UEH - Leader/Nhóm phó
          </span>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center p-4">
        <AdminAuthForm />
      </main>

      {/* Footer */}
      <footer className="border-t py-4 text-center text-sm text-muted-foreground bg-card">
        © 2025 TaskFlow UEH - Đại học Kinh tế TP. Hồ Chí Minh
      </footer>
    </div>
  );
}
