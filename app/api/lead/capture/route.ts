import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, firmName, jobTitle, module, optInNewsletter } = body;

    if (!email || !module) {
      return NextResponse.json(
        { error: "Missing required fields: email, module" },
        { status: 400 }
      );
    }

    // Persist to DB
    let leadId: number | null = null;
    try {
      const { query } = await import("@/lib/db");
      const [row] = await query<{ id: number }>(
        `INSERT INTO lead_capture (email, name, firm_name, job_title, module, opt_in_newsletter, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         RETURNING id`,
        [
          email,
          name || null,
          firmName || null,
          jobTitle || null,
          module,
          optInNewsletter || false,
        ]
      );
      leadId = row?.id ?? null;
    } catch (dbError) {
      console.error("Lead capture DB error (non-blocking):", dbError);
    }

    // Send internal notification (non-blocking)
    try {
      const { sendSimpleEmail } = await import("@/lib/email");
      sendSimpleEmail({
        to: "compliance@memaconsultants.com",
        subject: `FinCrime Lab Lead: ${email}`,
        html: `
          <h2>New FinCrime Lab Lead</h2>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Name:</strong> ${name || "Not provided"}</p>
          <p><strong>Firm:</strong> ${firmName || "Not provided"}</p>
          <p><strong>Job Title:</strong> ${jobTitle || "Not provided"}</p>
          <p><strong>Module:</strong> ${module}</p>
          <p><strong>Newsletter Opt-in:</strong> ${optInNewsletter ? "Yes" : "No"}</p>
        `,
      }).catch((err: unknown) => console.error("Lead notification email error:", err));
    } catch {
      // Email is non-critical
    }

    return NextResponse.json({
      success: true,
      id: leadId,
    });
  } catch (error) {
    console.error("Lead capture error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
