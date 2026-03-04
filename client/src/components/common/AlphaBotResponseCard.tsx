import React from 'react';
import Card from './Card';

export interface AlphaBotResponseCardProps {
    isLoading: boolean;
    title?: string;
    children: React.ReactNode;
    classNamePrefix?: string;
}

/**
 * AlphaBotResponseCard Component
 * 
 * A specialized wrapper around the standard `Card` component used specifically 
 * to display outputs from the AlphaBot LLM. It built-in logic to show a themed 
 * loading spinner and waiting message while `isLoading` is true.
 */
export const AlphaBotResponseCard: React.FC<AlphaBotResponseCardProps> = (props) => {
    return (
        <Card title={props.title} className={`${props.classNamePrefix ? props.classNamePrefix : ""} overflow-y-auto [scrollbar-color:var(--scrollbar-color)]`}>
            {props.isLoading ?
            ( <div>
            <span className='alpha-bot-spinner'></span>
                <p>AlphaBot is analysing current market conditions... 
                    <br />
                    May take up to two minutes.
                </p>
             </div>) : props.children}
        </Card>
    )

}