-- Create the images table
CREATE TABLE public.images (
    id BIGINT PRIMARY KEY,
    url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create an index for random selection optimization
CREATE INDEX idx_images_random ON public.images USING btree (created_at);

-- Grant necessary permissions
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;

-- Allow the service role to do everything
CREATE POLICY "Service role can do everything" ON public.images
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
