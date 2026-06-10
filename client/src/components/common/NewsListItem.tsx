/**
 * NewsListItem component
 * Renders a single news article card with image, title, company, and publish time.
 */
import { Article } from "../../types";
import { formatDate } from "../../utils/formatters";

export interface NewsListItemProps {
    article: Article;
}

const NewsListItem = (props: NewsListItemProps) => {

    return (
        <div
            className="flex p-[15px] relative min-h-[80px] w-full items-start gap-4 transition-all duration-300 ease hover:scale-[1.025] hover:bg-black/5 dark:hover:bg-white/5 border-b border-border-main/10 last:border-0 cursor-pointer"
            onClick={() => props.article.link && window.open(props.article.link, "_blank", "noopener,noreferrer")}
        >
            <div className="flex-none w-[100px] h-[75px] overflow-hidden bg-background shrink-0">
                <img className="w-full h-full object-cover" src={props.article.image_link} alt={props.article.title || "News article decoration"} />
            </div>
            
            <div className="flex flex-col flex-1 justify-center items-center text-sm min-w-0 h-full text-center">
                <div className="font-bold text-text-main line-clamp-2 leading-snug mb-1">{props.article.title}</div>
                <div className="flex items-center justify-center gap-2 mt-auto text-xs text-text-main/60 font-medium">
                    <span className="text-primary truncate max-w-[120px]">{props.article.news_company}</span>
                    <span>•</span>
                    <span>{formatDate(props.article.time_published)}</span>
                </div>
            </div>
        </div>
    );
}

export default NewsListItem;