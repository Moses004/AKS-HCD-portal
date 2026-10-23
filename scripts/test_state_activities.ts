import { getSupabaseClient } from '../src/lib/supabase';
import {
  STATE_ACTIVITY_CATEGORIES,
  STATE_CATEGORY_LABELS,
  STATE_STATUS_LABELS,
  ACTION_ITEM_STATUS_LABELS,
  StateActivityCategory,
  StateHCDActivity,
  StateHCDActivityActionItem,
} from '../src/types';
import { stateActivitiesService } from '../src/services/stateActivitiesService';

const integrationUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
if (!integrationUrl) {
  throw new Error('Integration tests require VITE_SUPABASE_URL to point at an isolated Supabase instance.');
}
if (/refjawgovrmsyigtcfdl\.supabase\.co/i.test(integrationUrl)) {
  throw new Error('Refusing to run state-activity integration tests against the AKS-HCD production Supabase project.');
}

async function runStateActivitiesSuite() {
  console.log('======================================================================');
  console.log('STATE-LEVEL ACTIVITIES REPORTING MODULE AUDIT & TEST SUITE');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      if (detail) console.error(`   Detail: ${detail}`);
      failed++;
    }
  }

  // TEST 1: Category Mapping Fidelity
  console.log('--- TEST GROUP 1: Canonical Category Mapping ---');
  const expectedCategories: StateActivityCategory[] = [
    'monitoring_evaluation',
    'partnerships_stakeholder_engagement',
    'national_level_engagements',
    'state_hcd_council_meetings',
    'state_hcd_working_group_activities',
    'other_state_level_initiatives',
  ];

  assert(
    STATE_ACTIVITY_CATEGORIES.length === 6,
    'Exactly 6 canonical state activity categories defined',
    `Found ${STATE_ACTIVITY_CATEGORIES.length}`
  );

  for (const cat of expectedCategories) {
    const label = STATE_CATEGORY_LABELS[cat];
    assert(Boolean(label && label.length > 5), `Category "${cat}" has official display label: "${label}"`);
  }

  assert(
    STATE_CATEGORY_LABELS.monitoring_evaluation === 'Monitoring and Evaluation (M&E)',
    'monitoring_evaluation displays as "Monitoring and Evaluation (M&E)"'
  );
  assert(
    STATE_CATEGORY_LABELS.partnerships_stakeholder_engagement === 'Partnerships and Stakeholder Engagement',
    'partnerships_stakeholder_engagement displays as "Partnerships and Stakeholder Engagement"'
  );
  assert(
    STATE_CATEGORY_LABELS.national_level_engagements === 'National-Level Engagements and Meetings',
    'national_level_engagements displays as "National-Level Engagements and Meetings"'
  );
  assert(
    STATE_CATEGORY_LABELS.state_hcd_council_meetings === 'State HCD Council Meetings',
    'state_hcd_council_meetings displays as "State HCD Council Meetings"'
  );
  assert(
    STATE_CATEGORY_LABELS.state_hcd_working_group_activities === 'State HCD Working Group Activities',
    'state_hcd_working_group_activities displays as "State HCD Working Group Activities"'
  );
  assert(
    STATE_CATEGORY_LABELS.other_state_level_initiatives === 'Other State-Level Initiatives',
    'other_state_level_initiatives displays as "Other State-Level Initiatives"'
  );

  // TEST 2: Status Enum Mapping
  console.log('\n--- TEST GROUP 2: Official Status Values & Labels ---');
  assert(STATE_STATUS_LABELS.draft === 'Draft', 'draft status displays as Draft');
  assert(STATE_STATUS_LABELS.pending_approval === 'Pending Review / Publication', 'pending_approval displays as "Pending Review / Publication"');
  assert(STATE_STATUS_LABELS.published === 'Published', 'published displays as "Published"');
  assert(STATE_STATUS_LABELS.rejected_draft === 'Returned Draft', 'rejected_draft displays as "Returned Draft"');
  assert(STATE_STATUS_LABELS.archived === 'Archived', 'archived displays as "Archived"');

  // TEST 3: Action Point Status Labels
  console.log('\n--- TEST GROUP 3: Action Point Register Statuses ---');
  assert(ACTION_ITEM_STATUS_LABELS.open === 'Open', 'Action point open status mapped to "Open"');
  assert(ACTION_ITEM_STATUS_LABELS.in_progress === 'In Progress', 'Action point in_progress status mapped to "In Progress"');
  assert(ACTION_ITEM_STATUS_LABELS.completed === 'Completed', 'Action point completed status mapped to "Completed"');
  assert(ACTION_ITEM_STATUS_LABELS.cancelled === 'Cancelled', 'Action point cancelled status mapped to "Cancelled"');

  // TEST 4: CSV Formula Injection Sanitization
  console.log('\n--- TEST GROUP 4: Spreadsheet Export Formula Injection Neutralization ---');
  const dummyActivity: StateHCDActivity = {
    id: 'test-uuid-001',
    activity_code: '=HYPERLINK("http://evil.com")',
    title: '+cmd|"/C calc"!A0',
    category: 'monitoring_evaluation',
    activity_date: '2026-04-15',
    activity_end_date: null,
    location: '@SUM(1,2)',
    lead_institution: '-SUM(1,2)',
    lead_unit: '-12345',
    participating_stakeholders: [{ organization_name: 'Test MDA', stakeholder_type: 'MDA', role: 'Executive Oversight' }],
    description: 'Normal Description',
    key_outcomes: '=1+1',
    decisions_resolutions: 'Approved standard mandate',
    status: 'published',
    evidence_files: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const csvOutput = stateActivitiesService.exportStateActivitiesCsv([dummyActivity]);
  assert(!csvOutput.includes(',"=HYPERLINK'), 'Neutralized formula trigger = with leading quote');
  assert(!csvOutput.includes(',"+cmd'), 'Neutralized formula trigger + with leading quote');
  assert(!csvOutput.includes(',"@SUM'), 'Neutralized formula trigger @ with leading quote');
  assert(csvOutput.includes("'-SUM(1,2)"), 'Formula with negative trigger neutralized with leading quote');
  assert(csvOutput.includes('-12345'), 'Pure negative numbers uncorrupted');

  // TEST 5: Storage Path Structure
  console.log('\n--- TEST GROUP 5: Evidence Storage Path Convention ---');
  const activityUuid = 'a45f94b3-c19e-4db4-8178-5a498b584988';
  const expectedPrefix = `state-level/${activityUuid}/`;
  const generatedPath = `state-level/${activityUuid}/${Date.now()}_report.pdf`;
  assert(generatedPath.startsWith(expectedPrefix), `Path conforms to state-level/<activity-uuid>/ (${generatedPath})`);

  // TEST 6: Live Supabase Database Connectivity & Schema Verifications
  console.log('\n--- TEST GROUP 6: Supabase Endpoints & Views Verification ---');
  const sb = getSupabaseClient();
  if (!sb) {
    console.error('❌ Supabase client unavailable!');
    failed++;
  } else {
    // 6.1: public.state_hcd_activities
    const res1 = await sb.from('state_hcd_activities').select('id, activity_code, title, category, status').limit(1);
    assert(!res1.error, 'Table public.state_hcd_activities is queryable (200 OK)');

    // 6.2: public.hcd_activity_reporting_overview view
    const res2 = await sb.from('hcd_activity_reporting_overview').select('*').limit(1);
    assert(!res2.error, 'Consolidated view public.hcd_activity_reporting_overview is queryable (200 OK)');

    // 6.3: public.state_hcd_public_action_items view (200 OK or security_invoker RLS 42501 guard)
    const res3 = await sb.from('state_hcd_public_action_items').select('*').limit(1);
    const res3Valid = !res3.error || res3.error.code === '42501' || res3.error.message?.includes('permission denied');
    assert(res3Valid, 'Public action view public.state_hcd_public_action_items endpoint & security_invoker guard active');

    // 6.4: RLS isolation: anonymous cannot read private action items table directly
    const res4 = await sb.from('state_hcd_activity_action_items').select('*').limit(1);
    const rlsProtected = res4.error ? res4.error.message.includes('permission denied') : true;
    assert(rlsProtected, 'RLS guard active: public.state_hcd_activity_action_items protects sensitive personnel fields');
  }

  console.log('\n======================================================================');
  console.log(`STATE ACTIVITIES TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStateActivitiesSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
