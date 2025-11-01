import React, { useState, useRef, useCallback } from 'react';
import { Tool, Attachment } from '../types';
import { SendIcon, PaperclipIcon, MicIcon, SquareIcon, WandIcon, VideoIcon, ImageIcon, SearchIcon } from './icons';
import { fileToBase64 } from '../utils/fileUtils';

interface ComposerProps {
    onSendMessage: (prompt: string, attachments: Attachment[], tool: Tool) => void;
    isLoading: boolean;
    isRecording: boolean;
    onToggleRecording: () => void;
}

const Composer: React.FC<ComposerProps> = ({ onSendMessage, isLoading, isRecording, onToggleRecording }) => {
    const [prompt, setPrompt] = useState('');
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [activeTool, setActiveTool] = useState<Tool>(Tool.CHAT);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSend = () => {
        if ((prompt.trim() || attachments.length > 0) && !isLoading) {
            onSendMessage(prompt, attachments, activeTool);
            setPrompt('');
            setAttachments([]);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };
    
    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const base64Data = await fileToBase64(file);
            let type: 'image' | 'video' | 'audio' = 'image';
            if (file.type.startsWith('video/')) type = 'video';
            if (file.type.startsWith('audio/')) type = 'audio';

            setAttachments([{ type, data: base64Data, mimeType: file.type }]);
            
            // Automatically switch tool based on file type
            if (type === 'image') setActiveTool(Tool.IMAGE_ANALYSIS);
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSend();
        }
    };
    
    // FIX: Replaced JSX.Element with React.ReactElement to resolve the "Cannot find namespace 'JSX'" error.
    const getToolInfo = (tool: Tool): { icon: React.ReactElement, label: string, placeholder: string } => {
        switch (tool) {
            case Tool.WEB_SEARCH:
                return { icon: <SearchIcon />, label: "Veb Qidiruv", placeholder: "Parij Olimpiadasidagi so'nggi yangiliklar..." };
            case Tool.IMAGE_GENERATION:
                return { icon: <WandIcon />, label: "Rasm Generatsiyasi", placeholder: "O'rgimchak odamning fotorealistik portreti..." };
            case Tool.VIDEO_GENERATION:
                return { icon: <VideoIcon />, label: "Video Generatsiyasi", placeholder: "Rasmga prompt qo'shing..." };
            case Tool.IMAGE_ANALYSIS:
                return { icon: <ImageIcon />, label: "Rasm Tahlili", placeholder: "Ushbu rasmni tasvirlab bering..." };
            default:
                return { icon: <SendIcon />, label: "Suhbat", placeholder: "Xabar yozing..." };
        }
    };

    const toolInfo = getToolInfo(activeTool);

    return (
        <div className="flex-shrink-0 p-4 bg-slate-800/50 border-t border-slate-700/50">
            <div className="max-w-4xl mx-auto">
                 {attachments.length > 0 && (
                    <div className="mb-2 flex items-center gap-2">
                        {attachments.map((att, index) => (
                            <div key={index} className="relative bg-slate-700 p-1 rounded-lg">
                                <img src={att.data} alt="attachment preview" className="h-16 w-16 object-cover rounded" />
                                <button
                                    onClick={() => setAttachments(attachments.filter((_, i) => i !== index))}
                                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full h-5 w-5 text-xs flex items-center justify-center"
                                >
                                    &times;
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                <div className="relative flex items-center bg-slate-700 rounded-xl p-2">
                    <div className="flex items-center">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 text-slate-400 hover:text-white transition-colors"
                            aria-label="Fayl biriktirish"
                        >
                            <PaperclipIcon />
                        </button>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*"/>

                        <button
                            onClick={onToggleRecording}
                            className={`p-2 transition-colors ${isRecording ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-white'}`}
                            aria-label={isRecording ? "Yozishni to'xtatish" : "Ovozli yozish"}
                        >
                            {isRecording ? <SquareIcon /> : <MicIcon />}
                        </button>
                    </div>

                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={toolInfo.placeholder}
                        rows={1}
                        className="flex-1 bg-transparent resize-none outline-none px-3 text-slate-200 placeholder-slate-500"
                        style={{ maxHeight: '100px' }}
                    />
                    
                    <div className="flex items-center space-x-2">
                        <div className="group relative">
                             <button className="p-2 text-slate-400 hover:text-white transition-colors" aria-label="Asbobni tanlang">
                                {getToolInfo(activeTool).icon}
                            </button>
                            <div className="absolute bottom-full right-0 mb-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto z-10">
                                {[Tool.CHAT, Tool.WEB_SEARCH, Tool.IMAGE_GENERATION, Tool.VIDEO_GENERATION].map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setActiveTool(t)}
                                        className={`w-full text-left px-3 py-2 flex items-center space-x-2 text-sm ${activeTool === t ? 'bg-blue-600/30 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
                                    >
                                        {getToolInfo(t).icon}
                                        <span>{getToolInfo(t).label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={handleSend}
                            disabled={isLoading}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white p-2.5 rounded-lg transition-colors"
                            aria-label="Yuborish"
                        >
                            <SendIcon />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Composer;