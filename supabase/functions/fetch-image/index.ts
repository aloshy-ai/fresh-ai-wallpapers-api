// supabase/functions/fetch-image/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CivitAIResponse {
  items: Array<{
    id: number
    url: string
  }>
}

interface ImageRecord {
  id: number
  url: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Try fetching from CivitAI first
    try {
      const civitaiResponse = await fetch(
        'https://civitai.com/api/v1/images?limit=1&nsfw=X&sort=Newest',
        {
          headers: { 'Content-Type': 'application/json' }
        }
      )

      if (civitaiResponse.ok) {
        const data: CivitAIResponse = await civitaiResponse.json()
        
        if (data.items && data.items.length > 0) {
          const image = data.items[0]
          
          // Try to insert the new image
          const { error: insertError } = await supabaseClient
            .from('images')
            .insert({ id: image.id, url: image.url })
          
          // If insert successful or failed due to duplicate, return the URL
          if (!insertError || insertError.code === '23505') { // 23505 is the Postgres duplicate key error code
            return new Response(
              JSON.stringify({ url: image.url }),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            )
          }
        }
      }
    } catch (error) {
      console.error('Error fetching from CivitAI:', error)
    }

    // If CivitAI fetch failed or insert failed, fall back to random URL from DB
    const { data: randomImage, error: queryError } = await supabaseClient
      .from('images')
      .select('url')
      .order('random()')
      .limit(1)
      .single()

    if (queryError) {
      throw new Error('Failed to fetch fallback image')
    }

    return new Response(
      JSON.stringify({ url: randomImage.url }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

