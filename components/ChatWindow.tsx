
import React, { useEffect, useRef } from 'react';
import { Message as MessageType } from '../types';
import Message from './Message';
import { LoaderIcon } from './icons';

interface ChatWindowProps {
    messages: MessageType[];
    isLoading: boolean;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ messages, isLoading }) => {
    const endOfMessagesRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div className="flex-1 p-4 md:p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto space-y-6">
                {messages.map((msg, index) => (
                    <Message key={msg.id} message={msg} />
                ))}
                {isLoading && (
                    <div className="flex justify-center items-center p-4">
                        <div className="flex items-center space-x-2 text-slate-400">
                           <LoaderIcon className="animate-spin" />
                           <span>O'ylanmoqda...</span>
                        </div>
                    </div>
                )}
                <div ref={endOfMessagesRef} />
            </div>
        </div>
    );
};

export default ChatWindow;
