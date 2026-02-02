import React from 'react';
import './AlphaBotResponseCard.css';
import Card from './Card';

export interface AlphaBotResponseCardProps {
    isLoading: boolean;
    title?: string;
    children: React.ReactNode;
}

export const AlphaBotResponseCard: React.FC<AlphaBotResponseCardProps> = (props) => {
    return (
        <Card title={props.title} className="alpha-bot-card">
            {props.isLoading ?
            ( <div>
            <span className='alpha-bot-spinner'></span>
             <p>AlphaBot is analysing current market conditions...</p>
             </div>) : props.children}
        </Card>
    )

}