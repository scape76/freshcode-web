import Landing from './index.html';
import AdminPanel from './admin.html';
import LoginPage from './login.html';

import nodemailer from 'nodemailer';
import { db } from './db';
import './seed';
import { file } from 'bun';


const emailConfig = {
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
};

const transporter = nodemailer.createTransport(emailConfig);

type Admin = {
    id: number;
    username: string;
    password: string;
};

Bun.serve({
  static: {
    "/": Landing,
    "/login": LoginPage
  },
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/") {
      return new Response(Landing, {
        headers: { "Content-Type": "text/html" },
      });
    }

    if (url.pathname === "/login") {
      return new Response(Bun.file("login.html"), {
        headers: { "Content-Type": "text/html" },
      });
    }

    if (url.pathname === "/api/login") {
      return handlers.handleLogin(req);
    }

    if (url.pathname === "/admin") {
      if (!handlers.checkAuth(req)) {
        return new Response(null, {
          status: 302,
          headers: { "Location": "/login" }
        });
      }

      return new Response(file('./admin.html'));
    }

    switch (url.pathname) {
      case "/api/contact":
        if (req.method === "POST") {
          return handlers.handleSubscribe(req);
        }
        break;

      case "/api/subscribers":
        if (req.method === "GET") {
          return handlers.handleGetSubscribers();
        }
        break;

      case (url.pathname.match(/^\/api\/subscribers\/\d+$/)?.input):
        if (req.method === "DELETE") {
          return handlers.handleDeleteSubscriber(req);
        }
      break;

      case "/api/send-mass-email":
        if (req.method === "POST") {
          return handlers.handleMassEmail(req);
        }
        break;
    }

    return handlers.handleNotFound();
  }
})

const handlers = {
  handleSubscribe: async (req: Request) => {
    try {
      const { email, message } = await req.json();

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return new Response(JSON.stringify({ error: "Invalid email" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const insert = db.prepare(
       "INSERT INTO contacts (email, message) VALUES (?, ?)"
      );

      insert.run(email, message);

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: "Failed to process request" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  },

  handleGetSubscribers: () => {
    try {
      const subscribers = db.prepare("SELECT * FROM contacts ORDER BY created_at DESC").all();

      return new Response(JSON.stringify(subscribers), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch subscribers" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  },

  handleDeleteSubscriber: async (req: Request) => {
    try {
        const id = req.url.split('/').pop();

        if (!id) {
            return new Response(JSON.stringify({ error: "Invalid ID" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        const deleteStmt = db.prepare("DELETE FROM contacts WHERE id = ?");
        deleteStmt.run(id);

        return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        return new Response(
            JSON.stringify({ error: "Failed to delete subscriber" }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
  },

  handleMassEmail: async (req: Request) => {
    try {
      const { subject, content } = await req.json();

      if (!subject || !content) {
        return new Response(JSON.stringify({ error: "Subject and content are required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const subscribers = db.prepare("SELECT email FROM contacts").all() as { email: string }[];
      const emails = subscribers.map(sub => sub.email);

      if (emails.length === 0) {
        return new Response(JSON.stringify({ error: "No subscribers found" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      await transporter.sendMail({
        from: emailConfig.auth.user,
        bcc: emails,
        subject: subject,
        text: content,
        html: content.replace(/\n/g, '<br>')
      });

      return new Response(JSON.stringify({
        success: true,
        recipientCount: emails.length
      }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error('Email sending error:', error);
      return new Response(
        JSON.stringify({ error: "Failed to send emails" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  },

  handleLogin: async (req: Request) => {
    try {
      const { username, password } = await req.json();

      if (!username || !password) {
        return new Response(JSON.stringify({ error: "Username and password are required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const admin = db.prepare("SELECT * FROM admins WHERE username = ?").get(username) as Admin | undefined;

      if (!admin || admin.password !== password) {
        return new Response(JSON.stringify({ error: "Invalid credentials" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const sessionToken = Math.random().toString(36).substring(2);

      return new Response(JSON.stringify({ success: true }), {
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": `session=${sessionToken}; Path=/; HttpOnly`
        },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: "Login failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  checkAuth: (req: Request) => {
    const cookie = req.headers.get('cookie');
    if (!cookie?.includes('session=')) {
      return false;
    }
    return true;
  },

  handleNotFound: () => {
    return new Response("Not Found", { status: 404 });
  },

};

console.log("Server running at http://localhost:3000");