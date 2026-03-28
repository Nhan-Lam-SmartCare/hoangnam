import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Tag, Image, Phone, MapPin, Mail, Facebook, MessageCircle } from 'lucide-react';

interface ShopLayoutProps {
  children: React.ReactNode;
}

export function ShopLayout({ children }: ShopLayoutProps) {
  const location = useLocation();

  const navLinks = [
    { path: '/san-pham', label: 'Sản Phẩm', icon: Home },
    { path: '/khuyen-mai', label: 'Khuyến Mãi', icon: Tag },
    { path: '/thu-vien', label: 'Thư Viện', icon: Image },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/san-pham" className="flex items-center gap-3 group">
              <img
                src="/logo-smartcare.png"
                alt="SmartCare Logo"
                className="h-10 w-10 rounded-lg shadow-sm group-hover:shadow-md transition"
              />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Nhạn Lâm SmartCare</h1>
                <p className="text-xs text-gray-500">Phụ tùng & Sửa chữa xe máy</p>
              </div>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                      isActive
                        ? 'bg-orange-100 text-orange-700 font-semibold ring-1 ring-orange-200 shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* Contact Button */}
            <a
              href="tel:0947747907"
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-medium"
            >
              <Phone className="h-4 w-4" />
              <span className="hidden lg:inline">0947.747.907</span>
              <span className="lg:hidden">Gọi ngay</span>
            </a>
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden flex items-center gap-2 pb-3 overflow-x-auto">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-sm whitespace-nowrap transition ${
                    isActive
                      ? 'bg-orange-100 text-orange-700 font-semibold ring-1 ring-orange-200'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* About */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img src="/logo-smartcare.png" alt="Logo" className="h-10 w-10 rounded-lg" />
                <h3 className="text-lg font-bold text-white">Nhạn Lâm SmartCare</h3>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                Chuyên cung cấp phụ tùng chính hãng và dịch vụ sửa chữa, bảo dưỡng xe máy 
                chuyên nghiệp. Uy tín - Chất lượng - Giá tốt.
              </p>
            </div>

            {/* Contact Info */}
            <div>
              <h3 className="text-lg font-bold text-white mb-4">Liên Hệ</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Hotline</p>
                    <a href="tel:0947747907" className="text-orange-400 hover:text-orange-300">
                      0947.747.907
                    </a>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Địa chỉ</p>
                    <p className="text-sm text-gray-400">
                      Ấp Phú Lợi B, Xã Long Phú Thuận, Đồng Tháp
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Email</p>
                    <a href="mailto:nhanlamsmartcare2025@gmail.com" className="text-orange-400 hover:text-orange-300 text-sm">
                      nhanlamsmartcare2025@gmail.com
                    </a>
                  </div>
                </li>
              </ul>
            </div>

            {/* Social & Hours */}
            <div>
              <h3 className="text-lg font-bold text-white mb-4">Kết Nối</h3>
              <div className="flex items-center gap-3 mb-6">
                <a
                  href="https://www.facebook.com/?ref=homescreenpwa"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
                  aria-label="Facebook"
                >
                  <Facebook className="h-5 w-5" />
                </a>
                <a
                  href="https://zalo.me/0947747907"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition"
                  aria-label="Zalo"
                >
                  <MessageCircle className="h-5 w-5" />
                </a>
              </div>
              <div>
                <p className="font-medium mb-2">Giờ Làm Việc</p>
                <p className="text-sm text-gray-400">Thứ 2 - Chủ Nhật</p>
                <p className="text-sm text-gray-400">7:00 - 19:00</p>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-500">
            <p>© {new Date().getFullYear()} Nhạn Lâm SmartCare. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
