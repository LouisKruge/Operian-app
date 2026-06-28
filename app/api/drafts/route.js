import nodemailer from "nodemailer";

const BASE_ID = "app5FRKtatYGgszAC";
const TABLE_ID = "tblpeCePiIwk5XopS";

const FIELDS = {
  subject: "fldC58PKTpquwG77q",
  body: "flddELmZOD32zfv0j",
  toEmail: "fldkMZMj1XKLikkpI",
  status: "fldcPthoRM1CGwjaO",
  sentAt: "fldSOHpybDLoSwOWg",
};

export const dynamic = "force-dynamic";

function checkAuth(request) {
  const gateKey = process.env.GROWTH_DASHBOARD_KEY?.trim();
  if (!gateKey) return true;
  const provided = (request.headers.get("x-dashboard-key") || new URL(request.url).searchParams.get("key"))?.trim();
  return provided === gateKey;
}

async function getRecord(id, apiKey) {
  const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${id}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch draft ${id}: ${res.status}`);
  return res.json();
}

async function patchRecord(id, fields, apiKey) {
  const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update draft ${id}: ${res.status} ${text}`);
  }
  return res.json();
}

async function sendMail(to, subject, body) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error("GMAIL_USER / GMAIL_APP_PASSWORD are not configured on the server.");
  }
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  await transporter.sendMail({
    from: user,
    to,
    subject,
    text: body,
  });
}

export async function POST(request) {
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "AIRTABLE_API_KEY is not configured on the server." }, { status: 500 });
  }
  if (!checkAuth(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { id, action } = payload || {};
  if (!id || !["approve", "reject"].includes(action)) {
    return Response.json({ error: "Body must include { id, action: 'approve' | 'reject' }" }, { status: 400 });
  }

  try {
    const record = await getRecord(id, apiKey);
    const currentStatus = record.fields[FIELDS.status];
    if (currentStatus !== "Pending Review") {
      return Response.json({ error: `Draft is already "${currentStatus}", not Pending Review.` }, { status: 409 });
    }

    if (action === "reject") {
      const updated = await patchRecord(id, { [FIELDS.status]: "Rejected" }, apiKey);
      return Response.json({ ok: true, status: "Rejected", id: updated.id });
    }

    // action === "approve" → send the real email, then mark Sent
    const to = record.fields[FIELDS.toEmail];
    const subject = record.fields[FIELDS.subject];
    const body = record.fields[FIELDS.body];
    if (!to) {
      return Response.json({ error: "Draft has no recipient email." }, { status: 400 });
    }

    await sendMail(to, subject, body);

    const updated = await patchRecord(
      id,
      { [FIELDS.status]: "Sent", [FIELDS.sentAt]: new Date().toISOString() },
      apiKey
    );
    return Response.json({ ok: true, status: "Sent", id: updated.id });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 502 });
  }
}
