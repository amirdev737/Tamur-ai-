
import React from 'react';
import { Source } from '../types';
import { LinkIcon } from './icons';

interface SourcesPanelProps {
    sources: Source[];
}

const SourcesPanel: React.FC<SourcesPanelProps> = ({ sources }) => {
    return (
        <aside className="h-full bg-slate-800/30 p-2 flex flex-col">
            <h2 className="text-lg font-semibold text-slate-300 p-2 mb-2">Manbalar</h2>
            <div className="flex-1 overflow-y-auto">
                {sources.length === 0 ? (
                    <div className="text-center text-slate-500 p-4">
                        <p>Hozircha manbalar yo'q.</p>
                    </div>
                ) : (
                    <ul className="space-y-3">
                        {sources.map((source, index) => (
                            <li key={source.id} className="bg-slate-700/50 p-3 rounded-lg border border-slate-600/50">
                                <a
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-start space-x-3 group"
                                >
                                    <span className="text-slate-400 font-mono text-sm pt-1">[{index + 1}]</span>
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-slate-200 group-hover:text-cyan-400 transition-colors duration-200 line-clamp-2">
                                            {source.title}
                                        </h3>
                                        <p className="text-xs text-cyan-500 truncate">{new URL(source.url).hostname}</p>
                                    </div>
                                    <LinkIcon className="text-slate-500 group-hover:text-cyan-400 transition-colors duration-200" />
                                </a>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </aside>
    );
};

export default SourcesPanel;
