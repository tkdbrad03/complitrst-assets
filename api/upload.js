import { put } from "@vercel/blob";

export const config = {
  api: { bodyParser: false }
};

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const contentType = req.headers["content-type"] || "";
    if (!contentType.includes("multipart/form-data")) {
      return res.status(400).json({ error: "Expected multipart/form-data" });
    }

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    const match = contentType.match(/boundary=(.+)$/);
    if (!match) return res.status(400).json({ error: "Missing boundary" });
    const boundary = `--${match[1]}`;

    const parts = buffer.toString("binary").split(boundary);
    const filePart = parts.find(p => p.includes('name="file"') && p.includes("Content-Type:"));
    if (!filePart) return res.status(400).json({ error: "No file field found (name must be 'file')" });

    const headerEnd = filePart.indexOf("\r\n\r\n");
    const headerText = filePart.slice(0, headerEnd);
    const bodyBinary = filePart.slice(headerEnd + 4).replace(/\r\n$/, "");

    const filenameMatch = headerText.match(/filename="([^"]+)"/);
    const originalName = filenameMatch ? filenameMatch[1] : "upload.jpg";

    const mimeMatch = headerText.match(/Content-Type:\s*([^\r\n]+)/i);
    const mime = mimeMatch ? mimeMatch[1].trim() : "application/octet-stream";

    const fileBuffer = Buffer.from(bodyBinary, "binary");

    const ext = originalName.includes(".") ? originalName.split(".").pop() : "jpg";
    const key = `cookbook/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

    const blob = await put(key, fileBuffer, {
      access: "public",
      contentType: mime
    });

    return res.status(200).json({ url: blob.url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Upload failed" });
  }
}
