import { Resend } from "resend";

// The approval code email, in the house dress. The code is the whole
// message: possession of this inbox is the authorization, so nothing in
// the email is clickable and the decision facts ride above the code.

let client: Resend | undefined;

function resend(): Resend {
	if (!client) {
		const key = process.env.RESEND_API_KEY;
		if (!key) throw new Error("RESEND_API_KEY is not set");
		client = new Resend(key);
	}
	return client;
}

export function ownerEmail(): string {
	const to = process.env.RENDI_OWNER_EMAIL;
	if (!to) throw new Error("RENDI_OWNER_EMAIL is not set");
	return to;
}

export function approvalEmailHtml(input: {
	code: string;
	storeName: string;
	itemsCount: number;
	totalDisplay: string;
	destination: string;
	conversationTitle: string;
	minutes: number;
}): string {
	const facts = [
		["Store", input.storeName],
		["Items", String(input.itemsCount)],
		["Total with tip", input.totalDisplay],
		["Deliver to", input.destination],
		["Asked from", input.conversationTitle],
	]
		.map(
			([label, value]) =>
				`<tr><td style="padding:3px 12px 3px 0;color:#8a8578;font-size:13px;">${label}</td><td style="padding:3px 0;color:#3d3a33;font-size:13px;">${value}</td></tr>`,
		)
		.join("");
	return `<div style="background:#f5f0e6;padding:32px 16px;font-family:Georgia,serif;">
	<div style="max-width:560px;margin:0 auto;">
		<p style="text-align:center;font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:3px;color:#8a8578;margin:0 0 14px;">RENDI ORDER</p>
		<div style="background:#fffdf7;border:1px solid #e6dcc9;border-radius:12px;padding:28px 32px;">
			<h1 style="font-style:italic;font-weight:normal;font-size:22px;color:#3d3a33;margin:0 0 16px;">An order is waiting for your yes.</h1>
			<table style="border-collapse:collapse;margin:0 0 20px;">${facts}</table>
			<p style="text-align:center;font-family:ui-monospace,Menlo,monospace;font-size:34px;letter-spacing:10px;color:#c2410c;margin:0 0 8px;">${input.code}</p>
			<p style="text-align:center;font-size:13px;color:#8a8578;margin:0;">Type this code into the order card. It works once and dies in ${input.minutes} minutes; any change to the cart voids it. Not you? Ignore this and nothing happens.</p>
		</div>
		<p style="text-align:center;font-size:12px;color:#8a8578;margin:16px 0 0;">rendi.help</p>
	</div>
</div>`;
}

export async function sendApprovalEmail(input: {
	code: string;
	storeName: string;
	itemsCount: number;
	totalDisplay: string;
	destination: string;
	conversationTitle: string;
	minutes: number;
	approvalId: number;
}): Promise<void> {
	const { error } = await resend().emails.send(
		{
			from: "Rendi <pulse@rendi.help>",
			replyTo: "Rendi <pulse@rendi.help>",
			to: ownerEmail(),
			subject: `Approve ${input.totalDisplay} at ${input.storeName}`,
			html: approvalEmailHtml(input),
		},
		{ idempotencyKey: `dd-approval/${input.approvalId}` },
	);
	if (error) throw new Error(`approval email failed: ${error.message}`);
}
