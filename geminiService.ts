
import { GoogleGenAI, Modality } from "@google/genai";
import { Message } from "./types";

const SYSTEM_INSTRUCTION = `
Você é a Aura, uma conselheira emocional e amiga próxima. 
Seu objetivo é melhorar a vida, as emoções e o bem-estar do usuário.
Diretrizes:
1. Empatia Profunda: Valide sempre os sentimentos do usuário.
2. Sabedoria Prática: Ofereça soluções acionáveis, não apenas clichês.
3. Educadora: Ensine conceitos de inteligência emocional, psicologia positiva e mindfulness de forma leve.
4. Linguagem: Use um tom caloroso, amigável e informal (em Português do Brasil).
5. Interatividade: Faça perguntas para entender melhor a situação.
6. Limites: Se o usuário demonstrar risco de autoagressão, recomende ajuda profissional e linhas de apoio (CVV 188 no Brasil).
`;

export const getAuraResponseStream = async (userMessage: string, history: Message[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  const contents = history.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));

  contents.push({
    role: 'user',
    parts: [{ text: userMessage }]
  });

  try {
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.8,
        topP: 0.95,
      }
    });

    return responseStream;
  } catch (error) {
    console.error("Gemini Stream Error:", error);
    throw error;
  }
};

export const getAuraSpeech = async (text: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Diga de forma carinhosa e natural: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
    console.error("Speech Generation Error:", error);
    return null;
  }
};
