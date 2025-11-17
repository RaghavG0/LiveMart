import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the user from the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      throw new Error('Invalid user token')
    }

    const { role } = await req.json()

    if (!role || !['customer', 'retailer', 'wholesaler'].includes(role)) {
      throw new Error('Invalid role. Must be customer, retailer, or wholesaler')
    }

    console.log(`Assigning role ${role} to user ${user.id}`)

    // Check if user already has a role
    const { data: existingRole, error: checkError } = await supabaseClient
      .from('user_roles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (existingRole) {
      // Update existing role
      const { error: updateError } = await supabaseClient
        .from('user_roles')
        .update({ role })
        .eq('user_id', user.id)

      if (updateError) {
        console.error('Error updating role:', updateError)
        throw updateError
      }

      console.log(`Updated role for user ${user.id} to ${role}`)
      return new Response(
        JSON.stringify({ message: 'Role updated successfully', role }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      // Insert new role
      const { error: insertError } = await supabaseClient
        .from('user_roles')
        .insert({ user_id: user.id, role })

      if (insertError) {
        console.error('Error inserting role:', insertError)
        throw insertError
      }

      console.log(`Assigned role ${role} to user ${user.id}`)
      return new Response(
        JSON.stringify({ message: 'Role assigned successfully', role }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    console.error('Error in assign-user-role function:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
