/*
  # Article Number Function

  1. New Function
    - `set_article_number` - Function to generate sequential article numbers for equipment

  2. Security
    - Function is accessible to authenticated users
*/

-- Function to generate sequential article numbers
CREATE OR REPLACE FUNCTION set_article_number()
RETURNS TRIGGER AS $$
DECLARE
  prefix TEXT;
  year_date TEXT;
  next_number INT;
BEGIN
  -- Get the prefix from system settings or use default
  SELECT COALESCE(value, 'ART') INTO prefix
  FROM system_settings
  WHERE id = 'article_prefix';
  
  -- Format: ART-yyyymmdd-xxxx (e.g., ART-20230615-0001)
  year_date := TO_CHAR(CURRENT_DATE, 'yyyymmdd');
  
  -- Get the next number for this date
  SELECT COALESCE(MAX(CAST(SUBSTRING(article_number FROM LENGTH(prefix || '-' || year_date || '-') + 1) AS INTEGER)), 0) + 1
  INTO next_number
  FROM equipment
  WHERE article_number LIKE (prefix || '-' || year_date || '-%');
  
  -- Set the article number
  NEW.article_number := prefix || '-' || year_date || '-' || LPAD(next_number::TEXT, 4, '0');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;