/**
 * NewsListItem component
 * Renders a single news article card with image, title, company, and publish time.
 */
import { useState } from "react";
import { Article } from "../../types";
import { formatDate } from "../../utils/formatters";

export interface NewsListItemProps {
    article: Article;
}

const NewsListItem = (props: NewsListItemProps) => {
    const [imgFailed, setImgFailed] = useState(false);
    const imageSrc = props.article.image_link?.trim();
    const showImage = Boolean(imageSrc) && !imgFailed;

    return (
        <div
            className="flex p-3 relative min-h-[80px] w-full items-start gap-4 rounded-xl transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--primary-green)_10%,transparent)] border-b border-[var(--tg-hairline)] last:border-0 cursor-pointer"
            onClick={() => props.article.link && window.open(props.article.link, "_blank", "noopener,noreferrer")}
        >
            <div className="flex-none w-[100px] h-[75px] overflow-hidden rounded-lg bg-black/20 shrink-0 shadow-[inset_0_0_0_1px_var(--tg-hairline)]">
                {showImage ? (
                    <img
                        className="w-full h-full object-cover"
                        src={imageSrc}
                        alt={props.article.title || "News article decoration"}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={() => setImgFailed(true)}
                    />
                ) : (
                    <div className="w-full h-full bg-border-main/10" aria-hidden="true" />
                )}
            </div>
            
            <div className="flex-col flex-1 justify-center items-start text-sm min-w-0 h-full text-left flex">
                <div className="font-semibold text-text-main line-clamp-2 leading-snug mb-1">{props.article.title}</div>
                <div className="flex items-center gap-2 mt-auto font-mono text-[11px] text-text-main/50">
                    <span className="text-ink-up uppercase truncate max-w-[140px]">{props.article.news_company}</span>
                    <span>•</span>
                    <span>{formatDate(props.article.time_published)}</span>
                </div>
            </div>
        </div>
    );
}

export default NewsListItem;
