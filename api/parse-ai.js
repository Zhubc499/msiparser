import { HfInference } from "@huggingface/inference";

const hf = new HfInference(process.env.HUGGINGFACE_API_TOKEN);

export default async function handler(req, res) {
  // Langkah 4: Cek apakah ini permintaan "ping" dari cron job (metode GET)
  if (req.method === 'GET') {
    res.status(200).send('Pong! Keep-warm ping successful.');
    return;
  }
  
  // Jika bukan GET, lanjutkan dengan metode POST seperti biasa
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const { input } = req.body;

    const prompt = `[INST] <<SYS>>
    You are an expert data extraction assistant for a logistics company. Your task is to parse shipping cost text and convert it into a structured JSON array. Each object must have "item", "cost", "measurement", and "amount". Default "amount" to "1" if not specified. Default "measurement" to "/ITEM" if not found. Provide ONLY a valid JSON object as output with a single key "data" containing the array of items.
    <</SYS>>
    TEKS UNTUK DIPARSING:
    ${input} [/INST]`;

    const response = await hf.textGeneration({
      model: "NousResearch/Llama-2-7b-chat-hf",
      inputs: prompt,
      parameters: { max_new_tokens: 1024, return_full_text: false },
    });

    const rawText = response.generated_text;
    const startIndex = rawText.indexOf('{');
    const endIndex = rawText.lastIndexOf('}');
    
    if (startIndex === -1 || endIndex === -1) {
      throw new Error("AI did not return a valid JSON object.");
    }

    const cleanJsonText = rawText.substring(startIndex, endIndex + 1);
    const parsedData = JSON.parse(cleanJsonText);
    
    // Kirim respons sukses
    res.status(200).json({ success: true, data: parsedData.data });

  } catch (error) {
    // Kirim respons error
    res.status(500).json({ success: false, error: error.toString() });
  }
}
