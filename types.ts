
// Fix: Removed VideoGenerationOperation from @google/genai import as it is no longer exported.
import { Chat, GroundingChunk } from "@google/genai";

// Fix: Define VideoGenerationOperation interface as it's no longer exported from @google/genai.
export interface VideoGenerationOperation {
    // FIX: Made the 'done' property optional to align with the Gemini SDK's operation type, resolving a type mismatch.
    done?: boolean;
    progress?: {
        progress?: number;
    };
    error?: {
        message: string;
    };
    response?: {
        generatedVideos?: {
            video?: {
                uri?: string;
            };
        }[];
    };
}

// Fix: Define LiveSession interface as it's no longer exported from @google/genai.
export interface LiveSession {
  close: () => void;
  sendRealtimeInput: (input: { media: { data: string; mimeType: string; } }) => void;
}

export interface Attachment {
    type: 'image' | 'video' | 'audio';
    data: string; // base64 or URL
    mimeType: string;
}

export interface Source {
    id: string;
    url: string;
    title: string;
    snippet: string;
}

export interface Message {
    id: string;
    role: 'user' | 'model';
    content: string;
    attachments: Attachment[];
    sources: Source[];
}

export interface ChatSession {
    id: string;
    title: string;
    messages: Message[];
    chat: Chat | null;
}

export enum Tool {
    CHAT = 'CHAT',
    WEB_SEARCH = 'WEB_SEARCH',
    IMAGE_GENERATION = 'IMAGE_GENERATION',
    VIDEO_GENERATION = 'VIDEO_GENERATION',
    IMAGE_ANALYSIS = 'IMAGE_ANALYSIS',
}

export type VideoOperation = VideoGenerationOperation;