import React, { useState } from 'react';
import { marked } from 'marked';
import { Message as MessageType } from '../types';
import { UserIcon, BotIcon, VideoIcon, CopyIcon, CheckIcon } from './icons';

interface MessageProps {
    message: MessageType;
}

const Message: React.FC<MessageProps> = ({ message }) => {
    const { role, content, attachments, sources } = message;
    const isUser = role === 'user';
    const [isCopied, setIsCopied] = useState(false);

    const handleCopy = () => {
        if (!content) return;
        navigator.clipboard.writeText(content).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    };

    const createMarkup = (text: string) => {
        return { __html: marked(text, { breaks: true, gfm: true }) };
    };

    const isVideoStatus = !isUser && content.startsWith("Video generatsiya");

    return (
        <div className={`flex items-start space-x-4 ${isUser ? 'justify-end' : ''}`}>
            {!isUser && (
                 <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                    <BotIcon className="w-5 h-5" />
                </div>
            )}
            <div className={`relative group w-full max-w-2xl px-5 py-4 rounded-2xl ${isUser ? 'bg-blue-600 rounded-br-none' : 'bg-slate-700/80 rounded-bl-none'}`}>
                {!isUser && content && !isVideoStatus && (
                    <button
                        onClick={handleCopy}
                        className="absolute top-2 right-2 p-1.5 bg-slate-600/50 rounded-md text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-500/50 hover:text-white"
                        aria-label="Nusxa olish"
                    >
                        {isCopied ? <CheckIcon className="w-4 h-4 text-green-400" /> : <CopyIcon className="w-4 h-4" />}
                    </button>
                )}

                {isVideoStatus ? (
                    <div className="flex items-center space-x-3 text-slate-300">
                        <VideoIcon className="w-5 h-5 flex-shrink-0 text-cyan-400 animate-pulse" />
                        <span>{content}</span>
                    </div>
                ) : content && (
                    <div
                        className="prose prose-invert prose-p:text-slate-300 prose-headings:text-slate-100 prose-strong:text-slate-100 prose-a:text-cyan-400"
                        dangerouslySetInnerHTML={createMarkup(content)}
                    />
                )}
                
                {attachments && attachments.length > 0 && (
                    <div className="mt-4 grid gap-4 grid-cols-1 sm:grid-cols-2">
                        {attachments.map((att, index) => (
                            <div key={index} className="rounded-lg overflow-hidden border border-slate-600">
                                {att.type === 'image' && <img src={att.data} alt="generated content" className="w-full h-auto object-cover" />}
                                {att.type === 'video' && <video src={att.data} controls className="w-full h-auto" />}
                            </div>
                        ))}
                    </div>
                )}

                {sources && sources.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-600/50">
                        <h4 className="text-xs font-semibold text-slate-400 mb-2">Manbalar:</h4>
                        <div className="flex flex-wrap gap-2">
                            {sources.map((source, index) => (
                                <a
                                    key={source.id}
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-slate-600 hover:bg-slate-500 text-slate-200 text-xs font-mono py-1 px-2 rounded-full transition-colors"
                                >
                                    [{index + 1}]
                                </a>
                            ))}
                        </div>
                    </div>
                )}
            </div>
             {isUser && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center">
                    <UserIcon className="w-5 h-5" />
                </div>
            )}
        </div>
    );
};

export default Message;