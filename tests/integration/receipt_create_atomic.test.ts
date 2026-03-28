
import { createClient } from "@supabase/supabase-js";
import { describe, it, expect, beforeAll } from "vitest";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase URL or Service Role Key");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

describe("Atomic Receipt Creation (Integration)", () => {
    beforeAll(async () => {
        // SQL function should be applied manually before running tests
    });

    it("should create receipt and update stock atomically", async () => {
        // 1. Create a test part with unique ID
        const randomId = Math.random().toString(36).substring(7);
        const partId = `ATOMIC-${Date.now()}-${randomId}`;
        const branchId = "CN1";

        const { error: createPartError } = await admin.from("parts").insert({
            id: partId,
            name: "Atomic Test Part",
            sku: partId,
            stock: { [branchId]: 10 },
            retailPrice: { [branchId]: 100000 },
            category: "Test",
        });

        if (createPartError) {
            console.error("Failed to create test part:", createPartError);
            throw createPartError;
        }

        // 2. Call the atomic RPC
        const items = [
            {
                partId,
                partName: "Atomic Test Part",
                quantity: 5,
                importPrice: 80000,
                sellingPrice: 120000,
                wholesalePrice: 110000,
            },
        ];

        const { data, error } = await admin.rpc("receipt_create_atomic", {
            p_items: items,
            p_supplier_id: "SUP-TEST",
            p_branch_id: branchId,
            p_user_id: "TEST-USER",
            p_notes: "Test Atomic Receipt",
        });

        if (error) {
            console.error("RPC Error:", error);
            throw error;
        }

        if (!data.success) {
            console.error("RPC Failed:", data.message);
            throw new Error("RPC Failed: " + data.message);
        }

        expect(data.success).toBe(true);

        // 3. Verify stock update
        const { data: part, error: fetchPartError } = await admin
            .from("parts")
            .select("stock, retailPrice")
            .eq("id", partId)
            .single();

        if (fetchPartError) throw fetchPartError;
        if (!part) throw new Error("Part not found after receipt creation");

        expect(part.stock[branchId]).toBe(15); // 10 + 5
        expect(part.retailPrice[branchId]).toBe(120000);

        // 4. Verify transaction creation
        const { data: txs } = await admin
            .from("inventory_transactions")
            .select("*")
            .eq("partId", partId)
            .eq("type", "Nhập kho")
            .order("created_at", { ascending: false })
            .limit(1);

        if (!txs) throw new Error("No transactions found");

        expect(txs).toHaveLength(1);
        expect(txs[0].quantity).toBe(5);
        expect(txs[0].notes).toBe("Test Atomic Receipt");

        // Cleanup test data
        await admin.from("parts").delete().eq("id", partId);
    }, 30000);
});
