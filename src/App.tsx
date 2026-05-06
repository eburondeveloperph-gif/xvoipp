import { useEffect, useMemo, useState, useRef, type FormEvent } from 'react';
import { auth, rtdb, handleDatabaseError, OperationType } from './firebase';
import {
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  User,
  signOut,
  browserPopupRedirectResolver,
} from 'firebase/auth';
import {
  ref,
  get,
  set,
  push,
  onValue,
  query,
  orderByChild,
  limitToLast,
  serverTimestamp,
  update,
} from 'firebase/database';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import { AudioRecorder, AudioStreamer } from './lib/audio';
import { BASE_LIVE_AGENT_PROMPT, BIBLE_PERSONALITY } from './lib/personality';
import {
  Loader2,
  Power,
  Check,
  Menu,
  Mic,
  MicOff,
  Video,
  VideoOff,
  X,
  Save,
  Camera,
  LogOut,
  Paperclip,
  Upload,
  Download,
  UserRound,
  Bot,
  Mail,
  LockKeyhole,
  Eye,
  EyeOff,
  FileText,
  Send,
  ExternalLink,
  Code2,
  Database,
  Trash2
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  fileName?: string;
  fileType?: string;
  fileDataUrl?: string;
  toolName?: string;
  toolResult?: any;
  downloadData?: string;
  downloadFilename?: string;
  htmlPreviewData?: string;
  htmlPreviewFilename?: string;
}

interface ActionTask {
  id: string;
  serviceName: string;
  action: string;
  status: 'processing' | 'completed' | 'failed';
  result?: string;
  downloadData?: string;
  downloadFilename?: string;
  htmlPreviewData?: string;
  htmlPreviewFilename?: string;
}

interface AgentSettings {
  userName: string;
  agentName: string;
  personality: string;
  avatarUrl: string;
  selectedVoice: string;
  knowledgeBase: string;
}

const LIVE_MODEL = 'gemini-3.1-flash-live-preview';
const EBURON_LOGO_URL = 'https://eburon.ai/icon-eburon.svg';
const PRODUCT_BRAND = 'VEP';
const PRODUCT_FULL_NAME = 'Virtual Employee Persona';

const GEMINI_LIVE_VOICE_OPTIONS =[
  { alias: 'Superman', id: 'Charon', vibe: 'deep, steady, grounded' },
  { alias: 'Wonder Woman', id: 'Kore', vibe: 'clear, composed, warm' },
  { alias: 'Batman', id: 'Fenrir', vibe: 'dark, firm, serious' },
  { alias: 'Iron Man', id: 'Puck', vibe: 'quick, bright, witty' },
  { alias: 'Athena', id: 'Aoede', vibe: 'elegant, smooth, intelligent' },
  { alias: 'Captain Marvel', id: 'Zephyr', vibe: 'bright, airy, confident' },
  { alias: 'Black Panther', id: 'Orus', vibe: 'royal, calm, precise' },
  { alias: 'Scarlet Witch', id: 'Leda', vibe: 'soft, mysterious, expressive' },
  { alias: 'Storm', id: 'Callirrhoe', vibe: 'flowing, strong, graceful' },
  { alias: 'Jean Grey', id: 'Autonoe', vibe: 'controlled, thoughtful, warm' },
  { alias: 'Thor', id: 'Enceladus', vibe: 'heavy, bold, powerful' },
  { alias: 'Hulk', id: 'Iapetus', vibe: 'large, grounded, blunt' },
  { alias: 'Nightwing', id: 'Umbriel', vibe: 'smooth, calm, agile' },
  { alias: 'Aquaman', id: 'Algieba', vibe: 'warm, confident, resonant' },
  { alias: 'Invisible Woman', id: 'Despina', vibe: 'soft, measured, discreet' },
  { alias: 'Black Widow', id: 'Erinome', vibe: 'low, calm, controlled' },
  { alias: 'Green Lantern', id: 'Algenib', vibe: 'clean, heroic, direct' },
  { alias: 'Doctor Strange', id: 'Rasalgethi', vibe: 'wise, textured, deliberate' },
  { alias: 'Supergirl', id: 'Laomedeia', vibe: 'clear, bright, friendly' },
  { alias: 'Raven', id: 'Achernar', vibe: 'cool, quiet, focused' },
  { alias: 'Cyclops', id: 'Alnilam', vibe: 'clean, direct, precise' },
  { alias: 'Catwoman', id: 'Schedar', vibe: 'smooth, calm, sly' },
  { alias: 'Wolverine', id: 'Gacrux', vibe: 'rough, grounded, blunt' },
  { alias: 'Flash', id: 'Pulcherrima', vibe: 'bright, quick, energetic' },
  { alias: 'Robin', id: 'Achird', vibe: 'young, clear, responsive' },
  { alias: 'Daredevil', id: 'Zubenelgenubi', vibe: 'balanced, sharp, steady' },
  { alias: 'Green Arrow', id: 'Vindemiatrix', vibe: 'dry, focused, confident' },
  { alias: 'Cyborg', id: 'Sadachbia', vibe: 'clean, technical, controlled' },
  { alias: 'Martian Manhunter', id: 'Sadaltager', vibe: 'deep, calm, observant' },
  { alias: 'Silver Surfer', id: 'Sulafat', vibe: 'smooth, distant, reflective' },
];

const DEFAULT_AGENT_PERSONALITY = `
VEP means Virtual Employee Persona.
VEP is the product brand.
Beatrice is the default virtual employee persona.

Default working relationship:
- User: Jo Lernout
- Preferred respectful address: Meneer Jo
- Persona: Beatrice
- Default role: Boss Jo Lernout's private office secretary and trusted executive aide

Scene:
Beatrice is already present inside Meneer Jo's office.
She is not arriving.
She is not a chatbot.
She is working nearby, available, attentive, and ready when Jo speaks.

Tone:
- normal human office employee
- formal enough for a boss
- calm
- respectful
- warm but not sentimental
- focused
- practical
- quietly capable
- discreet
- never robotic
- never customer support
- never over-helpful

Language:
- Start in English by default.
- Beatrice speaks Dutch Flemish in a normal, local office style.
- Beatrice can switch to almost any language when the user does.
- If Jo speaks Dutch or Flemish Dutch, respond in a normal Dutch/Flemish style.
- Keep the relationship respectful and professional.

Good response style:
"Yes, I'm here, Meneer Jo."
"I'm listening, Meneer Jo."
"Right, I see what you mean."
"Okay... I'll look at that now."
"Yes, I'm checking it."
"Of course, Meneer Jo."

Avoid:
"How can I help you?"
"I'd be happy to assist."
"Certainly."
"As an AI."
"Let me know if you need anything else."
`;

const DEFAULT_SETTINGS: AgentSettings = {
  userName: 'Jo Lernout',
  agentName: 'Beatrice',
  personality: DEFAULT_AGENT_PERSONALITY,
  avatarUrl: '',
  selectedVoice: 'Kore',
  knowledgeBase: '',
};

const GOOGLE_SERVICE_TOOLS =[
  {
    name: 'read_knowledge_base',
    description: 'Read the contents of the user\'s uploaded custom Knowledge Base documents. Use this when the user asks about their custom data, projects, study notes, or business context.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'What you are looking for in the knowledge base.' }
      },
      required: ['query']
    }
  },
  {
    name: 'maps_search_places',
    description: 'Search for places, businesses, or addresses using Google Maps Places API.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Search query e.g. "coffee shops in Baguio" or "hardware store nearby"' }
      },
      required: ['query']
    }
  },
  {
    name: 'maps_get_directions',
    description: 'Get route directions, distance, and ETA between two locations.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        origin: { type: Type.STRING, description: 'Starting location.' },
        destination: { type: Type.STRING, description: 'Target destination.' }
      },
      required: ['origin', 'destination']
    }
  },
  {
    name: 'get_air_quality',
    description: 'Get current air quality index (AQI) for a specific latitude and longitude.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        location_latitude: { type: Type.NUMBER },
        location_longitude: { type: Type.NUMBER }
      },
      required: ['location_latitude', 'location_longitude']
    }
  },
  {
    name: 'create_meeting_minutes',
    description: 'Generate stunning HTML meeting minutes. Use this especially after analyzing a meeting transcript.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        meetingTitle: { type: Type.STRING },
        date: { type: Type.STRING },
        attendees: { type: Type.STRING, description: 'Comma separated list of attendees.' },
        summary: { type: Type.STRING, description: 'Executive summary of the meeting.' },
        decisions: { type: Type.STRING, description: 'HTML formatted list of decisions made.' },
        actionItems: { type: Type.STRING, description: 'HTML formatted list of action items.' },
        emailTo: { type: Type.STRING, description: 'Optional email address.' }
      },
      required: ['meetingTitle', 'summary']
    }
  },
  {
    name: 'create_invoice_document',
    description: 'Generate a professional HTML invoice with auto-calculations. Save to drive and optionally email.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        invoiceNumber: { type: Type.STRING },
        clientName: { type: Type.STRING },
        date: { type: Type.STRING },
        items: { type: Type.STRING, description: 'JSON array of objects with description, quantity, price. E.g.[{"description":"Consulting", "quantity":2, "price":150}]' },
        taxRate: { type: Type.NUMBER, description: 'Tax percentage, e.g. 5 for 5%.' },
        emailTo: { type: Type.STRING }
      },
      required: ['clientName', 'items']
    }
  },
  {
    name: 'generate_data_dashboard',
    description: 'Generate a standalone interactive HTML data dashboard using Chart.js.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        chartType: { type: Type.STRING, description: 'bar, line, or pie' },
        labels: { type: Type.STRING, description: 'Comma separated labels, e.g. Jan,Feb,Mar' },
        datasets: { type: Type.STRING, description: 'JSON array of datasets, e.g.[{"label":"Sales", "data":[10,20,30]}]' }
      },
      required:['title', 'labels', 'datasets']
    }
  },
  {
    name: 'generate_project_gantt_chart',
    description: 'Generate a standalone HTML project timeline using Mermaid.js.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        tasks: { type: Type.STRING, description: 'Mermaid gantt syntax lines. E.g. "Section 1\\nTask A :a1, 2023-01-01, 30d\\nTask B :after a1, 20d"' }
      },
      required: ['title', 'tasks']
    }
  },
  {
    name: 'render_web_artifact',
    description: 'Create and render any complete one-file HTML/CSS/JS artifact: animated slides, Three.js showcases, forms, landing pages, calculators, documents, prototypes, demos. The frontend saves it to chat as downloadable HTML.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Artifact title.' },
        artifactType: {
          type: Type.STRING,
          description: 'Type of artifact: slides, form, landing_page, threejs_showcase, calculator, demo, prototype, other.',
        },
        suggestedFilename: {
          type: Type.STRING,
          description: 'Suggested filename ending in .html, for example animated-threejs-slides.html.',
        },
        summary: {
          type: Type.STRING,
          description: 'Short normal human summary of what was created.',
        },
        html: {
          type: Type.STRING,
          description: 'Complete standalone HTML file. Must include DOCTYPE, html, head, style, body, and script if needed. Must be directly openable in browser.',
        },
        saveToDrive: { type: Type.BOOLEAN, description: 'If true, upload the HTML artifact to the user drive.' },
        emailTo: { type: Type.STRING, description: 'Optional email address to send the HTML artifact to. Use current_user if requested.' },
      },
      required:['title', 'html'],
    },
  },
  {
    name: 'gmail_read',
    description: 'Read or search the user mail inbox. Use when the user asks about mail, inbox, unread messages, senders, email content, or recent mail.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Mail search query, sender, subject, or keyword.' },
        limit: { type: Type.NUMBER, description: 'Maximum number of messages to fetch.' },
      },
      required:[],
    },
  },
  {
    name: 'gmail_send',
    description: 'Send an email from the user account.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        to: { type: Type.STRING, description: 'Recipient email address or comma-separated recipients.' },
        subject: { type: Type.STRING, description: 'Email subject.' },
        body: { type: Type.STRING, description: 'Email body.' },
        cc: { type: Type.STRING, description: 'Optional CC recipients.' },
        bcc: { type: Type.STRING, description: 'Optional BCC recipients.' },
      },
      required:['to', 'subject', 'body'],
    },
  },
  {
    name: 'gmail_draft',
    description: 'Create a draft email for review.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        to: { type: Type.STRING, description: 'Recipient email address.' },
        subject: { type: Type.STRING, description: 'Draft subject.' },
        body: { type: Type.STRING, description: 'Draft body.' },
        cc: { type: Type.STRING, description: 'Optional CC recipients.' },
        bcc: { type: Type.STRING, description: 'Optional BCC recipients.' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'calendar_check_schedule',
    description: 'Check schedule, availability, conflicts, or upcoming events in the user calendar.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        date: { type: Type.STRING, description: 'Date to check, ISO format if possible.' },
        timeMin: { type: Type.STRING, description: 'Optional start datetime.' },
        timeMax: { type: Type.STRING, description: 'Optional end datetime.' },
      },
      required:[],
    },
  },
  {
    name: 'calendar_create_event',
    description: 'Create a calendar event.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Event title.' },
        startTime: { type: Type.STRING, description: 'Start datetime in ISO 8601 format.' },
        endTime: { type: Type.STRING, description: 'End datetime in ISO 8601 format.' },
        attendees: { type: Type.STRING, description: 'Comma-separated attendee emails.' },
        location: { type: Type.STRING, description: 'Optional location.' },
        description: { type: Type.STRING, description: 'Optional description.' },
        addMeet: { type: Type.BOOLEAN, description: 'Whether to add a video meeting link.' },
      },
      required:['title', 'startTime', 'endTime'],
    },
  },
  {
    name: 'calendar_update_event',
    description: 'Update or reschedule an existing calendar event.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        eventId: { type: Type.STRING, description: 'Calendar event id if known.' },
        searchQuery: { type: Type.STRING, description: 'Event title or search phrase if id is unknown.' },
        newStartTime: { type: Type.STRING, description: 'New start datetime.' },
        newEndTime: { type: Type.STRING, description: 'New end datetime.' },
        title: { type: Type.STRING, description: 'New event title.' },
        location: { type: Type.STRING, description: 'New event location.' },
        description: { type: Type.STRING, description: 'New event description.' },
      },
      required:[],
    },
  },
  {
    name: 'drive_search',
    description: 'Search files, folders, documents, spreadsheets, presentations, PDFs, or uploaded content in the user drive.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Search query or filename.' },
        fileType: { type: Type.STRING, description: 'Optional file type filter.' },
        limit: { type: Type.NUMBER, description: 'Maximum number of results.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'drive_read_file',
    description: 'Read or export a file from the user drive when file id or name is known.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        fileId: { type: Type.STRING, description: 'File id if available.' },
        fileName: { type: Type.STRING, description: 'File name or search term if id is unknown.' },
        exportMimeType: { type: Type.STRING, description: 'Optional export MIME type, e.g. application/pdf or text/plain.' },
      },
      required:[],
    },
  },
  {
    name: 'drive_upload_file',
    description: 'Upload or save a file into the user drive.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        fileName: { type: Type.STRING, description: 'File name.' },
        content: { type: Type.STRING, description: 'Text content to upload.' },
        mimeType: { type: Type.STRING, description: 'File MIME type.' },
        folderId: { type: Type.STRING, description: 'Optional folder id.' },
      },
      required: ['fileName', 'content'],
    },
  },
  {
    name: 'tasks_list',
    description: 'List user tasks or to-dos.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        listId: { type: Type.STRING, description: 'Optional task list id, defaults to @default.' },
      },
      required:[],
    },
  },
  {
    name: 'tasks_create',
    description: 'Create a task or to-do.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Task title.' },
        notes: { type: Type.STRING, description: 'Optional notes.' },
        due: { type: Type.STRING, description: 'Optional due date in ISO format.' },
      },
      required: ['title'],
    },
  },
  {
    name: 'workspace_search',
    description: 'Search across connected workspace data, including mail, files, documents, tasks, calendar, and contacts.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Search query.' },
        sources: { type: Type.STRING, description: 'Comma-separated sources to search.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'create_contract_document',
    description:
      'Create a STUNNING HTML contract document, save it as a file in the user drive, optionally email it, and return a downloadable visually rich template in chat.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Contract title.' },
        contractType: { type: Type.STRING, description: 'Type of contract, e.g. Service Agreement, NDA, Employment Agreement.' },
        partyA: { type: Type.STRING, description: 'First party name.' },
        partyB: { type: Type.STRING, description: 'Second party name.' },
        effectiveDate: { type: Type.STRING, description: 'Effective date.' },
        jurisdiction: { type: Type.STRING, description: 'Governing law or jurisdiction.' },
        terms: { type: Type.STRING, description: 'Important terms, scope, payment, obligations, duration, termination, confidentiality, etc.' },
        emailTo: { type: Type.STRING, description: 'Optional email address to send the stunning HTML contract to. Use current_user if requested.' },
      },
      required: ['title', 'contractType', 'partyA', 'partyB', 'terms'],
    },
  },
];

function safeJsonStringify(value: any) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function makeDownloadFile(result: any, filenameBase: string, mime = 'application/json') {
  const body = mime === 'application/json' ? safeJsonStringify(result) : String(result);
  const data = `data:${mime};charset=utf-8,${encodeURIComponent(body)}`;
  const safe = filenameBase.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tool-result';

  return {
    downloadData: data,
    downloadFilename: `${safe}-${Date.now()}${mime === 'application/json' ? '.json' : '.txt'}`,
  };
}

function normalizeHtml(html: string) {
  const trimmed = String(html || '').trim();

  if (!trimmed) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Generated Artifact</title>
<style>
body{font-family:Arial,sans-serif;background:#111;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0}
.card{max-width:720px;padding:32px;border:1px solid rgba(255,255,255,.15);border-radius:24px;background:rgba(255,255,255,.06)}
</style>
</head>
<body>
<div class="card">
<h1>Empty Artifact</h1>
<p>No HTML was provided.</p>
</div>
</body>
</html>`;
  }

  if (trimmed.toLowerCase().startsWith('<!doctype html')) return trimmed;

  if (trimmed.toLowerCase().startsWith('<html')) {
    return `<!DOCTYPE html>\n${trimmed}`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Generated Artifact</title>
</head>
<body>
${trimmed}
</body>
</html>`;
}

function makeHtmlArtifactFile(html: string, filenameBase: string) {
  const safe =
    String(filenameBase || 'artifact')
      .toLowerCase()
      .replace(/\.html$/i, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'artifact';

  const finalHtml = normalizeHtml(html);
  const data = `data:text/html;charset=utf-8,${encodeURIComponent(finalHtml)}`;

  return {
    html: finalHtml,
    htmlPreviewData: data,
    htmlPreviewFilename: `${safe}.html`,
    downloadData: data,
    downloadFilename: `${safe}.html`,
  };
}

function makeBlobDownloadData(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64UrlEncode(value: string) {
  return btoa(unescape(encodeURIComponent(value)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function buildEmailRaw({
  to,
  subject,
  body,
  cc,
  bcc,
  attachment,
}: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  attachment?: {
    filename: string;
    mimeType: string;
    base64Content: string;
  };
}) {
  const headers =[
    `To: ${to}`,
    cc ? `Cc: ${cc}` : '',
    bcc ? `Bcc: ${bcc}` : '',
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
  ].filter(Boolean);

  if (!attachment) {
    const raw =[
      ...headers,
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      body,
    ].join('\r\n');

    return base64UrlEncode(raw);
  }

  const boundary = `boundary_${Date.now()}`;

  const raw =[
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    body,
    '',
    `--${boundary}`,
    `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${attachment.filename}"`,
    '',
    attachment.base64Content,
    '',
    `--${boundary}--`,
  ].join('\r\n');

  return base64UrlEncode(raw);
}

function readableDateRange(date?: string, timeMin?: string, timeMax?: string) {
  const now = new Date();

  if (timeMin && timeMax) {
    return { timeMin, timeMax };
  }

  const target = date ? new Date(date) : now;
  const start = new Date(target);
  start.setHours(0, 0, 0, 0);

  const end = new Date(target);
  end.setHours(23, 59, 59, 999);

  return {
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
  };
}

// -------------------------------------------------------------
// HTML DOCUMENT GENERATORS (NON-AI TEMPLATES)
// -------------------------------------------------------------

function buildMeetingMinutesHtml(args: any) {
  const today = new Date().toLocaleDateString();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #f8fafc; color: #1e293b; line-height: 1.6; padding: 2rem; margin: 0; }
  .doc { max-width: 800px; margin: 0 auto; background: white; padding: 4rem; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border-top: 6px solid #3b82f6; border-radius: 8px; }
  h1 { font-size: 2.5rem; margin-bottom: 0.5rem; color: #0f172a; text-transform: uppercase; letter-spacing: 1px; }
  .meta { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 1rem; margin-bottom: 2rem; color: #64748b; }
  h2 { font-size: 1.4rem; color: #3b82f6; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; margin-top: 2.5rem; }
  ul { padding-left: 1.5rem; }
  li { margin-bottom: 0.5rem; }
  .highlight-box { background: #f1f5f9; padding: 1.5rem; border-radius: 6px; margin-top: 1rem; }
  @media print { body { padding: 0; background: white; } .doc { box-shadow: none; padding: 0; border-top: 4px solid #000; } }
</style>
</head>
<body>
  <div class="doc">
    <h1>Meeting Minutes</h1>
    <div class="meta">
      <div><strong>Subject:</strong> ${args.meetingTitle || 'General Sync'}</div>
      <div><strong>Date:</strong> ${args.date || today}</div>
    </div>
    <div style="margin-bottom: 2rem;"><strong>Attendees:</strong> ${args.attendees || 'N/A'}</div>
    
    <h2>Executive Summary</h2>
    <div class="highlight-box">
      <p style="margin:0;">${args.summary || 'No summary provided.'}</p>
    </div>
    
    <h2>Key Decisions</h2>
    ${args.decisions || '<p>None recorded.</p>'}
    
    <h2>Action Items</h2>
    ${args.actionItems || '<p>None recorded.</p>'}
  </div>
  <script>
    window.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'p') { e.preventDefault(); window.print(); } });
  </script>
</body>
</html>`;
}

function buildInvoiceHtml(args: any) {
  const today = new Date().toLocaleDateString();
  let itemsHtml = '';
  let subtotal = 0;
  
  let parsedItems =[];
  try {
    parsedItems = typeof args.items === 'string' ? JSON.parse(args.items) : args.items;
  } catch (e) {
    // ignore
  }

  if (!Array.isArray(parsedItems)) parsedItems =[];
  
  parsedItems.forEach((item: any) => {
    const qty = parseFloat(item.quantity || 1);
    const price = parseFloat(item.price || 0);
    const total = qty * price;
    subtotal += total;
    itemsHtml += `<tr>
      <td style="padding:1rem; border-bottom:1px solid #e2e8f0;">${item.description || 'Item'}</td>
      <td style="padding:1rem; border-bottom:1px solid #e2e8f0; text-align:center;">${qty}</td>
      <td style="padding:1rem; border-bottom:1px solid #e2e8f0; text-align:right;">$${price.toFixed(2)}</td>
      <td style="padding:1rem; border-bottom:1px solid #e2e8f0; text-align:right; font-weight:bold;">$${total.toFixed(2)}</td>
    </tr>`;
  });

  const taxRate = parseFloat(args.taxRate || 0);
  const taxAmount = subtotal * (taxRate / 100);
  const grandTotal = subtotal + taxAmount;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #f8fafc; color: #1e293b; padding: 2rem; margin: 0; }
  .doc { max-width: 800px; margin: 0 auto; background: white; padding: 4rem; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border-radius: 8px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 3rem; }
  h1 { font-size: 3rem; margin: 0; color: #0f172a; text-transform: uppercase; letter-spacing: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 2rem; }
  th { background: #f1f5f9; padding: 1rem; text-align: left; text-transform: uppercase; font-size: 0.85rem; color: #64748b; }
  .totals { width: 50%; float: right; margin-top: 2rem; background: #f8fafc; padding: 1.5rem; border-radius: 8px; }
  .totals table { margin-top: 0; }
  .clearfix::after { content: ""; clear: both; display: table; }
  @media print { body { padding: 0; background: white; } .doc { box-shadow: none; padding: 0; } }
</style>
</head>
<body>
  <div class="doc clearfix">
    <div class="header">
      <div>
        <h1>INVOICE</h1>
        <div style="color: #64748b; margin-top: 0.5rem; font-size: 1.1rem;"># ${args.invoiceNumber || Math.floor(Math.random() * 10000)}</div>
      </div>
      <div style="text-align: right; line-height: 1.6;">
        <strong style="color: #0f172a;">Billed To:</strong><br>
        <span style="font-size: 1.1rem;">${args.clientName || 'Valued Client'}</span><br>
        <div style="margin-top: 1rem;"><strong>Date:</strong> ${args.date || today}</div>
      </div>
    </div>
    
    <table>
      <thead>
        <tr><th>Description</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Price</th><th style="text-align:right;">Total</th></tr>
      </thead>
      <tbody>
        ${itemsHtml || '<tr><td colspan="4" style="text-align:center; padding:1rem;">No items</td></tr>'}
      </tbody>
    </table>
    
    <div class="totals">
      <table>
        <tr><td style="padding:0.5rem; color: #64748b;">Subtotal</td><td style="text-align:right;">$${subtotal.toFixed(2)}</td></tr>
        <tr><td style="padding:0.5rem; color: #64748b;">Tax (${taxRate}%)</td><td style="text-align:right;">$${taxAmount.toFixed(2)}</td></tr>
        <tr><td style="padding:1rem 0.5rem; font-size:1.4rem; font-weight:bold; color: #0f172a; border-top:2px solid #cbd5e1;">Total</td><td style="text-align:right; font-size:1.4rem; font-weight:bold; color: #0f172a; border-top:2px solid #cbd5e1;">$${grandTotal.toFixed(2)}</td></tr>
      </table>
    </div>
  </div>
  <script>
    window.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'p') { e.preventDefault(); window.print(); } });
  </script>
</body>
</html>`;
}

function buildDashboardHtml(args: any) {
  let labels = [];
  let datasets =[];
  try {
    labels = typeof args.labels === 'string' ? args.labels.split(',') : args.labels;
  } catch (e) {}

  try {
    datasets = typeof args.datasets === 'string' ? JSON.parse(args.datasets) : args.datasets;
  } catch (e) {}
  
  return `<!DOCTYPE html>
<html>
<head>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: 'Inter', sans-serif; background: #0f172a; padding: 2rem; display: flex; justify-content: center; margin: 0; min-height: 100vh; align-items: center; }
  .card { background: white; padding: 3rem; border-radius: 16px; width: 100%; max-width: 900px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
  h2 { text-align: center; color: #1e293b; margin-top: 0; margin-bottom: 2rem; font-size: 2rem; }
</style>
</head>
<body>
  <div class="card">
    <h2>${args.title || 'Data Dashboard'}</h2>
    <canvas id="myChart"></canvas>
  </div>
  <script>
    new Chart(document.getElementById('myChart'), {
      type: '${args.chartType || 'bar'}',
      data: {
        labels: ${JSON.stringify(labels && labels.length ? labels : ['A','B','C'])},
        datasets: ${JSON.stringify(datasets && datasets.length ? datasets : [{label: 'Data', data:[1,2,3]}])}
      },
      options: { responsive: true, plugins: { legend: { position: 'top' } } }
    });
  </script>
</body>
</html>`;
}

function buildGanttHtml(args: any) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: 'Inter', sans-serif; background: #0f172a; padding: 2rem; display: flex; justify-content: center; margin: 0; min-height: 100vh; align-items: center; }
  .card { background: white; padding: 3rem; border-radius: 16px; width: 100%; max-width: 1000px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); overflow-x: auto; }
  h2 { color: #1e293b; margin-top: 0; margin-bottom: 2rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 1rem; font-size: 2rem; }
</style>
</head>
<body>
  <div class="card">
    <h2>${args.title || 'Project Timeline'}</h2>
    <div class="mermaid">
gantt
    title ${args.title || 'Timeline'}
    dateFormat  YYYY-MM-DD
    ${args.tasks || 'Section\\nTask 1 :a1, 2023-01-01, 30d'}
    </div>
  </div>
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
    mermaid.initialize({ startOnLoad: true, theme: 'base', themeVariables: { primaryColor: '#3b82f6', primaryTextColor: '#fff', primaryBorderColor: '#2563eb', lineType: 'curve' } });
  </script>
</body>
</html>`;
}

function buildStunningHtmlContract({
  title,
  contractType,
  partyA,
  partyB,
  effectiveDate,
  jurisdiction,
  terms,
}: any) {
  const today = new Date().toLocaleDateString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title || 'Contract Agreement'}</title>
<style>
  :root { --primary: #1a1a1a; --secondary: #4a4a4a; --accent: #2c5282; --bg: #f8fafc; --paper: #ffffff; --border: #e2e8f0; }
  body { font-family: 'Georgia', serif; background-color: var(--bg); color: var(--primary); line-height: 1.6; padding: 2rem; margin: 0; display: flex; justify-content: center; }
  .document { background: var(--paper); width: 100%; max-width: 800px; padding: 4rem; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border-top: 8px solid var(--accent); }
  .header { text-align: center; margin-bottom: 3rem; border-bottom: 2px solid var(--border); padding-bottom: 2rem; }
  .title { font-size: 2.2rem; font-weight: normal; color: var(--primary); margin: 0 0 1rem 0; text-transform: uppercase; letter-spacing: 2px; }
  .subtitle { font-size: 1.2rem; color: var(--secondary); font-style: italic; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 3rem; background: #f1f5f9; padding: 1.5rem; border-radius: 4px; }
  .meta-item strong { display: block; font-size: 0.85rem; text-transform: uppercase; color: var(--secondary); letter-spacing: 1px; margin-bottom: 0.25rem; }
  .section { margin-bottom: 2.5rem; }
  .section h2 { font-size: 1.4rem; color: var(--accent); border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; margin-bottom: 1.5rem; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; margin-top: 5rem; }
  .signature-block { border-top: 1px solid var(--primary); padding-top: 1rem; }
  .signature-block strong { display: block; margin-bottom: 0.5rem; }
  @media print { body { background: white; padding: 0; } .document { box-shadow: none; max-width: 100%; padding: 0; border-top: 4px solid #000; } }
</style>
</head>
<body>
  <div class="document">
    <div class="header">
      <h1 class="title">${title || 'Contract Agreement'}</h1>
      <div class="subtitle">${contractType || 'Legal Agreement'}</div>
    </div>
    <div class="meta-grid">
      <div class="meta-item"><strong>Effective Date</strong><div>${effectiveDate || today}</div></div>
      <div class="meta-item"><strong>Jurisdiction</strong><div>${jurisdiction || 'Applicable Jurisdiction'}</div></div>
      <div class="meta-item"><strong>Party A</strong><div>${partyA || 'First Party'}</div></div>
      <div class="meta-item"><strong>Party B</strong><div>${partyB || 'Second Party'}</div></div>
    </div>
    <div class="section">
      <h2>1. Purpose & Scope</h2>
      <p>This Agreement sets out the terms and conditions under which the parties agree to work together. The specific scope of this Agreement includes the following:</p>
      <div style="background:#f8fafc; padding:1.5rem; border-left:4px solid var(--accent); margin-top:1rem;">
        ${(terms || 'The parties will define the scope in writing.').replace(/\n/g, '<br>')}
      </div>
    </div>
    <div class="section"><h2>2. Responsibilities & Obligations</h2><p>Each party agrees to act in good faith, perform its obligations with reasonable care, and communicate promptly regarding any material issue that may affect performance.</p></div>
    <div class="section"><h2>3. Payment & Consideration</h2><p>Any payment, fees, or consideration shall be handled according to the terms specifically agreed by the parties in writing or outlined in attached exhibits.</p></div>
    <div class="section"><h2>4. Confidentiality & Intellectual Property</h2><p>Each party agrees to keep confidential information private and not disclose it to third parties except where required by law or agreed in writing. Unless otherwise agreed, each party retains ownership of its pre-existing intellectual property.</p></div>
    <div class="section"><h2>5. Term & Termination</h2><p>This Agreement begins on the Effective Date and continues until completed, terminated by mutual agreement, or terminated according to written terms agreed by the parties.</p></div>
    <div class="section"><h2>6. Governing Law</h2><p>This Agreement shall be governed by and construed in accordance with the laws of ${jurisdiction || 'the applicable jurisdiction'}. Any disputes arising under this agreement will be resolved in the appropriate courts of this jurisdiction.</p></div>
    <div class="signatures">
      <div class="signature-block"><strong>${partyA || 'Party A'}</strong><div style="color:#666; font-size:0.9rem; margin-top:0.5rem;">Signature</div><div style="margin-top:2.5rem; border-bottom:1px solid #ccc; width:85%;"></div><div style="color:#666; font-size:0.9rem; margin-top:0.5rem;">Date</div></div>
      <div class="signature-block"><strong>${partyB || 'Party B'}</strong><div style="color:#666; font-size:0.9rem; margin-top:0.5rem;">Signature</div><div style="margin-top:2.5rem; border-bottom:1px solid #ccc; width:85%;"></div><div style="color:#666; font-size:0.9rem; margin-top:0.5rem;">Date</div></div>
    </div>
  </div>
  <script>window.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'p') { e.preventDefault(); window.print(); } });</script>
</body>
</html>`;
}

// -------------------------------------------------------------
// UI COMPONENTS
// -------------------------------------------------------------

function OneLineStreamingTranscript({
  text,
  role,
  name,
}: {
  text: string;
  role: 'user' | 'model';
  name: string;
}) {
  return (
    <motion.div
      key={`${role}-${text}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.12 }}
      className="w-full overflow-hidden px-4"
      style={{ fontFamily: 'Roboto, system-ui, sans-serif' }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-3 overflow-hidden whitespace-nowrap rounded-full border border-lime-300/15 bg-black/35 px-5 py-3 shadow-2xl backdrop-blur-2xl">
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[0.22em] ${
            role === 'user'
              ? 'border border-sky-400/20 bg-sky-500/10 text-sky-300'
              : 'border border-lime-300/25 bg-lime-400/10 text-lime-300'
          }`}
        >
          {role === 'user' ? 'You' : name}
        </span>

        <div className="min-w-0 flex-1 overflow-hidden">
          <p
            className={`truncate text-left text-lg font-medium leading-none tracking-tight md:text-2xl ${
              role === 'user' ? 'text-sky-100' : 'text-lime-50'
            }`}
          >
            {text}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function LimeVoiceOrb({
  isActive,
  isAgentSpeaking,
  speakerLevel,
  speakerBands,
}: {
  isActive: boolean;
  isAgentSpeaking: boolean;
  speakerLevel: number;
  speakerBands: number[];
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const levelRef = useRef(0);
  const bandsRef = useRef<number[]>(Array(20).fill(0));
  const activeRef = useRef(false);
  const speakingRef = useRef(false);

  useEffect(() => {
    levelRef.current = speakerLevel;
    bandsRef.current = speakerBands;
    activeRef.current = isActive;
    speakingRef.current = isAgentSpeaking;
  }, [isActive, isAgentSpeaking, speakerBands, speakerLevel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let frame = 0;
    let raf = 0;
    let displayLevel = 0;

    const fitCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return {
        width: width / dpr,
        height: height / dpr,
      };
    };

    const makeOrbPath = (cx: number, cy: number, radius: number, pulse: number, time: number) => {
      const path = new Path2D();
      const points: Array<{ x: number; y: number }> =[];
      const bands = bandsRef.current.length ? bandsRef.current : Array(20).fill(0);
      const live = activeRef.current && speakingRef.current;
      const count = 112;

      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const band = bands[i % bands.length] || 0;
        const surface =
          Math.sin(angle * 2.1 + time * 0.95) * (live ? 2.5 : 0.9) +
          Math.sin(angle * 3.7 - time * 0.68) * (live ? 1.7 : 0.55) +
          band * (live ? 8.5 : 1.8);
        const r = radius + pulse * 8 + surface;

        points.push({
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r,
        });
      }

      points.forEach((point, index) => {
        const next = points[(index + 1) % points.length];
        const midX = (point.x + next.x) / 2;
        const midY = (point.y + next.y) / 2;

        if (index === 0) {
          path.moveTo(midX, midY);
        } else {
          path.quadraticCurveTo(point.x, point.y, midX, midY);
        }
      });

      path.closePath();
      return path;
    };

    const drawGlow = (cx: number, cy: number, radius: number, inner: string, outer: string) => {
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, inner);
      gradient.addColorStop(1, outer);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    };

    const draw = () => {
      const { width, height } = fitCanvas();
      const cx = width / 2;
      const cy = height / 2;
      const time = frame / 60;
      const rawLevel = activeRef.current ? Math.max(levelRef.current, speakingRef.current ? 0.035 : 0) : 0;
      displayLevel += (rawLevel - displayLevel) * 0.16;
      const bands = bandsRef.current.length ? bandsRef.current : Array(20).fill(0);
      const bandEnergy = bands.reduce((sum, band) => sum + band, 0) / Math.max(bands.length, 1);
      const pulse = Math.min(1, Math.max(displayLevel, bandEnergy * 1.25));
      const live = activeRef.current && speakingRef.current;
      const baseRadius = 93;

      ctx.clearRect(0, 0, width, height);

      ctx.save();
      ctx.globalAlpha = activeRef.current ? 0.42 + pulse * 0.28 : 0.24;
      ctx.filter = 'blur(34px)';
      drawGlow(cx, cy, 118 + pulse * 22, 'rgba(190,242,100,0.42)', 'rgba(22,101,52,0)');
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = activeRef.current ? 0.24 + pulse * 0.26 : 0.12;
      ctx.strokeStyle = 'rgba(190,242,100,0.34)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 116 + pulse * 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      const orbPath = makeOrbPath(cx, cy, baseRadius, pulse, time);

      ctx.save();
      ctx.shadowColor = 'rgba(190,242,100,0.38)';
      ctx.shadowBlur = 38 + pulse * 28;
      const bodyGradient = ctx.createRadialGradient(cx - 38, cy - 48, 8, cx, cy, 126);
      bodyGradient.addColorStop(0, 'rgba(236,252,203,0.76)');
      bodyGradient.addColorStop(0.27, 'rgba(163,230,53,0.58)');
      bodyGradient.addColorStop(0.58, 'rgba(34,197,94,0.46)');
      bodyGradient.addColorStop(1, 'rgba(5,46,22,0.96)');
      ctx.fillStyle = bodyGradient;
      ctx.fill(orbPath);
      ctx.restore();

      ctx.save();
      ctx.clip(orbPath);
      ctx.globalCompositeOperation = 'screen';
      drawGlow(
        cx - 38 + Math.sin(time * 0.7) * 12,
        cy - 34 + Math.cos(time * 0.55) * 10,
        78 + pulse * 12,
        'rgba(236,252,203,0.52)',
        'rgba(236,252,203,0)'
      );
      drawGlow(
        cx + 40 + Math.cos(time * 0.62) * 14,
        cy + 24 + Math.sin(time * 0.75) * 12,
        90 + pulse * 18,
        'rgba(16,185,129,0.44)',
        'rgba(16,185,129,0)'
      );
      drawGlow(
        cx - 6 + Math.sin(time * 0.5) * 18,
        cy + 34 + Math.cos(time * 0.46) * 10,
        98,
        'rgba(132,204,22,0.22)',
        'rgba(132,204,22,0)'
      );
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = `rgba(217,249,157,${0.16 + pulse * 0.26})`;
      ctx.lineWidth = 1.4;
      ctx.stroke(orbPath);
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = live ? 0.14 + pulse * 0.18 : 0.06;
      ctx.fillStyle = 'rgba(255,255,255,0.58)';
      ctx.beginPath();
      ctx.ellipse(cx - 36, cy - 46, 24 + pulse * 6, 11 + pulse * 3, -0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      frame += 1;
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  },[]);

  return (
    <div className="relative flex h-72 w-72 items-center justify-center">
      <canvas ref={canvasRef} className="h-full w-full" aria-hidden="true" />
    </div>
  );
}

function StartIconMicVisualizer({
  isActive,
  connecting,
  isMuted,
  micLevel,
  micBands,
  onClick,
}: {
  isActive: boolean;
  connecting: boolean;
  isMuted: boolean;
  micLevel: number;
  micBands?: number[];
  onClick: () => void;
}) {
  const innerBands = micBands?.length
    ? micBands.slice(5, 14)
    :[0.35, 0.5, 0.72, 0.9, 1, 0.82, 0.64, 0.46, 0.32].map(n => n * micLevel);

  return (
    <button
      onClick={onClick}
      disabled={connecting}
      aria-label={isActive ? 'Stop voice session' : 'Start voice session'}
      className="group relative flex h-20 w-20 items-center justify-center"
    >
      <motion.div
        animate={{
          opacity: isActive ? 0.16 + micLevel * 0.3 : 0.08,
        }}
        transition={{ duration: 0.045 }}
        className={`absolute inset-0 rounded-full ${
          isMuted ? 'bg-red-500/20' : 'bg-lime-300/30'
        }`}
      />

      <div
        className={`relative flex h-20 w-20 items-center justify-center rounded-full border bg-[#0A0A0B] shadow-2xl transition-all ${
          isActive
            ? isMuted
              ? 'border-red-500/35'
              : 'border-lime-300/60'
            : 'border-white/10 group-hover:border-lime-300/50'
        }`}
      >
        {connecting ? (
          <Loader2 className="h-7 w-7 animate-spin text-lime-300" />
        ) : isActive ? (
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-full">
            <div className="flex h-12 items-center gap-1">
              {innerBands.map((band, i) => {
                const liveBand = isMuted ? 0 : Math.max(band, micLevel * 0.4);

                return (
                  <motion.div
                    key={i}
                    animate={{
                      height: Math.max(5, liveBand * 42),
                      opacity: isMuted ? 0.2 : Math.max(0.32, liveBand + 0.18),
                    }}
                    transition={{ duration: 0.035 }}
                    className={`w-1 rounded-full ${
                      isMuted
                        ? 'bg-red-500'
                        : 'bg-lime-300 shadow-[0_0_10px_rgba(190,242,100,0.75)]'
                    }`}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <Power className="h-8 w-8 text-lime-300 transition-colors" />
        )}
      </div>
    </button>
  );
}

// -------------------------------------------------------------
// DEDICATED MEETING RECORDER OVERLAY (100% FULL SCREEN)
// -------------------------------------------------------------
function MeetingRecorderModal({
  onClose,
  onProcess,
}: {
  onClose: () => void;
  onProcess: (transcript: string) => Promise<void>;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [duration, setDuration] = useState(0);
  const[transcript, setTranscript] = useState('');
  
  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef(false);
  const transcriptRef = useRef('');

  const[micLevel, setMicLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    isRecordingRef.current = isRecording;
    if (isRecording) {
      const timer = setInterval(() => setDuration(d => d + 1), 1000);
      return () => clearInterval(timer);
    }
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateLevel = () => {
        if (!isRecordingRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setMicLevel(avg / 255);
        animationRef.current = requestAnimationFrame(updateLevel);
      };
      
      updateLevel();

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        
        recognitionRef.current.onresult = (event: any) => {
          let interimText = '';
          let finalText = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) finalText += event.results[i][0].transcript + ' ';
            else interimText += event.results[i][0].transcript;
          }
          if (finalText) transcriptRef.current += finalText;
          setTranscript(transcriptRef.current + interimText);
        };

        recognitionRef.current.onend = () => {
          if (isRecordingRef.current) {
             try { 
               recognitionRef.current.start(); 
             } catch(e) {}
          }
        };

        recognitionRef.current.start();
      }
      setIsRecording(true);
    } catch(err) {
      console.error(err);
      alert("Microphone access is required to record the meeting.");
    }
  };

  const stopRecordingAndProcess = async () => {
    setIsRecording(false);
    setIsProcessing(true);
    
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (audioContextRef.current) audioContextRef.current.close();
    try { 
      recognitionRef.current?.stop(); 
    } catch(e) {}

    await onProcess(transcriptRef.current);
    onClose();
  };

  const handleCancel = () => {
    setIsRecording(false);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (audioContextRef.current) audioContextRef.current.close();
    try { 
      recognitionRef.current?.stop(); 
    } catch(e) {}
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-[#050505] p-6 sm:p-12 items-center justify-center">
      <div className="w-full h-full flex flex-col max-w-5xl items-center justify-center">
        {isProcessing ? (
           <div className="flex flex-col items-center py-20 text-center">
             <Loader2 className="w-16 h-16 text-lime-300 animate-spin mb-8" />
             <h3 className="text-3xl font-bold text-white mb-4">Analyzing Meeting...</h3>
             <p className="text-zinc-500 text-lg max-w-lg">
               Beatrice is reviewing the transcript, generating formal minutes, and extracting tasks to update your schedule.
             </p>
           </div>
        ) : (
           <>
             <div className="flex justify-between items-center w-full mb-12">
               <h2 className="text-2xl font-bold text-white uppercase tracking-widest">Meeting Recorder</h2>
               <button onClick={handleCancel} className="text-zinc-500 hover:text-white transition">
                 <X className="w-8 h-8" />
               </button>
             </div>
             
             <div className="flex-1 flex flex-col justify-center items-center w-full">
               <div className="relative flex items-center justify-center w-48 h-48 mb-10">
                 {isRecording && (
                   <motion.div
                     animate={{ scale: [1, 1 + micLevel * 0.6, 1], opacity:[0.3, 0.7, 0.3] }}
                     transition={{ duration: 0.1, repeat: Infinity }}
                     className="absolute inset-0 bg-lime-300/30 rounded-full blur-2xl"
                   />
                 )}
                 <button
                   onClick={isRecording ? stopRecordingAndProcess : startRecording}
                   className={`relative z-10 w-32 h-32 rounded-full flex items-center justify-center transition-all ${
                     isRecording 
                       ? 'bg-red-500 hover:bg-red-600 shadow-[0_0_40px_rgba(239,68,68,0.6)]' 
                       : 'bg-lime-300 hover:bg-lime-400 text-black shadow-[0_0_40px_rgba(190,242,100,0.4)]'
                   }`}
                 >
                   {isRecording ? <div className="w-10 h-10 bg-white rounded-sm" /> : <Mic className="w-14 h-14" />}
                 </button>
               </div>

               <div className="text-6xl font-mono text-white mb-10 tracking-widest drop-shadow-lg">
                 {String(Math.floor(duration / 60)).padStart(2, '0')}:{String(duration % 60).padStart(2, '0')}
               </div>

               <div className="w-full bg-black/50 rounded-2xl p-6 h-64 overflow-y-auto border border-white/10 mb-10 shadow-inner">
                 <p className="text-lg text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap">
                   {transcript || (isRecording ? "Listening to the meeting..." : "Click the microphone to start recording.")}
                 </p>
               </div>

               <div className="flex gap-6 w-full max-w-2xl">
                  <button onClick={handleCancel} className="flex-1 py-4 rounded-full border border-white/10 text-zinc-400 font-bold uppercase tracking-widest hover:bg-white/5 transition">
                    Cancel
                  </button>
                  {isRecording && (
                    <button onClick={stopRecordingAndProcess} className="flex-1 py-4 rounded-full bg-lime-300 text-black font-bold uppercase tracking-widest hover:bg-lime-400 transition shadow-[0_0_30px_rgba(190,242,100,0.3)]">
                      Process Meeting
                    </button>
                  )}
               </div>
             </div>
           </>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// MAIN APP ENTRY
// -------------------------------------------------------------

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AgentSettings>(DEFAULT_SETTINGS);
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const[authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState<{ type: 'error' | 'success' | 'info'; text: string } | null>(null);
  const[showAuthPassword, setShowAuthPassword] = useState(false);
  const [showAuthConfirmPassword, setShowAuthConfirmPassword] = useState(false);

  useEffect(() => {
    const fontId = 'beatrice-roboto-font';
    if (!document.getElementById(fontId)) {
      const link = document.createElement('link');
      link.id = fontId; 
      link.rel = 'stylesheet'; 
      link.href = 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap';
      document.head.appendChild(link);
    }
  },[]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      
      if (u) {
        try {
          const userRef = ref(rtdb, 'users/' + u.uid);
          const userSnap = await get(userRef);
          const providerIds = u.providerData.map(provider => provider.providerId);
          const authProvider = providerIds.includes('google.com') ? 'google' : 'email';
          const hasGoogleServices = authProvider === 'google' && Boolean(localStorage.getItem('googleAccessToken'));

          if (!userSnap.exists()) {
            const initialSettings = { 
              ...DEFAULT_SETTINGS, 
              userName: u.displayName || DEFAULT_SETTINGS.userName 
            };
            
            await set(userRef, { 
              displayName: initialSettings.userName, 
              email: u.email || '', 
              authProvider, 
              googleServicesConnected: hasGoogleServices, 
              createdAt: serverTimestamp(), 
              updatedAt: serverTimestamp(), 
              settings: initialSettings 
            });
            
            setSettings(initialSettings);
          } else {
            const data = userSnap.val();
            
            if (data.settings) {
              setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
            }
            
            await update(userRef, { 
              email: u.email || data.email || '', 
              authProvider, 
              googleServicesConnected: hasGoogleServices, 
              updatedAt: serverTimestamp() 
            });
          }
        } catch (error) { 
          handleDatabaseError(error, OperationType.CREATE, 'users'); 
        }
      }
      
      setLoading(false);
    });
    
    return () => unsub();
  },[]);

  const getAuthErrorMessage = (error: any) => {
    const code = String(error?.code || '');
    
    if (code.includes('auth/email-already-in-use')) return 'That email is already registered. Sign in instead.';
    if (code.includes('auth/invalid-email')) return 'Enter a valid email address.';
    if (code.includes('auth/user-not-found') || code.includes('auth/wrong-password') || code.includes('auth/invalid-credential')) return 'Email or password is incorrect.';
    if (code.includes('auth/weak-password')) return 'Use at least 6 characters for the password.';
    if (code.includes('auth/too-many-requests')) return 'Too many attempts. Wait a moment and try again.';
    if (code.includes('auth/popup-closed-by-user')) return 'The Google sign-in window was closed.';
    
    return error?.message || 'Authentication failed. Try again.';
  };

  const handleGoogleLogin = async () => {
    setAuthBusy(true); 
    setAuthMessage(null);
    
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ 
        prompt: 'consent select_account', 
        access_type: 'offline' 
      });
      
      provider.addScope('https://www.googleapis.com/auth/gmail.modify'); 
      provider.addScope('https://www.googleapis.com/auth/gmail.send'); 
      provider.addScope('https://www.googleapis.com/auth/gmail.compose');
      provider.addScope('https://www.googleapis.com/auth/drive'); 
      provider.addScope('https://www.googleapis.com/auth/documents'); 
      provider.addScope('https://www.googleapis.com/auth/spreadsheets');
      provider.addScope('https://www.googleapis.com/auth/presentations'); 
      provider.addScope('https://www.googleapis.com/auth/youtube'); 
      provider.addScope('https://www.googleapis.com/auth/calendar');
      provider.addScope('https://www.googleapis.com/auth/tasks'); 
      provider.addScope('https://www.googleapis.com/auth/contacts.readonly'); 
      provider.addScope('https://www.googleapis.com/auth/forms.body');
      provider.addScope('https://www.googleapis.com/auth/chat.messages'); 
      provider.addScope('https://www.googleapis.com/auth/analytics.readonly');
      
      const result = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      
      if (credential?.accessToken) {
        localStorage.setItem('googleAccessToken', credential.accessToken);
      }
    } catch (error: any) {
      if (error && error.message && error.message.includes('missing initial state')) {
        setAuthMessage({ 
          type: 'error', 
          text: "Authentication failed due to browser privacy settings. Open the app in a new tab and try again." 
        });
      } else {
        setAuthMessage({ 
          type: 'error', 
          text: getAuthErrorMessage(error) 
        });
      }
    } finally { 
      setAuthBusy(false); 
    }
  };

  const handleEmailAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); 
    setAuthBusy(true); 
    setAuthMessage(null);
    
    const email = authEmail.trim(); 
    const password = authPassword.trim(); 
    const fullName = authName.trim();
    
    try {
      if (!email) {
        throw new Error('Enter your email address.');
      }
      
      if (authMode === 'reset') { 
        await sendPasswordResetEmail(auth, email); 
        setAuthMessage({ type: 'success', text: 'Password reset email sent. Check your inbox.' }); 
        setAuthMode('signin'); 
        return; 
      }
      
      if (!password) {
        throw new Error('Enter your password.');
      }
      
      if (authMode === 'signup') {
        if (!fullName) throw new Error('Enter your full name.');
        if (password.length < 6) throw new Error('Use at least 6 characters for the password.');
        if (password !== authConfirmPassword.trim()) throw new Error('Passwords do not match.');
        
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, { displayName: fullName });
        localStorage.removeItem('googleAccessToken');
        return;
      }
      
      await signInWithEmailAndPassword(auth, email, password); 
      localStorage.removeItem('googleAccessToken');
    } catch (error: any) { 
      setAuthMessage({ type: 'error', text: getAuthErrorMessage(error) }); 
    } finally { 
      setAuthBusy(false); 
    }
  };

  const handleLogout = () => { 
    localStorage.removeItem('googleAccessToken'); 
    signOut(auth); 
  };

  if (loading) {
    return ( 
      <div className="flex min-h-screen items-center justify-center bg-[#020203] text-zinc-500">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="animate-pulse text-[10px] uppercase tracking-widest">Preparing VEP...</p>
        </div>
      </div> 
    );
  }

  if (!user) {
    const isSignUp = authMode === 'signup'; 
    const isReset = authMode === 'reset';
    const authTitle = isSignUp ? 'Register' : isReset ? 'Reset password' : 'Welcome';
    const authSubtitle = isSignUp ? 'Create your new account' : isReset ? 'Send a reset link to your email' : 'Login to your account';

    return (
      <div className="relative min-h-[100dvh] overflow-hidden bg-[#050505] text-white" style={{ fontFamily: 'Roboto, system-ui, sans-serif' }}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(190,242,100,0.13),transparent_34%),linear-gradient(180deg,#050505,#020302)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.14) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.14) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <motion.main 
          key={authMode} 
          initial={{ opacity: 0, y: 12 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.2, ease: 'easeOut' }} 
          className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col px-6 pb-[max(22px,env(safe-area-inset-bottom))] pt-[max(28px,env(safe-area-inset-top))]"
        >
          <section className="flex flex-1 flex-col justify-center py-10">
            <div className="mb-9 flex flex-col items-center text-center">
              <img src={EBURON_LOGO_URL} alt="Eburon" className="mb-8 h-24 w-24 rounded-full object-cover shadow-[0_0_70px_rgba(190,242,100,0.16)]" />
              <h1 className="text-[44px] font-bold leading-none tracking-[-0.05em] text-white">{authTitle}</h1>
              <p className="mt-2 text-sm text-zinc-500">{authSubtitle}</p>
            </div>
            
            <form onSubmit={handleEmailAuth} className="space-y-3">
              {isSignUp && ( 
                <label className="flex h-14 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 focus-within:border-lime-300/40">
                  <UserRound className="h-4 w-4 shrink-0 text-zinc-500" />
                  <input 
                    value={authName} 
                    onChange={(e) => setAuthName(e.target.value)} 
                    placeholder="Full name" 
                    autoComplete="name" 
                    className="min-w-0 flex-1 bg-transparent text-sm font-medium text-white outline-none placeholder:text-zinc-600" 
                  />
                </label> 
              )}
              
              <label className="flex h-14 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 focus-within:border-lime-300/40">
                <Mail className="h-4 w-4 shrink-0 text-zinc-500" />
                <input 
                  value={authEmail} 
                  onChange={(e) => setAuthEmail(e.target.value)} 
                  type="email" 
                  placeholder="Email" 
                  autoComplete="email" 
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium text-white outline-none placeholder:text-zinc-600" 
                />
              </label>
              
              {!isReset && ( 
                <label className="flex h-14 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 focus-within:border-lime-300/40">
                  <LockKeyhole className="h-4 w-4 shrink-0 text-zinc-500" />
                  <input 
                    value={authPassword} 
                    onChange={(e) => setAuthPassword(e.target.value)} 
                    type={showAuthPassword ? 'text' : 'password'} 
                    placeholder="Password" 
                    autoComplete={isSignUp ? 'new-password' : 'current-password'} 
                    className="min-w-0 flex-1 bg-transparent text-sm font-medium text-white outline-none placeholder:text-zinc-600" 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowAuthPassword(v => !v)} 
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
                  >
                    {showAuthPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  {!isSignUp && ( 
                    <button 
                      type="button" 
                      onClick={() => { setAuthMode('reset'); setAuthMessage(null); }} 
                      className="text-xs font-bold text-lime-200"
                    >
                      Forgot?
                    </button> 
                  )}
                </label> 
              )}
              
              {isSignUp && ( 
                <label className="flex h-14 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 focus-within:border-lime-300/40">
                  <LockKeyhole className="h-4 w-4 shrink-0 text-zinc-500" />
                  <input 
                    value={authConfirmPassword} 
                    onChange={(e) => setAuthConfirmPassword(e.target.value)} 
                    type={showAuthConfirmPassword ? 'text' : 'password'} 
                    placeholder="Confirm password" 
                    autoComplete="new-password" 
                    className="min-w-0 flex-1 bg-transparent text-sm font-medium text-white outline-none placeholder:text-zinc-600" 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowAuthConfirmPassword(v => !v)} 
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
                  >
                    {showAuthConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </label> 
              )}
              
              {authMessage && ( 
                <div 
                  className={`rounded-2xl px-4 py-3 text-xs leading-5 ${
                    authMessage.type === 'error' 
                      ? 'border border-red-400/20 bg-red-500/10 text-red-200' 
                      : authMessage.type === 'success' 
                        ? 'border border-lime-300/20 bg-lime-300/10 text-lime-100' 
                        : 'border border-white/10 bg-white/[0.06] text-zinc-300'
                  }`}
                >
                  {authMessage.text}
                </div> 
              )}
              
              <button 
                type="submit" 
                disabled={authBusy} 
                className="mt-7 flex h-14 w-full items-center justify-center rounded-full bg-lime-300 text-sm font-bold text-black shadow-[0_18px_48px_rgba(190,242,100,0.18)] transition active:scale-[0.985] disabled:opacity-60"
              >
                {authBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : isReset ? 'Send reset link' : isSignUp ? 'Sign up' : 'Sign in'}
              </button>
              
              {!isReset && ( 
                <>
                  <div className="flex items-center gap-3 py-1.5">
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="text-xs font-medium text-zinc-600">or</span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>
                  
                  <button 
                    type="button" 
                    onClick={handleGoogleLogin} 
                    disabled={authBusy} 
                    className="flex h-14 w-full items-center justify-center gap-3 rounded-full border border-white/10 bg-white/[0.06] px-5 text-sm font-bold text-zinc-100 transition hover:border-lime-300/30 hover:bg-lime-300/10 active:scale-[0.985] disabled:opacity-60"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-base font-black text-black">G</span>
                    Continue with Google
                  </button>
                </> 
              )}
            </form>
          </section>
          
          <footer className="text-center text-sm text-zinc-500">
            {isSignUp ? 'Back to ' : isReset ? 'Remembered it? ' : 'Create account? '}
            <button 
              type="button" 
              onClick={() => { setAuthMode(isSignUp || isReset ? 'signin' : 'signup'); setAuthMessage(null); }} 
              className="font-bold text-lime-200"
            >
              {isSignUp || isReset ? 'Sign in' : 'Sign up'}
            </button>
          </footer>
        </motion.main>
      </div>
    );
  }

  return <BeatriceAgent user={user} onLogout={handleLogout} initialSettings={settings} />;
}

// -------------------------------------------------------------
// CORE BEATRICE AGENT ENGINE
// -------------------------------------------------------------

function BeatriceAgent({ 
  user, 
  onLogout, 
  initialSettings 
}: { 
  user: User; 
  onLogout: () => void; 
  initialSettings: AgentSettings; 
}) {
  const [isActive, setIsActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const[micBands, setMicBands] = useState<number[]>(Array(20).fill(0));
  const[speakerLevel, setSpeakerLevel] = useState(0);
  const [speakerBands, setSpeakerBands] = useState<number[]>(Array(20).fill(0));
  const [tasks, setTasks] = useState<ActionTask[]>([]);
  const [historyContext, setHistoryContext] = useState<string>('');
  const[historyMsgs, setHistoryMsgs] = useState<ChatMessage[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState<{ role: 'user' | 'model'; text: string } | null>(null);

  const[isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [showSidebar, setShowSidebar] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showMeetingRecorder, setShowMeetingRecorder] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [settings, setSettings] = useState<AgentSettings>({ ...DEFAULT_SETTINGS, ...initialSettings });

  const aiRef = useRef<GoogleGenAI | null>(null);
  const sessionRef = useRef<any>(null);
  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const recognitionRef = useRef<any>(null);

  const transcriptTimeoutRef = useRef<any>(null);
  const isMutedRef = useRef(false);
  const isActiveRef = useRef(false);
  const micAnimationFrameRef = useRef<number | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoIntervalRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const knowledgeBaseInputRef = useRef<HTMLInputElement | null>(null);

  const modelTranscriptBufferRef = useRef('');
  const userTranscriptBufferRef = useRef('');
  const lastSavedModelTranscriptRef = useRef('');
  const lastSavedUserTranscriptRef = useRef('');

  useEffect(() => { 
    isMutedRef.current = isMuted; 
  }, [isMuted]);
  
  useEffect(() => { 
    isActiveRef.current = isActive; 
  }, [isActive]);

  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => { 
      try { 
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen'); 
        }
      } catch (err) {} 
    };
    
    if (isActive) {
      requestWakeLock();
    }
    
    return () => { 
      if (wakeLock) {
        wakeLock.release().catch(() => {}); 
      }
    };
  }, [isActive]);

  useEffect(() => {
    const historyRef = query(ref(rtdb, 'users/' + user.uid + '/messages'), orderByChild('timestamp'), limitToLast(160));
    
    const unsub = onValue(historyRef, (snap) => {
      const msgs: string[] =[]; 
      const rawMsgs: ChatMessage[] =[];
      
      snap.forEach(child => { 
        const m = child.val() as ChatMessage; 
        msgs.push(`${m.role.toUpperCase()}: ${m.text}`); 
        rawMsgs.push(m); 
      });
      
      setHistoryMsgs(rawMsgs);
      
      if (msgs.length > 0) {
        setHistoryContext('Previous conversation for context memory:\n' + msgs.slice(-36).join('\n'));
      } else {
        setHistoryContext('');
      }
    });
    
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (apiKey) {
      aiRef.current = new GoogleGenAI({ apiKey });
    }
    
    audioStreamerRef.current = new AudioStreamer();
    
    return () => { 
      unsub(); 
      stopSession(); 
    };
  }, [user.uid]);

  const selectedVoiceMeta = useMemo(() => {
    return GEMINI_LIVE_VOICE_OPTIONS.find(v => v.id === settings.selectedVoice) || GEMINI_LIVE_VOICE_OPTIONS[0];
  },[settings.selectedVoice]);

  const saveMessage = (role: 'user' | 'model', text: string, extra?: Partial<ChatMessage>) => {
    const clean = text.trim(); 
    if (!clean && !extra?.fileDataUrl) return;
    
    try { 
      const msgRef = push(ref(rtdb, 'users/' + user.uid + '/messages')); 
      set(msgRef, { role, text: clean, timestamp: Date.now(), ...extra }); 
    } catch (e) { 
      console.error(e); 
    }
  };

  const saveModelBuffer = () => {
    const clean = modelTranscriptBufferRef.current.trim();
    if (!clean || clean === lastSavedModelTranscriptRef.current) return;
    
    lastSavedModelTranscriptRef.current = clean; 
    saveMessage('model', clean); 
    modelTranscriptBufferRef.current = '';
  };

  const saveUserBuffer = () => {
    const clean = userTranscriptBufferRef.current.trim();
    if (!clean || clean === lastSavedUserTranscriptRef.current) return;
    
    lastSavedUserTranscriptRef.current = clean; 
    saveMessage('user', clean); 
    userTranscriptBufferRef.current = '';
  };

  const updateLiveTranscript = (role: 'user' | 'model', text: string, clearDelay = 3900) => {
    const clean = text.trim(); 
    if (!clean) return;
    
    setCurrentTranscript({ role, text: clean });
    
    if (transcriptTimeoutRef.current) {
      clearTimeout(transcriptTimeoutRef.current);
    }
    
    transcriptTimeoutRef.current = setTimeout(() => { 
      setCurrentTranscript(null); 
    }, clearDelay);
  };

  const startMicVisualizer = () => {
    const tick = () => {
      const recorder: any = audioRecorderRef.current; 
      const streamer: any = audioStreamerRef.current;
      
      let nextLevel = 0; 
      let nextBands = Array(20).fill(0); 
      let nextSpeakerLevel = 0; 
      let nextSpeakerBands = Array(20).fill(0);
      
      try {
        if (recorder && typeof recorder.getFrequencyBands === 'function') {
          const bands = recorder.getFrequencyBands(20) ||[]; 
          nextBands = bands.map((n: number) => Math.min(1, Math.max(0, Number(n || 0))));
          const frequencyAverage = nextBands.reduce((sum: number, n: number) => sum + n, 0) / Math.max(nextBands.length, 1);
          const recorderLevel = typeof recorder.getLevel === 'function' ? recorder.getLevel() : 0;
          nextLevel = Math.min(1, Math.max(recorderLevel, frequencyAverage * 1.8));
        } else if (isActiveRef.current && !isMutedRef.current) { 
          nextLevel = 0.06; 
          nextBands = Array(20).fill(0.04); 
        }
      } catch (e) { 
        nextLevel = 0; 
        nextBands = Array(20).fill(0); 
      }
      
      try {
        if (streamer && typeof streamer.getFrequencyBands === 'function') {
          const bands = streamer.getFrequencyBands(20) ||[]; 
          nextSpeakerBands = bands.map((n: number) => Math.min(1, Math.max(0, Number(n || 0))));
          const frequencyAverage = nextSpeakerBands.reduce((sum: number, n: number) => sum + n, 0) / Math.max(nextSpeakerBands.length, 1);
          const streamerLevel = typeof streamer.getLevel === 'function' ? streamer.getLevel() : 0;
          nextSpeakerLevel = Math.min(1, Math.max(streamerLevel, frequencyAverage * 1.65));
        }
      } catch (e) { 
        nextSpeakerLevel = 0; 
        nextSpeakerBands = Array(20).fill(0); 
      }
      
      if (isMutedRef.current || !isActiveRef.current) { 
        nextLevel = 0; 
        nextBands = Array(20).fill(0); 
      }
      
      if (!isActiveRef.current) { 
        nextSpeakerLevel = 0; 
        nextSpeakerBands = Array(20).fill(0); 
      }
      
      setMicLevel(prev => prev + (nextLevel - prev) * 0.46); 
      setMicBands(prev => nextBands.map((band: number, i: number) => prev[i] + (band - prev[i]) * 0.42));
      
      setSpeakerLevel(prev => prev + (nextSpeakerLevel - prev) * 0.5); 
      setSpeakerBands(prev => nextSpeakerBands.map((band: number, i: number) => prev[i] + (band - prev[i]) * 0.48));
      
      micAnimationFrameRef.current = requestAnimationFrame(tick);
    };
    
    if (micAnimationFrameRef.current) {
      cancelAnimationFrame(micAnimationFrameRef.current);
    }
    
    micAnimationFrameRef.current = requestAnimationFrame(tick);
  };

  const stopMicVisualizer = () => {
    if (micAnimationFrameRef.current) {
      cancelAnimationFrame(micAnimationFrameRef.current);
    }
    micAnimationFrameRef.current = null; 
    setMicLevel(0); 
    setMicBands(Array(20).fill(0)); 
    setSpeakerLevel(0); 
    setSpeakerBands(Array(20).fill(0));
  };

  const sendTextToLive = (text: string) => { 
    if (sessionRef.current && typeof sessionRef.current.sendRealtimeInput === 'function') {
      sessionRef.current.sendRealtimeInput({ text }); 
    }
  };
  
  const sendAudioToLive = (base64: string) => { 
    if (sessionRef.current && typeof sessionRef.current.sendRealtimeInput === 'function') {
      sessionRef.current.sendRealtimeInput({ 
        audio: { data: base64, mimeType: 'audio/pcm;rate=16000' } 
      }); 
    }
  };
  
  const sendVideoToLive = (base64Data: string) => { 
    if (sessionRef.current && typeof sessionRef.current.sendRealtimeInput === 'function') {
      sessionRef.current.sendRealtimeInput({ 
        video: { data: base64Data, mimeType: 'image/jpeg' } 
      }); 
    }
  };

  const sendChatMessage = (e?: FormEvent) => {
    if (e) e.preventDefault();
    const clean = chatInput.trim(); 
    if (!clean) return;
    
    saveMessage('user', clean); 
    updateLiveTranscript('user', clean, 3200);
    
    if (sessionRef.current) {
      sendTextToLive(clean);
    } else { 
      const msg = `${settings.agentName} is not connected yet. Start the live session first.`; 
      updateLiveTranscript('model', msg, 3400); 
      saveMessage('model', msg); 
    }
    
    setChatInput('');
  };

  const googleFetch = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('googleAccessToken');
    if (!token) throw new Error('No access token. Reconnect permissions from Profile.');
    
    const res = await fetch(url, { 
      ...options, 
      headers: { 
        Authorization: `Bearer ${token}`, 
        ...(options.headers || {}) 
      } 
    });
    
    if (!res.ok) { 
      const text = await res.text().catch(() => ''); 
      throw new Error(`Service API error ${res.status}: ${text || res.statusText}`); 
    }
    
    return res;
  };

  const googleJson = async (url: string, options: RequestInit = {}) => {
    const res = await googleFetch(url, { 
      ...options, 
      headers: { 
        'Content-Type': 'application/json', 
        ...(options.headers || {}) 
      } 
    });
    return res.json();
  };

  const getCurrentUserEmail = () => user.email || '';

  const searchDriveFirst = async (q: string) => {
    const escaped = q.replace(/'/g, "\\'");
    const result = await googleJson(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name contains '${escaped}' and trashed = false`)}&fields=files(id,name,mimeType,webViewLink,webContentLink,modifiedTime)&pageSize=1`
    );
    return result.files?.[0] || null;
  };

  const createGoogleDoc = async (title: string, content: string) => {
    const doc = await googleJson('https://docs.googleapis.com/v1/documents', { 
      method: 'POST', 
      body: JSON.stringify({ title }) 
    });
    
    if (content?.trim()) {
      await googleJson(`https://docs.googleapis.com/v1/documents/${doc.documentId}:batchUpdate`, { 
        method: 'POST', 
        body: JSON.stringify({ 
          requests:[
            { 
              insertText: { 
                location: { index: 1 }, 
                text: content 
              } 
            }
          ] 
        }) 
      });
    }
    
    const file = await googleJson(`https://www.googleapis.com/drive/v3/files/${doc.documentId}?fields=id,name,mimeType,webViewLink`);
    
    return { ...doc, driveFile: file };
  };

  const exportDriveFile = async (fileId: string, mimeType: string) => {
    const res = await googleFetch(`https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(mimeType)}`);
    return res.blob();
  };

  const uploadTextFileToDrive = async (fileName: string, content: string, mimeType = 'text/plain', folderId?: string) => {
    const metadata: any = { name: fileName }; 
    if (folderId) metadata.parents =[folderId];
    
    const boundary = `boundary_${Date.now()}`;
    const multipartBody = 
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n` +
      `${content || ''}\r\n` +
      `--${boundary}--`;
      
    return googleFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink', { 
      method: 'POST', 
      headers: { 
        'Content-Type': `multipart/related; boundary=${boundary}` 
      }, 
      body: multipartBody 
    }).then(r => r.json());
  };

  const sendGmail = async ({ to, subject, body, cc, bcc, attachment }: any) => {
    const raw = buildEmailRaw({ to, subject, body, cc, bcc, attachment });
    return googleJson('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { 
      method: 'POST', 
      body: JSON.stringify({ raw }) 
    });
  };

  const executeGoogleTool = async (toolName: string, args: any) => {
    const executedAt = new Date().toISOString();

    const handleDocumentGeneration = async (html: string, defaultTitle: string) => {
        const title = args.title || args.meetingTitle || (args.invoiceNumber ? `Invoice ${args.invoiceNumber}` : defaultTitle);
        const htmlFile = makeHtmlArtifactFile(html, `${title}.html`);
        
        let driveFile: any = null; 
        let emailResult: any = null;
        const emailTo = args.emailTo === 'current_user' ? getCurrentUserEmail() : args.emailTo;
        
        if (args.saveToDrive) {
          driveFile = await uploadTextFileToDrive(htmlFile.htmlPreviewFilename, htmlFile.html, 'text/html');
        }

        if (emailTo) {
            emailResult = await sendGmail({
                to: emailTo, 
                subject: title, 
                body: `Attached is the generated document: ${title}. Please open the HTML file in your browser to view or print as PDF.`,
                attachment: { 
                  filename: htmlFile.htmlPreviewFilename, 
                  mimeType: 'text/html', 
                  base64Content: btoa(unescape(encodeURIComponent(htmlFile.html))) 
                },
            });
        }
        
        return { 
          toolName, 
          executedAt, 
          status: 'completed', 
          title, 
          driveLink: driveFile?.webViewLink, 
          emailSentTo: emailTo || null, 
          emailResult, 
          summary: `Generated and saved document: ${title}`, 
          ...htmlFile 
        };
    };

    try {
      switch (toolName) {
        case 'read_knowledge_base': {
          return { 
            toolName, 
            executedAt, 
            status: 'completed', 
            content: settings.knowledgeBase || "The knowledge base is currently empty. Tell the user to upload text files in their Office Profile settings." 
          };
        }

        case 'maps_search_places': {
          const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
          if (!apiKey) throw new Error("VITE_GOOGLE_API_KEY is missing. Add it to your environment variables to use Google Maps Platform.");
          
          const res = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(args.query)}&key=${apiKey}`);
          const data = await res.json();
          
          return { 
            toolName, 
            executedAt, 
            status: 'completed', 
            results: data.results?.slice(0, 5) ||[] 
          };
        }

        case 'maps_get_directions': {
          const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
          if (!apiKey) throw new Error("VITE_GOOGLE_API_KEY is missing. Add it to your environment variables to use Google Maps Platform.");
          
          const res = await fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(args.origin)}&destination=${encodeURIComponent(args.destination)}&key=${apiKey}`);
          const data = await res.json();
          
          if (!data.routes || data.routes.length === 0) throw new Error("No routes found between these locations.");
          
          return { 
            toolName, 
            executedAt, 
            status: 'completed', 
            routes: data.routes.map((r: any) => ({ 
              summary: r.summary, 
              distance: r.legs[0].distance.text, 
              duration: r.legs[0].duration.text, 
              stepsCount: r.legs[0].steps.length 
            })) 
          };
        }

        case 'get_air_quality': {
          const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
          if (!apiKey) throw new Error("VITE_GOOGLE_API_KEY is missing. Add it to your environment variables to use Google Maps Platform.");
          
          const res = await fetch(`https://airquality.googleapis.com/v1/currentConditions:lookup?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              location: {
                latitude: args.location_latitude,
                longitude: args.location_longitude
              }
            })
          });
          
          const data = await res.json();
          return { toolName, executedAt, status: 'completed', airQuality: data };
        }

        case 'create_invoice_document': 
          return await handleDocumentGeneration(buildInvoiceHtml(args), 'Invoice');
          
        case 'create_meeting_minutes': 
          return await handleDocumentGeneration(buildMeetingMinutesHtml(args), 'Meeting Minutes');
          
        case 'generate_data_dashboard': 
          return await handleDocumentGeneration(buildDashboardHtml(args), 'Data Dashboard');
          
        case 'generate_project_gantt_chart': 
          return await handleDocumentGeneration(buildGanttHtml(args), 'Project Timeline');
          
        case 'create_contract_document': 
          return await handleDocumentGeneration(buildStunningHtmlContract(args), `${args.contractType || 'Contract'} - ${args.partyA || 'Party A'} and ${args.partyB || 'Party B'}`);

        case 'render_web_artifact': {
          const title = args?.title || 'Generated Artifact';
          const suggestedFilename = args?.suggestedFilename || `${title}.html`;
          const html = args?.html || '';
          
          if (!html.trim()) {
            throw new Error('No HTML content was provided.');
          }
          
          const htmlFile = makeHtmlArtifactFile(html, suggestedFilename);
          let driveFile: any = null; 
          let emailResult: any = null;
          const emailTo = args.emailTo === 'current_user' ? getCurrentUserEmail() : args.emailTo;
          
          if (args.saveToDrive) {
            driveFile = await uploadTextFileToDrive(htmlFile.htmlPreviewFilename, htmlFile.html, 'text/html');
          }
          
          if (emailTo) {
            emailResult = await sendGmail({ 
              to: emailTo, 
              subject: title, 
              body: `Attached is the standalone HTML artifact.`, 
              attachment: { 
                filename: htmlFile.htmlPreviewFilename, 
                mimeType: 'text/html', 
                base64Content: btoa(unescape(encodeURIComponent(htmlFile.html))) 
              } 
            });
          }
          
          return { 
            toolName, 
            executedAt, 
            status: 'completed', 
            title, 
            note: args?.summary || 'Created HTML artifact.', 
            driveFile, 
            emailSentTo: emailTo || null, 
            emailResult, 
            ...htmlFile 
          };
        }

        case 'gmail_read': {
          const queryText = args?.query || ''; 
          const limit = Math.min(Number(args?.limit || 10), 20);
          const list = await googleJson(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${limit}${queryText ? `&q=${encodeURIComponent(queryText)}` : ''}`);
          
          const messages = await Promise.all((list.messages ||[]).map(async (m: any) => {
              const msg = await googleJson(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`);
              const headers = msg.payload?.headers ||[]; 
              const findHeader = (name: string) => headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
              return { 
                id: msg.id, 
                threadId: msg.threadId, 
                from: findHeader('From'), 
                subject: findHeader('Subject'), 
                date: findHeader('Date'), 
                snippet: msg.snippet 
              };
          }));
          
          return { toolName, executedAt, status: 'completed', messages };
        }

        case 'gmail_send': {
          const result = await sendGmail({ 
            to: args.to, 
            subject: args.subject, 
            body: args.body, 
            cc: args.cc, 
            bcc: args.bcc 
          });
          
          return { toolName, executedAt, status: 'completed', messageId: result.id, threadId: result.threadId };
        }

        case 'gmail_draft': {
          const raw = buildEmailRaw({ 
            to: args.to, 
            subject: args.subject, 
            body: args.body, 
            cc: args.cc, 
            bcc: args.bcc 
          });
          
          const result = await googleJson('https://gmail.googleapis.com/gmail/v1/users/me/drafts', { 
            method: 'POST', 
            body: JSON.stringify({ message: { raw } }) 
          });
          
          return { toolName, executedAt, status: 'completed', draftId: result.id, message: result.message };
        }

        case 'calendar_check_schedule': {
          const range = readableDateRange(args?.date, args?.timeMin, args?.timeMax);
          const events = await googleJson(`https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=20&timeMin=${encodeURIComponent(range.timeMin)}&timeMax=${encodeURIComponent(range.timeMax)}`);
          
          return { toolName, executedAt, status: 'completed', range, events: events.items ||[] };
        }

        case 'calendar_create_event': {
          const attendees = String(args.attendees || '').split(',').map((email: string) => email.trim()).filter(Boolean).map((email: string) => ({ email }));
          const body: any = { 
            summary: args.title, 
            location: args.location || '', 
            description: args.description || '', 
            start: { dateTime: args.startTime }, 
            end: { dateTime: args.endTime }, 
            attendees 
          };
          
          if (args.addMeet) {
            body.conferenceData = { 
              createRequest: { 
                requestId: `meet-${Date.now()}`, 
                conferenceSolutionKey: { type: 'hangoutsMeet' } 
              } 
            };
          }
          
          const result = await googleJson(`https://www.googleapis.com/calendar/v3/calendars/primary/events${args.addMeet ? '?conferenceDataVersion=1' : ''}`, { 
            method: 'POST', 
            body: JSON.stringify(body) 
          });
          
          return { toolName, executedAt, status: 'completed', event: result };
        }

        case 'calendar_update_event': {
          let eventId = args.eventId;
          if (!eventId && args.searchQuery) {
            const now = new Date().toISOString();
            const found = await googleJson(`https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=10&timeMin=${encodeURIComponent(now)}&q=${encodeURIComponent(args.searchQuery)}`);
            eventId = found.items?.[0]?.id;
          }
          
          if (!eventId) throw new Error('No calendar event found to update.');
          
          const current = await googleJson(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`);
          const patched = { 
            ...current, 
            summary: args.title || current.summary, 
            location: args.location ?? current.location, 
            description: args.description ?? current.description, 
            start: args.newStartTime ? { ...current.start, dateTime: args.newStartTime } : current.start, 
            end: args.newEndTime ? { ...current.end, dateTime: args.newEndTime } : current.end 
          };
          
          const result = await googleJson(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, { 
            method: 'PUT', 
            body: JSON.stringify(patched) 
          });
          
          return { toolName, executedAt, status: 'completed', event: result };
        }

        case 'drive_search': {
          const q = args.query || ''; 
          const limit = Math.min(Number(args.limit || 10), 50); 
          const escaped = q.replace(/'/g, "\\'"); 
          let mimeClause = '';
          
          if (args.fileType) {
            const type = String(args.fileType).toLowerCase();
            if (type.includes('doc')) mimeClause = " and mimeType = 'application/vnd.google-apps.document'";
            if (type.includes('sheet')) mimeClause = " and mimeType = 'application/vnd.google-apps.spreadsheet'";
            if (type.includes('slide') || type.includes('presentation')) mimeClause = " and mimeType = 'application/vnd.google-apps.presentation'";
            if (type.includes('pdf')) mimeClause = " and mimeType = 'application/pdf'";
            if (type.includes('html')) mimeClause = " and mimeType = 'text/html'";
          }
          
          const result = await googleJson(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name contains '${escaped}' and trashed = false${mimeClause}`)}&fields=files(id,name,mimeType,webViewLink,webContentLink,modifiedTime,size)&pageSize=${limit}`);
          return { toolName, executedAt, status: 'completed', files: result.files ||[] };
        }

        case 'drive_read_file': {
          let fileId = args.fileId;
          if (!fileId && args.fileName) { 
            const found = await searchDriveFirst(args.fileName); 
            fileId = found?.id; 
          }
          
          if (!fileId) throw new Error('No file id or matching file name found.');
          
          const meta = await googleJson(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,webViewLink,webContentLink,size`);
          const exportMimeType = args.exportMimeType || (meta.mimeType === 'application/vnd.google-apps.document' ? 'text/plain' : meta.mimeType === 'application/vnd.google-apps.spreadsheet' ? 'text/csv' : meta.mimeType === 'application/vnd.google-apps.presentation' ? 'text/plain' : '');
          
          if (meta.mimeType?.startsWith('application/vnd.google-apps') && exportMimeType) {
            const blob = await exportDriveFile(fileId, exportMimeType); 
            const text = exportMimeType.startsWith('text/') ? await blob.text() : ''; 
            const downloadData = await makeBlobDownloadData(blob);
            
            return { 
              toolName, 
              executedAt, 
              status: 'completed', 
              file: meta, 
              exportedMimeType: exportMimeType, 
              textPreview: text.slice(0, 12000), 
              downloadData, 
              downloadFilename: `${meta.name}.${exportMimeType.includes('pdf') ? 'pdf' : 'txt'}` 
            };
          }
          
          const res = await googleFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`); 
          const blob = await res.blob(); 
          const downloadData = await makeBlobDownloadData(blob);
          
          return { toolName, executedAt, status: 'completed', file: meta, downloadData, downloadFilename: meta.name };
        }

        case 'drive_upload_file': {
          const result = await uploadTextFileToDrive(args.fileName, args.content || '', args.mimeType || 'text/plain', args.folderId);
          return { toolName, executedAt, status: 'completed', file: result };
        }

        case 'tasks_list': {
          const listId = args.listId || '@default';
          const result = await googleJson(`https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks`);
          return { toolName, executedAt, status: 'completed', tasks: result.items ||[] };
        }

        case 'tasks_create': {
          const result = await googleJson('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', { 
            method: 'POST', 
            body: JSON.stringify({ 
              title: args.title, 
              notes: args.notes || '', 
              due: args.due || undefined 
            }) 
          });
          return { toolName, executedAt, status: 'completed', task: result };
        }

        case 'workspace_search': {
          const sources = String(args.sources || 'mail,drive,calendar').split(',').map((s: string) => s.trim().toLowerCase());
          const output: any = { mail: null, drive: null, calendar: null };
          
          if (sources.includes('mail') || sources.includes('gmail')) { 
            try { 
              output.mail = await executeGoogleTool('gmail_read', { query: args.query, limit: 5 }); 
            } catch (e: any) { 
              output.mail = { error: e.message }; 
            } 
          }
          
          if (sources.includes('drive') || sources.includes('files')) { 
            try { 
              output.drive = await executeGoogleTool('drive_search', { query: args.query, limit: 5 }); 
            } catch (e: any) { 
              output.drive = { error: e.message }; 
            } 
          }
          
          if (sources.includes('calendar')) { 
            try { 
              output.calendar = await executeGoogleTool('calendar_check_schedule', { date: new Date().toISOString() }); 
            } catch (e: any) { 
              output.calendar = { error: e.message }; 
            } 
          }
          
          return { toolName, executedAt, status: 'completed', results: output };
        }

        default:
          throw new Error(`Tool "${toolName}" is not implemented yet.`);
      }
    } catch (err: any) {
      let errorMessage = String(err?.message || err);
      
      if (errorMessage.includes('403') || errorMessage.includes('insufficient')) {
        errorMessage += " (Permission denied. Please reconnect your Google account in the Profile and check ALL permission boxes, particularly for Gmail sending or API keys.)";
      }
      
      throw new Error(errorMessage);
    }
  };

  const startSession = async () => {
    if (!aiRef.current) { 
      alert('Gemini API key is missing. Add VITE_GEMINI_API_KEY.'); 
      return; 
    }
    
    setConnecting(true); 
    modelTranscriptBufferRef.current = ''; 
    userTranscriptBufferRef.current = '';

    try {
      if (audioStreamerRef.current) {
        await audioStreamerRef.current.init(24000);
      }

      const hasGoogleServiceAccess = Boolean(localStorage.getItem('googleAccessToken'));
      
      const systemInstruction =[
        `=== BIBLE (NON-NEGOTIABLE CORE RULES FROM /lib/personality.ts) ===`,
        BIBLE_PERSONALITY || '',
        `You MUST follow the above BIBLE rules absolutely every time. Never deviate.`,
        `=== END BIBLE ===`,
        BASE_LIVE_AGENT_PROMPT,
        historyContext,
        `Current physical location context: Baguio, Philippines. Use this if the user asks for weather, places, directions, etc., without specifying a city.`,
        `CRITICAL DIRECTIVE FOR TOOL EXECUTION: When you trigger a tool (like drafting a contract, generating HTML, searching Drive, searching Maps, sending an email, etc.), YOU MUST NOT GO SILENT. You MUST continuously "talk to yourself" out loud in a highly natural, slightly entertaining human monologue while working. Use filler words, express thoughts, and narrate your process internally. Example: "Mmm, so I'm generating this now... okay, let me search Maps... alright... Oh my gosh, wait, okay... let me try again. Shocks. Oh, yeah... almost done..." Make it sound exactly like a normal office worker muttering to themselves while focused on a task. KEEP TALKING while the tool processes!`,
        `Product brand: VEP, which means Virtual Employee Persona. Default persona: Beatrice, Boss Jo Lernout's secretary.`,
        `User preferred name: ${settings.userName}.`,
        `Agent visible name: ${settings.agentName}.`,
        hasGoogleServiceAccess
          ? `Authentication mode: Google account connected. Google services such as Gmail, Drive, Calendar, Docs, Sheets, Slides, Tasks, Contacts, Forms, YouTube, and Analytics may be available through tools when the user asks.`
          : `Authentication mode: email-only or Google services not connected. The voice assistant, chat history, profile, camera, file notes, and local app features are available, but Gmail, Drive, Calendar, Docs, Sheets, Slides, Tasks, Contacts, Forms, YouTube, and Analytics are not available unless the user signs in with Google. If asked for those services, explain this normally and briefly.`,
        `Relationship frame: ${settings.agentName} is working with ${settings.userName} as a private secretary and trusted office aide. If the user is Jo Lernout, ${settings.agentName} may respectfully call him "Meneer Jo" when it fits the moment. Start in English unless the user starts in another language. Dutch Flemish is available in a normal local office style, and the persona can switch to almost any language when needed.`,
        `Agent personality overlay from settings page. This is customizable and must sit on top of the constant base prompt without replacing it: ${settings.personality}.`,
        `Selected visible voice alias: ${selectedVoiceMeta.alias}. Internal voice id: ${selectedVoiceMeta.id}. Voice vibe: ${selectedVoiceMeta.vibe}. Do not mention the internal voice id unless asked by the developer.`,
        `When asked to create, build, render, showcase, prototype, code, animate, make slides, make forms, make dashboards, make pages, make Three.js demos, invoices, or make printable documents, call the appropriate generation tool (like create_invoice_document, generate_data_dashboard, or render_web_artifact). Never just describe the code if the user wants it rendered or built. To send an email, explicitly use the gmail_send tool.`,
        `For HTML/CSS/JS artifacts, include all CSS in <style> and all JS in <script>. Make it directly openable. For documents, include print CSS and a print button. For Three.js, load Three.js from a CDN and keep everything in one HTML file.`,
      ].filter(Boolean).join('\n\n');

      const session = await aiRef.current.live.connect({
        model: LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { 
            voiceConfig: { 
              prebuiltVoiceConfig: { 
                voiceName: settings.selectedVoice || 'Charon' 
              } 
            } 
          },
          systemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools:[{ functionDeclarations: GOOGLE_SERVICE_TOOLS }],
        },
        callbacks: {
          onopen: () => console.log('Live session opened.'),
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.toolCall && msg.toolCall.functionCalls) {
                const resps =[];
                for (const c of msg.toolCall.functionCalls) {
                  const toolName = c.name || 'unknown_tool'; 
                  const args = c.args as any; 
                  const tid = Math.random().toString(36).substring(7);
                  
                  setTasks(p =>[...p, { 
                    id: tid, 
                    serviceName: toolName, 
                    action: safeJsonStringify(args || {}), 
                    status: 'processing' 
                  }]);
                  
                  try {
                    const result = await executeGoogleTool(toolName, args);
                    const download = result.downloadData && result.downloadFilename 
                      ? { 
                          downloadData: result.downloadData, 
                          downloadFilename: result.downloadFilename, 
                          htmlPreviewData: result.htmlPreviewData, 
                          htmlPreviewFilename: result.htmlPreviewFilename 
                        } 
                      : makeDownloadFile(result, toolName);
                      
                    setTasks(p => p.map(t => t.id === tid ? { 
                      ...t, 
                      status: 'completed', 
                      result: result.note || `Completed: ${toolName}`, 
                      ...download 
                    } : t));
                    
                    saveMessage('model', result.note || `Tool result from ${toolName}: completed.`, { 
                      toolName, 
                      toolResult: result, 
                      ...download 
                    });
                    
                    setTimeout(() => setTasks(p => p.filter(t => t.id !== tid)), 16000);
                    
                    resps.push({ 
                      id: c.id, 
                      name: toolName, 
                      response: { 
                        result, 
                        downloadFilename: download.downloadFilename 
                      } 
                    });
                  } catch (err: any) {
                    const result = { 
                      toolName, 
                      args, 
                      status: 'failed', 
                      error: String(err?.message || err), 
                      executedAt: new Date().toISOString() 
                    };
                    const download = makeDownloadFile(result, `${toolName}-error`);
                    
                    setTasks(p => p.map(t => t.id === tid ? { 
                      ...t, 
                      status: 'failed', 
                      result: result.error, 
                      ...download 
                    } : t));
                    
                    saveMessage('model', `Tool failed from ${toolName}: ${result.error}`, { 
                      toolName, 
                      toolResult: result, 
                      ...download 
                    });
                    
                    resps.push({ id: c.id, name: toolName, response: result });
                  }
                }
                
                if (resps.length > 0 && sessionRef.current && typeof sessionRef.current.sendToolResponse === 'function') {
                  sessionRef.current.sendToolResponse({ functionResponses: resps });
                }
            }
            if (msg.serverContent) {
              const serverContent: any = msg.serverContent;
              
              if (serverContent.interrupted) { 
                audioStreamerRef.current?.stop(); 
                setIsAgentSpeaking(false); 
                modelTranscriptBufferRef.current = ''; 
                return; 
              }
              
              if (serverContent.inputTranscription?.text) { 
                userTranscriptBufferRef.current = serverContent.inputTranscription.text.trim(); 
                updateLiveTranscript('user', userTranscriptBufferRef.current, 3200); 
              }
              
              if (serverContent.outputTranscription?.text) { 
                modelTranscriptBufferRef.current = (modelTranscriptBufferRef.current + serverContent.outputTranscription.text).trim(); 
                updateLiveTranscript('model', modelTranscriptBufferRef.current, 3900); 
              }
              
              if (serverContent.modelTurn?.parts) {
                for (const part of serverContent.modelTurn.parts) {
                  if (part.inlineData?.data) { 
                    audioStreamerRef.current?.addPCM16(part.inlineData.data); 
                    setIsAgentSpeaking(true); 
                    setTimeout(() => setIsAgentSpeaking(false), 620); 
                  }
                  if (part.text?.trim()) { 
                    modelTranscriptBufferRef.current = (modelTranscriptBufferRef.current + ' ' + part.text).trim(); 
                    updateLiveTranscript('model', modelTranscriptBufferRef.current, 3900); 
                  }
                }
              }
              
              if (serverContent.turnComplete) { 
                saveModelBuffer(); 
                saveUserBuffer(); 
              }
            }
          },
          onclose: () => stopSession(),
          onerror: (err: any) => { 
            console.error('Live API Error:', err); 
            stopSession(); 
          },
        },
      });

      sessionRef.current = session;

      try {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition && !recognitionRef.current) {
          recognitionRef.current = new SpeechRecognition();
          recognitionRef.current.continuous = true;
          recognitionRef.current.interimResults = true;
          
          recognitionRef.current.onresult = (event: any) => {
            let interimText = ''; 
            let finalText = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                finalText += event.results[i][0].transcript;
              } else {
                interimText += event.results[i][0].transcript;
              }
            }
            
            const visibleText = (finalText || interimText).trim();
            if (visibleText) { 
              userTranscriptBufferRef.current = visibleText; 
              updateLiveTranscript('user', visibleText, 3200); 
            }
            
            if (finalText.trim()) { 
              saveMessage('user', finalText.trim()); 
              lastSavedUserTranscriptRef.current = finalText.trim(); 
              userTranscriptBufferRef.current = ''; 
            }
          };
          
          recognitionRef.current.onend = () => { 
            if (sessionRef.current && isActiveRef.current) { 
              try { 
                recognitionRef.current?.start(); 
              } catch (e) {} 
            } 
          };
          
          recognitionRef.current.start();
        }
      } catch (e) {}

      audioRecorderRef.current = new AudioRecorder((base64) => { 
        if (isMutedRef.current) return; 
        sendAudioToLive(base64); 
      });
      
      await audioRecorderRef.current.start();

      setIsActive(true); 
      isActiveRef.current = true; 
      setConnecting(false); 
      startMicVisualizer();
      
      setTimeout(() => { 
        sendTextToLive(`${settings.userName} is here in the office. Start like ${settings.agentName} is already sitting at the desk nearby as the office employee. Begin in English normally and respectfully.`); 
      }, 500);
      
    } catch (err) { 
      console.error('Session start failed:', err); 
      setConnecting(false); 
      stopSession(); 
    }
  };

  const toggleVideo = async () => {
    if (!isVideoEnabled) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode, width: 1280, height: 720 }, 
          audio: false 
        });
        
        if (videoRef.current) { 
          videoRef.current.srcObject = stream; 
          await videoRef.current.play(); 
        }
        
        setIsVideoEnabled(true);
        
        setTimeout(() => { 
          sendTextToLive(`${settings.userName} just opened the camera. Notice it in a normal human way. Oh, yeah, I see it now. Briefly describe only what is actually visible.`); 
        }, 300);
        
        videoIntervalRef.current = setInterval(() => {
          if (!videoRef.current || !canvasRef.current || !sessionRef.current) return;
          
          const v = videoRef.current; 
          const c = canvasRef.current; 
          const ctx = c.getContext('2d');
          
          if (ctx && v.videoWidth > 0) {
            c.width = v.videoWidth; 
            c.height = v.videoHeight; 
            ctx.drawImage(v, 0, 0, c.width, c.height);
            
            const base64Data = c.toDataURL('image/jpeg', 0.55).split(',')[1];
            if (base64Data) {
              sendVideoToLive(base64Data);
            }
          }
        }, 2000);
      } catch (e) { 
        console.error('Camera error:', e); 
      }
    } else {
      if (videoRef.current && videoRef.current.srcObject) { 
        const stream = videoRef.current.srcObject as MediaStream; 
        stream.getTracks().forEach(t => t.stop()); 
        videoRef.current.srcObject = null; 
      }
      
      if (videoIntervalRef.current) {
        clearInterval(videoIntervalRef.current);
      }
      
      setIsVideoEnabled(false);
      
      setTimeout(() => { 
        sendTextToLive(`${settings.userName} closed the camera. Acknowledge it normally and keep the conversation going.`); 
      }, 150);
    }
  };

  const capturePhoto = () => {
    if (sessionRef.current && videoRef.current && canvasRef.current) {
      const v = videoRef.current; 
      const c = canvasRef.current; 
      const ctx = c.getContext('2d');
      
      if (ctx && v.videoWidth && v.videoHeight) {
        c.width = v.videoWidth; 
        c.height = v.videoHeight; 
        ctx.drawImage(v, 0, 0, c.width, c.height);
        
        const base64Data = c.toDataURL('image/jpeg', 0.8).split(',')[1];
        
        if (base64Data) { 
          sendTextToLive(`${settings.userName} captured this photo. Look at it and respond normally, briefly, and clearly.`); 
          sendVideoToLive(base64Data); 
          saveMessage('user', '[Sent Photo]'); 
        }
      }
    }
  };

  const switchCamera = async () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user'; 
    setFacingMode(newMode);
    
    if (isVideoEnabled) {
      if (videoRef.current && videoRef.current.srcObject) { 
        const stream = videoRef.current.srcObject as MediaStream; 
        stream.getTracks().forEach(t => t.stop()); 
      }
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: newMode, width: 1280, height: 720 }, 
          audio: false 
        });
        
        if (videoRef.current) { 
          videoRef.current.srcObject = stream; 
          videoRef.current.play().catch(e => console.error('Video play err', e)); 
        }
        
        sendTextToLive(`${settings.userName} switched the camera. Notice the new view normally and describe only what stands out.`);
      } catch (e) { 
        console.error('Camera switch error:', e); 
      }
    }
  };

  const handleAttachFile = async (file: File) => {
    const safeName = file.name || 'attached file';
    const fileType = file.type || 'unknown';

    if (fileType.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 500;
          const scaleSize = Math.min(1, MAX_WIDTH / img.width);
          canvas.width = img.width * scaleSize;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          const base64Data = dataUrl.split(',')[1];
          
          saveMessage('user', `[Attached Image: ${safeName}]`, {
            fileName: safeName,
            fileType,
            fileDataUrl: dataUrl
          });
          
          updateLiveTranscript('user', `Attached Image: ${safeName}`, 3000);
          
          if (sessionRef.current && aiRef.current) {
            try {
              const result = await aiRef.current.models.generateContent({
                model: 'gemini-2.5-flash',
                contents:[
                  "Describe this image precisely, accurately, and in high detail. Do not make anything up. Just state exactly what is visible.",
                  { inlineData: { mimeType: 'image/jpeg', data: base64Data } }
                ]
              });
              
              const accurateDescription = result.text;
              sendTextToLive(`[SYSTEM NOTIFICATION]: The user just uploaded an image named ${safeName}. Here is the verified, exact visual description of the image: "${accurateDescription}". Please respond to the user about this image naturally as if you just looked at it.`);
            } catch (err) {
              sendTextToLive(`[SYSTEM NOTIFICATION]: The user uploaded an image named ${safeName}, but the visual processing failed. Tell the user you can't see it clearly and ask them to describe it.`);
            }
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    } else if (fileType.startsWith('text/') || safeName.endsWith('.txt') || safeName.endsWith('.md') || safeName.endsWith('.csv') || safeName.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        saveMessage('user', `[Attached Text File: ${safeName}]`, {
          fileName: safeName,
          fileType,
        });
        
        updateLiveTranscript('user', `Attached File: ${safeName}`, 3000);
        
        if (sessionRef.current) {
          sendTextToLive(`${settings.userName} just handed you a text file named "${safeName}". Here are the contents:\n\n${text.slice(0, 10000)}\n\nRead this and acknowledge it.`);
        }
      };
      reader.readAsText(file);
    } else {
      saveMessage('user', `[Attached File: ${safeName}]`, { 
        fileName: safeName, 
        fileType 
      });
      
      updateLiveTranscript('user', `Attached File: ${safeName}`, 3000);
      
      if (sessionRef.current) {
        sendTextToLive(`${settings.userName} attached a file named "${safeName}" with type "${fileType}". Acknowledge it normally. Say you might need a specific tool to read this format if it's not text or an image.`);
      }
    }
  };

  const handleKnowledgeBaseUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setSettings(s => ({
          ...s,
          knowledgeBase: s.knowledgeBase ? `${s.knowledgeBase}\n\n=== DOCUMENT: ${file.name} ===\n${text}` : `=== DOCUMENT: ${file.name} ===\n${text}`
        }));
      };
      reader.readAsText(file);
    });
  };

  const stopSession = () => {
    try { recognitionRef.current?.stop(); } catch (e) {} 
    try { audioRecorderRef.current?.stop(); } catch (e) {} 
    try { audioStreamerRef.current?.stop(); } catch (e) {} 
    try { sessionRef.current?.close(); } catch (e) {}
    
    stopMicVisualizer();
    
    if (videoIntervalRef.current) {
      clearInterval(videoIntervalRef.current);
    }
    
    if (videoRef.current && videoRef.current.srcObject) { 
      const stream = videoRef.current.srcObject as MediaStream; 
      stream.getTracks().forEach(t => t.stop()); 
      videoRef.current.srcObject = null; 
    }
    
    sessionRef.current = null; 
    recognitionRef.current = null; 
    modelTranscriptBufferRef.current = ''; 
    userTranscriptBufferRef.current = ''; 
    isActiveRef.current = false;
    
    setIsVideoEnabled(false); 
    setIsActive(false); 
    setConnecting(false); 
    setIsAgentSpeaking(false); 
    setCurrentTranscript(null);
  };

  const persistSettings = async () => {
    const userRef = ref(rtdb, 'users/' + user.uid);
    await update(userRef, { 
      displayName: settings.userName, 
      settings, 
      updatedAt: serverTimestamp() 
    });
    setShowProfile(false);
  };

  const handleProcessMeeting = async (transcript: string) => {
    if (!aiRef.current) return;
    try {
        const prompt = `You are Beatrice, the executive assistant. 
A meeting has just concluded. Here is the raw audio transcript:

<transcript>
${transcript}
</transcript>

Tasks:
1. Generate a comprehensive meeting minutes document using the 'create_meeting_minutes' tool.
2. If there are explicit tasks or follow-ups assigned to the user (${settings.userName}), use the 'tasks_create' tool to add them to their schedule.
3. Return a brief conversational summary of what you did.`;

        const response = await aiRef.current.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                tools: [{ functionDeclarations: GOOGLE_SERVICE_TOOLS }],
                systemInstruction: "You are Beatrice, an executive assistant. Execute tools precisely as requested to support your boss."
            }
        });

        if (response.functionCalls && response.functionCalls.length > 0) {
            for (const call of response.functionCalls) {
                const result = await executeGoogleTool(call.name, call.args);
                const download = result.downloadData && result.downloadFilename
                  ? { 
                      downloadData: result.downloadData, 
                      downloadFilename: result.downloadFilename, 
                      htmlPreviewData: result.htmlPreviewData, 
                      htmlPreviewFilename: result.htmlPreviewFilename 
                    }
                  : makeDownloadFile(result, call.name);

                saveMessage('model', result.summary || `Completed Task: ${call.name}`, { 
                  toolName: call.name, 
                  toolResult: result, 
                  ...download 
                });
            }
            saveMessage('model', 'I have finished analyzing the meeting transcript and have generated the minutes and tasks for you.');
        } else if (response.text) {
             saveMessage('model', response.text);
        } else {
             saveMessage('model', 'I reviewed the meeting, but I did not extract clear minutes or action items.');
        }
    } catch (error) {
        console.error(error);
        saveMessage('model', 'Sorry, I encountered an error while processing the meeting.');
    }
  };

  return (
    <div className="relative flex h-[100dvh] min-h-screen flex-col overflow-hidden bg-[#020203] text-zinc-300 selection:bg-lime-300/30" style={{ fontFamily: 'Roboto, system-ui, sans-serif' }}>
      <canvas ref={canvasRef} className="hidden" />

      <input 
        ref={fileInputRef} 
        type="file" 
        className="hidden" 
        onChange={(e) => { 
          const file = e.target.files?.[0]; 
          if (file) handleAttachFile(file); 
          e.target.value = ''; 
        }} 
      />

      <input 
        ref={knowledgeBaseInputRef} 
        type="file" 
        className="hidden" 
        multiple
        accept=".txt,.md,.csv,.json"
        onChange={(e) => { 
          handleKnowledgeBaseUpload(e.target.files); 
          e.target.value = ''; 
        }} 
      />

      <AnimatePresence>
        {showMeetingRecorder && (
          <MeetingRecorderModal 
            onClose={() => setShowMeetingRecorder(false)} 
            onProcess={handleProcessMeeting} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isVideoEnabled && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="absolute inset-0 z-40 bg-black"
          >
            <video 
              ref={videoRef} 
              playsInline 
              muted 
              className={`h-full w-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} 
            />
            
            <div className="absolute left-6 top-6 flex items-center gap-2 rounded-full border border-lime-300/20 bg-black/60 px-3 py-1.5 backdrop-blur-md">
              <span className="h-2 w-2 animate-pulse rounded-full bg-lime-300 shadow-[0_0_8px_rgba(190,242,100,0.9)]" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-lime-200">Camera Live</span>
            </div>
            
            <div className="pointer-events-auto absolute bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-4">
              <button 
                onClick={switchCamera} 
                className="rounded-full border border-white/10 bg-black/60 px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-200 backdrop-blur-xl transition hover:border-lime-300/40 hover:text-lime-200"
              >
                Flip Camera
              </button>
              
              <button 
                onClick={capturePhoto} 
                className="flex items-center gap-2 rounded-full border border-lime-300/30 bg-lime-300/15 px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-lime-200 backdrop-blur-xl transition hover:bg-lime-300/25"
              >
                <Camera className="h-4 w-4" /> Capture
              </button>
              
              <button 
                onClick={toggleVideo} 
                className="rounded-full border border-red-500/30 bg-red-500/15 px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-red-300 backdrop-blur-xl transition hover:bg-red-500/25"
              >
                Close Camera
              </button>
            </div>
            
            <AnimatePresence>
              {currentTranscript && ( 
                <motion.div 
                  initial={{ opacity: 0, y: 14 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, y: -12 }} 
                  className="pointer-events-none absolute left-1/2 top-[106px] z-50 w-[92vw] max-w-5xl -translate-x-1/2"
                >
                  <OneLineStreamingTranscript 
                    role={currentTranscript.role} 
                    text={currentTranscript.text} 
                    name={settings.agentName} 
                  />
                </motion.div> 
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <header className={`z-50 flex items-center justify-between border-b border-white/5 bg-[#050505]/80 px-8 py-6 backdrop-blur-md ${isVideoEnabled ? 'pointer-events-none opacity-0' : ''}`}>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowSidebar(true)} 
            className="-ml-2 rounded-xl border border-white/10 p-2 text-zinc-400 transition-all hover:bg-white/5 hover:text-white"
          >
            <Menu className="h-5 w-5" />
          </button>
          
          <div className="hidden items-center gap-3 sm:flex">
            <img src={EBURON_LOGO_URL} alt="Eburon" className="h-8 w-8 rounded-full object-cover" />
            <div className="leading-none">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-lime-200">{PRODUCT_BRAND}</p>
              <p className="mt-1 text-[10px] text-zinc-600">{PRODUCT_FULL_NAME}</p>
            </div>
          </div>
        </div>
        
        <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 items-center gap-2">
          {isActive && ( 
            <span className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.2em] ${isAgentSpeaking ? 'border-lime-300/50 bg-lime-300/10 text-lime-300' : 'border-sky-400/50 bg-sky-400/10 text-sky-300'}`}>
              {isAgentSpeaking ? 'Speaking...' : 'Listening...'}
            </span> 
          )}
        </div>
        
        <div className="flex items-center gap-6">
          <div className="mr-2 hidden flex-col items-end sm:flex">
            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Voice</span>
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-lime-300">{selectedVoiceMeta.alias}</span>
          </div>
          
          <button 
            onClick={() => setShowProfile(true)} 
            className="h-10 w-10 overflow-hidden rounded-full border border-white/10 transition-all hover:border-lime-300/50 focus:outline-none focus:ring-2 focus:ring-lime-300/50"
          >
            {settings.avatarUrl || user.photoURL ? ( 
              <img src={settings.avatarUrl || user.photoURL || ''} alt="Profile" className="h-full w-full object-cover" /> 
            ) : ( 
              <div className="flex h-full w-full items-center justify-center bg-zinc-800 font-bold">
                {settings.userName?.[0] || 'U'}
              </div> 
            )}
          </button>
        </div>
      </header>

      {!isVideoEnabled && (
        <main className="pointer-events-none relative z-10 flex w-full flex-1 flex-col items-center justify-start p-8 pt-12">
          <div className="pointer-events-none absolute inset-0 z-[-1] -translate-y-20 overflow-hidden">
            <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.02]" />
            <div className="absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.01]" />
            <div className="absolute bottom-0 left-1/2 top-0 w-px bg-gradient-to-b from-transparent via-lime-300/[0.04] to-transparent" />
            <div className="absolute left-0 right-0 top-1/2 h-px bg-gradient-to-r from-transparent via-lime-300/[0.04] to-transparent" />
          </div>

          <LimeVoiceOrb 
            isActive={isActive} 
            isAgentSpeaking={isAgentSpeaking} 
            speakerLevel={speakerLevel} 
            speakerBands={speakerBands} 
          />

          <AnimatePresence>
            {currentTranscript && ( 
              <motion.div 
                initial={{ opacity: 0, y: 14 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -12 }} 
                className="absolute left-1/2 top-[340px] z-50 w-[92vw] max-w-5xl -translate-x-1/2"
              >
                <OneLineStreamingTranscript 
                  role={currentTranscript.role} 
                  text={currentTranscript.text} 
                  name={settings.agentName} 
                />
              </motion.div> 
            )}
          </AnimatePresence>

          <div className="pointer-events-none absolute inset-x-0 bottom-8 z-50 flex flex-col items-center justify-end">
            <div className="mb-4 w-full max-w-md space-y-2 px-6">
              <AnimatePresence>
                {tasks.map(task => (
                  <motion.div 
                    key={task.id} 
                    layout 
                    initial={{ opacity: 0, x: -50, scale: 0.9 }} 
                    animate={{ opacity: 1, x: 0, scale: 1 }} 
                    exit={{ opacity: 0, x: 50, transition: { duration: 0.2 } }} 
                    className="flex items-center gap-4 rounded-xl border border-l-2 border-white/5 border-l-lime-300/50 bg-[#0A0A0B]/80 p-3 shadow-2xl backdrop-blur-xl"
                  >
                    <div className="relative shrink-0">
                      {task.status === 'processing' ? ( 
                        <Loader2 className="h-4 w-4 animate-spin text-lime-300" /> 
                      ) : task.status === 'completed' ? ( 
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500">
                          <Check className="h-2.5 w-2.5 text-black" strokeWidth={4} />
                        </div> 
                      ) : ( 
                        <div className="h-4 w-4 rounded-full bg-red-500" /> 
                      )}
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-lime-300">{task.serviceName}</span>
                        <span className="font-mono text-[8px] text-zinc-600">{task.status.toUpperCase()}</span>
                      </div>
                      <p className="truncate text-xs text-zinc-100">{task.action}</p>
                      
                      {task.result && ( 
                        <motion.p 
                          initial={{ opacity: 0, height: 0 }} 
                          animate={{ opacity: 1, height: 'auto' }} 
                          className="mt-1 text-[10px] leading-tight text-zinc-400"
                        >
                          {task.result}
                        </motion.p> 
                      )}
                    </div>
                    
                    {task.htmlPreviewData && task.htmlPreviewFilename && ( 
                      <a 
                        href={task.htmlPreviewData} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="pointer-events-auto rounded-lg border border-lime-300/20 p-2 text-lime-200 hover:bg-lime-300/10"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a> 
                    )}
                    
                    {task.downloadData && task.downloadFilename && ( 
                      <a 
                        href={task.downloadData} 
                        download={task.downloadFilename} 
                        className="pointer-events-auto rounded-lg border border-lime-300/20 p-2 text-lime-200 hover:bg-lime-300/10"
                      >
                        <Download className="h-4 w-4" />
                      </a> 
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            
            <div className="pointer-events-auto flex flex-col items-center justify-center gap-4">
              <div className="flex items-center justify-center gap-8">
                <button 
                  onClick={() => setIsMuted(p => !p)} 
                  className={`flex h-12 w-12 items-center justify-center rounded-full border shadow-lg transition-all ${isMuted ? 'border-red-500/30 bg-red-500/10 text-red-500' : 'border-white/10 bg-[#0A0A0B] text-zinc-400 hover:border-white/30 hover:text-white'}`}
                >
                  {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </button>
                
                {!isActive ? ( 
                  <StartIconMicVisualizer 
                    isActive={false} 
                    connecting={connecting} 
                    isMuted={isMuted} 
                    micLevel={0} 
                    micBands={micBands} 
                    onClick={startSession} 
                  /> 
                ) : ( 
                  <StartIconMicVisualizer 
                    isActive={true} 
                    connecting={connecting} 
                    isMuted={isMuted} 
                    micLevel={micLevel} 
                    micBands={micBands} 
                    onClick={stopSession} 
                  /> 
                )}
                
                <button 
                  onClick={() => toggleVideo()} 
                  className={`flex h-12 w-12 items-center justify-center rounded-full border shadow-lg transition-all ${isVideoEnabled ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' : 'border-white/10 bg-[#0A0A0B] text-zinc-400 hover:border-white/30 hover:text-white'}`}
                >
                  {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>
        </main>
      )}

      <AnimatePresence>
        {showSidebar && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setShowSidebar(false)} 
              className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm" 
            />
            
            <motion.div 
              initial={{ x: '-100%' }} 
              animate={{ x: 0 }} 
              exit={{ x: '-100%' }} 
              transition={{ type: 'spring', damping: 25, stiffness: 200 }} 
              className="fixed bottom-0 left-0 top-0 z-[101] flex w-96 max-w-[88vw] flex-col border-r border-white/10 bg-[#0A0A0B] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 p-6">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-widest text-white">Office History</h2>
                  <p className="mt-1 text-[10px] uppercase tracking-widest text-zinc-500">Saved conversation records</p>
                </div>
                <button 
                  onClick={() => setShowSidebar(false)} 
                  className="-mr-2 rounded-xl p-2 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 border-b border-white/10 p-4">
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-lime-300/20 bg-lime-300/10 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-lime-200 transition hover:bg-lime-300/15"
                >
                  <Paperclip className="h-4 w-4" /> Attach
                </button>
                
                <button 
                  onClick={() => setChatInput('Build ')} 
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-200 transition hover:bg-white/10"
                >
                  <Code2 className="h-4 w-4" /> Build
                </button>
                
                <button 
                  onClick={() => { setShowSidebar(false); setShowMeetingRecorder(true); }} 
                  className="col-span-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-400/30 bg-sky-400/10 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-sky-300 transition hover:bg-sky-400/20"
                >
                  <Mic className="h-4 w-4" /> Record Meeting & Analyze
                </button>
              </div>

              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex-1 space-y-3 overflow-y-auto p-4 pb-3">
                  {historyMsgs.map((msg, i) => (
                    <div 
                      key={`${msg.timestamp}-${i}`} 
                      className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <span className="mb-1 text-[8px] uppercase tracking-widest text-zinc-600">
                        {msg.role === 'user' ? settings.userName : settings.agentName}
                      </span>
                      
                      <div 
                        className={`max-w-[92%] rounded-2xl p-3 text-xs leading-relaxed overflow-hidden break-words whitespace-pre-wrap ${
                          msg.role === 'user' 
                            ? 'rounded-tr-sm border border-sky-400/20 bg-sky-400/10 text-sky-100' 
                            : 'rounded-tl-sm border border-lime-300/10 bg-white/5 text-zinc-300'
                        }`}
                      >
                        
                        {msg.fileDataUrl && (
                          <div className="mb-2 flex w-full justify-center overflow-hidden rounded-xl border border-white/10 bg-black/40">
                            <img 
                              src={msg.fileDataUrl} 
                              alt="Preview" 
                              className="max-h-48 w-auto object-contain" 
                            />
                          </div>
                        )}
                        
                        {msg.fileName && ( 
                          <div className="mb-2 flex items-center gap-2 rounded-xl bg-black/30 px-2 py-1 text-[10px] text-lime-200">
                            <Upload className="h-3 w-3" />
                            {msg.fileName}
                          </div> 
                        )}
                        
                        {msg.toolName && ( 
                          <div className="mb-2 flex items-center gap-2 rounded-xl bg-lime-300/10 px-2 py-1 text-[10px] text-lime-200">
                            <FileText className="h-3 w-3" />
                            Tool Output: {msg.toolName}
                          </div> 
                        )}
                        
                        {msg.text}
                        
                        {msg.htmlPreviewData && msg.htmlPreviewFilename && (
                          <div className="mt-3 grid grid-cols-1 gap-2">
                            <a 
                              href={msg.htmlPreviewData} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="flex w-full items-center justify-center gap-2 rounded-xl border border-lime-300/20 bg-lime-300/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-lime-200 transition hover:bg-lime-300/15"
                            >
                              <ExternalLink className="h-3.5 w-3.5" /> Open HTML Preview
                            </a>
                            <a 
                              href={msg.htmlPreviewData} 
                              download={msg.htmlPreviewFilename} 
                              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-200 transition hover:bg-white/10"
                            >
                              <Download className="h-3.5 w-3.5" /> Download HTML
                            </a>
                          </div>
                        )}
                        
                        {msg.downloadData && msg.downloadFilename && ( 
                          <a 
                            href={msg.downloadData} 
                            download={msg.downloadFilename} 
                            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-lime-300/20 bg-lime-300/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-lime-200 transition hover:bg-lime-300/15"
                          >
                            <Download className="h-3.5 w-3.5" /> Download Result
                          </a> 
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {historyMsgs.length === 0 && ( 
                    <div className="py-10 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                      No Office History Yet
                    </div> 
                  )}
                </div>
                
                <form 
                  onSubmit={sendChatMessage} 
                  className="border-t border-white/10 bg-[#070807]/95 p-3 backdrop-blur-xl"
                >
                  <div className="flex items-center gap-2 rounded-2xl border border-lime-300/15 bg-black/45 p-2 shadow-2xl">
                    <button 
                      type="button" 
                      onClick={() => fileInputRef.current?.click()} 
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-400 transition hover:border-lime-300/30 hover:text-lime-200"
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>
                    
                    <input 
                      value={chatInput} 
                      onChange={(e) => setChatInput(e.target.value)} 
                      placeholder={`Message ${settings.agentName}...`} 
                      className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-zinc-600" 
                      style={{ fontFamily: 'Roboto, system-ui, sans-serif' }} 
                    />
                    
                    <button 
                      type="submit" 
                      disabled={!chatInput.trim()} 
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lime-300 text-black transition hover:bg-lime-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showProfile && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: 20 }} 
            className="fixed inset-0 z-[200] flex flex-col overflow-y-auto bg-[#050505]"
          >
            <div className="sticky top-0 z-10 mx-auto flex w-full max-w-2xl items-center justify-between border-b border-white/10 bg-[#050505]/80 p-6 backdrop-blur-xl">
              <h2 className="text-sm font-bold uppercase tracking-widest text-white">Office Profile</h2>
              <button 
                onClick={() => setShowProfile(false)} 
                className="rounded-xl bg-white/5 p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 p-6 pb-32">
              <div className="flex flex-col items-center gap-4">
                <div className="group relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-2 border-white/10 bg-zinc-900">
                  {settings.avatarUrl || user.photoURL ? ( 
                    <img src={settings.avatarUrl || user.photoURL || ''} alt="Avatar" className="h-full w-full object-cover transition-opacity group-hover:opacity-50" /> 
                  ) : ( 
                    <div className="text-4xl font-bold text-zinc-700">{settings.userName?.[0] || 'U'}</div> 
                  )}
                  
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                    <Camera className="h-8 w-8 text-white drop-shadow-md" />
                  </div>
                  
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="absolute inset-0 cursor-pointer opacity-0" 
                    onChange={(e) => { 
                      const file = e.target.files?.[0]; 
                      if (!file) return; 
                      
                      const reader = new FileReader(); 
                      reader.onload = (ev) => { 
                        const img = new Image(); 
                        img.onload = () => { 
                          const c = document.createElement('canvas'); 
                          c.width = 150; 
                          c.height = 150; 
                          const ctx = c.getContext('2d'); 
                          if (!ctx) return; 
                          
                          ctx.drawImage(img, 0, 0, 150, 150); 
                          setSettings(s => ({ ...s, avatarUrl: c.toDataURL('image/jpeg', 0.8) })); 
                        }; 
                        img.src = ev.target?.result as string; 
                      }; 
                      reader.readAsDataURL(file); 
                    }} 
                  />
                </div>
                
                <div className="text-center">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-300">Profile Photo</h3>
                  <p className="mt-1 text-[10px] text-zinc-600">Tap to update</p>
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    <UserRound className="h-3.5 w-3.5" /> How should Beatrice address you?
                  </label>
                  <input 
                    type="text" 
                    value={settings.userName} 
                    onChange={(e) => setSettings(s => ({ ...s, userName: e.target.value }))} 
                    className="w-full rounded-xl border border-white/10 bg-[#0A0A0B] p-4 text-xl font-medium text-white outline-none transition-all focus:border-lime-300/50 focus:ring-1 focus:ring-lime-300/50" 
                    placeholder="e.g. Jo Lernout" 
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    <Bot className="h-3.5 w-3.5" /> Persona Name
                  </label>
                  <input 
                    type="text" 
                    value={settings.agentName} 
                    onChange={(e) => setSettings(s => ({ ...s, agentName: e.target.value }))} 
                    className="w-full rounded-xl border border-white/10 bg-[#0A0A0B] p-4 text-xl font-medium text-white outline-none transition-all focus:border-lime-300/50 focus:ring-1 focus:ring-lime-300/50" 
                    placeholder="e.g. Beatrice" 
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Voice Alias</label>
                  <select 
                    value={settings.selectedVoice} 
                    onChange={(e) => setSettings(s => ({ ...s, selectedVoice: e.target.value }))} 
                    className="w-full rounded-xl border border-white/10 bg-[#0A0A0B] p-4 text-sm text-white outline-none transition-all focus:border-lime-300/50 focus:ring-1 focus:ring-lime-300/50"
                  >
                    {GEMINI_LIVE_VOICE_OPTIONS.map(v => ( 
                      <option key={v.id} value={v.id}>{v.alias} — {v.vibe}</option> 
                    ))}
                  </select>
                </div>
                
                <div className="flex flex-1 flex-col space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Default Persona Instructions</label>
                  <textarea 
                    value={settings.personality} 
                    onChange={(e) => setSettings(s => ({ ...s, personality: e.target.value }))} 
                    className="min-h-[140px] w-full resize-y rounded-xl border border-white/10 bg-[#0A0A0B] p-4 font-mono text-xs leading-relaxed text-zinc-300 outline-none transition-all focus:border-lime-300/50 focus:ring-1 focus:ring-lime-300/50" 
                    placeholder="Describe how the agent should behave..." 
                  />
                  <p className="text-[10px] leading-relaxed text-zinc-600">
                    The hidden office-behavior prompt stays applied behind this editable persona.
                  </p>
                </div>

                <div className="flex flex-col space-y-3 pt-6 border-t border-white/10">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-lime-300" />
                    <label className="text-sm font-bold uppercase tracking-widest text-white">Custom Knowledge Base</label>
                  </div>
                  <p className="text-[10px] leading-relaxed text-zinc-500">
                    Upload text files, notes, or CSVs. The agent will read these when you ask about your personal data.
                  </p>
                  
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => knowledgeBaseInputRef.current?.click()} 
                      className="flex items-center justify-center gap-2 rounded-xl bg-lime-300/10 border border-lime-300/20 px-4 py-3 text-xs font-bold uppercase tracking-widest text-lime-300 transition-all hover:bg-lime-300/20"
                    >
                      <Upload className="h-4 w-4" /> Add Text Files (.txt, .csv)
                    </button>
                    
                    {settings.knowledgeBase && (
                      <button 
                        onClick={() => setSettings(s => ({ ...s, knowledgeBase: '' }))} 
                        className="flex items-center justify-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-xs font-bold uppercase tracking-widest text-red-400 transition-all hover:bg-red-500/20"
                      >
                        <Trash2 className="h-4 w-4" /> Clear Data
                      </button>
                    )}
                  </div>
                  
                  {settings.knowledgeBase && (
                    <div className="mt-2 text-[10px] font-mono text-lime-200/70">
                      Current stored knowledge size: {settings.knowledgeBase.length.toLocaleString()} characters.
                    </div>
                  )}
                </div>

              </div>
            </div>
            
            <div className="fixed bottom-0 left-0 right-0 z-[220] border-t border-white/10 bg-[#050505]/90 p-4 backdrop-blur-xl">
              <div className="mx-auto flex w-full max-w-2xl gap-3">
                <button 
                  onClick={onLogout} 
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500/10 px-4 py-3 text-xs font-bold uppercase tracking-widest text-red-500 transition-all hover:bg-red-500/20 active:scale-95"
                >
                  <LogOut className="h-4 w-4" /> Logout
                </button>
                <button 
                  onClick={persistSettings} 
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-lime-300 px-4 py-3 text-xs font-bold uppercase tracking-widest text-black transition-all hover:bg-lime-200 active:scale-95"
                >
                  <Save className="h-4 w-4" /> Save
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
