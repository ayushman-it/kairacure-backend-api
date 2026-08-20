import { Router } from 'express';
import { getAdminOperationRecordsForAi } from './admin.js';

const router = Router();

const siteContext = `
Kairacure — Patient-First International Medical Travel Platform

About Kairacure:
- Kairacure is India's leading medical travel coordination platform.
- We help patients from India and abroad plan their full medical journey: treatment discovery, hospital matching, doctor selection, cost estimation, visa & travel support, and post-treatment follow-up — all at no extra cost to the patient.
- Brand tagline: "Patient-first international care planning."
- Contact: care@kairacure.com | Delhi NCR, India

What Kairacure Does:
1. Free Second Opinion — connect patients with specialist doctors without extra charges.
2. Lowest Cost Guarantee — negotiated hospital and package rates passed on to the patient.
3. Dedicated Medical Expert — a care expert monitors progress and helps choose the right care.
4. Seamless Travel Planning — visa invitation, hotel, airport pickup, translators, and local support.
5. Transparent Pricing — all costs shown in Indian Rupees (INR) by default.

Who We Serve:
- Patients from India seeking specialist care in metro cities.
- International patients travelling to India for treatment.
- Medical tourists combining treatment with tourism or wellness.
- Partner doctors and hospitals wanting to reach verified patients.

Key Statistics:
- 100,000+ patient journeys benchmarked.
- 38+ destination countries tracked.
- 1,500+ hospital partners mapped.
- 48-hour medical opinion target.

Treatment Categories Available:
Cardiac Sciences, Orthopedics, Oncology, Neurosurgery, Ophthalmology, Gastroenterology,
Urology, Endocrinology, Aesthetic & Plastic Surgery, Dermatology, Dental, ENT,
Obstetrics & Gynecology, Pulmonology, Pediatrics, Wellness & Ayurveda, Infertility & IVF.

Top Hospital Cities in India:
Delhi NCR (New Delhi, Gurgaon, Noida), Mumbai, Bangalore, Chennai, Hyderabad,
Pune, Ahmedabad, Kolkata, Chandigarh, Jaipur, Kochi, Coimbatore.

Accreditations We Check:
JCI (Joint Commission International), NABH (National Accreditation Board for Hospitals),
ISO certifications, International Patient Wings with dedicated coordinators.

Patient Journey Steps:
1. Treatment Search — patient selects treatment from ICD-11 catalog.
2. Procedure Selection — specific ICD-11 procedure refinement.
3. Trip Style — Budget, Premium, Medical+Vacation, Wellness, Fast-Track, Family.
4. Hospital Selection — filtered by treatment, city, rating, accreditation.
5. Journey Planning — flight, hotel, stay duration, companion cost estimator.

How to Book:
- Submit an appointment form (no registration required).
- Register for a Patient Dashboard to track progress.
- Contact care coordinator at care@kairacure.com.
`;

function buildAdminContext(records) {
  const grouped = records.reduce((items, record) => {
    items[record.recordType] = items[record.recordType] || [];
    items[record.recordType].push(record);
    return items;
  }, {});

  const hospitalsContext = (grouped.hospital || []).slice(0, 15).map((record) => {
    const data = record.publicData || {};
    return `${data.name || record.title} (${data.city || 'city not set'}, ${data.state || data.country || 'India'}) — specialty: ${data.specialty || 'not set'}, treatments: ${data.treatments || 'not set'}, beds: ${data.beds || 'not set'}, package from INR ${data.packageFrom || 'not set'}, accreditations: ${data.accreditations || 'not set'}`;
  });

  const surgeryContext = (grouped.surgery || []).slice(0, 20).map((record) => {
    const data = record.publicData || {};
    return `${data.surgery || record.title} [${data.category || data.treatment || 'General'}] ICD/code: ${data.procedureCode || 'none'} — hospital cost INR ${data.hospitalCostInr || 'not set'}, Kairacure price INR ${data.medijourneyPriceInr || 'not set'}, at ${data.hospital || 'partner hospital'}`;
  });

  const treatmentContext = (grouped.treatment || []).slice(0, 20).map((record) => {
    const data = record.publicData || {};
    const code = data.icdCode || data.procedureCode || '';
    return `${data.group || data.category || 'Medical'} — ${data.title || record.title}${code ? ` (ICD-11: ${code})` : ''}, from INR ${data.packageFrom || 'TBD'}: ${(data.description || 'no description').slice(0, 80)}`;
  });

  const doctorContext = (grouped.doctor || []).slice(0, 12).map((record) => {
    const data = record.publicData || {};
    return `${data.doctorName || record.title} — ${data.specialty || 'specialty not set'}, ${data.experience || ''}, at ${data.hospital || 'partner hospital'}, rating ${data.rating || 'N/A'}`;
  });

  const inquiryContext = (grouped.inquiry || []).slice(0, 5).map((record) => {
    const data = record.publicData || {};
    return `${data.patientName || record.title} from ${data.country || 'unknown'} — interest: ${data.treatmentInterest || 'not set'}, status: ${record.status || 'new'}`;
  });

  const parts = [
    `Live data summary: hospitals ${grouped.hospital?.length || 0}, treatments ${grouped.treatment?.length || 0}, surgeries ${grouped.surgery?.length || 0}, doctors ${grouped.doctor?.length || 0}, inquiries ${grouped.inquiry?.length || 0}, appointments ${grouped.appointment?.length || 0}.`,
    hospitalsContext.length ? `Partner hospitals:\n${hospitalsContext.join('\n')}` : '',
    treatmentContext.length ? `ICD-11 treatment catalog:\n${treatmentContext.join('\n')}` : '',
    surgeryContext.length ? `Surgery costing:\n${surgeryContext.join('\n')}` : '',
    doctorContext.length ? `Doctors:\n${doctorContext.join('\n')}` : '',
    inquiryContext.length ? `Recent inquiries (for context only):\n${inquiryContext.join('\n')}` : '',
  ];

  return parts.filter(Boolean).join('\n\n');
}

const SYSTEM_PROMPT = `You are Kairacure's medical travel assistant — a knowledgeable, warm, and professional care navigator.

Your role:
- Help patients understand their treatment options, find the right Indian hospital and doctor, get a cost estimate in INR, and plan their medical journey.
- Use the live Kairacure admin database (provided below) as the primary source of truth for hospitals, treatments, surgery costs, and doctors.
- Never reveal confidential/internal fields (margins, contract notes, private phone numbers).
- Never provide a medical diagnosis. Frame all health information as general guidance and always recommend consulting a qualified doctor.

Reply style & Formatting Rules (CRITICAL):
- Reply in the same language the user writes in. Hindi → Hindi. English → English. Hinglish → natural Hinglish. Never randomly switch languages.
- Keep answers warm, practical, structured, and concise. Avoid technical medical jargon unless the user uses it.
- ALWAYS write each hospital recommendation on a new line starting with a dash bullet point (-). NEVER combine multiple hospital bullet points into a single text paragraph.
- Put a clear line break between different sections and hospital cards.
- DO NOT use markdown symbols like double asterisks (**), hashes (##, ###), or markdown headers in your response. Write clean text with clear line breaks.
- Always end patient-facing answers with a clear "Next Step" the user can take.

When a patient asks about a treatment or hospital, structure the answer clearly:
Here are the top hospitals for [Treatment]:

- Hospital Name (City)
  Accreditation: JCI / NABH Accredited
  Starting Package: INR X,XX,XXX

- Hospital Name (City)
  Accreditation: JCI / NABH Accredited
  Starting Package: INR X,XX,XXX

Next Steps: Share your medical reports to care@kairacure.com or click "Plan My Journey" to get a customized estimate.
Safety Note: This information is for educational guidance. Please consult a qualified physician.`;

export function formatAiReply(rawText = '') {
  let cleaned = String(rawText || '');
  // Strip ## or # headers at start of line
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');
  // Remove ** bold markers (e.g. **Title** -> Title)
  cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '$1');
  // Remove * italic markers
  cleaned = cleaned.replace(/\*(.*?)\*/g, '$1');
  // Remove __ underline markers
  cleaned = cleaned.replace(/__(.*?)__/g, '$1');
  // Convert inline " - " bullet points into clean newlines
  cleaned = cleaned.replace(/([^\n])\s+-\s+([A-Z0-9])/g, '$1\n- $2');
  // Clean up extra blank lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned.trim();
}

router.post('/', async (req, res, next) => {
  try {
    const message = String(req.body?.message || '').trim();
    const history = Array.isArray(req.body?.history) ? req.body.history : [];

    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }

    const groqKey = process.env.GROQ_API_KEY;
    const groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    const openRouterKey = process.env.OPENROUTER_API_KEY;

    if (!groqKey && !openRouterKey) {
      return res.status(503).json({ message: 'AI API Key is not configured' });
    }

    const adminRecords = await getAdminOperationRecordsForAi();
    const adminContext = buildAdminContext(adminRecords);

    // Build conversation history (last 8 messages max to stay within context)
    const conversationHistory = history.slice(-8).map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: String(msg.content || ''),
    }));

    let rawReply = '';

    // 1. Try Groq API first for lightning fast inference with multi-model fallbacks
    if (groqKey) {
      const groqModelsToTry = Array.from(new Set([
        process.env.GROQ_MODEL || 'llama-3.1-70b-versatile',
        'llama-3.1-70b-versatile',
        'llama3-70b-8192',
        'llama-3.1-8b-instant',
        'mixtral-8x7b-32768',
      ])).filter(Boolean);

      for (const currentModel of groqModelsToTry) {
        try {
          const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${groqKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: currentModel,
              messages: [
                {
                  role: 'system',
                  content: `${SYSTEM_PROMPT}\n\n--- Kairacure Platform Context ---\n${siteContext}\n\n--- Live Admin Database ---\n${adminContext}`,
                },
                ...conversationHistory,
                { role: 'user', content: message },
              ],
              temperature: 0.6,
              max_tokens: 1024,
            }),
          });

          const groqData = await groqResponse.json();
          if (groqResponse.ok && groqData.choices?.[0]?.message?.content) {
            rawReply = groqData.choices[0].message.content;
            break; // Success! Break model loop
          } else {
            console.warn(`Groq API model ${currentModel} failed:`, groqData?.error?.message || groqResponse.statusText);
          }
        } catch (err) {
          console.warn(`Groq API error on model ${currentModel}:`, err.message);
        }
      }
    }

    // 2. Fallback to OpenRouter if Groq didn't return a reply
    if (!rawReply && openRouterKey) {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.CLIENT_ORIGIN || 'http://localhost:5173',
          'X-Title': 'Kairacure Medical Travel Assistant',
        },
        body: JSON.stringify({
          model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `${SYSTEM_PROMPT}\n\n--- Kairacure Platform Context ---\n${siteContext}\n\n--- Live Admin Database ---\n${adminContext}`,
            },
            ...conversationHistory,
            { role: 'user', content: message },
          ],
        }),
      });

      const data = await response.json();
      if (response.ok && data.choices?.[0]?.message?.content) {
        rawReply = data.choices[0].message.content;
      }
    }

    if (!rawReply) {
      return res.status(500).json({ message: 'Failed to generate response from AI backend.' });
    }

    const finalReply = formatAiReply(rawReply);
    return res.json({ reply: finalReply });
  } catch (error) {
    next(error);
  }
});

export default router;

