
import React from 'react';
import { BotIcon, PlusIcon } from './icons';

interface HeaderProps {
    onNewChat: () => void;
}

const Header: React.FC<HeaderProps> = ({ onNewChat }) => {
    return (
        <header className="flex-shrink-0 flex items-center justify-between p-2 md:p-4 border-b border-slate-700/50">
            <div className="flex items-center space-x-3">
                <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-2 rounded-lg">
                   <BotIcon/>
                </div>
                <h1 className="text-xl font-bold text-slate-200 hidden md:block">Tamur AI</h1>
            </div>
            <button
                onClick={onNewChat}
                className="flex items-center space-x-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold py-2 px-4 rounded-lg transition duration-200"
            >
                <PlusIcon/>
                <span className="hidden md:inline">Yangi suhbat</span>
            </button>
        </header>
    );
};

export default Header;
