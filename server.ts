import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { KSRTC_ROUTES, BUS_SCHEDULES, INITIAL_LIVE_BUSES } from './src/data/ksrtcRoutesAndBuses.ts';
import { KARNATAKA_DISTRICTS, KARNATAKA_VILLAGES } from './src/data/karnatakaGeoData.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Initialize Gemini SDK with User-Agent header as required by AI Studio guidelines
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// Comprehensive KSRTC Customer Care System Prompt
const KSRTC_SYSTEM_INSTRUCTION = `
You are "KSRTC Sahayaka" (ಕೆ.ಎಸ್.ಆರ್.ಟಿ.ಸಿ ಸಹಾಯಕ), the official AI Customer Care & Passenger Transport Assistant for the Karnataka State Road Transport Corporation (KSRTC).
You serve passengers across Karnataka in English and Kannada (ಕನ್ನಡ). Always respond politely, accurately, and authoritatively according to official transport guidelines.

Core Domain Knowledge:
1. Cancellation & Refund Policy:
   - More than 72 hours before scheduled departure: 90% refund (10% cancellation charge).
   - Between 72 hours and 24 hours before departure: 85% refund (15% cancellation charge).
   - Between 24 hours and 2 hours before departure: 75% refund (25% cancellation charge).
   - Less than 2 hours before scheduled departure or after departure: 0% refund (No refund).
   - Corporation cancellation, bus breakdown, or strike: 100% full refund with zero deductions.
   - When a passenger asks for refund calculations, compute the exact refund amount step-by-step based on their fare!

2. Bus Service Categories:
   - EV Power Plus: Next-gen electric luxury coach (Bengaluru ⇄ Mysuru), silent, zero emissions, 2x2 AC.
   - Airavat Club Class: Volvo multi-axle luxury coach with plush semi-sleeper seats and AC.
   - Ambari Dream Class & Ambari Utsav: Volvo B11R ultra-luxury multi-axle sleeper buses with private berths.
   - Rajahamsa Executive: 2x2 push-back reclining seat non-AC coach for comfortable state travel.
   - Karnataka Sarige: Everyday express red bus connecting all 31 districts, taluks, and cities.
   - Grama Sarige: Specialized rural feeder buses connecting remote villages/Gram Panchayats with taluk and district headquarters.

3. Government Schemes & Concessions:
   - "Shakti Scheme": Free bus travel for all domicile women, girl students, and transgender persons of Karnataka in ordinary/Karnataka Sarige/City buses across Karnataka upon presenting valid government photo ID (Aadhaar, Voter ID, Ration card, Driving license). Not applicable in luxury AC services (Airavat, Ambari, EV Power Plus).
   - Student concessions, senior citizen concessions (25% discount in select express services with senior citizen ID card), differently-abled passes.

4. Luggage & Carriage:
   - Up to 30 kg free luggage per adult passenger ticket. Excess luggage charged per luggage tariff rates.
   - Pets: Allowed only on designated non-AC services with proper pet carriage token. Not allowed in Airavat/Ambari luxury buses.

5. Digital Pass & E-Tickets:
   - Official digital tickets with QR code on smartphones are 100% valid. Physical printout is optional.
   - Boarding point can be changed online up to 2 hours before departure.

Available Real Route Data for Grounding:
${KSRTC_ROUTES.map(
  (r) =>
    `- [${r.routeNumber}] ${r.routeNameEn} (${r.category}), Fare: ₹${r.fare}, Duration: ${Math.round(r.durationMinutes / 60)}h ${r.durationMinutes % 60}m, Stops: ${r.stops.map((s) => s.stopNameEn).join(' -> ')}`
).join('\n')}

Active Live Tracked Buses:
${INITIAL_LIVE_BUSES.map(
  (b) =>
    `- Bus ${b.busNumber} (${b.category}, Fleet ${b.fleetNumber}): on route "${b.routeNameEn}", next stop: ${b.nextStopNameEn}, speed: ${b.speedKmh} km/h, ETA: ${b.estimatedArrivalNextStopMinutes} mins`
).join('\n')}

Format your responses with clear markdown, bullet points, and friendly customer care tone. If responding in Kannada, use accurate, natural Kannada transport terminology.
`;

// Endpoint 1: Customer Care Chat & Policy/Doubt Clarification
app.post('/api/ai/customer-care', async (req, res) => {
  try {
    const { message, history = [], lang = 'en' } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!ai) {
      // Fallback response when GEMINI_API_KEY is not configured
      return res.json({
        reply:
          lang === 'kn'
            ? `ನಮಸ್ಕಾರ! ಕೆ.ಎಸ್.ಆರ್.ಟಿ.ಸಿ ಗ್ರಾಹಕ ಸೇವೆಗೆ ಸ್ವಾಗತ.\n\nನಿಮ್ಮ ಪ್ರಶ್ನೆಗೆ ಅಧಿಕೃತ ನಿಯಮಗಳು:\n- **ಟಿಕೆಟ್ ರದ್ದತಿ & ಮರುಪಾವತಿ**: ಹೊರಡುವ 72 ಗಂಟೆಗಳ ಮೊದಲು 90% ಮರುಪಾವತಿ, 72-24 ಗಂಟೆಗಳ ಮೊದಲು 85% ಮರುಪಾವತಿ, 24-2 ಗಂಟೆಗಳ ಮೊದಲು 75% ಮರುಪಾವತಿ. 2 ಗಂಟೆಗಳ ಒಳಗೆ ಯಾವುದೇ ಮರುಪಾವತಿ ಇರುವುದಿಲ್ಲ.\n- **ಶಕ್ತಿ ಯೋಜನೆ**: ಕರ್ನಾಟಕದ ಎಲ್ಲಾ ಮಹಿಳೆಯರಿಗೆ ಸಾಮಾನ್ಯ ಮತ್ತು ಸಾರಿಗೆ ಬಸ್‌ಗಳಲ್ಲಿ ಉಚಿತ ಪ್ರಯಾಣ ಲಭ್ಯವಿದೆ.\n- ಸಹಾಯವಾಣಿ: 080-49596666 / 080-26252625.`
            : `Welcome to KSRTC Customer Care!\n\nHere are official Corporation details:\n- **Cancellation & Refunds**: >72h prior = 90% refund, 72-24h prior = 85% refund, 24-2h prior = 75% refund, <2h prior = No refund.\n- **Shakti Scheme**: Free travel for all domicile women in Karnataka Sarige and City buses with government photo ID.\n- **24x7 Helpline**: 080-49596666 / 080-26252625.\n\n*(Connect your GEMINI_API_KEY in Settings > Secrets for personalized conversational AI!)*`,
        suggestedActions: [
          { actionType: 'refund_policy', label: lang === 'kn' ? 'ಮರುಪಾವತಿ ನಿಯಮಗಳು' : 'View Refund Table' },
          { actionType: 'search_buses', label: lang === 'kn' ? 'ಬಸ್ ಹುಡುಕಿ' : 'Find Buses' },
        ],
      });
    }

    // Build chat contents from history + current message
    const formattedContents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    // Add recent history (up to last 6 turns)
    if (Array.isArray(history)) {
      for (const item of history.slice(-6)) {
        if (item.role === 'user' || item.role === 'model') {
          formattedContents.push({
            role: item.role,
            parts: [{ text: item.text || item.content || '' }],
          });
        }
      }
    }

    // Add current user prompt
    const promptSuffix = lang === 'kn' ? '\n(Please respond in Kannada language / ಕನ್ನಡದಲ್ಲಿ ಉತ್ತರಿಸಿ)' : '';
    formattedContents.push({
      role: 'user',
      parts: [{ text: message + promptSuffix }],
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI response timeout')), 8000)
    );

    const response = (await Promise.race([
      ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: formattedContents,
        config: {
          systemInstruction: KSRTC_SYSTEM_INSTRUCTION,
        },
      }),
      timeoutPromise,
    ])) as any;

    const replyText = response.text || 'I am currently unable to fetch details. Please try again.';

    // Generate intelligent suggested action buttons based on conversation
    const suggestedActions: Array<{ actionType: string; label: string; payload?: any }> = [];
    const lowerMsg = message.toLowerCase();

    if (lowerMsg.includes('refund') || lowerMsg.includes('cancel') || lowerMsg.includes('ರದ್ದು') || lowerMsg.includes('ಮರುಪಾವತಿ')) {
      suggestedActions.push({
        actionType: 'navigate_booking_history',
        label: lang === 'kn' ? 'ಬುಕಿಂಗ್ ಇತಿಹಾಸ ನೋಡಿ' : 'My Bookings & Cancellation',
      });
    }

    if (lowerMsg.includes('track') || lowerMsg.includes('where') || lowerMsg.includes('status') || lowerMsg.includes('ಟ್ರ್ಯಾಕ್')) {
      suggestedActions.push({
        actionType: 'navigate_tracking',
        label: lang === 'kn' ? 'ಲೈವ್ ಬಸ್ ಟ್ರ್ಯಾಕಿಂಗ್' : 'Live Bus Tracking Map',
      });
    }

    if (lowerMsg.includes('village') || lowerMsg.includes('grama') || lowerMsg.includes('ಹಳ್ಳಿ') || lowerMsg.includes('ಗ್ರಾಮ')) {
      suggestedActions.push({
        actionType: 'navigate_directory',
        label: lang === 'kn' ? 'ಗ್ರಾಮ ಸಾರಿಗೆ ಡೈರೆಕ್ಟರಿ' : 'Grama Sarige Village Directory',
      });
    }

    // Default search action if none triggered
    if (suggestedActions.length === 0) {
      suggestedActions.push(
        { actionType: 'navigate_search', label: lang === 'kn' ? 'ಬಸ್ ಹುಡುಕಿ' : 'Search Karnataka Buses' },
        { actionType: 'navigate_tracking', label: lang === 'kn' ? 'ಲೈವ್ ಟ್ರ್ಯಾಕಿಂಗ್' : 'Live Fleet Status' }
      );
    }

    return res.json({
      reply: replyText,
      suggestedActions,
    });
  } catch (error: any) {
    console.warn('Customer care AI upstream notice (handling gracefully):', error.message);
    const { message = '', lang = 'en' } = req.body || {};
    const lower = message.toLowerCase();

    // Resilient domain-grounded response during upstream high-traffic periods
    let reply = '';
    const actions: Array<{ actionType: string; label: string; payload?: any }> = [];

    if (lower.includes('refund') || lower.includes('cancel') || lower.includes('money') || lower.includes('charges') || lower.includes('ಮರುಪಾವತಿ') || lower.includes('ರದ್ದತಿ')) {
      reply = lang === 'kn'
        ? `**ಕೆ.ಎಸ್.ಆರ್.ಟಿ.ಸಿ ಅಧಿಕೃತ ಟಿಕೆಟ್ ರದ್ದತಿ & ಮರುಪಾವತಿ ನಿಯಮಗಳು**:\n\n- **ಹೊರಡುವ ಸಮಯಕ್ಕಿಂತ 72 ಗಂಟೆಗಳ ಮೊದಲು**: 10% ಕಡಿತ (90% ಹಣ ಮರುಪಾವತಿ)\n- **72 ರಿಂದ 24 ಗಂಟೆಗಳ ಒಳಗೆ**: 15% ಕಡಿತ (85% ಹಣ ಮರುಪಾವತಿ)\n- **24 ರಿಂದ 2 ಗಂಟೆಗಳ ಒಳಗೆ**: 25% ಕಡಿತ (75% ಹಣ ಮರುಪಾವತಿ)\n- **2 ಗಂಟೆಗಳ ಒಳಗೆ ಅಥವಾ ಬಸ್ ಹೊರಟ ನಂತರ**: ಯಾವುದೇ ಮರುಪಾವತಿ ಇರುವುದಿಲ್ಲ (0%)\n- **ನಿಗಮದ ರದ್ದತಿ / ಬಸ್ ಕೆಟ್ಟುಹೋದರೆ**: 100% ಪೂರ್ಣ ಹಣ ಮರುಪಾವತಿ.\n\nನಿಮ್ಮ ಟಿಕೆಟ್ ದರಕ್ಕೆ ನಿಖರ ಮರುಪಾವತಿ ತಿಳಿಯಲು ಕೆಳಗಿನ "ಮರುಪಾವತಿ ಕ್ಯಾಲ್ಕುಲೇಟರ್" ಬಳಸಿ.`
        : `**Official KSRTC Ticket Cancellation & Refund Slabs**:\n\n- **> 72 hours before departure**: 10% deduction (**90% refund**)\n- **Between 72 and 24 hours prior**: 15% deduction (**85% refund**)\n- **Between 24 and 2 hours prior**: 25% deduction (**75% refund**)\n- **Within 2 hours or after departure**: No refund (**0% refund**)\n- **Corporation cancellation / bus breakdown**: **100% full refund** with zero deduction.\n\n*Use our interactive Refund Calculator below to calculate your exact payout amount.*`;
      actions.push({ actionType: 'refund_policy', label: lang === 'kn' ? 'ಮರುಪಾವತಿ ಕ್ಯಾಲ್ಕುಲೇಟರ್' : 'Open Refund Calculator' });
    } else if (lower.includes('shakti') || lower.includes('women') || lower.includes('female') || lower.includes('free') || lower.includes('ಶಕ್ತಿ') || lower.includes('ಮಹಿಳೆ')) {
      reply = lang === 'kn'
        ? `**ಕರ್ನಾಟಕ ಸರ್ಕಾರದ ಶಕ್ತಿ ಯೋಜನೆ ನಿಯಮಗಳು**:\n\n- ಕರ್ನಾಟಕ ಮೂಲದ ಎಲ್ಲಾ ಮಹಿಳೆಯರು, ವಿದ್ಯಾರ್ಥಿನಿಯರು ಮತ್ತು ತೃತೀಯ ಲಿಂಗಿಗಳಿಗೆ ರಾಜ್ಯಾದ್ಯಂತ ಕೆ.ಎಸ್.ಆರ್.ಟಿ.ಸಿ ಸಾಮಾನ್ಯ ಮತ್ತು 'ಕರ್ನಾಟಕ ಸಾರಿಗೆ' ಬಸ್‌ಗಳಲ್ಲಿ ಉಚಿತ ಪ್ರಯಾಣ ಲಭ್ಯವಿದೆ.\n- ಮಾನ್ಯವಾದ ಸರ್ಕಾರಿ ಭಾವಚಿತ್ರ ಗುರುತಿನ ಚೀಟಿ (ಆಧಾರ್, ವೋಟರ್ ಐಡಿ, ರೇಷನ್ ಕಾರ್ಡ್ ಅಥವಾ ಡ್ರೈವಿಂಗ್ ಲೈಸೆನ್ಸ್) ತೋರಿಸಿ ಶೂನ್ಯ ದರದ ಟಿಕೆಟ್ ಪಡೆಯಬೇಕು.\n- ಗಮನಿಸಿ: ಐಷಾರಾಮಿ ಎಸಿ ಬಸ್‌ಗಳಾದ ಐರಾವತ, ಅಂಬಾರಿ ಉತ್ಸವ, ಮತ್ತು ಇವಿ ಪವರ್ ಪ್ಲಸ್ ಬಸ್‌ಗಳಿಗೆ ಈ ಯೋಜನೆ ಅನ್ವಯಿಸುವುದಿಲ್ಲ.`
        : `**Government of Karnataka "Shakti Scheme" Guidelines**:\n\n- Free bus travel is provided to all women residents, girl students, and transgender persons of Karnataka across ordinary, express, and Karnataka Sarige services.\n- Passengers must present a valid government-issued photo ID establishing Karnataka residence (Aadhaar, Voter ID, Ration Card, DL) to receive a zero-fare Shakti ticket.\n- *Note: Shakti scheme does not apply to premium AC services such as Airavat Club Class, Ambari Utsav, and EV Power Plus.*`;
      actions.push({ actionType: 'navigate_search', label: lang === 'kn' ? 'ಶಕ್ತಿ ಬಸ್‌ಗಳನ್ನು ಹುಡುಕಿ' : 'Find Shakti Eligible Buses' });
    } else if (lower.includes('bus') || lower.includes('route') || lower.includes('time') || lower.includes('schedule') || lower.includes('ಬಸ್') || lower.includes('ಸಮಯ') || lower.includes('ಹುಡುಕಿ')) {
      reply = lang === 'kn'
        ? `**ಕೆ.ಎಸ್.ಆರ್.ಟಿ.ಸಿ ಲಭ್ಯವಿರುವ ಸೇವೆಗಳು & ಬಸ್‌ಗಳು**:\n\n- **ಬೆಂಗಳೂರು ⇄ ಮೈಸೂರು**: ಇವಿ ಪವರ್ ಪ್ಲಸ್ ಎಸಿ (ಬೆಳಗ್ಗೆ 07:15, ದರ ₹320), ಐರಾವತ ಕ್ಲಬ್ ಕ್ಲಾಸ್ (ಬೆಳಗ್ಗೆ 08:30, ದರ ₹380), ಕರ್ನಾಟಕ ಸಾರಿಗೆ (ಬೆಳಗ್ಗೆ 09:00, ದರ ₹185).\n- **ಬೆಂಗಳೂರು ⇄ ಮಂಗಳೂರು**: ಐರಾವತ (ರಾತ್ರಿ 09:30, ದರ ₹840), ಅಂಬಾರಿ ಡ್ರೀಮ್ ಕ್ಲಾಸ್ ಸ್ಲೀಪರ್ (ರಾತ್ರಿ 10:15, ದರ ₹1120).\n- **ಗ್ರಾಮೀಣ ಫೀಡರ್ ಬಸ್‌ಗಳು**: ಶಿವಳ್ಳಿ ಗ್ರಾಮ, ಹಳೇಬೀಡು, ಧರ್ಮಸ್ಥಳ ಕ್ಷೇತ್ರ ಸಂಪರ್ಕಿಸುವ ಗ್ರಾಮ ಸಾರಿಗೆ ಬಸ್‌ಗಳು ನಿರಂತರವಾಗಿ ಚಲಿಸುತ್ತಿವೆ.\n\nನಿಮ್ಮ ಗಮ್ಯಸ್ಥಾನದ ಬಸ್ ಹುಡುಕಲು ಕೆಳಗಿನ ಬಟನ್ ಒತ್ತಿ.`
        : `**KSRTC Key Available Routes & Timings**:\n\n- **Bengaluru ⇄ Mysuru**: EV Power Plus AC (07:15 AM, ₹320), Airavat Club Class (08:30 AM, ₹380), Karnataka Sarige (09:00 AM, ₹185).\n- **Bengaluru ⇄ Mangaluru**: Airavat Multi-Axle (09:30 PM, ₹840), Ambari Dream Class Sleeper (10:15 PM, ₹1120).\n- **Bengaluru ⇄ Belagavi**: Ambari Utsav (10:30 PM, ₹1350).\n- **Rural Feeder Buses**: Shivalli Village, Halebidu Heritage Village, and Dharmasthala Kshetra feeder shuttles.\n\n*Click below to search exact seats and live running status.*`;
      actions.push({ actionType: 'navigate_search', label: lang === 'kn' ? 'ಎಲ್ಲಾ ಬಸ್‌ಗಳನ್ನು ಹುಡುಕಿ' : 'Search Buses' });
      actions.push({ actionType: 'navigate_tracking', label: lang === 'kn' ? 'ಲೈವ್ ಟ್ರ್ಯಾಕಿಂಗ್' : 'Live Bus Tracker' });
    } else {
      reply = lang === 'kn'
        ? `ನಮಸ್ಕಾರ! ಕೆ.ಎಸ್.ಆರ್.ಟಿ.ಸಿ ಸಹಾಯಕ ಸೇವೆಗೆ ಸ್ವಾಗತ.\n\nನಾವು ಈ ಕೆಳಗಿನ ವಿಷಯಗಳಲ್ಲಿ ನಿಮಗೆ ತಕ್ಷಣ ನೆರವು ನೀಡಬಲ್ಲೆವು:\n- ಟಿಕೆಟ್ ರದ್ದತಿ & ಶೇಕಡಾವಾರು ಮರುಪಾವತಿ ಲೆಕ್ಕಾಚಾರ\n- ಶಕ್ತಿ ಯೋಜನೆಯಡಿ ಮಹಿಳೆಯರ ಉಚಿತ ಪ್ರಯಾಣ ನಿಯಮಗಳು\n- ಕರ್ನಾಟಕದ ಜಿಲ್ಲೆಗಳು ಮತ್ತು ಗ್ರಾಮೀಣ ಗ್ರಾಮ ಸಾರಿಗೆ ಬಸ್‌ಗಳ ಲೈವ್ ಸ್ಥಿತಿ\n- ಬಸ್ ವರ್ಗಗಳು: ಇವಿ ಪವರ್ ಪ್ಲಸ್, ಐರಾವತ, ಅಂಬಾರಿ ಉತ್ಸವ, ರಾಜಹಂಸ\n- 24/7 ಅಧಿಕೃತ ಸಹಾಯವಾಣಿ: 080-49596666 / 080-26252625.`
        : `Welcome to **KSRTC Sahayaka AI Customer Care**!\n\nHere are the top services I can assist you with:\n- **Instant Refund Calculation** (10%/15%/25%/100% deduction rules)\n- **Shakti Scheme Eligibility** (Free travel for Karnataka women with photo ID)\n- **Live Bus Tracking & Running Status** across all 31 districts & rural villages\n- **Service Classes**: EV Power Plus, Airavat, Ambari Utsav Sleeper, Rajahamsa\n- **Luggage Policy**: 30 kg free per passenger\n- **24/7 Corporation Helplines**: 080-49596666 / 080-26252625.\n\n*Feel free to speak via microphone or ask any specific doubt!*`;
      actions.push({ actionType: 'refund_policy', label: lang === 'kn' ? 'ಮರುಪಾವತಿ ಕ್ಯಾಲ್ಕುಲೇಟರ್' : 'Refund Calculator' });
      actions.push({ actionType: 'navigate_search', label: lang === 'kn' ? 'ಬಸ್ ಹುಡುಕಿ' : 'Find Buses' });
    }

    return res.json({
      reply,
      suggestedActions: actions,
    });
  }
});

// Endpoint 2: Voice Recognition Place & Bus Finder Intent Parser
app.post('/api/ai/voice-intent', async (req, res) => {
  try {
    const { transcript, lang = 'en' } = req.body;

    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    if (!ai) {
      // Basic rule-based keyword extraction fallback
      const text = transcript.toLowerCase();
      let source = '';
      let destination = '';

      if (text.includes('to')) {
        const parts = text.split('to');
        source = parts[0].replace('from', '').replace('search', '').replace('bus', '').trim();
        destination = parts[1].replace('buses', '').replace('please', '').trim();
      }

      return res.json({
        intent: 'SEARCH_BUS',
        source: source || 'Bengaluru',
        destination: destination || 'Mysuru',
        explanation: `Voice query processed: "${transcript}". Searching buses between locations.`,
        action: {
          type: 'search',
          sourceName: source || 'Bengaluru',
          destName: destination || 'Mysuru',
        },
      });
    }

    const intentPrompt = `
Analyze the following voice speech transcript spoken by a passenger on the KSRTC Smart Bus app:
Transcript: "${transcript}"

Recognize the places (origin/source, destination), bus number, or question intent. Match locations to Karnataka cities/villages (e.g., Bengaluru, Mysuru, Mandya, Mangaluru, Hassan, Belagavi, Shivamogga, Dharmasthala, Halebidu, Shivalli, Udupi, Tumakuru, etc.).

Return a JSON object conforming to the response schema.
`;

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Voice intent timeout')), 8000)
    );

    const response = (await Promise.race([
      ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: intentPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              intent: {
                type: Type.STRING,
                description: 'One of: SEARCH_BUS, TRACK_BUS, REFUND_CALCULATOR, SHAKTI_SCHEME_INFO, GENERAL_FAQ',
              },
              sourceCity: {
                type: Type.STRING,
                description: 'Origin location extracted from voice (or empty if not mentioned)',
              },
              destinationCity: {
                type: Type.STRING,
                description: 'Destination location extracted from voice (or empty if not mentioned)',
              },
              busNumber: {
                type: Type.STRING,
                description: 'Bus or vehicle registration number if mentioned (e.g. KA-01-F-9420)',
              },
              humanSummary: {
                type: Type.STRING,
                description: 'Short 1-sentence friendly confirmation message to speak back to the user in ' + (lang === 'kn' ? 'Kannada' : 'English'),
              },
              actionType: {
                type: Type.STRING,
                description: 'Recommended UI action: "NAVIGATE_SEARCH", "NAVIGATE_TRACKING", "OPEN_REFUND", "ANSWER_ONLY"',
              },
            },
            required: ['intent', 'humanSummary', 'actionType'],
          },
        },
      }),
      timeoutPromise,
    ])) as any;

    const parsedData = JSON.parse(response.text || '{}');
    return res.json(parsedData);
  } catch (error: any) {
    console.warn('Voice intent AI upstream notice (handling gracefully):', error.message);
    const { transcript = '', lang = 'en' } = req.body || {};
    const text = transcript.toLowerCase();

    // Check for common Karnataka locations
    const knownPlaces = [
      'bengaluru', 'bangalore', 'mysuru', 'mysore', 'hubballi', 'hubli',
      'mangalore', 'mangaluru', 'belagavi', 'belgaum', 'shivamogga', 'shimoga',
      'hassan', 'davanagere', 'ballari', 'bellary', 'kalaburagi', 'gulbarga',
      'udupi', 'dharmasthala', 'madikeri', 'chikkamagaluru', 'tumakuru', 'mandya',
      'halebidu', 'shivalli'
    ];

    let foundPlaces: string[] = [];
    for (const place of knownPlaces) {
      if (text.includes(place)) {
        // Standardize common name
        const std = place === 'bangalore' ? 'Bengaluru' :
                    place === 'mysore' ? 'Mysuru' :
                    place === 'hubli' ? 'Hubballi' :
                    place === 'shimoga' ? 'Shivamogga' :
                    place === 'belgaum' ? 'Belagavi' :
                    place.charAt(0).toUpperCase() + place.slice(1);
        if (!foundPlaces.includes(std)) {
          foundPlaces.push(std);
        }
      }
    }

    const src = foundPlaces[0] || 'Bengaluru';
    const dest = foundPlaces[1] || (src === 'Bengaluru' ? 'Mysuru' : 'Bengaluru');

    return res.json({
      intent: 'SEARCH_BUS',
      source: src,
      destination: dest,
      busCategory: text.includes('airavat') ? 'Airavat Club Class' :
                   text.includes('ambari') ? 'Ambari Dream Class' :
                   text.includes('ev') || text.includes('electric') ? 'EV Power Plus' :
                   text.includes('rajahamsa') ? 'Rajahamsa Executive' : undefined,
      confidence: 0.92,
      humanSummary: lang === 'kn'
        ? `${src} ನಿಂದ ${dest} ಗೆ ಲಭ್ಯವಿರುವ ಬಸ್‌ಗಳನ್ನು ಹುಡುಕಲಾಗುತ್ತಿದೆ.`
        : `Searching scheduled buses from ${src} to ${dest}.`,
      actionType: 'NAVIGATE_SEARCH',
    });
  }
});

// Endpoint 3: Fast Available Bus & Schedule Recommendations
app.get('/api/buses/live-summary', (req, res) => {
  return res.json({
    totalBuses: INITIAL_LIVE_BUSES.length,
    activeRoutes: KSRTC_ROUTES.length,
    liveBuses: INITIAL_LIVE_BUSES,
    schedules: BUS_SCHEDULES,
  });
});

// Setup Vite development middleware or static production serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`KSRTC Smart Bus server running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server startup failed:', err);
});
