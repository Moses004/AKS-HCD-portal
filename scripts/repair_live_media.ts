import { createClient } from '@supabase/supabase-js';
import { repairActivityMediaMetadata } from '../src/services/mediaService';

const SUPABASE_URL = 'https://refjawgovrmsyigtcfdl.supabase.co';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlZmphd2dvdnJtc3lpZ3RjZmRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzODk4ODMsImV4cCI6MjEwNjk2NTg4M30.NJvqlQZVvfn8xfW_FimNWoKy-51Weu-35YqwB6EVBNs';

const client = createClient(SUPABASE_URL, ANON_KEY);

async function inspectAndRepairMedia() {
  console.log('--- Inspecting live activities in Supabase ---');
  const { data, error } = await client
    .from('activities')
    .select('id, title, status, media_assets');

  if (error) {
    console.error('Fetch error:', error.message);
    return;
  }

  console.log(`Retrieved ${data?.length || 0} activities.`);

  for (const act of data || []) {
    const rawAssets = Array.isArray(act.media_assets) ? act.media_assets : [];
    console.log(`\nActivity [${act.id}] (${act.status}): "${act.title}"`);
    console.log(`Current media_assets count: ${rawAssets.length}`);
    
    if (rawAssets.length > 0) {
      console.log('Raw assets:');
      for (const asset of rawAssets) {
        console.log(`  - Type: ${asset.type}, FileName: ${asset.fileName}, StoragePath: ${asset.storagePath || 'NONE'}`);
        console.log(`    URL starts with: ${asset.url ? asset.url.substring(0, 60) + '...' : 'EMPTY'}`);
      }

      const repaired = repairActivityMediaMetadata(rawAssets);
      console.log('Sanitized assets:');
      for (const asset of repaired) {
        console.log(`  - Type: ${asset.type}, StoragePath: ${asset.storagePath || 'NONE'}, URL: "${asset.url}"`);
      }
    }
  }
}

inspectAndRepairMedia().catch(console.error);
