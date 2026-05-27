import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function run() {
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('id, title, source_url, application_method, application_email');
  
  if (error) {
    console.error('Error fetching jobs:', error);
    return;
  }
  
  console.log('Jobs in DB:', JSON.stringify(jobs, null, 2));
}

run();
