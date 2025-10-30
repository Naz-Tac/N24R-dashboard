#!/usr/bin/env node
/**
 * Simple integration test for /api/availability
 * - Loads .env.local
 * - POST -> expect 201
 * - GET -> expect to see the record
 * - Optionally query Supabase REST to verify persistence
 * - Delete test row afterwards
 * - Prints a JSON summary
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load .env.local if present
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  console.warn('Warning: .env.local not found in project root.');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// fetch fallback: use global.fetch if available, otherwise lazy import node-fetch
async function fetcher(...args) {
  if (global.fetch) return global.fetch(...args);
  const mod = await import('node-fetch');
  return mod.default(...args);
}

(async () => {
  const PORT = process.env.PORT || 3000;
  const API_URL = `http://localhost:${PORT}/api/availability`;
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const summary = {
    status: 'fail',
    post_status: null,
    verified_insert: false,
    total_rows: null,
    warnings: []
  };

  if (!API_URL) {
    console.warn('Warning: API URL could not be determined.');
    process.exit(1);
  }

  if (!SUPABASE_URL || !SUPABASE_ANON || !SUPABASE_SERVICE) {
    summary.warnings.push('Supabase env variables missing; Supabase REST verification will be skipped.');
  }

  // build test payload using today's date
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;

  const payload = {
    agent_name: 'Test Agent',
    availability_date: dateStr,
    start_time: '09:00:00',
    end_time: '17:00:00',
    notes: null  // explicitly include notes field (nullable in schema)
  };

  try {
    // POST to local API
    const postRes = await fetcher(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // small timeout not available on fetch consistently; rely on default
    }).catch((err) => ({ error: err }));

    if (!postRes || postRes.error) {
      console.error('POST failed to connect to local server:', postRes && postRes.error ? postRes.error : postRes);
      summary.warnings.push('Failed to connect to local server on POST. Is the dev server running?');
      console.log(JSON.stringify(summary, null, 2));
      process.exit(2);
    }

    summary.post_status = postRes.status;

    let postJson = null;
    try {
      postJson = await postRes.json();
    } catch (err) {
      // sometimes response is HTML if error
      const txt = await postRes.text();
      console.error('POST response was not JSON:', txt.substring(0, 1000));
    }

    if (postRes.status !== 201) {
      console.error('Expected HTTP 201 from POST, got', postRes.status);
      console.error('Response body:', JSON.stringify(postJson, null, 2));
      if (postJson && postJson.error) {
        console.error('⚠️  Supabase/API error:', postJson.error);
      }
      summary.warnings.push(`POST did not return 201. Got ${postRes.status}: ${postJson && postJson.error || 'unknown error'}`);
      // continue to try GET for diagnosis
    }

    // try to extract inserted id if provided
    let insertedId = null;
    if (postJson && postJson.data && Array.isArray(postJson.data) && postJson.data[0] && postJson.data[0].id) {
      insertedId = postJson.data[0].id;
    }

    // GET local API
    const getRes = await fetcher(API_URL, { method: 'GET' }).catch((err) => ({ error: err }));
    if (!getRes || getRes.error) {
      console.error('GET failed to connect to local server:', getRes && getRes.error ? getRes.error : getRes);
      summary.warnings.push('Failed to connect to local server on GET.');
      console.log(JSON.stringify(summary, null, 2));
      process.exit(3);
    }

    let getJson = null;
    try {
      getJson = await getRes.json();
    } catch (err) {
      const txt = await getRes.text();
      console.error('GET response was not JSON:', txt.substring(0, 1000));
    }

    // Check whether record exists in GET response
    if (getJson && getJson.data && Array.isArray(getJson.data)) {
      const found = getJson.data.find((r) => r.agent_name === payload.agent_name && String(r.availability_date).startsWith(dateStr));
      if (found) {
        summary.verified_insert = true;
        summary.total_rows = getJson.data.length;
      }
    }

    // Optionally verify via Supabase REST
    let supaVerified = false;
    if (SUPABASE_URL && SUPABASE_ANON && SUPABASE_SERVICE) {
      const restUrlBase = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/agent_availability';
      // build filter for agent_name and date
      const filter = `agent_name=eq.${encodeURIComponent(payload.agent_name)}&availability_date=eq.${encodeURIComponent(dateStr)}`;
      const restUrl = `${restUrlBase}?select=*&${filter}&order=created_at.desc&limit=5`;

      // retry loop
      let restJson = null;
      for (let attempt = 1; attempt <= 6; attempt++) {
        const r = await fetcher(restUrl, {
          method: 'GET',
          headers: {
            apikey: SUPABASE_ANON,
            Authorization: `Bearer ${SUPABASE_SERVICE}`,
            Accept: 'application/json'
          }
        }).catch((e) => ({ error: e }));

        if (!r || r.error) {
          summary.warnings.push(`Supabase REST request failed on attempt ${attempt}`);
        } else {
          const text = await r.text();
          try {
            restJson = JSON.parse(text);
          } catch (e) {
            restJson = null;
          }

          if (Array.isArray(restJson) && restJson.length > 0) {
            supaVerified = true;
            // set total_rows to the number returned by rest for convenience
            summary.total_rows = restJson.length;
            // capture id if not from POST
            if (!insertedId && restJson[0].id) insertedId = restJson[0].id;
            break;
          }
        }

        // wait before retrying
        await sleep(1000);
      }
    }

    // If we have an insertedId, attempt to delete the test row to clean up
    let deleted = false;
    if (insertedId && SUPABASE_URL && SUPABASE_SERVICE && SUPABASE_ANON) {
      const delUrl = SUPABASE_URL.replace(/\/$/, '') + `/rest/v1/agent_availability?id=eq.${insertedId}`;
      const delRes = await fetcher(delUrl, {
        method: 'DELETE',
        headers: {
          apikey: SUPABASE_ANON,
          Authorization: `Bearer ${SUPABASE_SERVICE}`
        }
      }).catch((e) => ({ error: e }));

      if (delRes && !delRes.error) {
        // PostgREST returns 204 on delete; sometimes returns array if Prefer header used
        deleted = (delRes.status === 200 || delRes.status === 204);
      }
    }

    // Final summary
    summary.status = 'ok';
    summary.post_status = summary.post_status || null;
    summary.verified_insert = !!summary.verified_insert || !!supaVerified;
    if (summary.total_rows === null) summary.total_rows = summary.verified_insert ? 1 : 0;
    summary.deleted_test_row = deleted;

    console.log(JSON.stringify(summary, null, 2));

    if (summary.verified_insert) {
      console.log('\n✅ API Integration Tests Passed — Supabase and Next.js endpoints verified.');
      process.exit(0);
    } else {
      console.error('\n❌ API Integration Tests Failed — test record not found via API/Supabase.');
      process.exit(4);
    }
  } catch (err) {
    console.error('Unexpected error in test script:', err);
    process.exit(99);
  }
})();
