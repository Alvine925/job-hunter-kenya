import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
});

const supabase = createClient(
  env.VITE_SUPABASE_URL || '',
  env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function run() {
  const { data: jobs, error: jobErr } = await supabase
    .from('jobs')
    .select('id, title, company');
  
  if (jobErr) {
    console.error('Error fetching jobs:', jobErr);
    return;
  }

  console.log('Jobs in database:', jobs.length);
  for (const job of jobs) {
    const { data: apps } = await supabase
      .from('applications')
      .select('id, tailored_cv, drive_file_id, drive_folder_id')
      .eq('job_id', job.id);
    
    console.log(`Job: ${job.title} at ${job.company} (ID: ${job.id})`);
    console.log(`  Applications count: ${apps ? apps.length : 0}`);
    if (apps && apps.length > 0) {
      for (const app of apps) {
        console.log(`    App ID: ${app.id}`);
        console.log(`    tailored_cv length: ${app.tailored_cv ? app.tailored_cv.length : 'null/undefined'}`);
      }
    }
  }
}

run();
