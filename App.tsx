import React, { useState, useCallback, useEffect, useRef } from 'react';
// Fix: Removed LiveSession from @google/genai import as it's no longer exported.
import { GoogleGenAI, GenerateContentResponse, Chat, GroundingChunk } from "@google/genai";
// Fix: Import LiveSession from local types file.
import { ChatSession, Message, Source, Tool, Attachment, LiveSession } from './types';
import Header from './components/Header';
import ChatHistoryPanel from './components/ChatHistoryPanel';
import ChatWindow from './components/ChatWindow';
import SourcesPanel from './components/SourcesPanel';
import Composer from './components/Composer';
import { sendMessageStream, generateImage, analyzeImage, generateVideo, startLiveConversation, closeLiveConversation, generateTitle } from './services/geminiService';
import { MenuIcon, XIcon } from './components/icons';

const App: React.FC = () => {
    const [chats, setChats] = useState<ChatSession[]>(() => {
        try {
            const savedChats = localStorage.getItem('tamur-chats');
            if (savedChats) {
                // When loading, omit the non-serializable 'chat' instance
                return JSON.parse(savedChats).map((c: Omit<ChatSession, 'chat'>) => ({...c, chat: null}));
            }
        } catch (error) {
            console.error("Failed to load chats from localStorage", error);
        }
        return [];
    });

    const [activeChatId, setActiveChatId] = useState<string | null>(() => {
        return localStorage.getItem('tamur-activeChatId');
    });

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isStreaming, setIsStreaming] = useState<boolean>(false);
    const [currentSources, setCurrentSources] = useState<Source[]>([]);
    const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState<boolean>(true);
    const [isRightSidebarOpen, setIsRightSidebarOpen] = useState<boolean>(true);

    const [isRecording, setIsRecording] = useState<boolean>(false);
    const liveSessionRef = useRef<LiveSession | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const gainNodeRef = useRef<GainNode | null>(null);

    const activeChat = chats.find(c => c.id === activeChatId);
    
    useEffect(() => {
        // Create a default chat session on initial load if none exist
        if (chats.length === 0) {
            handleNewChat();
        } else if (!activeChatId && chats.length > 0) {
            // If there's no active chat id, default to the first one
            setActiveChatId(chats[0].id);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Persist chats to localStorage
    useEffect(() => {
        try {
            // Omit the non-serializable 'chat' instance before saving
            const serializableChats = chats.map(({ chat, ...rest }) => rest);
            localStorage.setItem('tamur-chats', JSON.stringify(serializableChats));
        } catch (error) {
            console.error("Failed to save chats to localStorage", error);
        }
    }, [chats]);

    // Persist active chat ID to localStorage
    useEffect(() => {
        if (activeChatId) {
            localStorage.setItem('tamur-activeChatId', activeChatId);
        } else {
            localStorage.removeItem('tamur-activeChatId');
        }
    }, [activeChatId]);


    const handleNewChat = () => {
        const newChat: ChatSession = {
            id: `chat-${Date.now()}`,
            title: 'Yangi suhbat',
            messages: [{
                id: `msg-${Date.now()}`,
                role: 'model',
                content: "Salom! Men Tamur, sizning universal yordamchingizman. Qanday yordam bera olaman?",
                attachments: [],
                sources: [],
            }],
            chat: null
        };
        setChats(prev => [newChat, ...prev]);
        setActiveChatId(newChat.id);
        setCurrentSources([]);
    };

    const handleDeleteChat = (chatIdToDelete: string) => {
        const remainingChats = chats.filter(c => c.id !== chatIdToDelete);
        setChats(remainingChats);

        if (activeChatId === chatIdToDelete) {
            if (remainingChats.length > 0) {
                setActiveChatId(remainingChats[0].id);
            } else {
                handleNewChat(); // Create a new one if all are deleted
            }
        }
    };


    const updateMessages = useCallback((chatId: string, messages: Message[]) => {
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages } : c));
    }, []);

    const updateChatInstance = useCallback((chatId: string, chatInstance: Chat) => {
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, chat: chatInstance } : c));
    }, []);

    const updateChatTitle = useCallback((chatId: string, title: string) => {
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, title } : c));
    }, []);


    const handleSendMessage = async (prompt: string, attachments: Attachment[], tool: Tool) => {
        if (!activeChatId || !activeChat) return;

        // Auto-generate title for the first user message in a new chat
        if (activeChat.messages.length === 1 && activeChat.title === 'Yangi suhbat') {
            generateTitle(prompt).then(title => {
                if (title) updateChatTitle(activeChatId, title);
            }).catch(console.error); // Don't block the main flow
        }

        setIsLoading(true);
        setCurrentSources([]);

        const userMessage: Message = {
            id: `msg-${Date.now()}`,
            role: 'user',
            content: prompt,
            attachments,
            sources: []
        };

        const modelResponseId = `msg-${Date.now() + 1}`;
        const modelResponsePlaceholder: Message = {
            id: modelResponseId,
            role: 'model',
            content: '',
            attachments: [],
            sources: []
        };

        updateMessages(activeChatId, [...activeChat.messages, userMessage, modelResponsePlaceholder]);
        
        const updateModelMessage = (updates: Partial<Message>) => {
            setChats(prev => prev.map(c => {
                if (c.id === activeChatId) {
                    const newMessages = c.messages.map(m => 
                        m.id === modelResponseId ? { ...m, ...updates } : m
                    );
                    return { ...c, messages: newMessages };
                }
                return c;
            }));
        };

        try {
            if (tool === Tool.CHAT || tool === Tool.WEB_SEARCH) {
                setIsStreaming(true);
                const { stream, chatInstance } = await sendMessageStream(prompt, activeChat.chat, tool);
                if (activeChat.chat !== chatInstance) {
                    updateChatInstance(activeChatId, chatInstance);
                }
                
                let fullResponse = '';
                let sources: Source[] = [];
                for await (const chunk of stream) {
                    fullResponse += chunk.text;
                    
                    if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
                        const newSources = (chunk.candidates[0].groundingMetadata.groundingChunks as GroundingChunk[])
                            .map((gc: any, index: number) => ({
                                id: `src-${index}-${Date.now()}`,
                                url: gc.web?.uri || gc.maps?.uri || '#',
                                title: gc.web?.title || gc.maps?.title || 'Manba',
                                snippet: ''
                            }));
                        sources = newSources;
                        setCurrentSources(newSources);
                    }
                    updateModelMessage({ content: fullResponse, sources });
                }
            } else if (tool === Tool.IMAGE_GENERATION) {
                const imageResult = await generateImage(prompt);
                const imageAttachments = imageResult.map(img => ({ type: 'image' as const, data: img.url, mimeType: 'image/jpeg' }));
                updateModelMessage({ attachments: imageAttachments, content: `"${prompt}" uchun rasm tayyor.` });
            } else if (tool === Tool.VIDEO_GENERATION) {
                const videoAttachment = attachments.find(a => a.type === 'image');
                if (!videoAttachment) {
                    updateModelMessage({ content: "Video generatsiya qilish uchun rasm yuklang." });
                    setIsLoading(false);
                    return;
                }
                updateModelMessage({ content: "Video generatsiyasi boshlandi. Bu bir necha daqiqa vaqt olishi mumkin..." });

                await generateVideo(prompt, videoAttachment.data, (status, videoUrl) => {
                    const currentAttachments = activeChat.messages.find(m => m.id === modelResponseId)?.attachments || [];
                    const updates: Partial<Message> = { content: status };
                    if (videoUrl) {
                        updates.content = "Video tayyor!";
                        updates.attachments = [...currentAttachments, { type: 'video', data: videoUrl, mimeType: 'video/mp4' }];
                    }
                    updateModelMessage(updates);
                });
            } else if (tool === Tool.IMAGE_ANALYSIS) {
                const imageToAnalyze = attachments.find(a => a.type === 'image');
                if (!imageToAnalyze) {
                    updateModelMessage({ content: "Rasm tahlili uchun rasm yuklang." });
                    setIsLoading(false);
                    return;
                }
                const analysisResult = await analyzeImage(prompt, imageToAnalyze.data, imageToAnalyze.mimeType);
                updateModelMessage({ content: analysisResult });
            }
        } catch (error) {
            console.error("Gemini API call failed:", error);
            updateModelMessage({ content: "Xatolik yuz berdi. Iltimos, keyinroq qayta urinib ko'ring." });
        } finally {
            setIsLoading(false);
            setIsStreaming(false);
        }
    };
    
    const handleToggleRecording = useCallback(async () => {
        if (isRecording) {
            // Stop recording
            setIsRecording(false);
            if (liveSessionRef.current) {
                closeLiveConversation(liveSessionRef.current, audioContextRef.current);
                liveSessionRef.current = null;
            }
        } else {
            // Start recording
            if (!activeChatId || !activeChat) return;
            setIsRecording(true);

            const userMessage: Message = {
                id: `msg-${Date.now()}`,
                role: 'user',
                content: '[Ovozli suhbat boshlandi]',
                attachments: [],
                sources: []
            };
            
            const modelResponseId = `msg-${Date.now() + 1}`;
            const modelResponsePlaceholder: Message = {
                id: modelResponseId,
                role: 'model',
                content: '[Mikrofon tinglanmoqda...]',
                attachments: [],
                sources: []
            };

            updateMessages(activeChatId, [...activeChat.messages, userMessage, modelResponsePlaceholder]);

            const updateModelMessage = (updates: Partial<Message>) => {
                setChats(prev => prev.map(c => {
                    if (c.id === activeChatId) {
                        const newMessages = c.messages.map(m => 
                            m.id === modelResponseId ? { ...m, ...updates } : m
                        );
                        return { ...c, messages: newMessages };
                    }
                    return c;
                }));
            };

            const onMessage = (text: string, isFinal: boolean) => {
                updateModelMessage({ content: text || "..." });
            };

            const onError = (error: Error) => {
                console.error("Live conversation error:", error);
                updateModelMessage({ content: `Ovozli suhbatda xatolik: ${error.message}` });
                setIsRecording(false);
            };

            try {
                const { session, audioContext, gainNode } = await startLiveConversation(onMessage, onError);
                liveSessionRef.current = session;
                audioContextRef.current = audioContext;
                gainNodeRef.current = gainNode;
            } catch (error) {
                console.error("Failed to start live conversation:", error);
                onError(error as Error);
            }
        }
    }, [isRecording, activeChat, activeChatId, updateMessages]);


    return (
        <div className="h-screen w-screen bg-slate-900 flex flex-col font-sans">
            <Header onNewChat={handleNewChat} />
            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar */}
                <div className={`transition-all duration-300 ${isLeftSidebarOpen ? 'w-64' : 'w-0'} hidden md:block overflow-hidden`}>
                    <ChatHistoryPanel
                        chats={chats}
                        activeChatId={activeChatId}
                        setActiveChatId={setActiveChatId}
                        onDeleteChat={handleDeleteChat}
                    />
                </div>
                
                {/* Main Content */}
                <main className="flex-1 flex flex-col bg-slate-800/50 rounded-lg m-2 border border-slate-700/50 overflow-hidden">
                    <div className="flex-shrink-0 p-2 border-b border-slate-700/50 flex items-center justify-between md:hidden">
                        <button onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)} className="p-2 rounded-md hover:bg-slate-700">
                           {isLeftSidebarOpen ? <XIcon/> : <MenuIcon/>}
                        </button>
                         <h1 className="text-lg font-semibold text-center truncate px-2">{activeChat?.title || 'Tamur'}</h1>
                        <button onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)} className="p-2 rounded-md hover:bg-slate-700">
                            {isRightSidebarOpen ? <XIcon/> : <MenuIcon/>}
                        </button>
                    </div>

                    <ChatWindow messages={activeChat?.messages || []} isLoading={isLoading && !isStreaming} />
                    <Composer
                        onSendMessage={handleSendMessage}
                        isLoading={isLoading}
                        isRecording={isRecording}
                        onToggleRecording={handleToggleRecording}
                    />
                </main>

                {/* Right Sidebar */}
                <div className={`transition-all duration-300 ${isRightSidebarOpen ? 'w-72' : 'w-0'} hidden md:block overflow-hidden`}>
                   <SourcesPanel sources={currentSources} />
                </div>
                 {/* Mobile Sidebars */}
                <div className={`fixed top-16 left-2 bottom-2 z-20 bg-slate-800 rounded-lg border border-slate-700 md:hidden transition-transform duration-300 ${isLeftSidebarOpen ? 'translate-x-0' : '-translate-x-full'} w-64`}>
                    <ChatHistoryPanel chats={chats} activeChatId={activeChatId} onDeleteChat={handleDeleteChat} setActiveChatId={(id) => {setActiveChatId(id); setIsLeftSidebarOpen(false);}} />
                </div>
                <div className={`fixed top-16 right-2 bottom-2 z-20 bg-slate-800 rounded-lg border border-slate-700 md:hidden transition-transform duration-300 ${isRightSidebarOpen ? 'translate-x-0' : 'translate-x-full'} w-72`}>
                    <SourcesPanel sources={currentSources} />
                </div>

            </div>
        </div>
    );
};

export default App;