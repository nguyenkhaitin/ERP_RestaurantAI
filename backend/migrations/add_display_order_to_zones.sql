-- =============================================
-- MIGRATION: Add display_order to khu_vuc table
-- Purpose: Enable drag-and-drop sorting for zones
-- Date: 2026-01-07
-- =============================================

-- Step 1: Add display_order column with default value 0
ALTER TABLE khu_vuc 
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Step 2: Initialize display_order based on current ID order
-- This ensures existing zones have sequential order values
UPDATE khu_vuc 
SET display_order = subquery.row_num
FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY id ASC) as row_num
    FROM khu_vuc
) AS subquery
WHERE khu_vuc.id = subquery.id;

-- Step 3: Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_khu_vuc_display_order 
ON khu_vuc(display_order);

-- Step 4: Add comment for documentation
COMMENT ON COLUMN khu_vuc.display_order IS 'Thứ tự hiển thị của khu vực (dùng cho drag-and-drop sorting)';

-- Verification query (optional - run to check results)
-- SELECT id, ten_khu_vuc, display_order FROM khu_vuc ORDER BY display_order ASC;
