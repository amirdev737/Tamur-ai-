import React from 'react';
import { ChatSession } from '../types';
import { MessageSquareIcon, TrashIcon } from './icons';

interface ChatHistoryPanelProps {
    chats: ChatSession[];
    activeChatId: string | null;
    setActiveChatId: (id: string) => void;
    onDeleteChat: (id: string) => void;
}

const ChatHistoryPanel: React.FC<ChatHistoryPanelProps> = ({ chats, activeChatId, setActiveChatId, onDeleteChat }) => {
    
    const handleDelete = (e: React.MouseEvent, chatId: string) => {
        e.stopPropagation(); // Prevent chat selection when deleting
        if (window.confirm("Haqiqatan ham bu suhbatni o'chirmoqchimisiz?")) {
            onDeleteChat(chatId);
        }
    };
    
    return (
        <aside className="h-full bg-slate-800/30 p-2 flex flex-col">
            <h2 className="text-lg font-semibold text-slate-300 p-2 mb-2">Suhbatlar tarixi</h2>
            <div className="flex-1 overflow-y-auto">
                <nav className="flex flex-col space-y-1">
                    {chats.map(chat => (
                        <button
                            key={chat.id}
                            onClick={() => setActiveChatId(chat.id)}
                            className={`group flex items-center justify-between space-x-3 p-3 rounded-lg text-left text-sm transition-colors duration-200 w-full ${
                                activeChatId === chat.id
                                    ? 'bg-blue-600/30 text-white'
                                    : 'text-slate-400 hover:bg-slate-700/50'
                            }`}
                        >
                            <div className="flex items-center space-x-3 overflow-hidden">
                                <MessageSquareIcon className="flex-shrink-0" />
                                <span className="truncate flex-1">{chat.title}</span>
                            </div>
                            <span onClick={(e) => handleDelete(e, chat.id)} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity">
                                <TrashIcon className="w-4 h-4" />
                            </span>
                        </button>
                    ))}
                </nav>
            </div>
        </aside>
    );
};

export default ChatHistoryPanel;