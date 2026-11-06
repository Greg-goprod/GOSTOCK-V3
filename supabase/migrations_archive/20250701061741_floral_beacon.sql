/*
  # Enable RLS on status_configs table

  1. Security
    - Enable RLS on `status_configs` table to match existing policies
    - This resolves the mismatch between RLS policies and RLS being disabled

  The table already has proper RLS policies defined but RLS was not enabled,
  causing permission issues when trying to fetch data.
*/

-- Enable RLS on status_configs table
ALTER TABLE status_configs ENABLE ROW LEVEL SECURITY;