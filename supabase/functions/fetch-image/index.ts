import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Validate Supabase environment variables
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: 'Supabase environment variables are not set' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }

  try {
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Try fetching the latest image from CivitAI
    try {
      const civitaiResponse = await fetch(
        'https://civitai.com/api/v1/images?limit=1&nsfw=X&sort=Newest',
        { headers: { 'Content-Type': 'application/json' } }
      )

      if (civitaiResponse.ok) {
        const data = await civitaiResponse.json()
        if (data.items && data.items.length > 0) {
          const image = data.items[0]

          // Upsert the image into Supabase
          const { error: upsertError } = await supabaseClient
            .from('images')
            .upsert({ id: image.id, url: image.url })

          if (!upsertError) {
            return new Response(
              JSON.stringify({ url: image.url }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        }
      } else {
        console.error(`CivitAI response error: ${civitaiResponse.statusText}`)
      }
    } catch (error) {
      console.error('CivitAI fetch error:', error)
    }

    // Fallback: Fetch random image from Supabase
    const { data: randomImage, error: queryError } = await supabaseClient
      .from('images')
      .select('url')
      .order('random()')
      .limit(1)
      .single()

    if (queryError) {
      console.error('Supabase query error:', queryError)
      throw new Error('Failed to fetch fallback image')
    }

    return new Response(
      JSON.stringify({ url: randomImage.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

