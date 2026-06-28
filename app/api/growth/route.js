const BASE_ID = "app5FRKtatYGgszAC";

const TABLES = {
  companies: "tbl126qsPB6DVyLRX",
  contacts: "tbliohMogBDjg6CLn",
  sequences: "tblKPrcmRUM55BmWs",
  consentLog: "tbl1KTczsjsA0MDRk",
  automationLog: "tblNrZsfAmLrRl2Sr",
  emailDrafts: "tblpeCePiIwk5XopS",
};

async function fetchAllRecords(tableId, apiKey) {
  const records = [];
  let offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${tableId}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Airtable fetch failed for ${tableId}: ${res.status} ${text}`);
    }
    const data = await res.json();
    records.push(...data.records);
    offset = data.offset;
  } while (offset && records.length < 5000);
  return records;
}

export const dynamic = "force-dynamic";

export async function GET(request) {
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "AIRTABLE_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  const gateKey = process.env.GROWTH_DASHBOARD_KEY?.trim();
  if (gateKey) {
    const provided = (request.headers.get("x-dashboard-key") || new URL(request.url).searchParams.get("key"))?.trim();
    if (provided !== gateKey) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const [companies, contacts, sequences, consentLog, automationLog, emailDrafts] = await Promise.all([
      fetchAllRecords(TABLES.companies, apiKey),
      fetchAllRecords(TABLES.contacts, apiKey),
      fetchAllRecords(TABLES.sequences, apiKey),
      fetchAllRecords(TABLES.consentLog, apiKey),
      fetchAllRecords(TABLES.automationLog, apiKey),
      fetchAllRecords(TABLES.emailDrafts, apiKey),
    ]);

    return Response.json({
      fetchedAt: new Date().toISOString(),
      companies: companies.map((r) => ({ id: r.id, createdTime: r.createdTime, ...r.fields })),
      contacts: contacts.map((r) => ({ id: r.id, createdTime: r.createdTime, ...r.fields })),
      sequences: sequences.map((r) => ({ id: r.id, createdTime: r.createdTime, ...r.fields })),
      consentLog: consentLog.map((r) => ({ id: r.id, createdTime: r.createdTime, ...r.fields })),
      automationLog: automationLog.map((r) => ({ id: r.id, createdTime: r.createdTime, ...r.fields })),
      emailDrafts: emailDrafts.map((r) => ({ id: r.id, createdTime: r.createdTime, ...r.fields })),
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 502 });
  }
}
