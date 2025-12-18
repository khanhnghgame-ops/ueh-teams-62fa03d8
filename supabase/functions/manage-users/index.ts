import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_PASSWORD = "123456";

interface CreateMemberRequest {
  action: "create_member" | "setup_system_accounts" | "update_password" | "clear_must_change_password" | "delete_user" | "update_email";
  email?: string;
  password?: string;
  student_id?: string;
  full_name?: string;
  role?: "member" | "leader" | "admin";
  user_id?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const body: CreateMemberRequest = await req.json();
    console.log("Action:", body.action);

    if (body.action === "setup_system_accounts") {
      // Setup Leader account
      const leaderEmail = "khanhngh.ueh@gmail.com";
      const leaderPassword = "14092005";
      
      // Check if leader exists
      const { data: leaderList } = await supabaseAdmin.auth.admin.listUsers();
      const existingLeader = leaderList?.users?.find(u => u.email === leaderEmail);
      
      if (existingLeader) {
        // Update password
        await supabaseAdmin.auth.admin.updateUserById(existingLeader.id, {
          password: leaderPassword,
          email_confirm: true,
        });
        console.log("Leader password updated");
        
        // Ensure profile exists
        await supabaseAdmin.from("profiles").upsert({
          id: existingLeader.id,
          email: leaderEmail,
          student_id: "31241570562",
          full_name: "Nguyễn Hoàng Khánh (Leader)",
          is_approved: true,
          must_change_password: false,
        }, { onConflict: "id" });
        
        // Ensure admin role
        await supabaseAdmin.from("user_roles").upsert({
          user_id: existingLeader.id,
          role: "admin",
        }, { onConflict: "user_id,role" });
      } else {
        // Create leader
        const { data: newLeader, error: leaderError } = await supabaseAdmin.auth.admin.createUser({
          email: leaderEmail,
          password: leaderPassword,
          email_confirm: true,
          user_metadata: { student_id: "31241570562", full_name: "Nguyễn Hoàng Khánh (Leader)" }
        });
        
        if (leaderError) {
          console.error("Leader creation error:", leaderError);
        } else if (newLeader.user) {
          await supabaseAdmin.from("profiles").upsert({
            id: newLeader.user.id,
            email: leaderEmail,
            student_id: "31241570562",
            full_name: "Nguyễn Hoàng Khánh (Leader)",
            is_approved: true,
            must_change_password: false,
          }, { onConflict: "id" });
          
          await supabaseAdmin.from("user_roles").insert({
            user_id: newLeader.user.id,
            role: "admin",
          });
          console.log("Leader created successfully");
        }
      }

      // Setup Deputy account
      const deputyEmail = "khanhngh.game@gmail.com";
      const deputyPassword = "123456";
      
      const existingDeputy = leaderList?.users?.find(u => u.email === deputyEmail);
      
      if (existingDeputy) {
        await supabaseAdmin.auth.admin.updateUserById(existingDeputy.id, {
          password: deputyPassword,
          email_confirm: true,
        });
        console.log("Deputy password updated");
        
        await supabaseAdmin.from("profiles").upsert({
          id: existingDeputy.id,
          email: deputyEmail,
          student_id: "DEPUTY001",
          full_name: "Nhóm phó",
          is_approved: true,
          must_change_password: false,
        }, { onConflict: "id" });
        
        await supabaseAdmin.from("user_roles").upsert({
          user_id: existingDeputy.id,
          role: "leader",
        }, { onConflict: "user_id,role" });
      } else {
        const { data: newDeputy, error: deputyError } = await supabaseAdmin.auth.admin.createUser({
          email: deputyEmail,
          password: deputyPassword,
          email_confirm: true,
          user_metadata: { student_id: "DEPUTY001", full_name: "Nhóm phó" }
        });
        
        if (deputyError) {
          console.error("Deputy creation error:", deputyError);
        } else if (newDeputy.user) {
          await supabaseAdmin.from("profiles").upsert({
            id: newDeputy.user.id,
            email: deputyEmail,
            student_id: "DEPUTY001",
            full_name: "Nhóm phó",
            is_approved: true,
            must_change_password: false,
          }, { onConflict: "id" });
          
          await supabaseAdmin.from("user_roles").insert({
            user_id: newDeputy.user.id,
            role: "leader",
          });
          console.log("Deputy created successfully");
        }
      }

      return new Response(JSON.stringify({ success: true, message: "System accounts setup complete" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "create_member") {
      const { email, student_id, full_name } = body;
      
      if (!email || !student_id || !full_name) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create user in auth with DEFAULT PASSWORD
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: { student_id, full_name }
      });

      if (createError) {
        console.error("Create member error:", createError);
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (newUser.user) {
        // Create profile with must_change_password = true
        await supabaseAdmin.from("profiles").upsert({
          id: newUser.user.id,
          email,
          student_id,
          full_name,
          is_approved: true,
          must_change_password: true,
        }, { onConflict: "id" });

        // Assign member role
        await supabaseAdmin.from("user_roles").insert({
          user_id: newUser.user.id,
          role: "member",
        });

        console.log("Member created successfully with default password:", email);
      }

      return new Response(JSON.stringify({ success: true, user: newUser.user }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "update_password") {
      const { user_id, password } = body;
      
      if (!user_id || !password) {
        return new Response(JSON.stringify({ error: "Missing user_id or password" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
        password,
      });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Clear must_change_password flag after password update
      await supabaseAdmin.from("profiles").update({
        must_change_password: false,
      }).eq("id", user_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "clear_must_change_password") {
      const { user_id } = body;
      
      if (!user_id) {
        return new Response(JSON.stringify({ error: "Missing user_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabaseAdmin.from("profiles").update({
        must_change_password: false,
      }).eq("id", user_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "delete_user") {
      const { user_id } = body;
      
      if (!user_id) {
        return new Response(JSON.stringify({ error: "Missing user_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete user from auth (this will cascade to profiles due to ON DELETE CASCADE)
      const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);

      if (error) {
        console.error("Delete user error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("User deleted successfully:", user_id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "update_email") {
      const { user_id, email } = body;
      
      if (!user_id || !email) {
        return new Response(JSON.stringify({ error: "Missing user_id or email" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update email in auth
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
        email,
        email_confirm: true,
      });

      if (authError) {
        console.error("Update email error:", authError);
        return new Response(JSON.stringify({ error: authError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update email in profiles
      await supabaseAdmin.from("profiles").update({
        email,
      }).eq("id", user_id);

      console.log("Email updated successfully:", user_id, email);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});