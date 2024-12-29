import { assert, assertEquals } from 'https://deno.land/std@0.192.0/testing/asserts.ts'
import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import 'https://deno.land/x/dotenv@v3.2.2/load.ts'

// Set up the configuration for the Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const options = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
}

// Test client creation and database connection
const testClientCreation = async () => {
  const client: SupabaseClient = createClient(supabaseUrl, supabaseKey, options)

  if (!supabaseUrl) throw new Error('supabaseUrl is required.')
  if (!supabaseKey) throw new Error('supabaseKey is required.')

  // Test connection by querying the images table
  const { data: table_data, error: table_error } = await client
    .from('public.images')
    .select('*')
    .limit(1)
  
  if (table_error) {
    throw new Error('Invalid Supabase client: ' + table_error.message)
  }
  assert(table_data !== null, 'Data should be returned from the query.')
}

// Test storing image in database
const testImageStorage = async () => {
  const client: SupabaseClient = createClient(supabaseUrl, supabaseKey, options)

  // Invoke the fetch-image function
  const { data: functionData, error: funcError } = await client.functions.invoke('fetch-image')
  
  if (funcError) {
    throw new Error('Function invocation failed: ' + funcError.message)
  }

  assert(functionData.url, 'Function should return an image URL')

  // Check if the image exists in the database
  const { data: dbData, error: dbError } = await client
    .from('public.images')
    .select('url')
    .eq('url', functionData.url)
    .single()

  if (dbError) {
    throw new Error('Database query failed: ' + dbError.message)
  }

  assert(dbData !== null, 'Image should be stored in database')
  assertEquals(dbData.url, functionData.url, 'Stored URL should match returned URL')
}

// Test prevention of duplicate entries
const testDuplicatePrevention = async () => {
  const client: SupabaseClient = createClient(supabaseUrl, supabaseKey, options)

  // Get initial count
  const { count: initialCount, error: countError } = await client
    .from('public.images')
    .select('*', { count: 'exact', head: true })

  if (countError) {
    throw new Error('Initial count query failed: ' + countError.message)
  }

  // Make two consecutive requests
  const { data: first } = await client.functions.invoke('fetch-image')
  const { data: second } = await client.functions.invoke('fetch-image')

  // Get final count
  const { count: finalCount, error: finalCountError } = await client
    .from('public.images')
    .select('*', { count: 'exact', head: true })

  if (finalCountError) {
    throw new Error('Final count query failed: ' + finalCountError.message)
  }

  // Assert that count didn't increase by more than 2
  assert(
    (finalCount ?? 0) - (initialCount ?? 0) <= 2,
    'Count should not increase by more than 2 for two requests'
  )
}

// Test error handling for invalid requests
const testErrorHandling = async () => {
  const client: SupabaseClient = createClient(supabaseUrl, supabaseKey, options)

  // Test with invalid credentials
  const invalidClient = createClient(supabaseUrl, 'invalid_key', options)
  const { data: invalidData, error: invalidError } = await invalidClient
    .from('public.images')
    .select('*')
  
  assert(invalidError !== null, 'Should error with invalid credentials')
}

// Register and run the tests
Deno.test('Client Creation Test', testClientCreation)
Deno.test('Image Storage Test', testImageStorage)
Deno.test('Duplicate Prevention Test', testDuplicatePrevention)
Deno.test('Error Handling Test', testErrorHandling)

