import { put } from "@vercel/blob";

export const config = {
  api: {
    bodyParser: false, // required for file uploads
  },
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

    // Parse multipart form data (minimal implementation using Web APIs available in Vercel runtime)
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    // Extract boundary
    const match = contentType.match(/boundary=(.+)$/);
    if (!match) return res.status(400).json({ error: "Missing boundary" });
    const boundary = `--${match[1]}`;

    // Split parts
    const parts = buffer.toString("binary").split(boundary);
    const filePart = parts.find(p => p.includes('name="file"') && p.includes("Content-Type:"));

    if (!filePart) {
      return res.status(400).json({ error: "No file field found (name must be 'file')" });
    }

    // Parse headers/body
    const headerEnd = filePart.indexOf("\r\n\r\n");
    const headerText = filePart.slice(0, headerEnd);
    const bodyBinary = filePart.slice(headerEnd + 4);

    // Remove trailing CRLF
    const cleanedBodyBinary = bodyBinary.replace(/\r\n$/, "");

    // Filename
    const filenameMatch = headerText.match(/filename="([^"]+)"/);
    const originalName = filenameMatch ? filenameMatch[1] : "upload.jpg";

    // Content type
    const mimeMatch = headerText.match(/Content-Type:\s*([^\r\n]+)/i);
    const mime = mimeMatch ? mimeMatch[1].trim() : "application/octet-stream";

    // Convert to Buffer
    const fileBuffer = Buffer.from(cleanedBodyBinary, "binary");

    // Create a safe unique name
    const ext = originalName.includes(".") ? originalName.split(".").pop() : "jpg";
    const key = `cookbook/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

    // Upload to Vercel Blob (public by default when using put with access: 'public')
    const blob = await put(key, fileBuffer, {
      access: "public",
      contentType: mime,
    });

    return res.status(200).json({ url: blob.url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Upload failed" });
  }
}
