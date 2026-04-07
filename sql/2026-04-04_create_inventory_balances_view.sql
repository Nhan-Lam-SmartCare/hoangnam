-- ============================================================
-- Create view: inventory_balances_view
-- Muc tieu: Hien thi ton kho theo dang bang truyen thong
-- (moi san pham, moi chi nhanh = 1 dong)
--
-- Cac cot json branch-map duoc tro ve tu bang parts:
-- - stock
-- - retailPrice / retailprice
-- - wholesalePrice / wholesaleprice
-- - costPrice / costprice
-- - laborCost / laborcost
-- - reservedStock / reservedstock / reserved
--
-- Luu y:
-- - View uu tien key branch trong stock.
-- - Neu san pham khong co key stock nao thi se khong co dong trong view.
-- ============================================================

DROP VIEW IF EXISTS public.inventory_balances_view;

CREATE VIEW public.inventory_balances_view AS
WITH parts_json AS (
  SELECT
    p.id,
    p.name,
    p.sku,
    p.category,
    p.description,
    p.created_at,
    to_jsonb(p) AS row_data
  FROM public.parts p
),
branch_rows AS (
  SELECT
    pj.id AS part_id,
    pj.name AS part_name,
    pj.sku,
    pj.category,
    pj.description,
    pj.created_at,
    bs.key AS branch_id,
    COALESCE(NULLIF(bs.value, '')::numeric, 0) AS on_hand_qty,
    COALESCE(
      NULLIF(
        COALESCE(
          (COALESCE(pj.row_data->'reservedStock', pj.row_data->'reservedstock', pj.row_data->'reserved', '{}'::jsonb) ->> bs.key),
          '0'
        ),
        ''
      )::numeric,
      0
    ) AS reserved_qty,
    COALESCE(
      NULLIF(
        COALESCE(
          (COALESCE(pj.row_data->'costPrice', pj.row_data->'costprice', '{}'::jsonb) ->> bs.key),
          '0'
        ),
        ''
      )::numeric,
      0
    ) AS cost_price,
    COALESCE(
      NULLIF(
        COALESCE(
          (COALESCE(pj.row_data->'retailPrice', pj.row_data->'retailprice', '{}'::jsonb) ->> bs.key),
          '0'
        ),
        ''
      )::numeric,
      0
    ) AS retail_price,
    COALESCE(
      NULLIF(
        COALESCE(
          (COALESCE(pj.row_data->'wholesalePrice', pj.row_data->'wholesaleprice', '{}'::jsonb) ->> bs.key),
          '0'
        ),
        ''
      )::numeric,
      0
    ) AS wholesale_price,
    COALESCE(
      NULLIF(
        COALESCE(
          (COALESCE(pj.row_data->'laborCost', pj.row_data->'laborcost', '{}'::jsonb) ->> bs.key),
          '0'
        ),
        ''
      )::numeric,
      0
    ) AS labor_cost
  FROM parts_json pj
  CROSS JOIN LATERAL jsonb_each_text(COALESCE(pj.row_data->'stock', '{}'::jsonb)) bs
)
SELECT
  part_id,
  part_name,
  sku,
  category,
  description,
  branch_id,
  on_hand_qty,
  reserved_qty,
  GREATEST(on_hand_qty - reserved_qty, 0) AS available_qty,
  cost_price,
  retail_price,
  wholesale_price,
  labor_cost,
  GREATEST(on_hand_qty - reserved_qty, 0) * cost_price AS inventory_value,
  created_at
FROM branch_rows
ORDER BY branch_id, part_name;

COMMENT ON VIEW public.inventory_balances_view IS
'Inventory balance by part and branch (derived from parts JSON branch-map fields).';

GRANT SELECT ON public.inventory_balances_view TO anon, authenticated, service_role;

-- Quick check:
-- SELECT * FROM public.inventory_balances_view ORDER BY branch_id, part_name LIMIT 100;
