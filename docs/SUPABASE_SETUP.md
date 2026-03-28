# Hướng dẫn Setup Supabase cho MotoCarePro

## Bước 1: Setup Database Schema

1. Truy cập Supabase Dashboard: https://uluxycppxlzdskyklgqt.supabase.co
2. Vào **SQL Editor**
3. Copy toàn bộ nội dung file `supabase_setup.sql`
4. Paste vào SQL Editor và click **Run**

## Bước 2: Kiểm tra Tables đã tạo

Vào **Table Editor**, bạn sẽ thấy các tables:
- ✅ customers
- ✅ parts
- ✅ work_orders
- ✅ sales
- ✅ cash_transactions
- ✅ payment_sources
- ✅ inventory_transactions

## Bước 3: Cài đặt dependencies (nếu chưa có)

```bash
npm install @supabase/supabase-js
```

## Bước 4: Cấu trúc files đã tạo

```
src/
├── lib/
│   └── supabase.ts          # Supabase client & helper functions
├── hooks/
│   └── useSupabase.ts       # React Query hooks
└── .env                      # Environment variables
```

## Bước 5: Sử dụng trong Component

### Ví dụ: Lấy danh sách Work Orders

```typescript
import { useWorkOrders } from './hooks/useSupabase';

function ServiceManager() {
  const { data: workOrders, isLoading, error } = useWorkOrders();
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div>
      {workOrders.map(order => (
        <div key={order.id}>{order.customerName}</div>
      ))}
    </div>
  );
}
```

### Ví dụ: Tạo Work Order mới

```typescript
import { useCreateWorkOrder } from './hooks/useSupabase';

function CreateOrder() {
  const createOrder = useCreateWorkOrder();
  
  const handleSubmit = () => {
    createOrder.mutate({
      id: `WO-${Date.now()}`,
      customerName: 'Nguyễn Văn A',
      status: 'Tiếp nhận',
      branchId: 'CN1',
      // ... other fields
    });
  };
  
  return <button onClick={handleSubmit}>Tạo phiếu</button>;
}
```

## Bước 6: Migrate data từ localStorage (Optional)

Nếu có dữ liệu cũ trong localStorage, bạn có thể migrate bằng cách:

```typescript
// Get old data
const oldCustomers = JSON.parse(localStorage.getItem('customers') || '[]');

// Insert to Supabase
for (const customer of oldCustomers) {
  await supabaseHelpers.createCustomer(customer);
}
```

## Bước 7: Update AppContext để dùng Supabase

Thay vì dùng localStorage, giờ AppContext sẽ fetch từ Supabase:

```typescript
// Old: const [customers, setCustomers] = useState(loadFromStorage('customers', []));
// New: Dùng useCustomers() hook
```

## Bước 8: Realtime Updates (Optional - Advanced)

Nếu muốn realtime sync giữa nhiều devices:

```typescript
import { supabase } from './lib/supabase';

// Subscribe to changes
supabase
  .channel('work_orders_changes')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'work_orders' },
    (payload) => {
      console.log('Change received!', payload);
      // Refetch data
    }
  )
  .subscribe();
```

## Features đã có sẵn:

✅ CRUD operations cho tất cả entities
✅ React Query integration (auto caching, refetch)
✅ TypeScript support
✅ Error handling
✅ Optimistic updates
✅ Row Level Security enabled
✅ Indexes cho performance
✅ Auto timestamps (created_at, updated_at)

## Next Steps:

1. Test kết nối bằng cách run `npm run dev`
2. Kiểm tra React Query DevTools để xem data
3. Thay thế localStorage logic bằng Supabase hooks
4. Setup authentication nếu cần

## Troubleshooting:

- **Error: Missing Supabase environment variables**
  → Kiểm tra file `.env` đã tồn tại và có đúng VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

- **Error: relation "customers" does not exist**
  → Run lại SQL script trong Supabase SQL Editor

- **CORS Error**
  → Kiểm tra Supabase URL và key có đúng không
