import { Button } from '@/components/ui/button';
import { ArrowRight, Users, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header trên - navbar */}
      <header className="border-b bg-primary text-primary-foreground sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img
              src="https://drive.google.com/file/d/1xqQ6e6DQWw6VZaSCYBbEg79TxyW1zwKV/view?usp=sharing"
              alt="UEH logo xanh"
              className="h-8 w-auto drop-shadow-md"
              loading="lazy"
            />
            <div className="hidden sm:block h-8 w-px bg-primary-foreground/30" />
            <span className="hidden sm:block font-heading font-semibold text-lg">TaskFlow UEH</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth/member">
              <Button variant="secondary" className="font-medium">
                Đăng nhập thành viên
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link to="/auth/admin">
              <Button className="font-medium bg-orange-500 hover:bg-orange-600 text-white border-0">
                <Shield className="w-4 h-4 mr-2" /> Leader / Nhóm phó
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Header dưới - thông tin liên hệ Leader */}
      <div className="bg-primary/90 text-primary-foreground border-b border-primary/40">
        <div className="container mx-auto px-4 py-2 flex flex-col md:flex-row items-center justify-between gap-2 text-xs md:text-sm">
          <span className="font-medium">Liên hệ Leader phụ trách hệ thống:</span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              Họ tên: <span className="font-semibold">Nguyễn Hoàng Khánh</span>
            </span>
            <span>
              Email: <span className="font-semibold">khanhngh.ueh@gmail.com</span>
            </span>
          </div>
        </div>
      </div>

      {/* Hero Section - 16:9 optimized */}
      <main className="flex-1 flex items-center">
        <section className="w-full py-12 md:py-20">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left content */}
              <div className="space-y-6 animate-fade-in">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm font-medium">
                  <Users className="w-4 h-4" />
                  Dành cho sinh viên UEH
                </div>

                <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
                  Quản lý công việc{' '}
                  <span className="text-gradient">nhóm hiệu quả</span>
                </h1>

                <p className="text-lg text-muted-foreground max-w-lg">
                  Nền tảng số giúp sinh viên quản lý công việc nhóm một cách minh bạch,
                  công bằng với hệ thống tính điểm tự động.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <Link to="/auth/member" className="w-full sm:w-auto">
                    <Button size="lg" className="w-full text-base font-semibold px-8">
                      Bắt đầu với tư cách thành viên
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </Link>
                  <Link to="/auth/admin" className="w-full sm:w-auto">
                    <Button
                      size="lg"
                      className="w-full text-base font-semibold px-8 bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      <Shield className="w-5 h-5 mr-2" />
                      Dành cho Leader/Nhóm phó
                    </Button>
                  </Link>
                </div>

                {/* Stats */}
                <div className="flex gap-8 pt-8 border-t border-border/50">
                  <div>
                    <p className="text-3xl font-heading font-bold text-primary">100%</p>
                    <p className="text-sm text-muted-foreground">Minh bạch</p>
                  </div>
                  <div>
                    <p className="text-3xl font-heading font-bold text-accent">Auto</p>
                    <p className="text-sm text-muted-foreground">Tính điểm</p>
                  </div>
                  <div>
                    <p className="text-3xl font-heading font-bold text-success">Real-time</p>
                    <p className="text-sm text-muted-foreground">Theo dõi</p>
                  </div>
                </div>
              </div>

              {/* Right illustration bỏ Dashboard dự án */}
              <div className="hidden lg:block" />
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-primary text-primary-foreground py-6 mt-8">
        <div className="container mx-auto px-4 space-y-4 text-sm">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                src="https://drive.google.com/file/d/1xqQ6e6DQWw6VZaSCYBbEg79TxyW1zwKV/view?usp=sharing"
                alt="UEH logo xanh"
                className="h-8 w-auto"
                loading="lazy"
              />
              <span className="text-xs md:text-sm">
                © 2025 TaskFlow UEH &mdash; Hệ thống quản lý công việc nhóm cho sinh viên UEH.
              </span>
            </div>
            <p className="text-xs md:text-sm text-primary-foreground/90 text-center md:text-right max-w-md">
              TaskFlow hỗ trợ chia task, theo dõi tiến độ, tính điểm từng thành viên và tổng kết theo giai đoạn,
              giúp giảng viên và sinh viên đánh giá công bằng, minh bạch.
            </p>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-2 text-xs md:text-sm text-primary-foreground/90">
            <span>Đơn vị: Trường Đại học Kinh tế TP. Hồ Chí Minh (UEH).</span>
            <span>
              Góp ý &amp; báo lỗi hệ thống: <span className="font-semibold">khanhngh.ueh@gmail.com</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
