import React, { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { ExternalPart } from '../../types';
import { toast } from 'react-toastify';
import { ExternalPartsDesktopTable } from './components/ExternalPartsDesktopTable';
import { ExternalPartsMobileList } from './components/ExternalPartsMobileList';

export default function ExternalPartsLookup() {
  const [parts, setParts] = useState<ExternalPart[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const fetchCategories = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_external_part_categories');

      if (error) throw error;

      const uniqueCategories = data?.map((item: any) => item.category) || [];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      try {
        const { data } = await supabase
          .from('external_parts')
          .select('category')
          .range(0, 999);
        const uniqueCategories = Array.from(
          new Set(data?.map((item) => item.category).filter(Boolean) || [])
        ).sort();
        setCategories(uniqueCategories);
      } catch (e) {
        console.error('Fallback fetch failed:', e);
      }
    }
  }, []);

  const fetchParts = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from('external_parts').select('*', { count: 'exact' });

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`);
      }

      if (selectedCategory) {
        query = query.eq('category', selectedCategory);
      }

      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data, error, count } = await query
        .range(from, to)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setParts(data || []);
      if (count) {
        setTotalPages(Math.ceil(count / ITEMS_PER_PAGE));
      }
    } catch (error) {
      console.error('Error fetching external parts:', error);
      toast.error('Không thể tải dữ liệu phụ tùng ngoài');
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, selectedCategory]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchParts();
  }, [fetchParts]);

  const handleAddToInventory = (part: ExternalPart) => {
    toast.success(`Đã chọn: ${part.name}. Tính năng thêm vào kho đang phát triển.`);
  };

  const handleRefresh = () => {
    fetchParts();
    fetchCategories();
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900">
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 py-3 sm:py-4">
        <div className="hidden sm:flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Tra cứu phụ tùng ngoài</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Tra cứu giá và thông tin phụ tùng từ nguồn dữ liệu bên ngoài (xemay.net)
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleRefresh}
              className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title="Làm mới"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="sm:hidden flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Tra cứu ngoài</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">xemay.net</p>
          </div>
          <button
            onClick={handleRefresh}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 active:bg-slate-200 dark:active:bg-slate-600"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 sm:pb-0">
        <div className="hidden sm:flex flex-col md:flex-row gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 shadow-sm flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Tìm kiếm theo tên phụ tùng hoặc mã SKU..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 shadow-sm w-full md:w-64">
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">-- Tất cả mẫu xe --</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="sm:hidden space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 z-10" />
            <input
              type="text"
              placeholder="Tìm tên hoặc SKU..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-md text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-md text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-no-repeat bg-right pr-10"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23cbd5e0'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
              backgroundPosition: 'right 0.75rem center',
              backgroundSize: '1.25rem',
            }}
          >
            <option value="">-- Tất cả mẫu xe --</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-hidden flex flex-col">
        <ExternalPartsDesktopTable
          loading={loading}
          parts={parts}
          page={page}
          totalPages={totalPages}
          onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
          onNextPage={() => setPage((p) => Math.min(totalPages, p + 1))}
          onAddToInventory={handleAddToInventory}
        />

        <ExternalPartsMobileList
          loading={loading}
          parts={parts}
          page={page}
          totalPages={totalPages}
          onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
          onNextPage={() => setPage((p) => Math.min(totalPages, p + 1))}
        />
      </div>
    </div>
  );
}
