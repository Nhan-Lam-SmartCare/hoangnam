import React, { useState, useEffect } from 'react';
import { Search, ExternalLink, Download, Plus, RefreshCw } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { ExternalPart } from '../../types';
import { formatCurrency } from '../../utils/format';
import { toast } from 'react-toastify';

export default function ExternalPartsLookup() {
    const [parts, setParts] = useState<ExternalPart[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [categories, setCategories] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const ITEMS_PER_PAGE = 20;

    const fetchCategories = async () => {
        try {
            const { data, error } = await supabase
                .rpc('get_external_part_categories');

            if (error) throw error;

            // Data is already unique and sorted from RPC
            const uniqueCategories = data?.map((item: any) => item.category) || [];
            setCategories(uniqueCategories);
        } catch (error) {
            console.error('Error fetching categories:', error);
            // Fallback to manual fetch if RPC fails
            try {
                const { data } = await supabase
                    .from('external_parts')
                    .select('category')
                    .range(0, 999);
                const uniqueCategories = Array.from(new Set(data?.map(item => item.category).filter(Boolean) || [])).sort();
                setCategories(uniqueCategories);
            } catch (e) {
                console.error('Fallback fetch failed:', e);
            }
        }
    };

    const fetchParts = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('external_parts')
                .select('*', { count: 'exact' });

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
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    useEffect(() => {
        fetchParts();
    }, [page, searchTerm, selectedCategory]);

    const handleAddToInventory = (part: ExternalPart) => {
        // This would ideally open the "Add Part" modal with pre-filled data
        // For now, we'll just show a toast or emit an event
        toast.success(`Đã chọn: ${part.name}. Tính năng thêm vào kho đang phát triển.`);
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900">
            {/* Header */}
            <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 py-3 sm:py-4">
                {/* Desktop Header */}
                <div className="hidden sm:flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Tra cứu phụ tùng ngoài</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Tra cứu giá và thông tin phụ tùng từ nguồn dữ liệu bên ngoài (xemay.net)
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => {
                                fetchParts();
                                fetchCategories();
                            }}
                            className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="Làm mới"
                        >
                            <RefreshCw className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Mobile Header */}
                <div className="sm:hidden flex justify-between items-center">
                    <div>
                        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Tra cứu ngoài</h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400">xemay.net</p>
                    </div>
                    <button
                        onClick={() => {
                            fetchParts();
                            fetchCategories();
                        }}
                        className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 active:bg-slate-200 dark:active:bg-slate-600"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Search & Filter */}
            <div className="p-4 sm:p-6 sm:pb-0">
                {/* Desktop Filter */}
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
                                    setPage(1); // Reset to page 1 on search
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

                {/* Mobile Filter */}
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
                            backgroundSize: '1.25rem'
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

            {/* Content */}
            <div className="flex-1 p-6 overflow-hidden flex flex-col">
                {/* Desktop Table View */}
                <div className="hidden sm:block bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex-1 flex flex-col overflow-hidden">
                    <div className="overflow-auto flex-1">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-700">Hình ảnh</th>
                                    <th className="px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-700">Mã SKU</th>
                                    <th className="px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-700">Tên phụ tùng</th>
                                    <th className="px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-700">Giá tham khảo</th>
                                    <th className="px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-700 text-right">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                                            Đang tải dữ liệu...
                                        </td>
                                    </tr>
                                ) : parts.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                                            Không tìm thấy phụ tùng nào.
                                        </td>
                                    </tr>
                                ) : (
                                    parts.map((part) => (
                                        <tr key={part.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 group">
                                            <td className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                                                {part.image_url ? (
                                                    <img
                                                        src={part.image_url}
                                                        alt={part.name}
                                                        className="w-12 h-12 object-cover rounded border border-slate-200 dark:border-slate-600"
                                                    />
                                                ) : (
                                                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-400 text-xs">
                                                        No img
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 font-mono text-sm text-slate-600 dark:text-slate-300">
                                                {part.sku || '---'}
                                            </td>
                                            <td className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                                                <div className="font-medium text-slate-900 dark:text-slate-100">{part.name}</div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400">{part.category}</div>
                                            </td>
                                            <td className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 font-medium text-blue-600 dark:text-blue-400">
                                                {formatCurrency(part.price)}
                                            </td>
                                            <td className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {part.source_url && (
                                                        <a
                                                            href={part.source_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                                            title="Xem nguồn"
                                                        >
                                                            <ExternalLink className="w-4 h-4" />
                                                        </a>
                                                    )}
                                                    <button
                                                        onClick={() => handleAddToInventory(part)}
                                                        className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                                                        title="Thêm vào kho"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Desktop Pagination */}
                    <div className="border-t border-slate-200 dark:border-slate-700 px-6 py-4 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                            Trang {page} / {totalPages}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700"
                            >
                                Trước
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="px-3 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700"
                            >
                                Sau
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Card View */}
                <div className="sm:hidden flex-1 flex flex-col">
                    <div className="flex-1 overflow-auto space-y-3 pb-20">
                        {loading ? (
                            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                                Đang tải dữ liệu...
                            </div>
                        ) : parts.length === 0 ? (
                            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                                Không tìm thấy phụ tùng nào.
                            </div>
                        ) : (
                            parts.map((part) => (
                                <div
                                    key={part.id}
                                    className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 border border-slate-100 dark:border-slate-700"
                                >
                                    <div className="flex gap-3">
                                        {/* Image */}
                                        <div className="flex-shrink-0">
                                            {part.image_url ? (
                                                <img
                                                    src={part.image_url}
                                                    alt={part.name}
                                                    className="w-16 h-16 object-cover rounded-xl border-2 border-slate-100 dark:border-slate-700"
                                                />
                                            ) : (
                                                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-xl border-2 border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-400 text-xs">
                                                    No img
                                                </div>
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-tight mb-1">
                                                {part.name}
                                            </div>
                                            <div className="text-xs text-slate-400 dark:text-slate-500 mb-2">
                                                {part.category}
                                            </div>
                                            {part.sku && (
                                                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700 px-2 py-0.5 rounded inline-block mb-2">
                                                    {part.sku}
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between mt-2">
                                                <div className="text-lg font-black text-blue-600 dark:text-blue-400">
                                                    {formatCurrency(part.price)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Mobile Pagination - Fixed Bottom */}
                    <div className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-lg border-t border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between z-10">
                        <div className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                            Trang {page}/{totalPages}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 disabled:opacity-40 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 active:scale-95 transition-transform"
                            >
                                ←
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 disabled:opacity-40 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 active:scale-95 transition-transform"
                            >
                                →
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
