import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export async function submitFeedback(email: string, content: string) {
  if (!supabase) {
    throw new Error("Supabase 配置缺失");
  }
  const { error } = await supabase.from("feedback").insert([{ email, content }]);

  if (error) {
    throw error;
  }
  return null;
}
