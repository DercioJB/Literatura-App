import express from "express";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";
import cookieParser from "cookie-parser";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(cookieParser());

  // Helper to build the redirect URI dynamically
  const getRedirectUri = (req: express.Request) => {
    // We use the Host header. In Cloud Run, req.headers.host is the exact domain.
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const protocol = req.headers["x-forwarded-proto"] || "https"; // Force https in prod
    // Strip trailing slash if present
    const cleanHost = (host as string).replace(/\/$/, "");
    return `${protocol}://${cleanHost}/auth/callback`;
  };

  app.get("/api/auth/url", (req, res) => {
    try {
      const redirectUri = getRedirectUri(req);
      
      const client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        redirectUri
      );

      const url = client.generateAuthUrl({
        access_type: "offline",
        scope: ["https://www.googleapis.com/auth/drive.file", "profile", "email"],
      });

      res.json({ url });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to generate auth url" });
    }
  });

  app.get(["/auth/callback", "/auth/callback/"], async (req, res) => {
    try {
      const { code } = req.query;
      const redirectUri = getRedirectUri(req);
      
      const client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        redirectUri
      );

      const { tokens } = await client.getToken(code as string);
      
      // Store tokens securely in an HTTP-only cookie
      res.cookie("drive_tokens", JSON.stringify(tokens), {
        secure: true,
        sameSite: "none",
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error("OAuth callback error:", error);
      res.status(500).send(`A autenticação falhou. Detalhes do erro: ${error.message || JSON.stringify(error)}`);
    }
  });

  app.get("/api/auth/status", (req, res) => {
    const tokens = req.cookies.drive_tokens;
    if (tokens) {
      res.json({ isAuthenticated: true });
    } else {
      res.json({ isAuthenticated: false });
    }
  });

  // Logout handler
  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("drive_tokens", { secure: true, sameSite: "none", httpOnly: true });
    res.json({ success: true });
  });

  const getDriveClient = (req: express.Request) => {
    const tokensStr = req.cookies.drive_tokens;
    if (!tokensStr) throw new Error("Not authenticated");
    
    // Check if variables are defined
    if(!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        throw new Error("Missing OAuth configured variables");
    }

    const tokens = JSON.parse(tokensStr);
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    client.setCredentials(tokens);
    return google.drive({ version: "v3", auth: client });
  };

  const FILENAME = "estoque_distribuicao_data.json";

  app.get("/api/drive/pull", async (req, res) => {
    try {
      const drive = getDriveClient(req);
      
      // Look for the file
      const searchRes = await drive.files.list({
        q: `name='${FILENAME}' and trashed=false`, // and 'root' in parents
        spaces: 'drive',
        fields: 'files(id, name)'
      });

      const files = searchRes.data.files;
      if (!files || files.length === 0) {
        // File doesn't exist yet, return null so frontend creates default later
        return res.json({ data: null });
      }

      const fileId = files[0].id!;

      // Get file content
      const contentRes = await drive.files.get({
        fileId: fileId,
        alt: 'media'
      });

      res.json({ data: contentRes.data, fileId });
    } catch (error: any) {
      console.error("Drive pull error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/drive/push", async (req, res) => {
    try {
      const { data } = req.body;
      const drive = getDriveClient(req);

      // Look for the file
      const searchRes = await drive.files.list({
        q: `name='${FILENAME}' and trashed=false`,
        spaces: 'drive',
        fields: 'files(id, name)'
      });

      const files = searchRes.data.files;
      const media = {
        mimeType: 'application/json',
        body: JSON.stringify(data)
      };

      if (!files || files.length === 0) {
        // Create new file
        await drive.files.create({
          requestBody: {
            name: FILENAME,
            mimeType: 'application/json',
          },
          media: media,
          fields: 'id'
        });
        res.json({ success: true, message: "File created" });
      } else {
        // Update existing
        const fileId = files[0].id!;
        await drive.files.update({
          fileId: fileId,
          media: media
        });
        res.json({ success: true, message: "File updated" });
      }
    } catch (error: any) {
      console.error("Drive push error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve static files
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
