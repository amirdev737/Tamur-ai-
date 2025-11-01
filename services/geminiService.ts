// Fix: Removed LiveSession from @google/genai import as it's no longer exported.
import { GoogleGenAI, Chat, GenerateContentResponse, Modality } from "@google/genai";
// Fix: Import LiveSession from local types file.
import { Tool, VideoOperation, LiveSession } from '../types';
import { fileToBase64 } from '../utils/fileUtils';
import { encode, decode, decodeAudioData } from '../utils/audioUtils';

// This is a placeholder for the API key. In a real app, use a secure method.
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export const sendMessageStream = async (prompt: string, existingChat: Chat | null, tool: Tool) => {
    const useWebSearch = tool === Tool.WEB_SEARCH;
    
    const chat = existingChat || ai.chats.create({ 
        model: 'gemini-2.5-flash',
        config: {
            tools: useWebSearch ? [{ googleSearch: {} }] : [],
        },
    });

    const stream = await chat.sendMessageStream({ message: prompt });
    return { stream, chatInstance: chat };
};

export const generateTitle = async (prompt: string): Promise<string> => {
    if (!prompt) return '';
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Quyidagi so'rov uchun 3-5 so'zdan iborat qisqa sarlavha yarating. Faqat sarlavhani o'zini qaytaring, qo'shtirnoqlarsiz: "${prompt}"`,
        });
        return response.text.trim().replace(/"/g, ''); // Clean up quotes and extra whitespace
    } catch (error) {
        console.error("Failed to generate title:", error);
        return "Suhbat"; // Fallback title
    }
};

export const generateImage = async (prompt: string) => {
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio: '1:1',
        },
    });

    return response.generatedImages.map(img => ({
        url: `data:image/jpeg;base64,${img.image.imageBytes}`,
        altText: prompt
    }));
};

export const analyzeImage = async (prompt: string, base64Data: string, mimeType: string): Promise<string> => {
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [
                {
                    inlineData: {
                        mimeType: mimeType,
                        data: base64Data,
                    },
                },
                {
                    text: prompt
                }
            ]
        },
    });
    return response.text;
};

const pollVideoOperation = async (operation: VideoOperation, callback: (status: string, videoUrl?: string) => void): Promise<string> => {
    // FIX: Use 'any' type for the polling operation to avoid conflicts with the SDK's internal, unexported operation type.
    let currentOperation: any = operation;
    while (!currentOperation.done) {
        callback(`Video generatsiya qilinmoqda... (${Math.round((currentOperation.progress?.progress || 0) * 100)}%)`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        const newAi = new GoogleGenAI({ apiKey: API_KEY }); // Re-init to get latest key
        currentOperation = await newAi.operations.getVideosOperation({ operation: currentOperation });
    }

    if (currentOperation.error) {
        throw new Error(`Video generation failed: ${currentOperation.error.message}`);
    }

    const downloadLink = currentOperation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
        throw new Error("Video generation completed but no download link found.");
    }
    
    const videoResponse = await fetch(`${downloadLink}&key=${API_KEY}`);
    const videoBlob = await videoResponse.blob();
    const videoUrl = URL.createObjectURL(videoBlob);
    
    callback("Video tayyor!", videoUrl);
    return videoUrl;
};

export const generateVideo = async (prompt: string, imageBase64: string, callback: (status: string, videoUrl?: string) => void) => {
    // Veo requires API key selection
    // @ts-ignore
    const hasApiKey = await window.aistudio?.hasSelectedApiKey();
    if (!hasApiKey) {
        // @ts-ignore
        await window.aistudio?.openSelectKey();
    }
    
    const newAi = new GoogleGenAI({ apiKey: API_KEY }); // Use new instance with selected key

    let operation = await newAi.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        image: {
            imageBytes: imageBase64,
            mimeType: 'image/jpeg', // Veo often prefers jpeg
        },
        config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: '16:9'
        }
    });

    return pollVideoOperation(operation, callback);
};

// --- Live Conversation ---
export const startLiveConversation = async (
    onMessage: (text: string, isFinal: boolean) => void,
    onError: (error: Error) => void
): Promise<{ session: LiveSession, audioContext: AudioContext, gainNode: GainNode }> => {
    const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const outputNode = outputAudioContext.createGain();
    outputNode.connect(outputAudioContext.destination);
    let nextStartTime = 0;
    const sources = new Set<AudioBufferSourceNode>();

    let currentInputTranscription = '';
    let currentOutputTranscription = '';

    const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
            onopen: async () => {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    const inputAudioContext = new AudioContext({ sampleRate: 16000 });
                    const source = inputAudioContext.createMediaStreamSource(stream);
                    const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                    
                    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const l = inputData.length;
                        const int16 = new Int16Array(l);
                        for (let i = 0; i < l; i++) {
                            int16[i] = inputData[i] * 32768;
                        }
                        const pcmBlob = {
                            data: encode(new Uint8Array(int16.buffer)),
                            mimeType: 'audio/pcm;rate=16000',
                        };

                        sessionPromise.then((session) => {
                            session.sendRealtimeInput({ media: pcmBlob });
                        }).catch(onError);
                    };
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(inputAudioContext.destination);
                } catch(err) {
                    onError(err as Error);
                }
            },
            onmessage: async (message) => {
                if (message.serverContent?.outputTranscription) {
                    currentOutputTranscription += message.serverContent.outputTranscription.text;
                    onMessage(currentOutputTranscription, false);
                } else if (message.serverContent?.inputTranscription) {
                    currentInputTranscription += message.serverContent.inputTranscription.text;
                }

                if (message.serverContent?.turnComplete) {
                    onMessage(currentOutputTranscription, true);
                    currentInputTranscription = '';
                    currentOutputTranscription = '';
                }

                const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                if (base64Audio) {
                    nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
                    const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext, 24000, 1);
                    const sourceNode = outputAudioContext.createBufferSource();
                    sourceNode.buffer = audioBuffer;
                    sourceNode.connect(outputNode);
                    sourceNode.addEventListener('ended', () => { sources.delete(sourceNode); });
                    sourceNode.start(nextStartTime);
                    nextStartTime += audioBuffer.duration;
                    sources.add(sourceNode);
                }

                if (message.serverContent?.interrupted) {
                    for (const source of sources.values()) {
                        source.stop();
                        sources.delete(source);
                    }
                    nextStartTime = 0;
                }
            },
            onerror: (e) => onError(new Error(e.type)),
            onclose: () => console.log('Live session closed'),
        },
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
            outputAudioTranscription: {},
            inputAudioTranscription: {},
        },
    });

    const session = await sessionPromise;
    return { session, audioContext: outputAudioContext, gainNode: outputNode };
};

export const closeLiveConversation = (session: LiveSession, audioContext: AudioContext | null) => {
    session.close();
    audioContext?.close().catch(console.error);
};