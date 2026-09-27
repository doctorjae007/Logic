import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseClient = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export async function getAnonymousUserId() {
  if (!supabaseClient) return null

  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession()
  if (sessionError) throw sessionError
  if (sessionData.session) return sessionData.session.user.id

  const { data, error } = await supabaseClient.auth.signInAnonymously()
  if (error) throw error
  return data.user.id
}
