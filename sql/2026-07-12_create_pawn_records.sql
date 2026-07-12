CREATE TABLE IF NOT EXISTS public.pawn_records (
    id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_address TEXT,
    customer_cccd TEXT,
    asset_type TEXT NOT NULL,
    asset_model TEXT,
    asset_serial TEXT,
    loan_amount NUMERIC NOT NULL DEFAULT 0,
    interest_rate NUMERIC DEFAULT 0,
    interest_period TEXT DEFAULT 'day', -- 'day' hoặc 'month'
    start_date TIMESTAMPTZ DEFAULT now(),
    end_date TIMESTAMPTZ,
    min_interest NUMERIC DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'redeemed', 'liquidated'
    notes TEXT,
    branch_id TEXT DEFAULT 'CN1',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Bật RLS
ALTER TABLE public.pawn_records ENABLE ROW LEVEL SECURITY;

-- Phân quyền cho người dùng đã đăng nhập (authenticated)
REVOKE ALL ON public.pawn_records FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pawn_records TO authenticated, service_role;

-- Các chính sách bảo mật RLS
CREATE POLICY pawn_records_select ON public.pawn_records
    FOR SELECT TO authenticated
    USING (
        public.current_user_role() = 'owner'
        OR COALESCE(branch_id, 'CN1') = COALESCE(public.current_user_branch_id(), 'CN1')
    );

CREATE POLICY pawn_records_insert ON public.pawn_records
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY pawn_records_update ON public.pawn_records
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY pawn_records_delete ON public.pawn_records
    FOR DELETE TO authenticated
    USING (public.current_user_role() IN ('owner', 'manager'));
