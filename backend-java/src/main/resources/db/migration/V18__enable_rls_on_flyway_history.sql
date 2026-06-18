-- Enable Row Level Security on flyway_schema_history to fix Supabase security lint warning
ALTER TABLE public.flyway_schema_history ENABLE ROW LEVEL SECURITY;
